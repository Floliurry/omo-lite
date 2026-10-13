import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runUserPromptSubmitHook, ULTRAWORK_SKILL_POINTER_TEMPLATE } from "../hooks/ultrawork-trigger.mjs";
import { afterEach, describe, expect, it } from "./expect.mjs";
import { parseHookOutput } from "./ultrawork-test-helpers.mjs";

const POINTER_MAX_BYTES = 4096;
const HOOK_PATH = fileURLToPath(new URL("../hooks/ultrawork-trigger.mjs", import.meta.url));
const PLUGIN_SKILL_PATH = resolve(fileURLToPath(new URL("../skills/ultrawork/SKILL.md", import.meta.url)));
const tempDirectories = [];

function makeTempDirectory() {
	const directory = mkdtempSync(join(tmpdir(), "ultrawork-skill-"));
	tempDirectories.push(directory);
	return directory;
}

function writeSkillFile() {
	const skillPath = join(makeTempDirectory(), "SKILL.md");
	writeFileSync(skillPath, "---\nname: ultrawork\n---\n\n<ultrawork-mode>\ndirective body\n</ultrawork-mode>\n");
	return skillPath;
}

function pointerContext(skillPath) {
	const output = runUserPromptSubmitHook({ hook_event_name: "UserPromptSubmit", prompt: "ulw: this change" }, { skillPath });
	return parseHookOutput(output).hookSpecificOutput.additionalContext;
}

describe("ultrawork skill pointer", () => {
	afterEach(() => {
		for (const directory of tempDirectories.splice(0)) {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("#given an existing skill file #when context is built #then emits the compact pointer with the absolute path", () => {
		// given
		const skillPath = writeSkillFile();

		// when
		const context = pointerContext(skillPath);

		// then
		expect(context).toBe(ULTRAWORK_SKILL_POINTER_TEMPLATE.replace("{{ULTRAWORK_SKILL_PATH}}", skillPath).trim());
		expect(context.startsWith("<ultrawork-admission>")).toBe(true);
		expect(context).toContain(skillPath);
		expect(context).not.toContain("{{ULTRAWORK_SKILL_PATH}}");
		expect(Buffer.byteLength(context, "utf8")).toBeLessThan(POINTER_MAX_BYTES);
	});

	it("#given no skill path option #when context is built #then the pointer names the plugin's ultrawork skill", () => {
		// when
		const context = parseHookOutput(
			runUserPromptSubmitHook({ hook_event_name: "UserPromptSubmit", prompt: "ulw: this change" }),
		).hookSpecificOutput.additionalContext;

		// then
		expect(context).toContain(PLUGIN_SKILL_PATH);
		expect(Buffer.byteLength(context, "utf8")).toBeLessThan(POINTER_MAX_BYTES);
	});

	it("#given a missing skill file #when the hook runs #then it emits nothing", () => {
		// given
		const missingSkillPath = join(makeTempDirectory(), "SKILL.md");

		// when
		const output = runUserPromptSubmitHook(
			{ hook_event_name: "UserPromptSubmit", prompt: "ulw: this change" },
			{ skillPath: missingSkillPath },
		);

		// then
		expect(output).toBe("");
	});

	it("#given the hook runs with a skill file #when prompt is ulw #then hook JSON carries the pointer", () => {
		// given
		const skillPath = writeSkillFile();

		// when
		const output = runUserPromptSubmitHook(
			{ hook_event_name: "UserPromptSubmit", prompt: "ulw: this change" },
			{ skillPath },
		);
		const parsed = parseHookOutput(output);

		// then
		expect(output.endsWith("}\n")).toBe(true);
		expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
		expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
		expect(parsed.hookSpecificOutput.additionalContext).toContain(skillPath);
	});

	it("#given the hook CLI #when a ulw command arrives on stdin #then stdout carries the plugin pointer", () => {
		// when
		const result = runCli({
			hook_event_name: "UserPromptSubmit",
			session_id: "s-ultrawork-pointer",
			turn_id: "t-ultrawork-pointer",
			transcript_path: null,
			cwd: tmpdir(),
			model: "gpt-5.5",
			permission_mode: "default",
			prompt: "ulw: this change",
		});

		// then
		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(parseHookOutput(result.stdout).hookSpecificOutput.additionalContext).toContain(PLUGIN_SKILL_PATH);
	});

	it.each(["{not json", "", JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello" })])(
		"#given the hook CLI #when stdin is %j #then it exits cleanly with no output",
		(input) => {
			const result = runCli(input);
			expect(result.status).toBe(0);
			expect(result.stdout).toBe("");
			expect(result.stderr).toBe("");
		},
	);
});

function runCli(payload) {
	const input = typeof payload === "string" ? payload : `${JSON.stringify(payload)}\n`;
	return spawnSync(process.execPath, [HOOK_PATH], { cwd: tmpdir(), encoding: "utf8", input });
}
