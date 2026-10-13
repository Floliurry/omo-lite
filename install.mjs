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

	// The marketplace list may register other plugins too: only our entry is replaced.
	const marketplaceFile = join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
	const listed = existsSync(marketplaceFile) ? readJson(marketplaceFile) : { name: marketplace, plugins: [] };
	if (listed === null || !Array.isArray(listed.plugins)) {
		log(`skip marketplace entry: ${marketplaceFile} is not a plugin list this installer can read; add ${plugin} with path ./${plugin}/${version} yourself`);
	} else {
		act(`write marketplace entry ${marketplaceFile}`, () => {
			mkdirSync(dirname(marketplaceFile), { recursive: true });
			const entry = { name: plugin, source: { source: "local", path: `./${plugin}/${version}` } };
			const plugins = [...listed.plugins.filter((other) => other?.name !== plugin), entry];
			writeFileSync(marketplaceFile, `${JSON.stringify({ ...listed, plugins }, null, "\t")}\n`);
		});
	}

	const configPath = join(codexHome, "config.toml");
	const before = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
	const agentsDir = join(codexHome, "agents");
	const shipped = readdirSync(join(sourceRoot, "agents")).filter((file) => file.endsWith(".toml")).sort();
	const roles = shipped.filter((role) => {
		if (!isForeignRole(before, role)) return true;
		log(`skip role ${role}: config.toml registers [agents.${basename(role, ".toml")}] elsewhere`);
		return false;
	});
	// The manifest lists the role files the last install wrote. Only those this plugin no longer
	// ships are removed: a role skipped above may be the file the user's own entry points at, and a
	// removed role that config.toml still registers in the user's own way is kept.
	const previous = readJson(join(agentsDir, AGENTS_MANIFEST))?.agents ?? [];
	const staleRoles = previous.filter((role) => !shipped.includes(role)).filter((role) => {
		if (!isForeignRole(before, role)) return true;
		log(`keep ${join(agentsDir, role)}: this plugin no longer ships it, but config.toml registers [agents.${basename(role, ".toml")}] in its own way`);
		return false;
	});
	act(`copy ${roles.length} agent roles -> ${agentsDir}`, () => {
		mkdirSync(agentsDir, { recursive: true });
		for (const role of roles) copyFileSync(join(sourceRoot, "agents", role), join(agentsDir, role));
		for (const stale of staleRoles) rmSync(join(agentsDir, stale), { force: true });
		writeFileSync(join(agentsDir, AGENTS_MANIFEST), `${JSON.stringify({ agents: roles }, null, "\t")}\n`);
	});

	installCommand({ binDir, pluginRoot, marketplaceRoot, act, log });

	const instructionsFile = instructionsSetting(before, marketplaceRoot, join(pluginRoot, INSTRUCTIONS_FILE), log);
	const after = updateConfig(before, { marketplace, marketplaceRoot, plugin, roles, staleRoles, instructionsFile, multiAgent: multiAgentTexts(sourceRoot), log });
	if (after !== before) {
		act(`update ${configPath} (backup: config.toml.bak-omo-lite)`, () => {
			if (before !== "") writeFileSync(`${configPath}.bak-omo-lite`, before);
			writeFileSync(configPath, after);
		});
	}
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
// A value the installer cannot read counts as theirs too.
function instructionsSetting(config, marketplaceRoot, ours, log) {
	const current = rootValue(config, "model_instructions_file");
	if (current === null) return ours;
	if (current.text !== null && current.text.startsWith(marketplaceRoot)) return ours;
	log(`skip model_instructions_file: config.toml already sets it to ${current.text ?? current.raw}`);
	return null;
}

// Codex injects its own multi-agent texts: one says not to spawn unless asked, the role texts say
// every agent is equally capable. Ours replace them; an empty mode text drops that block. Codex
// reads these as config strings, so the text itself goes into config.toml.
function multiAgentTexts(sourceRoot) {
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

// Each group of keys is written whole or not at all. A group whose table or keys config.toml
// writes in a form this editor does not handle (dotted keys, an inline table, a multi-line value)
// is left as it is and reported, since rewriting it could break the file.
export function updateConfig(config, { marketplace, marketplaceRoot, plugin, roles, staleRoles = [], instructionsFile = null, multiAgent = null, log = () => {} }) {
	let next = config;
	const group = (what, entries) => {
		let draft = next;
		for (const [header, key, value] of entries) {
			const result = header === null ? setRootKey(draft, key, value) : setKey(draft, header, key, value);
			if (result.conflict !== undefined) {
				log(`skip ${what}: ${result.conflict}; set ${header === null ? key : `${header}.${key}`} there yourself`);
				return;
			}
			draft = result.config;
		}
		next = draft;
	};
	if (instructionsFile !== null) group("model_instructions_file", [[null, "model_instructions_file", JSON.stringify(instructionsFile)]]);
	group("features", ["plugins", "plugin_hooks", "multi_agent"].map((key) => ["features", key, "true"]));
	if (multiAgent !== null) {
		group("multi-agent texts", [
			["features.multi_agent_v2", "root_agent_usage_hint_text", JSON.stringify(multiAgent.root)],
			["features.multi_agent_v2", "subagent_usage_hint_text", JSON.stringify(multiAgent.subagent)],
			["features.multi_agent_v2", "multi_agent_mode_hint_text", '""'],
		]);
	}
	const marketplaceHeader = `marketplaces.${marketplace}`;
	group("marketplace", [
		[marketplaceHeader, "source_type", '"local"'],
		[marketplaceHeader, "source", JSON.stringify(marketplaceRoot)],
	]);
	const pluginHeader = `plugins.${JSON.stringify(`${plugin}@${marketplace}`)}`;
	group("plugin", [[pluginHeader, "enabled", "true"]]);
	// The previous installer switched on the bundled context7 server once; keep any later user choice.
	const context7 = `${pluginHeader}.mcp_servers.context7`;
	if (findSection(next, context7) === null) group("context7", [[context7, "enabled", "true"]]);
	for (const role of roles) group(`role ${role}`, [[`agents.${basename(role, ".toml")}`, "config_file", JSON.stringify(`./agents/${role}`)]]);
	// A role this plugin no longer ships loses the registration the installer wrote for it.
	for (const role of staleRoles) next = removeOwnRole(next, role);
	return next;
}

// ---- Minimal TOML editing ----
// Only what the installer writes: string, boolean and number values on one line, under [table]
// headers. Anything else in the way is reported as a conflict instead of being rewritten.

const SINGLE_LINE_VALUE = /^(?:"(?:[^"\\]|\\.)*"|'[^']*'|true|false|[-+]?[0-9][0-9_.eE+-]*)[ \t]*(?:#.*)?$/;

// Replace `key = ...` inside [header], or add it. Returns { config } or { conflict }.
function setKey(config, header, key, value) {
	const line = `${key} = ${value}`;
	const section = findSection(config, header);
	if (section === null) {
		const elsewhere = definedOutsideHeader(config, header);
		if (elsewhere !== null) return { conflict: elsewhere };
		return { config: `${config.replace(/\s*$/, "")}${config.trim() === "" ? "" : "\n\n"}[${header}]\n${line}\n` };
	}
	const found = keyLine(section.text, key);
	let text;
	if (found === null) text = section.text.replace(/^(.*\n)/, (headerLine) => `${headerLine}${line}\n`);
	else if (!SINGLE_LINE_VALUE.test(found.value)) return { conflict: `config.toml gives ${key} under [${header}] a value spanning several lines` };
	// Replacer functions, so a `$` in the value is not read as a replacement pattern.
	else text = section.text.replace(found.pattern, () => line);
	return { config: config.slice(0, section.start) + text + config.slice(section.end) };
}

// Root keys sit before the first table. A new one goes at the very top, which is always root.
function setRootKey(config, key, value) {
	const line = `${key} = ${value}`;
	const root = rootOf(config);
	const found = keyLine(root, key);
	if (found === null) return { config: `${line}\n${config}` };
	if (!SINGLE_LINE_VALUE.test(found.value)) return { conflict: `config.toml gives ${key} a value spanning several lines` };
	return { config: root.replace(found.pattern, () => line) + config.slice(root.length) };
}

// The value of a root string key: { text, raw }, with text null when it is not a one-line string.
function rootValue(config, key) {
	const found = keyLine(rootOf(config), key);
	if (found === null) return null;
	const raw = found.value.replace(/[ \t]*#.*$/, "");
	if (/^"(?:[^"\\]|\\.)*"$/.test(raw)) return { text: JSON.parse(raw), raw };
	if (/^'[^']*'$/.test(raw)) return { text: raw.slice(1, -1), raw };
	return { text: null, raw };
}

// The line setting `key` in a table's text, whether the key is bare or quoted.
function keyLine(text, key) {
	const pattern = new RegExp(`^[ \\t]*${keyForm(key)}[ \\t]*=[ \\t]*(.*)$`, "m");
	const match = pattern.exec(text);
	return match === null ? null : { pattern, value: match[1] };
}

// Where a table is created other than by its own [header], so a new header would redefine it: a
// dotted key that runs through it (`multi_agent_v2.enabled = true` under [features]) or a value
// set on it or a parent (`multi_agent_v2 = true`, `features = { ... }`). Returns a description or null.
function definedOutsideHeader(config, header) {
	const parts = headerParts(header);
	for (let depth = 0; depth < parts.length; depth += 1) {
		const text = depth === 0 ? rootOf(config) : findSection(config, joinHeader(parts.slice(0, depth)))?.text.replace(/^.*\n/, "");
		if (text === undefined) continue;
		const where = depth === 0 ? "at the top level" : `under [${joinHeader(parts.slice(0, depth))}]`;
		for (let end = depth + 1; end <= parts.length; end += 1) {
			const path = parts.slice(depth, end).map(keyForm).join("[ \\t]*\\.[ \\t]*");
			if (new RegExp(`^[ \\t]*${path}[ \\t]*=`, "m").test(text)) return `config.toml sets ${parts.slice(depth, end).join(".")} to a value ${where}, so [${header}] cannot be added`;
			if (end === parts.length && new RegExp(`^[ \\t]*${path}[ \\t]*\\.`, "m").test(text)) return `config.toml defines [${header}] with dotted keys ${where}`;
		}
	}
	return null;
}

// A key segment as TOML may write it: bare, "double-quoted" or 'single-quoted'.
function keyForm(key) {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const jsonEscaped = JSON.stringify(key).slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return /^[A-Za-z0-9_-]+$/.test(key) ? `(?:${escaped}|"${escaped}"|'${escaped}')` : `(?:"${jsonEscaped}"|'${escaped}')`;
}

// The keys of a [header], with quotes removed: plugins."omo@x".mcp_servers -> plugins, omo@x, mcp_servers.
function headerParts(header) {
	const parts = [];
	const pattern = /\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+))\s*(?:\.|$)/y;
	let match;
	while (pattern.lastIndex < header.length && (match = pattern.exec(header)) !== null) {
		parts.push(match[1] !== undefined ? JSON.parse(`"${match[1]}"`) : (match[2] ?? match[3]));
	}
	return parts;
}

function joinHeader(parts) {
	return parts.map((part) => (/^[A-Za-z0-9_-]+$/.test(part) ? part : JSON.stringify(part))).join(".");
}

function rootOf(config) {
	const firstHeader = config.search(/^[ \t]*\[/m);
	return firstHeader === -1 ? config : config.slice(0, firstHeader);
}

function findSection(config, header) {
	const wanted = headerParts(header).join("\u0000");
	const headerPattern = /^[ \t]*\[([^\[\]]+)\][ \t]*(?:#.*)?$/gm;
	let match;
	let start = -1;
	while ((match = headerPattern.exec(config)) !== null) {
		if (start !== -1) return { start, end: match.index, text: config.slice(start, match.index) };
		if (headerParts(match[1]).join("\u0000") === wanted) start = match.index;
	}
	if (start === -1) return null;
	const text = config.slice(start);
	return { start, end: config.length, text: text.endsWith("\n") ? text : `${text}\n` };
}

// Removes [agents.<role>] when it holds only the config_file line the installer wrote.
function removeOwnRole(config, role) {
	const section = findSection(config, `agents.${basename(role, ".toml")}`);
	if (section === null) return config;
	const body = section.text.replace(/^.*\n/, "").split("\n").filter((line) => line.trim() !== "");
	if (body.length !== 1 || body[0].trim() !== `config_file = ${JSON.stringify(`./agents/${role}`)}`) return config;
	return (config.slice(0, section.start) + config.slice(section.end)).replace(/\n{3,}/g, "\n\n");
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
