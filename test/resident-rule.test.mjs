import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { compactionPointer, loadRule, runHook } from "../hooks/resident-rule.mjs";
import { afterEach, beforeEach, describe, it } from "./expect.mjs";

const HOOK_PATH = fileURLToPath(new URL("../hooks/resident-rule.mjs", import.meta.url));
const RULES_DIR = fileURLToPath(new URL("../rules/", import.meta.url));
const SESSION_ID = "019f0000-resident-rule";

let tempRoot;
let dataRoot;

describe("resident-rule hook", () => {
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "omo-resident-rule-"));
		dataRoot = join(tempRoot, "data");
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	describe("resident rule loading", () => {
		it.each([
			["gpt-6.1-sol", "gpt-6.1-sol"],
			["  openai/gpt-6-astra-fast  ", "openai/gpt-6-astra-fast"],
			["some-unknown-model", "some-unknown-model"],
			["", "a GPT model"],
			[undefined, "a GPT model"],
		])("#given model %j #when the rule loads #then the model placeholder reads %s", (model, name) => {
			const template = readFileSync(join(RULES_DIR, "lead.md"), "utf8");
			assert.ok(template.includes("{{model}}"), "fixture precondition: the rule names the model");

			const rule = loadRule(model);

			assert.ok(rule.body.includes(name));
			assert.equal(rule.body.includes("{{"), false);
		});

		it("#given the shipped rule #when it loads #then it is the only rule file and its body drops the frontmatter", () => {
			assert.deepEqual(readdirSync(RULES_DIR).filter((file) => file !== "README.md"), ["lead.md"]);
			const rule = loadRule("gpt-6-sol");
			assert.equal(rule.path, join(RULES_DIR, "lead.md"));
			assert.ok(readFileSync(rule.path, "utf8").startsWith("---\n"), "fixture precondition: rule has frontmatter");
			assert.equal(rule.body, rule.body.trim());
			assert.doesNotMatch(rule.body, /^---/);
			assert.doesNotMatch(rule.body, /alwaysApply:|^description:/m);
		});

		it("#given a custom rules directory #when the hook injects #then it reads the rule from there and names the model", () => {
			const rulesDir = join(tempRoot, "rules");
			mkdirSync(rulesDir);
			writeFileSync(join(rulesDir, "lead.md"), "---\ndescription: test\n---\n\nCustom rule for {{model}}.\n");

			const context = injectedContext(runHook(sessionStart({ source: "startup", model: "gpt-6-sol" }), { rulesDir, dataRoot }));

			assert.equal(context, `Instructions from: ${join(rulesDir, "lead.md")}\n\nCustom rule for gpt-6-sol.`);
		});
	});

	describe("resident rule SessionStart", () => {
		it.each(["startup", "clear"])("#given SessionStart(%s) #when the hook runs #then it injects the rule path and body without frontmatter", (source) => {
			const rule = loadRule("gpt-6-sol");

			const output = runHook(sessionStart({ source, model: "gpt-6-sol" }), { dataRoot });
			const parsed = JSON.parse(output);

			assert.ok(output.endsWith("}\n"));
			assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
			assert.equal(parsed.hookSpecificOutput.additionalContext, `Instructions from: ${rule.path}\n\n${rule.body}`);
			assert.doesNotMatch(parsed.hookSpecificOutput.additionalContext, /alwaysApply/);
		});

		it("#given a resumed session #when SessionStart(resume) runs #then it emits nothing, because the history already holds the rule", () => {
			assert.equal(runHook(sessionStart({ source: "resume", model: "gpt-6-sol" }), { dataRoot }), "");
		});

		it("#given a compaction #when SessionStart(compact) runs #then it emits only a pointer to the rule file, never the body", () => {
			const rule = loadRule("gpt-6-astra");

			const context = injectedContext(runHook(sessionStart({ source: "compact", model: "gpt-6-astra" }), { dataRoot }));

			assert.equal(context, compactionPointer(rule.path));
			assert.ok(context.includes(rule.path));
			assert.equal(context.includes(rule.body.slice(0, 200)), false);
			assert.ok(context.length < 400);
		});

		it("#given a pending PostCompact marker #when SessionStart(compact) runs #then it clears the marker so the pointer is not repeated", () => {
			runHook(postCompact(), { dataRoot });
			assert.equal(existsSync(markerPath()), true);

			runHook(sessionStart({ source: "compact", model: "gpt-6-sol" }), { dataRoot });

			assert.equal(existsSync(markerPath()), false);
			assert.equal(runHook(userPrompt("continue"), { dataRoot }), "");
		});
	});

	describe("resident rule after PostCompact", () => {
		it("#given no compaction happened #when a prompt is submitted #then nothing is injected", () => {
			assert.equal(runHook(userPrompt("continue"), { dataRoot }), "");
			assert.equal(existsSync(join(dataRoot, "compacted")), false);
		});

		it("#given PostCompact ran #when prompts follow #then only the first one gets the pointer and the marker is removed", () => {
			assert.equal(runHook(postCompact(), { dataRoot }), "");
			assert.equal(existsSync(markerPath()), true);

			const first = runHook(userPrompt("continue"), { dataRoot });
			assert.equal(JSON.parse(first).hookSpecificOutput.hookEventName, "UserPromptSubmit");
			assert.equal(injectedContext(first), compactionPointer(loadRule("gpt-6-sol").path));
			assert.equal(existsSync(markerPath()), false);

			assert.equal(runHook(userPrompt("continue again"), { dataRoot }), "");
		});

		it("#given PostCompact ran #when a context-pressure prompt arrives #then it keeps the marker for the next prompt", () => {
			runHook(postCompact(), { dataRoot });

			const pressure = runHook(
				userPrompt("Context compacted\nerror context_too_large: Your input exceeds the context window of this model."),
				{ dataRoot },
			);

			assert.equal(pressure, "");
			assert.equal(existsSync(markerPath()), true);
			assert.equal(injectedContext(runHook(userPrompt("continue"), { dataRoot })), compactionPointer(loadRule("gpt-6-sol").path));
			assert.equal(existsSync(markerPath()), false);
		});

		it("#given a session id with path separators #when PostCompact runs #then the marker stays inside the data root", () => {
			runHook({ ...postCompact(), session_id: "../../escape/session" }, { dataRoot });

			assert.deepEqual(readdirSync(join(dataRoot, "compacted")), [".._.._escape_session.flag"]);
			assert.equal(existsSync(join(tempRoot, "escape")), false);
		});
	});

	describe("resident rule input", () => {
		it("#given malformed or unrelated input #when the hook runs #then it emits nothing", () => {
			for (const input of [undefined, null, "SessionStart", [], {}, { hook_event_name: "SessionStart" }, { hook_event_name: "Stop", session_id: "s" }]) {
				assert.equal(runHook(input, { dataRoot }), "");
			}
			assert.equal(existsSync(dataRoot), false);
		});
	});

	describe("resident rule CLI", () => {
		it("#given the hook file is executed #when SessionStart(startup) arrives on stdin #then stdout carries the rule", () => {
			const result = runCli(sessionStart({ source: "startup", model: "gpt-6-astra-fast" }));

			assert.equal(result.status, 0, result.stderr);
			assert.equal(result.stderr, "");
			assert.equal(injectedContext(result.stdout), `Instructions from: ${loadRule("gpt-6-astra-fast").path}\n\n${loadRule("gpt-6-astra-fast").body}`);
		});

		it("#given the hook file is executed #when PostCompact then a prompt arrive #then the marker lives under PLUGIN_DATA and is consumed", () => {
			const postCompactResult = runCli(postCompact());
			assert.equal(postCompactResult.status, 0, postCompactResult.stderr);
			assert.equal(postCompactResult.stdout, "");
			assert.equal(existsSync(markerPath()), true);

			const promptResult = runCli(userPrompt("continue"));
			assert.equal(promptResult.status, 0, promptResult.stderr);
			assert.equal(injectedContext(promptResult.stdout), compactionPointer(loadRule("gpt-6-sol").path));
			assert.equal(existsSync(markerPath()), false);
		});

		it("#given the hook file is executed #when stdin is empty or malformed #then it exits cleanly with no output", () => {
			for (const input of ["", "{not json"]) {
				const result = runCli(input);
				assert.equal(result.status, 0, result.stderr);
				assert.equal(result.stdout, "");
				assert.equal(result.stderr, "");
			}
		});
	});
});

function runCli(payload) {
	const input = typeof payload === "string" ? payload : `${JSON.stringify(payload)}\n`;
	return spawnSync(process.execPath, [HOOK_PATH], {
		cwd: tempRoot,
		encoding: "utf8",
		env: { ...process.env, PLUGIN_DATA: dataRoot },
		input,
	});
}

function markerPath(sessionId = SESSION_ID) {
	return join(dataRoot, "compacted", `${sessionId}.flag`);
}

function injectedContext(output) {
	assert.notEqual(output, "", "expected the hook to inject the rule");
	return JSON.parse(output).hookSpecificOutput.additionalContext;
}

function sessionStart(overrides) {
	return {
		hook_event_name: "SessionStart",
		session_id: SESSION_ID,
		transcript_path: null,
		cwd: tempRoot,
		model: "gpt-5.6",
		permission_mode: "default",
		...overrides,
	};
}

function postCompact() {
	return {
		hook_event_name: "PostCompact",
		session_id: SESSION_ID,
		transcript_path: null,
		cwd: tempRoot,
		model: "gpt-6-sol",
		permission_mode: "default",
		trigger: "auto",
	};
}

function userPrompt(prompt, transcriptPath = null) {
	return {
		hook_event_name: "UserPromptSubmit",
		session_id: SESSION_ID,
		turn_id: "turn-1",
		transcript_path: transcriptPath,
		cwd: tempRoot,
		model: "gpt-6-sol",
		permission_mode: "default",
		prompt,
	};
}

