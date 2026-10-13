import { runUserPromptSubmitHook } from "../hooks/ultrawork-trigger.mjs";
import { afterEach, describe, expect, it } from "./expect.mjs";
import {
	cleanupTempDirectories,
	parseHookOutput,
	writeCodexContextWindowTranscript,
	writeContextPressureTranscript,
	writeTranscript,
} from "./ultrawork-test-helpers.mjs";

afterEach(() => {
	cleanupTempDirectories();
});

describe("codex ultrawork hook", () => {
	it("#given ultrawork prompt #when hook runs #then emits directive as Codex hook JSON", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: this change",
		};

		// when
		const output = runUserPromptSubmitHook(payload);
		const parsed = parseHookOutput(output);

		// then
		expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
		expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given Windows cwd #when hook sees ultrawork prompt #then emits directive as Codex hook JSON", () => {
		// given
		const payload = {
			cwd: "C:\\Users\\codex\\project",
			hook_event_name: "UserPromptSubmit",
			model: "gpt-5.5",
			permission_mode: "default",
			prompt: "ulw: this change",
			session_id: "s",
			transcript_path: null,
			turn_id: "t",
		};

		// when
		const output = runUserPromptSubmitHook(payload);
		const parsed = parseHookOutput(output);

		// then
		expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
		expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given transcript already contains ultrawork directive #when a fresh command arrives #then requests admission again", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: this change",
			transcript_path: writeTranscript(
				JSON.stringify({
					hookSpecificOutput: {
						hookEventName: "UserPromptSubmit",
						additionalContext: "<ultrawork-mode>\nexisting directive",
					},
				}),
			),
		};

		// when
		const output = runUserPromptSubmitHook(payload);

		// then
		expect(parseHookOutput(output).hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given transcript only mentions ultrawork marker in user content #when hook sees first ulw command #then it emits directive", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: this change",
			transcript_path: writeTranscript(
				JSON.stringify({
					role: "user",
					content: "Please inspect text containing <ultrawork-mode> but do not activate yet.",
				}),
			),
		};

		// when
		const output = runUserPromptSubmitHook(payload);
		const parsed = parseHookOutput(output);

		// then
		expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given context-pressure recovery prompt with ulw #when hook runs #then does not add more context", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: [
				"/ulw recover this thread",
				"Warning: Skill descriptions were shortened to fit the 2% skills context budget.",
				"Warning: Long threads and multiple compactions can cause the model to be less accurate.",
				"Context compacted",
				"error context_too_large: Your input exceeds the context window of this model.",
				"ulw tdd commit well",
			].join("\n"),
		};

		// when
		const output = runUserPromptSubmitHook(payload);

		// then
		expect(output).toBe("");
	});

	it("#given stale context-pressure transcript #when a fresh ulw command arrives #then requests admission", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: this change",
			transcript_path: writeContextPressureTranscript(),
		};

		// when
		const output = runUserPromptSubmitHook(payload);

		// then
		expect(parseHookOutput(output).hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given old Codex context-window transcript #when a fresh ulw command arrives #then requests admission", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: "ulw: this change",
			transcript_path: writeCodexContextWindowTranscript(),
		};

		// when
		const output = runUserPromptSubmitHook(payload);

		// then
		expect(parseHookOutput(output).hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given quoted pressure marker in history #when a fresh ulw command arrives #then requests admission", () => {
		const output = runUserPromptSubmitHook({
			hook_event_name: "UserPromptSubmit",
			prompt: "/ulw inspect this change",
			transcript_path: writeTranscript('The inspected source contains "context compacted".'),
		});

		expect(parseHookOutput(output).hookSpecificOutput.additionalContext).toMatch(/^<ultrawork-admission>/);
	});

	it("#given context-pressure recovery prompt without ulw #when hook runs #then stays quiet", () => {
		// given
		const payload = {
			hook_event_name: "UserPromptSubmit",
			prompt: [
				"Context compacted",
				"Your input exceeds the context window of this model.",
				"Please adjust your input and try again.",
			].join("\n"),
		};

		// when
		const output = runUserPromptSubmitHook(payload);

		// then
		expect(output).toBe("");
	});

	it("#given malformed or empty input #when hook runs #then exits with empty output", () => {
		// given
		const inputs = [undefined, {}, { hook_event_name: "UserPromptSubmit", prompt: "" }];

		// when
		const outputs = inputs.map((input) => runUserPromptSubmitHook(input));

		// then
		expect(outputs).toEqual(["", "", ""]);
	});
});
