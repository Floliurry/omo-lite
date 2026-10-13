import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";

import { parsePostToolUsePayload, runPostToolUseHook, runTeammodeHookCli } from "../hooks/thread-title.mjs";
import { describe, expect, it } from "./expect.mjs";

const HOOK_PATH = fileURLToPath(new URL("../hooks/thread-title.mjs", import.meta.url));

describe("thread title PostToolUse guidance", () => {
	it("#given codex_app.create_thread completed #when the hook runs #then it asks Codex to immediately set a descriptive title", () => {
		// given
		const output = runPostToolUseHook({
			hook_event_name: "PostToolUse",
			session_id: "s-team",
			turn_id: "t-team",
			transcript_path: null,
			cwd: "/repo",
			model: "gpt-5.5",
			permission_mode: "default",
			tool_name: "create_thread",
			tool_use_id: "tool-create-thread",
			tool_input: {
				prompt: "Investigate package install failures",
				target: { type: "project", projectId: "/repo", environment: { type: "local" } },
			},
			tool_response: { threadId: "thread-123" },
		});

		// when
		const parsed = JSON.parse(output);

		// then
		expect(isHookOutput(parsed)).toBe(true);
		if (!isHookOutput(parsed)) return;
		expect(parsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
		expect(parsed.hookSpecificOutput.additionalContext).toContain("thread-123");
	});

	it("#given Codex reports create_thread output as a JSON string #when the hook runs #then it still extracts the thread id", () => {
		// given
		const output = runPostToolUseHook({
			hook_event_name: "PostToolUse",
			session_id: "s-team",
			turn_id: "t-team",
			transcript_path: null,
			cwd: "/repo",
			model: "gpt-5.5",
			permission_mode: "default",
			tool_name: "codex_app.create_thread",
			tool_use_id: "tool-create-thread",
			tool_input: {
				prompt: "Review a worktree PR",
				target: { type: "project", projectId: "/repo", environment: { type: "local" } },
			},
			tool_response: '{"threadId":"019ef350-ee78-72a3-bd5e-e40cebc3d814"}',
		});

		// when
		const parsed = JSON.parse(output);

		// then
		expect(isHookOutput(parsed)).toBe(true);
		if (!isHookOutput(parsed)) return;
		expect(parsed.hookSpecificOutput.additionalContext).toContain("019ef350-ee78-72a3-bd5e-e40cebc3d814");
	});

	it("#given an unrelated tool completed #when the hook runs #then it stays silent", () => {
		// given
		const output = runPostToolUseHook({
			hook_event_name: "PostToolUse",
			session_id: "s-team",
			turn_id: "t-team",
			transcript_path: null,
			cwd: "/repo",
			model: "gpt-5.5",
			permission_mode: "default",
			tool_name: "read_thread",
			tool_use_id: "tool-read-thread",
			tool_input: { threadId: "thread-123" },
			tool_response: { status: "ok" },
		});

		// when
		const actual = output;

		// then
		expect(actual).toBe("");
	});

	it("#given MultiAgentV2 spawn_agent completed #when the hook runs #then it leaves task-name identity untouched", () => {
		// given
		const output = runPostToolUseHook({
			hook_event_name: "PostToolUse",
			session_id: "s-team",
			turn_id: "t-team",
			transcript_path: null,
			cwd: "/repo",
			model: "gpt-5.6-sol",
			permission_mode: "default",
			tool_name: "spawn_agent",
			tool_use_id: "tool-spawn-agent",
			tool_input: { task_name: "runtime_core", message: "Inspect runtime state" },
			tool_response: { task_name: "/root/runtime_core" },
		});

		// when
		const actual = output;

		// then
		expect(actual).toBe("");
	});

	it("#given worktree-backed thread creation is pending #when the hook runs #then it tells Codex to wait for the real thread before bootstrapping", () => {
		// given
		const output = runPostToolUseHook({
			hook_event_name: "PostToolUse",
			session_id: "s-team",
			turn_id: "t-team",
			transcript_path: null,
			cwd: "/repo",
			model: "gpt-5.5",
			permission_mode: "default",
			tool_name: "codex_app.create_thread",
			tool_use_id: "tool-create-thread",
			tool_input: {
				prompt: "Fix LSP provisioned launcher skip on Node 25",
				target: {
					type: "project",
					projectId: "/repo",
					environment: { type: "worktree", startingState: { type: "working-tree" } },
				},
			},
			tool_response: {
				pendingWorktreeId: "remote-control:env:test-worktree",
			},
		});

		// when
		const parsed = JSON.parse(output);

		// then
		expect(isHookOutput(parsed)).toBe(true);
		if (!isHookOutput(parsed)) return;
		expect(parsed.hookSpecificOutput.additionalContext).toContain("remote-control:env:test-worktree");
		expect(parsed.hookSpecificOutput.additionalContext).toContain("DO NOT bind-thread");
	});

	it("#given create_thread returned neither a thread id nor a pending worktree #when the hook runs #then it stays silent", () => {
		for (const tool_response of [{}, { threadId: "   " }, "not json", "", null, ["thread-123"]]) {
			expect(runPostToolUseHook({ ...createThreadPayload(), tool_response })).toBe("");
		}
	});
});

describe("thread title hook stdin handling", () => {
	it("#given raw stdin #when parsed #then only a complete PostToolUse payload is accepted", () => {
		const valid = createThreadPayload();
		const { tool_response: _omitted, ...withoutResponse } = valid;

		expect(parsePostToolUsePayload(JSON.stringify(valid))).toEqual(valid);
		expect(parsePostToolUsePayload("")).toBeNull();
		expect(parsePostToolUsePayload("{not json")).toBeNull();
		expect(parsePostToolUsePayload(JSON.stringify(withoutResponse))).toBeNull();
		expect(parsePostToolUsePayload(JSON.stringify({ ...valid, hook_event_name: "PreToolUse" }))).toBeNull();
		expect(parsePostToolUsePayload(JSON.stringify({ ...valid, session_id: 1 }))).toBeNull();
	});

	it("#given stdin streams #when the CLI entry runs #then it writes the reminder once", async () => {
		// given
		const stdin = new PassThrough();
		const writes = [];
		const stdout = { write: (chunk) => writes.push(chunk) };
		stdin.end(JSON.stringify(createThreadPayload()));

		// when
		await runTeammodeHookCli(stdin, stdout);

		// then
		expect(writes.length).toBe(1);
		expect(JSON.parse(writes[0]).hookSpecificOutput.additionalContext).toContain("codex_app.set_thread_title");
	});

	it("#given the hook file is executed #when create_thread output arrives #then stdout carries the reminder", () => {
		const result = spawnSync(process.execPath, [HOOK_PATH], { encoding: "utf8", input: JSON.stringify(createThreadPayload()) });

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain("thread-123");
	});

	it.each(["", "{not json", JSON.stringify({ hook_event_name: "PostToolUse" })])(
		"#given the hook file is executed #when stdin is %j #then it exits cleanly with no output",
		(input) => {
			const result = spawnSync(process.execPath, [HOOK_PATH], { encoding: "utf8", input });

			expect(result.status).toBe(0);
			expect(result.stdout).toBe("");
			expect(result.stderr).toBe("");
		},
	);
});

function createThreadPayload() {
	return {
		hook_event_name: "PostToolUse",
		session_id: "s-team",
		turn_id: "t-team",
		transcript_path: null,
		cwd: "/repo",
		model: "gpt-5.5",
		permission_mode: "default",
		tool_name: "create_thread",
		tool_use_id: "tool-create-thread",
		tool_input: { prompt: "Investigate package install failures" },
		tool_response: { threadId: "thread-123" },
	};
}

function isHookOutput(value) {
	if (!isRecord(value)) return false;
	const hookSpecificOutput = value["hookSpecificOutput"];
	return (
		isRecord(hookSpecificOutput) &&
		hookSpecificOutput["hookEventName"] === "PostToolUse" &&
		typeof hookSpecificOutput["additionalContext"] === "string"
	);
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
