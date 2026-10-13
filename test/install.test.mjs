import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { commandScript, install, untrustedHooks } from "../install.mjs";
import { checkUpstream } from "../instructions/check-upstream.mjs";
import { afterEach, beforeEach, describe, it } from "./expect.mjs";

const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUR_BASE = readFileSync(join(SOURCE_ROOT, "instructions", "codex-base.md"), "utf8");

let tempRoot;
let codexHome;

describe("install base instructions", () => {
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "omo-install-"));
		codexHome = join(tempRoot, "codex");
		mkdirSync(codexHome);
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it("#given no model_instructions_file #when installing twice #then the first root line points at the installed base and the second run changes nothing", () => {
		writeFileSync(configPath(), 'service_tier = "priority"\ndeveloper_instructions = """\nkeep me\n"""\n\n[features]\nplugins = true\n');

		const { pluginRoot } = runInstall();
		const once = readFileSync(configPath(), "utf8");
		runInstall();

		const installed = join(pluginRoot, "instructions", "codex-base.md");
		assert.equal(once.split("\n")[0], `model_instructions_file = ${JSON.stringify(installed)}`);
		assert.match(once, /developer_instructions = """\nkeep me\n"""/);
		assert.equal(readFileSync(installed, "utf8"), OUR_BASE);
		assert.equal(readFileSync(configPath(), "utf8"), once);
	});

	it("#given our base from an older plugin version #when installing #then the key moves to the current copy in place", () => {
		const old = join(codexHome, "plugins", "cache", "sisyphuslabs", "omo", "0.0.1", "instructions", "codex-base.md");
		writeFileSync(configPath(), `service_tier = "priority"\nmodel_instructions_file = ${JSON.stringify(old)}\n`);

		const { pluginRoot } = runInstall();

		const lines = readFileSync(configPath(), "utf8").split("\n");
		assert.equal(lines[1], `model_instructions_file = ${JSON.stringify(join(pluginRoot, "instructions", "codex-base.md"))}`);
		assert.equal(lines.filter((line) => line.startsWith("model_instructions_file")).length, 1);
	});

	it("#given the user's own model_instructions_file #when installing #then it is left alone and the skip is reported", () => {
		writeFileSync(configPath(), 'model_instructions_file = "/home/me/my-base.md"\n');

		const { logs } = runInstall();

		assert.match(readFileSync(configPath(), "utf8"), /^model_instructions_file = "\/home\/me\/my-base\.md"$/m);
		assert.ok(logs.some((line) => line.includes("skip model_instructions_file")));
	});
});

describe("install multi-agent texts", () => {
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "omo-install-"));
		codexHome = join(tempRoot, "codex");
		mkdirSync(codexHome);
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it("#given a multi_agent_v2 table #when installing twice #then it holds our role texts and an empty mode text, and the second run changes nothing", () => {
		writeFileSync(configPath(), "[features.multi_agent_v2]\nenabled = true\nmax_concurrent_threads_per_session = 16\n");

		runInstall();
		const once = readFileSync(configPath(), "utf8");
		runInstall();

		const table = once.slice(once.indexOf("[features.multi_agent_v2]")).split(/\n(?=\[)/)[0];
		assert.equal(tableString(table, "root_agent_usage_hint_text"), readFileSync(join(SOURCE_ROOT, "instructions", "multi-agent-root.md"), "utf8").trim());
		assert.equal(tableString(table, "subagent_usage_hint_text"), readFileSync(join(SOURCE_ROOT, "instructions", "multi-agent-subagent.md"), "utf8").trim());
		assert.equal(tableString(table, "multi_agent_mode_hint_text"), "");
		assert.match(table, /^enabled = true$/m);
		assert.equal(readFileSync(configPath(), "utf8"), once);
	});

	it("#given multi_agent_v2 set as a flag under [features] #when installing #then no table is added and the skip is reported", () => {
		writeFileSync(configPath(), "[features]\nmulti_agent_v2 = true\n");

		const { logs } = runInstall();

		assert.doesNotMatch(readFileSync(configPath(), "utf8"), /\[features\.multi_agent_v2\]/);
		assert.ok(logs.some((line) => line.includes("skip multi-agent texts")));
	});
});

function tableString(table, key) {
	const match = new RegExp(`^${key} = (".*")$`, "m").exec(table);
	return match === null ? null : JSON.parse(match[1]);
}

describe("upstream instructions check", () => {
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "omo-upstream-"));
		codexHome = join(tempRoot, "codex");
		mkdirSync(join(tempRoot, "instructions"), { recursive: true });
		mkdirSync(codexHome);
		writeFileSync(join(tempRoot, "instructions", "upstream-test-model.md"), "Intro.\n\n# Autonomy\n\nAct.\n\n# Tools\n\nUse rg.\n");
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it("#given no models cache #when checking #then it reports the model as not cached", () => {
		assert.deepEqual(check(), { status: "not-cached", model: "test-model" });
	});

	it("#given the cache matches the snapshot #when checking #then it reports same", () => {
		cacheInstructions("Intro.\n\n# Autonomy\n\nAct.\n\n# Tools\n\nUse rg.\n");
		assert.equal(check().status, "same");
	});

	it("#given upstream edited one section and added another #when checking #then only those sections are named and the new text is written out", () => {
		cacheInstructions("Intro.\n\n# Autonomy\n\nAct now.\n\n# Tools\n\nUse rg.\n\n# Memory\n\nNew.\n");

		const result = check();

		assert.equal(result.status, "changed");
		assert.deepEqual(result.sections, ["# Autonomy", "# Memory"]);
		assert.ok(existsSync(result.currentPath));
		assert.match(readFileSync(result.currentPath, "utf8"), /Act now\./);
	});
});

describe("install omo command", () => {
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "omo-install-bin-"));
		codexHome = join(tempRoot, "codex");
		mkdirSync(codexHome);
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it("#given an empty bin directory #when installing #then an executable omo runs the installed tool", () => {
		const { pluginRoot } = runInstall();

		const command = join(tempRoot, "bin", "omo");
		assert.equal(readFileSync(command, "utf8"), commandScript(join(pluginRoot, "tools", "omo.mjs")));
		assert.equal(statSync(command).mode & 0o111, 0o111);
		const result = spawnSync(command, ["read", join(pluginRoot, "tools", "omo.mjs"), "1-1"], { encoding: "utf8", env: { ...process.env, CODEX_THREAD_ID: "" } });
		assert.match(result.stdout, /\n1\t#!\/usr\/bin\/env node\n$/);
	});

	it("#given an omo command that omo-lite did not write #when installing #then it is kept and the skip is reported", () => {
		mkdirSync(join(tempRoot, "bin"));
		writeFileSync(join(tempRoot, "bin", "omo"), "#!/bin/sh\necho mine\n");

		const { logs } = runInstall();

		assert.equal(readFileSync(join(tempRoot, "bin", "omo"), "utf8"), "#!/bin/sh\necho mine\n");
		assert.ok(logs.some((line) => line.startsWith("skip omo command")));
	});

	it("#given links left by an older install #when installing #then only links into the plugin cache whose target is gone are removed", () => {
		const bin = join(tempRoot, "bin");
		const cache = join(codexHome, "plugins", "cache", "sisyphuslabs");
		mkdirSync(bin);
		mkdirSync(join(tempRoot, "elsewhere"));
		writeFileSync(join(tempRoot, "elsewhere", "tool"), "");
		symlinkSync(join(cache, "omo", "5.0.0", "cli.js"), join(bin, "old-omo-tool"));
		symlinkSync(join(tempRoot, "missing"), join(bin, "other-dangling"));
		symlinkSync(join(tempRoot, "elsewhere", "tool"), join(bin, "other-live"));

		runInstall();

		assert.deepEqual(readdirSync(bin).sort(), ["omo", "other-dangling", "other-live"]);
	});
});

describe("hook trust report", () => {
	// Hashes Codex wrote for these definitions when the user trusted them.
	const PATCH_CHECK = { type: "command", command: 'node "${PLUGIN_ROOT}/hooks/patch-check.mjs"', timeout: 5, statusMessage: "(OmO) Checking Patch Matches" };
	const PATCH_CHECK_HASH = "sha256:e27b412a856337c9e8403bf73096299b26dafaff21d39f0d4cb0fe10a2a49f92";
	const RESIDENT_RULE = { type: "command", command: 'node "${PLUGIN_ROOT}/hooks/resident-rule.mjs"', timeout: 10, statusMessage: "(OmO) Loading Resident Rule", additionalContextLimit: 0 };
	const RESIDENT_RULE_HASH = "sha256:7e42171e714d9cd2bba559d62b2ce254ef2cf4d6745988e9f4beb71c68244b50";
	const hooks = (patchCheck = PATCH_CHECK) => ({ hooks: { SessionStart: [{ hooks: [RESIDENT_RULE] }], PreToolUse: [{ matcher: "^apply_patch$", hooks: [patchCheck] }] } });
	const trust = (key, hash) => `[hooks.state."omo@sisyphuslabs:hooks/hooks.json:${key}"]\ntrusted_hash = "${hash}"\n\n`;

	it("#given trust records Codex wrote #when the definitions are unchanged #then no hook is reported", () => {
		const config = trust("session_start:0:0", RESIDENT_RULE_HASH) + trust("pre_tool_use:0:0", PATCH_CHECK_HASH);
		assert.deepEqual(untrustedHooks(config, hooks(), "omo@sisyphuslabs"), []);
	});

	it("#given a changed definition and a missing record #when checked #then each is reported with its script and state", () => {
		const config = trust("pre_tool_use:0:0", PATCH_CHECK_HASH);

		const pending = untrustedHooks(config, hooks({ ...PATCH_CHECK, timeout: 6 }), "omo@sisyphuslabs");

		assert.deepEqual(
			pending.map(({ event, matcher, script, status }) => ({ event, matcher, script, status })),
			[
				{ event: "SessionStart", matcher: null, script: "resident-rule.mjs", status: "untrusted" },
				{ event: "PreToolUse", matcher: "^apply_patch$", script: "patch-check.mjs", status: "changed" },
			],
		);
	});

	it("#given a hook the user disabled #when checked #then it is not reported", () => {
		const config = '[hooks.state."omo@sisyphuslabs:hooks/hooks.json:session_start:0:0"]\nenabled = false\n\n' + trust("pre_tool_use:0:0", PATCH_CHECK_HASH);
		assert.deepEqual(untrustedHooks(config, hooks(), "omo@sisyphuslabs"), []);
	});
});

function runInstall() {
	const logs = [];
	const result = install({ codexHome, binDir: join(tempRoot, "bin"), sourceRoot: SOURCE_ROOT, log: (line) => logs.push(line) });
	return { ...result, logs };
}

function configPath() {
	return join(codexHome, "config.toml");
}

function check() {
	return checkUpstream({ codexHome, instructionsDir: join(tempRoot, "instructions"), outputDir: tempRoot });
}

function cacheInstructions(text) {
	const cache = { models: [{ slug: "other" }, { slug: "test-model", model_messages: { instructions_template: text } }] };
	writeFileSync(join(codexHome, "models_cache.json"), JSON.stringify(cache));
}
