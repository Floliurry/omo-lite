import { isUltraworkPrompt, runUserPromptSubmitHook } from "../hooks/ultrawork-trigger.mjs";
import { afterEach, describe, expect, it } from "./expect.mjs";
import { cleanupTempDirectories, parseHookOutput, writeTranscript } from "./ultrawork-test-helpers.mjs";

afterEach(cleanupTempDirectories);

describe("codex ultrawork command admission", () => {
	it.each([
		"/ultrawork fix this",
		"$ultrawork fix this",
		"$omo:ulw fix this",
		"/skill:ulw fix this",
		"/ulw",
		"/ulw fix this change",
		"$ulw",
		"$ulw fix this change",
		"$omo:ultrawork fix this change",
		"/skill:ultrawork fix this change",
		"ulw: fix this change",
		"ultrawork: fix this change",
		"ulw：修复这个问题",
		"ultrawork：修复这个问题",
		"ulw",
		"ultrawork",
		"  ULW  ",
		"ULTRAWORK",
		"\n/ULW fix this change",
		"/ulw\nFix the README command.",
		"ulw: 不要启用 ultrawork；请先解释这个命令。",
	])("#given explicit command %j #when hook runs #then emits admission for main-agent judgment", (prompt) => {
		const output = runUserPromptSubmitHook({ hook_event_name: "UserPromptSubmit", prompt });
		const parsed = parseHookOutput(output);
		expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
		expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
		expect(isUltraworkPrompt(prompt)).toBe(true);
	});

	it.each([
		"please explain ultrawork",
		"please ulw this change",
		"ulw this change",
		"ultrawork this change",
		"why did ultrawork trigger here?",
		"하이ulw",
		"refactor ulw_helper.ts",
		"src/ulw-loop.ts",
		"不要使用 ultrawork；直接回答这个问题。",
		"Do not use /ulw",
		"never enable ultrawork",
		"ulw off",
		"ultrawork disabled",
		"ulw-plan",
		"ulw-loop",
		"ulw-execute",
		"ulw-research",
		"/ulw-plan",
		"$ulw-loop",
		"$omo:ulw-plan refactor auth",
		"$omo:ulw-research inspect hooks",
		"/skill:ultrawork-other",
		"/ulw_helper.ts",
		"/ulw/path",
		"$ulwSuffix",
		"`/ulw fix this`",
		'"ulw: fix this"',
		"'ulw: fix this'",
		"> /ulw fix this",
		"```text\n/ulw fix this\n```",
		"~~~\nulw: fix this\n~~~",
		"    /ulw fix this",
		"Here is the command:\n/ulw fix this",
		"",
	])("#given mention or non-command %j #when hook runs #then stays silent", (prompt) => {
		expect(runUserPromptSubmitHook({ hook_event_name: "UserPromptSubmit", prompt })).toBe("");
		expect(isUltraworkPrompt(prompt)).toBe(false);
	});

	it.each([
		"<ultrawork-admission>",
		"<ultrawork-mode>",
		"<lazycodex-auto-workflow>",
	])("#given historical %s hook output #when a fresh command arrives #then requests a new admission decision", (marker) => {
		const transcript_path = writeTranscript(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "UserPromptSubmit",
					additionalContext: marker,
				},
			}),
		);
		const output = runUserPromptSubmitHook({
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: fix this",
			transcript_path,
		});
		expect(parseHookOutput(output).hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
		expect(
			runUserPromptSubmitHook({ hook_event_name: "UserPromptSubmit", prompt: "continue", transcript_path }),
		).toBe("");
	});
});
