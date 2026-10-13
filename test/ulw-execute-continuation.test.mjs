import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	renderExecutionContractReference,
	runStopHook,
	ULW_EXECUTE_CONTINUATION_DIRECTIVE,
} from "../hooks/ulw-execute-continuation.mjs";
import { afterEach, describe, expect, it } from "./expect.mjs";

const DEFAULT_WORKSPACE = "/repo";
const cleanupRoots = [];
const SCAFFOLD_PLAN_MARKDOWN = readFileSync(new URL("./fixtures/plan-scaffold.md", import.meta.url), "utf8");

afterEach(() => {
	for (const root of cleanupRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ulw-execute Stop hook", () => {
	it("#given stop hook is already active #when hook runs #then returns empty output", () => {
		// given
		const fs = createMemoryFs();
		const input = { ...createStopInput(), stop_hook_active: true };

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).toBe("");
	});

	it("#given no boulder state and start work prompt #when stop hook runs #then it stays quiet", () => {
		// given
		const fs = createMemoryFs();
		const input = {
			...createStopInput(),
			last_assistant_message: "I'll start work on this plan now.",
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).toBe("");
	});

	it("#given active codex work with remaining top-level tasks #when hook runs #then returns block JSON", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({
				sessionIds: ["codex:sess_abc"],
				status: "active",
				worktreePath: "/tmp/worktree",
			}),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		expect(parseBlockOutput(output).decision).toBe("block");
	});

	it.each([undefined, ".worktrees/task"])(
		"#given recorded worktree %s #when rendering state #then all placeholders resolve in their actual workspace",
		(worktreePath) => {
			// given
			const workspace = createWorkspace({
				boulderJson: createBoulderJson({
					sessionIds: ["codex:sess_abc"],
					status: "active",
					...(worktreePath === undefined ? {} : { worktreePath }),
				}),
				planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
			});

			// when
			const { reason } = parseBlockOutput(runStopHook(createStopInput(workspace), createMemoryFs()));

			// then
			expect(reason).not.toMatch(/\{\{[A-Z_]+\}\}/);
			expect(reason).toContain(`Plan file: \`${join(workspace, ".omo", "plans", "plan.md")}\``);
			expect(reason).toContain(`Boulder state: \`${join(workspace, ".omo", "boulder.json")}\``);
			expect(reason).toContain(`Ledger: \`${join(workspace, ".omo", "ulw-execute", "ledger.jsonl")}\``);
			expect(reason).toContain(`Hook workspace: \`${workspace}\``);
			expect(reason).toContain("`codex:sess_abc`");
			expect(reason).toContain("Remaining top-level checkboxes: `2` of `4`");
			expect(reason).toContain("Next incomplete task: `1. Implement checklist parser parity`");
			if (worktreePath === undefined) expect(reason).not.toContain("- Worktree:");
			else expect(reason).toContain(`Worktree: \`${join(workspace, worktreePath)}\``);
		},
	);

	it.each(["Stop", "SubagentStop"])(
		"#given paused work #when %s runs #then continuation eligibility is unchanged",
		(hookEventName) => {
			// given
			const workspace = createWorkspace({
				boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "paused" }),
				planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
			});

			// when
			const output = runStopHook(
				{ ...createStopInput(workspace), hook_event_name: hookEventName },
				createMemoryFs(),
			);

			// then
			expect(parseBlockOutput(output).decision).toBe("block");
		},
	);

	it("#given active codex work and an external-blocker marker #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: [
				"<ulw-execute-blocked-external>",
				"Blocker: the staging deploy credential is missing.",
				"Resume when a valid credential is provisioned.",
			].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).toBe("");
	});

	it("#given ultrawork opener then external-blocker marker #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: [
				"ULTRAWORK MODE ENABLED!",
				"<ulw-execute-blocked-external>",
				"Blocker: the staging deploy credential is missing.",
			].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).toBe("");
	});

	it("#given two mode banners then external-blocker marker #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: [
				"ULTRAWORK MODE ENABLED!",
				"ULW-RESEARCH MODE ENABLED!",
				"<ulw-execute-blocked-external>",
				"Blocker: the staging deploy credential is missing.",
				"Resume when a valid credential is provisioned.",
			].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).toBe("");
	});

	it("#given ordinary text then a stated external-blocker marker #when hook runs #then still returns block JSON", () => {
		// given: only mode banners may precede the marker
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: [
				"The deploy step failed.",
				"<ulw-execute-blocked-external>",
				"Blocker: the staging deploy credential is missing.",
			].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(parseBlockOutput(output).decision).toBe("block");
	});

	it("#given the external-blocker marker with no stated blocker #when hook runs #then still returns block JSON", () => {
		// given: a bare marker, which is what a quoted echo or untrusted text would produce.
		// ulw-execute-continuation.md requires the blocker and the resume condition, so the marker alone must not
		// skip the continuation guard.
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: "<ulw-execute-blocked-external>",
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).not.toBe("");
	});

	it("#given the ultrawork opener and a bare marker #when hook runs #then still returns block JSON", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: ["ULTRAWORK MODE ENABLED!", "<ulw-execute-blocked-external>", "   "].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(output).not.toBe("");
	});

	it("#given the external-blocker marker below the first line #when hook runs #then still returns block JSON", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const fs = createMemoryFs();
		const input = {
			...createStopInput(workspace),
			last_assistant_message: ["Next turn I may need to emit", "<ulw-execute-blocked-external>"].join("\n"),
		};

		// when
		const output = runStopHook(input, fs);

		// then
		expect(parseBlockOutput(output).decision).toBe("block");
	});

	it("#given active codex work with zero remaining tasks #when hook runs #then blocks for the final gate", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: ["# Plan", "", "## TODOs", "- [x] 1. Done"].join("\n"),
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		const { reason, decision } = parseBlockOutput(output);
		expect(decision).toBe("block");
		expect(reason).toContain("Remaining top-level checkboxes: `0` of `1`");
		expect(reason).toContain("Next incomplete task: `none (final gate pending)`");
		expect(reason).not.toMatch(/\{\{[A-Z_]+\}\}/);
	});

	it("#given context-window pressure in transcript #when hook runs #then it does not inject continuation text", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});
		const transcriptPath = join(workspace, "transcript.jsonl");
		const fs = createMemoryFs({
			[transcriptPath]: [
				JSON.stringify({
					type: "message",
					payload: {
						content: {
							error: {
								code: "context_too_large",
							},
						},
					},
				}),
				"Your input exceeds the context window of this model.",
				"",
			].join("\n"),
		});

		// when
		const output = runStopHook({ ...createStopInput(workspace), transcript_path: transcriptPath }, fs);

		// then
		expect(output).toBe("");
	});

	it("#given active work belongs to another harness #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["opencode:sess_abc"], status: "active" }),
			planMarkdown: "- [ ] First",
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		expect(output).toBe("");
	});

	it("#given bare legacy session id #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["sess_abc"], status: "active" }),
			planMarkdown: "- [ ] First",
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		expect(output).toBe("");
	});

	it("#given completed boulder work #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "completed" }),
			planMarkdown: "- [ ] First",
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		expect(output).toBe("");
	});

	it("#given malformed boulder JSON #when hook runs #then returns empty output", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: "{",
			planMarkdown: "- [ ] First",
		});
		const fs = createMemoryFs();

		// when
		const output = runStopHook(createStopInput(workspace), fs);

		// then
		expect(output).toBe("");
	});

	it("#given malformed input #when hook runs #then returns empty output", () => {
		// given
		const fs = createMemoryFs();

		// when
		const output = runStopHook({ hook_event_name: "Stop", session_id: 123 }, fs);

		// then
		expect(output).toBe("");
	});
});

describe("ulw-execute selected execution contract", () => {
	const pluginSkillPath = resolve(fileURLToPath(new URL("../skills/ulw-execute/SKILL.md", import.meta.url)));

	it("#given the plugin layout #when the default contract is rendered #then the plugin's ulw-execute skill is available", () => {
		expect(renderExecutionContractReference()).toBe(
			`- Selected execution contract: \`${pluginSkillPath}\` (available)`,
		);
	});

	it("#given a readable custom contract #when rendered #then that path is reported available", () => {
		// given
		const skillPath = fileURLToPath(new URL("./fixtures/selected-execution-contract.md", import.meta.url));

		// when
		const reference = renderExecutionContractReference(skillPath);

		// then
		expect(reference).toBe(`- Selected execution contract: \`${skillPath}\` (available)`);
	});

	it.each(["missing", "empty", "directory"])(
		"#given a %s contract #when rendered #then it is reported unavailable with the expected path",
		(kind) => {
			// given
			const root = mkdtempSync(join(tmpdir(), "codex-continuation-contract-"));
			cleanupRoots.push(root);
			const skillPath = join(root, "skills", "ulw-execute", "SKILL.md");
			if (kind === "directory") mkdirSync(skillPath, { recursive: true });
			if (kind === "empty") {
				mkdirSync(join(skillPath, ".."), { recursive: true });
				writeFileSync(skillPath, "  \n");
			}

			// when
			const reference = renderExecutionContractReference(skillPath);

			// then
			expect(reference).toContain("Selected execution contract: unavailable");
			expect(reference).toContain(skillPath);
			expect(reference).not.toContain("(available)");
		},
	);

	it("#given remaining work #when the Stop hook blocks #then the reason names the plugin contract and the dependency-gap route", () => {
		// given
		const workspace = createWorkspace({
			boulderJson: createBoulderJson({ sessionIds: ["codex:sess_abc"], status: "active" }),
			planMarkdown: SCAFFOLD_PLAN_MARKDOWN,
		});

		// when
		const { reason } = parseBlockOutput(runStopHook(createStopInput(workspace), createMemoryFs()));

		// then
		expect(ULW_EXECUTE_CONTINUATION_DIRECTIVE).toContain("{{SKILL_REFERENCE}}");
		expect(reason).toContain(renderExecutionContractReference());
		expect(reason).toMatch(/dependency gap/i);
		expect(reason).toContain("<ulw-execute-blocked-external>");
	});
});

function createStopInput(cwd = DEFAULT_WORKSPACE) {
	return {
		hook_event_name: "Stop",
		session_id: "sess_abc",
		turn_id: "turn_1",
		transcript_path: "",
		cwd,
		model: "gpt-5.5",
		permission_mode: "default",
		stop_hook_active: false,
		last_assistant_message: "done",
	};
}

function createWorkspace(input) {
	const root = mkdtempSync(join(tmpdir(), "codex-continuation-hook-"));
	cleanupRoots.push(root);
	mkdirSync(join(root, ".omo", "plans"), { recursive: true });
	writeFileSync(join(root, ".omo", "plans", "plan.md"), input.planMarkdown);
	writeFileSync(join(root, ".omo", "boulder.json"), input.boulderJson);
	return root;
}

function createBoulderJson(input) {
	const work = {
		work_id: "work_1",
		active_plan: ".omo/plans/plan.md",
		plan_name: "launch-plan",
		status: input.status,
		started_at: "2026-06-13T00:00:00.000Z",
		session_ids: input.sessionIds,
		...(input.worktreePath === undefined ? {} : { worktree_path: input.worktreePath }),
	};
	return JSON.stringify({
		schema_version: 2,
		active_work_id: "work_1",
		works: { work_1: work },
		active_plan: ".omo/plans/plan.md",
		plan_name: "legacy-launch-plan",
		started_at: "2026-06-13T00:00:00.000Z",
		status: input.status,
		session_ids: input.sessionIds,
	});
}

function createMemoryFs(files = {}) {
	return {
		readFileSync(path, encoding) {
			expect(encoding).toBe("utf8");
			const value = files[path];
			if (value === undefined) throw new Error(`Missing fixture: ${path}`);
			return value;
		},
	};
}

function parseBlockOutput(output) {
	const parsed = JSON.parse(output);
	if (!isRecord(parsed)) throw new Error("Expected object output");
	if (parsed["decision"] !== "block") throw new Error("Expected block decision");
	const reason = parsed["reason"];
	if (typeof reason !== "string") throw new Error("Expected string reason");
	return { decision: "block", reason };
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
