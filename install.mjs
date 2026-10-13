#!/usr/bin/env node
// Installs this plugin into Codex: copy it into the plugin cache, write the marketplace entry that
// points at the copy, enable it in config.toml, point Codex at our base instructions and our
// multi-agent texts, copy the agent roles (overwriting our own) and put the `omo` command on PATH. Lists the hooks Codex will
// skip until the user trusts them.
//
//   node install.mjs [--codex-home <dir>] [--bin-dir <dir>] [--marketplace <name>] [--dry-run]
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkUpstream, describeResult } from "./instructions/check-upstream.mjs";

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));
// Same identity as the previous OMO install, so this plugin replaces it instead of running beside it.
const DEFAULT_MARKETPLACE = "sisyphuslabs";
const NOT_SHIPPED = new Set(["test", "install.mjs", ".git", ".claude", "node_modules"]);
const AGENTS_MANIFEST = ".omo-lite-agents.json";
const INSTRUCTIONS_FILE = join("instructions", "codex-base.md");
const MULTI_AGENT_ROOT_FILE = join("instructions", "multi-agent-root.md");
const MULTI_AGENT_SUBAGENT_FILE = join("instructions", "multi-agent-subagent.md");
const COMMAND_MARKER = "# omo-lite:";
const HOOKS_FILE = join("hooks", "hooks.json");
// Events whose hooks may return additionalContext; Codex drops additionalContextLimit elsewhere.
const CONTEXT_EVENTS = new Set(["pre_tool_use", "post_tool_use", "session_start", "user_prompt_submit", "subagent_start"]);
const DEFAULT_CONTEXT_LIMIT = 2500;

export function install({ codexHome, binDir = join(homedir(), ".local", "bin"), marketplace = DEFAULT_MARKETPLACE, sourceRoot = SOURCE_ROOT, dryRun = false, log = console.log }) {
	const manifest = JSON.parse(readFileSync(join(sourceRoot, ".codex-plugin", "plugin.json"), "utf8"));
	const { name: plugin, version } = manifest;
	if (!/^[A-Za-z0-9._-]+$/.test(plugin) || !/^[A-Za-z0-9._+-]+$/.test(version)) throw new Error("plugin.json needs a plain name and version");
	const marketplaceRoot = join(codexHome, "plugins", "cache", marketplace);
	const pluginRoot = join(marketplaceRoot, plugin, version);
	const act = (message, fn) => {
		log(`${dryRun ? "[dry-run] " : ""}${message}`);
		if (!dryRun) fn();
	};

	act(`copy plugin -> ${pluginRoot}`, () => {
		const staging = `${pluginRoot}.staging-${process.pid}`;
		rmSync(staging, { recursive: true, force: true });
		mkdirSync(dirname(staging), { recursive: true });
		cpSync(sourceRoot, staging, {
			recursive: true,
			filter: (path) => !relative(sourceRoot, path).split(sep).some((part) => NOT_SHIPPED.has(part) || part === "__pycache__"),
		});
		rmSync(pluginRoot, { recursive: true, force: true });
		renameSync(staging, pluginRoot);
	});
	for (const other of listDirs(join(marketplaceRoot, plugin)).filter((entry) => entry !== version)) {
		act(`remove old version ${join(marketplaceRoot, plugin, other)}`, () => rmSync(join(marketplaceRoot, plugin, other), { recursive: true, force: true }));
	}

	const marketplaceFile = join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
	act(`write marketplace entry ${marketplaceFile}`, () => {
		mkdirSync(dirname(marketplaceFile), { recursive: true });
		const entry = { name: marketplace, plugins: [{ name: plugin, source: { source: "local", path: `./${plugin}/${version}` } }] };
		writeFileSync(marketplaceFile, `${JSON.stringify(entry, null, "\t")}\n`);
	});

	const configPath = join(codexHome, "config.toml");
	const before = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
	const agentsDir = join(codexHome, "agents");
	const roles = readdirSync(join(sourceRoot, "agents"))
		.filter((file) => file.endsWith(".toml"))
		.filter((role) => {
			if (!isForeignRole(before, role)) return true;
			log(`skip role ${role}: config.toml registers [agents.${basename(role, ".toml")}] elsewhere`);
			return false;
		})
		.sort();
	const previous = readJson(join(agentsDir, AGENTS_MANIFEST))?.agents ?? [];
	act(`copy ${roles.length} agent roles -> ${agentsDir}`, () => {
		mkdirSync(agentsDir, { recursive: true });
		for (const role of roles) copyFileSync(join(sourceRoot, "agents", role), join(agentsDir, role));
		for (const stale of previous.filter((role) => !roles.includes(role))) rmSync(join(agentsDir, stale), { force: true });
		writeFileSync(join(agentsDir, AGENTS_MANIFEST), `${JSON.stringify({ agents: roles }, null, "\t")}\n`);
	});

	installCommand({ binDir, pluginRoot, marketplaceRoot, act, log });

	const multiAgent = multiAgentSetting(before, sourceRoot, log);
	const after = updateConfig(before, { marketplace, marketplaceRoot, plugin, roles, instructionsFile: instructionsSetting(before, marketplaceRoot, join(pluginRoot, INSTRUCTIONS_FILE), log), multiAgent });
	if (after !== before) {
		act(`update ${configPath} (backup: config.toml.bak-omo-lite)`, () => {
			if (before !== "") writeFileSync(`${configPath}.bak-omo-lite`, before);
			writeFileSync(configPath, after);
		});
	}
	if (/^\s*features\s*[.=]/m.test(before)) log("config.toml sets features with dotted keys; enable plugins, plugin_hooks and multi_agent there yourself");
	const pending = untrustedHooks(after, readJson(join(sourceRoot, HOOKS_FILE)) ?? {}, `${plugin}@${marketplace}`);
	if (pending.length > 0) {
		log(`${pending.length} hook${pending.length > 1 ? "s are" : " is"} new or changed, and Codex skips ${pending.length > 1 ? "them" : "it"} until trusted. The IDE does not ask: run codex in a terminal and review /hooks.`);
		for (const hook of pending) log(`  ${hook.event}${hook.matcher === null ? "" : ` ${hook.matcher}`}: ${hook.script} (${hook.status})`);
	}
	log(describeResult(checkUpstream({ codexHome, instructionsDir: join(sourceRoot, "instructions") })));
	return { pluginRoot, marketplaceFile, configPath };
}

// Codex runs a plugin hook only while config.toml holds the hash of its current definition as
// trusted_hash. The hash follows hook_hash in Codex's hooks/src/engine/discovery.rs: the event, the
// group's matcher and the normalized handler as canonical JSON, then sha256.
export function untrustedHooks(config, hooksJson, pluginId) {
	const pending = [];
	for (const [event, groups] of Object.entries(hooksJson.hooks ?? {})) {
		const label = event.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
		groups.forEach((group, groupIndex) => {
			(group.hooks ?? []).forEach((handler, handlerIndex) => {
				const key = `${pluginId}:${HOOKS_FILE.split(sep).join("/")}:${label}:${groupIndex}:${handlerIndex}`;
				const state = findSection(config, `hooks.state.${JSON.stringify(key)}`)?.text ?? "";
				if (/^[ \t]*enabled[ \t]*=[ \t]*false/m.test(state)) return;
				const trusted = /^[ \t]*trusted_hash[ \t]*=[ \t]*"([^"]*)"/m.exec(state)?.[1] ?? null;
				if (trusted === hookHash(label, group.matcher, handler)) return;
				const script = /([\w.-]+\.mjs)/.exec(handler.command ?? "")?.[1] ?? handler.command;
				pending.push({ key, event, matcher: group.matcher ?? null, script, status: trusted === null ? "untrusted" : "changed" });
			});
		});
	}
	return pending;
}

function hookHash(label, matcher, handler) {
	const normalized = { type: "command", command: handler.command, timeout: Math.max(1, handler.timeout ?? 600), async: handler.async ?? false };
	if (handler.statusMessage !== undefined) normalized.statusMessage = handler.statusMessage;
	const limit = handler.additionalContextLimit;
	if (limit !== undefined && limit !== DEFAULT_CONTEXT_LIMIT && CONTEXT_EVENTS.has(label)) normalized.additionalContextLimit = limit;
	const identity = { event_name: label, hooks: [normalized] };
	if (matcher !== undefined) identity.matcher = matcher;
	return `sha256:${createHash("sha256").update(JSON.stringify(canonical(identity))).digest("hex")}`;
}

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

// `omo` is a small shell script that runs tools/omo.mjs from the installed version. A file named
// omo that we did not write is left alone. Links into our plugin cache whose target is gone, left
// by an older install, are removed.
function installCommand({ binDir, pluginRoot, marketplaceRoot, act, log }) {
	if (process.platform === "win32") {
		log("skip omo command: the wrapper is a POSIX shell script");
		return;
	}
	const target = join(binDir, "omo");
	if (pathExists(target) && !readText(target).includes(COMMAND_MARKER)) {
		log(`skip omo command: ${target} exists and was not written by omo-lite`);
	} else {
		act(`write omo command -> ${target}`, () => {
			mkdirSync(binDir, { recursive: true });
			writeFileSync(target, commandScript(join(pluginRoot, "tools", "omo.mjs")));
			chmodSync(target, 0o755);
		});
	}
	for (const link of staleLinks(binDir, marketplaceRoot)) act(`remove stale link ${link}`, () => rmSync(link, { force: true }));
	if (!(process.env.PATH ?? "").split(delimiter).includes(binDir)) log(`note: ${binDir} is not on PATH here; Codex finds omo only if it is on the PATH of its shell`);
}

export function commandScript(toolPath) {
	return `#!/bin/sh\n${COMMAND_MARKER} runs the installed omo tool; install.mjs rewrites this file.\nexec node '${toolPath.replace(/'/g, "'\\''")}' "$@"\n`;
}

function staleLinks(binDir, marketplaceRoot) {
	let entries;
	try {
		entries = readdirSync(binDir, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isSymbolicLink())
		.map((entry) => join(binDir, entry.name))
		.filter((link) => {
			const target = resolve(binDir, readlinkSync(link));
			return target.startsWith(`${marketplaceRoot}${sep}`) && !existsSync(target);
		});
}

function pathExists(path) {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}

function readText(path) {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "";
	}
}

// A model_instructions_file the user points elsewhere is theirs; ours lives under our marketplace root.
function instructionsSetting(config, marketplaceRoot, ours, log) {
	const current = rootString(config, "model_instructions_file");
	if (current === null || current.startsWith(marketplaceRoot)) return ours;
	log(`skip model_instructions_file: config.toml already points it at ${current}`);
	return null;
}

function rootString(config, key) {
	const match = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*"((?:[^"\\\\]|\\\\.)*)"`, "m").exec(rootOf(config));
	return match === null ? null : JSON.parse(`"${match[1]}"`);
}

// Codex injects its own multi-agent texts: one says not to spawn unless asked, the role texts say
// every agent is equally capable. Ours replace them; an empty mode text drops that block. Codex
// reads these as config strings, so the text itself goes into config.toml.
function multiAgentSetting(config, sourceRoot, log) {
	const features = findSection(config, "features");
	if (features !== null && /^[ \t]*multi_agent_v2[ \t]*=/m.test(features.text)) {
		log("skip multi-agent texts: config.toml sets features.multi_agent_v2 as a flag; make it a [features.multi_agent_v2] table to use them");
		return null;
	}
	const table = findSection(config, "features.multi_agent_v2");
	if (table !== null && /^[ \t]*(root_agent_usage_hint_text|subagent_usage_hint_text|multi_agent_mode_hint_text)[ \t]*=[ \t]*("""|''')/m.test(table.text)) {
		log("skip multi-agent texts: config.toml holds multi-line values for them; remove those to use ours");
		return null;
	}
	return {
		root: readFileSync(join(sourceRoot, MULTI_AGENT_ROOT_FILE), "utf8").trim(),
		subagent: readFileSync(join(sourceRoot, MULTI_AGENT_SUBAGENT_FILE), "utf8").trim(),
	};
}

// A role whose [agents.<name>] already points at another file belongs to the user; leave it alone.
function isForeignRole(config, role) {
	const section = findSection(config, `agents.${basename(role, ".toml")}`);
	return section !== null && !section.text.includes(`config_file = ${JSON.stringify(`./agents/${role}`)}`);
}

export function updateConfig(config, { marketplace, marketplaceRoot, plugin, roles, instructionsFile = null, multiAgent = null }) {
	let next = config;
	if (instructionsFile !== null) next = setRootKey(next, "model_instructions_file", JSON.stringify(instructionsFile));
	if (!/^\s*features\s*[.=]/m.test(next)) {
		for (const key of ["plugins", "plugin_hooks", "multi_agent"]) next = setKey(next, "features", key, "true");
	}
	if (multiAgent !== null) {
		next = setKey(next, "features.multi_agent_v2", "root_agent_usage_hint_text", JSON.stringify(multiAgent.root));
		next = setKey(next, "features.multi_agent_v2", "subagent_usage_hint_text", JSON.stringify(multiAgent.subagent));
		next = setKey(next, "features.multi_agent_v2", "multi_agent_mode_hint_text", '""');
	}
	const marketplaceHeader = `marketplaces.${marketplace}`;
	next = setKey(next, marketplaceHeader, "source_type", '"local"');
	next = setKey(next, marketplaceHeader, "source", JSON.stringify(marketplaceRoot));
	next = setKey(next, `plugins.${JSON.stringify(`${plugin}@${marketplace}`)}`, "enabled", "true");
	// The previous installer switched on the bundled context7 server once; keep any later user choice.
	const context7 = `plugins.${JSON.stringify(`${plugin}@${marketplace}`)}.mcp_servers.context7`;
	if (findSection(next, context7) === null) next = setKey(next, context7, "enabled", "true");
	for (const role of roles) next = setKey(next, `agents.${basename(role, ".toml")}`, "config_file", JSON.stringify(`./agents/${role}`));
	return next;
}

// Minimal TOML table editing: replace `key = ...` inside [header], or add it.
function setKey(config, header, key, value) {
	const line = `${key} = ${value}`;
	const section = findSection(config, header);
	if (section === null) return `${config.replace(/\s*$/, "")}${config.trim() === "" ? "" : "\n\n"}[${header}]\n${line}\n`;
	const keyPattern = new RegExp(`^[ \\t]*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*=.*$`, "m");
	// Replacer functions, so a `$` in the value is not read as a replacement pattern.
	const text = keyPattern.test(section.text) ? section.text.replace(keyPattern, () => line) : section.text.replace(/^(.*\n)/, (header) => `${header}${line}\n`);
	return config.slice(0, section.start) + text + config.slice(section.end);
}

// Root keys sit before the first table. A new one goes at the very top, which is always root.
function setRootKey(config, key, value) {
	const line = `${key} = ${value}`;
	const root = rootOf(config);
	const keyPattern = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");
	if (keyPattern.test(root)) return root.replace(keyPattern, line) + config.slice(root.length);
	return `${line}\n${config}`;
}

function rootOf(config) {
	const firstHeader = config.search(/^[ \t]*\[/m);
	return firstHeader === -1 ? config : config.slice(0, firstHeader);
}

function findSection(config, header) {
	const headerPattern = /^[ \t]*\[([^\[\]]+)\][ \t]*(?:#.*)?$/gm;
	let match;
	let start = -1;
	while ((match = headerPattern.exec(config)) !== null) {
		if (start !== -1) return { start, end: match.index, text: config.slice(start, match.index) };
		if (normalizeHeader(match[1]) === normalizeHeader(header)) start = match.index;
	}
	if (start === -1) return null;
	const text = config.slice(start);
	return { start, end: config.length, text: text.endsWith("\n") ? text : `${text}\n` };
}

function normalizeHeader(header) {
	return header.replace(/\s*\.\s*/g, ".").trim();
}

function listDirs(path) {
	try {
		return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.includes(".staging-")).map((entry) => entry.name);
	} catch {
		return [];
	}
}

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function parseArgs(argv) {
	const options = { codexHome: process.env.CODEX_HOME || join(homedir(), ".codex") };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") options.dryRun = true;
		else if (arg === "--codex-home") options.codexHome = resolve(argv[++index]);
		else if (arg === "--bin-dir") options.binDir = resolve(argv[++index]);
		else if (arg === "--marketplace") options.marketplace = argv[++index];
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const result = install(parseArgs(process.argv.slice(2)));
	console.log(`done: ${result.pluginRoot}`);
}
