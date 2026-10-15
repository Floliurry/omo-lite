import { explorerHandoffOutput } from "../hooks/explorer-handoff.mjs";
import { describe, expect, it } from "./expect.mjs";

function spawnPayload(agentType) {
	return JSON.stringify({
		hook_event_name: "PostToolUse",
		session_id: "s-lead",
		tool_name: "collaborationspawn_agent",
		tool_input: { agent_type: agentType, task_name: "probe", fork_turns: "1", message: "gAAAA-encrypted" },
		tool_response: { task_name: "/root/probe" },
	});
}

describe("explorer handoff reminder", () => {
	it("#given the lead spawned an explorer #when the hook runs #then it adds context for the lead", () => {
		// when
		const output = JSON.parse(explorerHandoffOutput(spawnPayload("explorer")));

		// then
		expect(output.hookSpecificOutput.hookEventName).toBe("PostToolUse");
		expect(output.hookSpecificOutput.additionalContext.length > 0).toBe(true);
	});

	it("#given the lead spawned a worker #when the hook runs #then it stays silent", () => {
		// when
		const output = explorerHandoffOutput(spawnPayload("lazycodex-worker-medium"));

		// then
		expect(output).toBe("");
	});
});
