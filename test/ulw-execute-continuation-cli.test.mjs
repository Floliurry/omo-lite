import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execPath } from "node:process";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "./expect.mjs";

const cleanupRoots = [];
const HOOKS_DIR = fileURLToPath(new URL("../hooks/", import.meta.url));
const HOOK_PATH = join(HOOKS_DIR, "ulw-execute-continuation.mjs");
const PLUGIN_SKILL_PATH = resolve(fileURLToPath(new URL("../skills/ulw-execute/SKILL.md", import.meta.url)));
const SELECTED_CONTRACT_FIXTURE = new URL("./fixtures/selected-execution-contract.md", import.meta.url);
const SCAFFOLD_PLAN_MARKDOWN = readFileSync(new URL("./fixtures/plan-scaffold.md", import.meta.url), "utf8");

describe("ulw-execute continuation CLI", () => {
	afterEach(() => {
		for (const root of cleanupRoots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	it("#given valid Stop stdin #when CLI runs #then stdout contains block JSON", () => {
		// given
		const cwd = createWorkspace(["codex:s1"]);
		const payload = JSON.stringify(makePayload(cwd, false, "Stop"));

		// when
		const result = runCli(payload);

		// then
		if (result.error !== undefined) throw result.error;
		expect(result.status).toBe(0);
		const output = parseStopHookOutput(result.stdout);
		expect(output.decision).toBe("block");
		expect(output.reason).not.toMatch(/\{\{[A-Z_]+\}\}/);
	});

	it("#given valid SubagentStop stdin #when CLI runs #then stdout contains block JSON", () => {
		// given
		const cwd = createWorkspace(["codex:s1"]);
		const payload = JSON.stringify(makePayload(cwd, false, "SubagentStop"));

		// when
		const result = runCli(payload);

		// then
		if (result.error !== undefined) throw result.error;
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"decision":"block"');
	});

	it("#given cwd has its own ulw-execute skill #when the hook runs #then it names the plugin's contract, not the cwd copy", () => {
		// given
		const cwd = createWorkspace(["codex:s1"]);
		const unrelatedSkill = join(cwd, "skills", "ulw-execute", "SKILL.md");
		copyContract(unrelatedSkill);

		// when
		const result = runCli(JSON.stringify(makePayload(cwd, false, "Stop")), HOOK_PATH, cwd);

		// then
		expect(result.status).toBe(0);
		const output = parseStopHookOutput(result.stdout);
		expect(output.decision).toBe("block");
		expect(output.reason).toContain(`Selected execution contract: \`${PLUGIN_SKILL_PATH}\` (available)`);
		expect(output.reason).not.toContain(unrelatedSkill);
		expect(output.reason).not.toMatch(/\{\{[A-Z_]+\}\}/);
	});

	it.each(["missing", "empty", "directory"])(
		"#given a relocated plugin with a %s ulw-execute skill #when the hook runs #then reports a dependency gap without skipping continuation",
		(kind) => {
			// given
			const cwd = createWorkspace(["codex:s1"]);
			const pluginRoot = createRelocatedPlugin();
			const skillPath = join(pluginRoot, "skills", "ulw-execute", "SKILL.md");
			if (kind === "directory") mkdirSync(skillPath, { recursive: true });
			if (kind === "empty") {
				mkdirSync(join(skillPath, ".."), { recursive: true });
				writeFileSync(skillPath, "  \n");
			}
			const unrelatedSkill = join(cwd, "skills", "ulw-execute", "SKILL.md");
			copyContract(unrelatedSkill);

			// when
			const result = runCli(
				JSON.stringify(makePayload(cwd, false, "Stop")),
				join(pluginRoot, "hooks", "ulw-execute-continuation.mjs"),
				cwd,
			);

			// then
			expect(result.status).toBe(0);
			const output = parseStopHookOutput(result.stdout);
			expect(output.decision).toBe("block");
			expect(output.reason).toContain("Selected execution contract: unavailable");
			expect(output.reason).toContain(skillPath);
			expect(output.reason).not.toContain(unrelatedSkill);
			expect(output.reason).toMatch(/dependency gap/i);
		},
	);

	it.each(["", "ULTRAWORK MODE ENABLED!\n"])(
		"#given opener %j #when an explained external blocker is reported #then ends the turn without completing work",
		(opener) => {
			// given
			const cwd = createWorkspace(["codex:s1"]);
			const boulderPath = join(cwd, ".omo", "boulder.json");
			const before = readFileSync(boulderPath, "utf8");
			const payload = {
				...makePayload(cwd, false, "Stop"),
				last_assistant_message: `${opener}<ulw-execute-blocked-external>\nThe selected execution contract is unavailable. Resume when that contract is supplied.`,
			};

			// when
			const result = runCli(JSON.stringify(payload), HOOK_PATH, cwd);

			// then
			expect(result.status).toBe(0);
			expect(result.stdout).toBe("");
			expect(readFileSync(boulderPath, "utf8")).toBe(before);
		},
	);

	it("#given active stop hook stdin #when CLI runs #then stdout is empty and exit is zero", () => {
		// given
		const cwd = createWorkspace(["codex:s1"]);
		const payload = JSON.stringify(makePayload(cwd, true, "Stop"));

		// when
		const result = runCli(payload);

		// then
		if (result.error !== undefined) throw result.error;
		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("#given unrelated session stdin #when CLI runs #then stdout is empty and exit is zero", () => {
		// given
		const cwd = createWorkspace(["codex:other"]);
		const payload = JSON.stringify(makePayload(cwd, false, "Stop"));

		// when
		const result = runCli(payload);

		// then
		if (result.error !== undefined) throw result.error;
		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
	});

	it.each(["{not-json", "", "   \n"])("#given malformed or empty stdin %j #when CLI runs #then stdout is empty and exit is zero", (payload) => {
		// when
		const result = runCli(payload);

		// then
		if (result.error !== undefined) throw result.error;
		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toBe("");
	});
});

function runCli(input, hookPath = HOOK_PATH, cwd = process.cwd()) {
	return spawnSync(execPath, [hookPath], { input, cwd, encoding: "utf8" });
}

// A copy of the hook with its own (possibly broken) skills directory, so the real plugin skill
// is never touched.
function createRelocatedPlugin() {
	const root = mkdtempSync(join(tmpdir(), "codex-continuation-plugin-"));
	cleanupRoots.push(root);
	const pluginRoot = join(root, "relocated plugin");
	mkdirSync(join(pluginRoot, "hooks", "lib"), { recursive: true });
	for (const file of ["ulw-execute-continuation.mjs", "ulw-execute-continuation.md", "lib/boulder-reader.mjs", "lib/plan-checklist.mjs"]) {
		cpSync(join(HOOKS_DIR, file), join(pluginRoot, "hooks", file));
	}
	return pluginRoot;
}

function copyContract(path) {
	mkdirSync(join(path, ".."), { recursive: true });
	cpSync(SELECTED_CONTRACT_FIXTURE, path);
}

function createWorkspace(sessionIds) {
	const root = mkdtempSync(join(tmpdir(), "codex-continuation-cli-"));
	cleanupRoots.push(root);
	mkdirSync(join(root, ".omo", "plans"), { recursive: true });
	writeFileSync(join(root, ".omo", "plans", "plan.md"), SCAFFOLD_PLAN_MARKDOWN);
	const work = {
		work_id: "w1",
		active_plan: ".omo/plans/plan.md",
		plan_name: "cli plan",
		session_ids: sessionIds,
		status: "active",
	};
	writeFileSync(
		join(root, ".omo", "boulder.json"),
		`${JSON.stringify({ schema_version: 2, active_work_id: "w1", works: { w1: work } })}\n`,
	);
	return root;
}

function makePayload(cwd, stopHookActive, eventName) {
	return {
		session_id: "s1",
		turn_id: "t1",
		transcript_path: "",
		cwd,
		hook_event_name: eventName,
		model: "gpt-5.5",
		permission_mode: "default",
		stop_hook_active: stopHookActive,
		last_assistant_message: "done",
	};
}

function parseStopHookOutput(stdout) {
	const parsed = JSON.parse(stdout);
	if (!isRecord(parsed) || typeof parsed["reason"] !== "string") throw new Error("CLI did not emit Stop hook JSON");
	return { decision: parsed["decision"], reason: parsed["reason"] };
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
