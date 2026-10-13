import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getPlanChecklist } from "../hooks/lib/plan-checklist.mjs";

const { scaffold } = await import(new URL("../skills/ulw-plan/scripts/scaffold-plan.mjs", import.meta.url).href);

function fields(draft) {
	const frontmatter = draft.split("---")[1];
	return Object.fromEntries(frontmatter.trim().split("\n").map((line) => {
		const separator = line.indexOf(":");
		return [line.slice(0, separator), line.slice(separator + 1).trim()];
	}));
}

test("#given the ulw-plan skill #when clear or unclear drafts are created #then only explicit review selection is recorded without a plan or approval", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ulwp-state-"));
	try {
		for (const intent of ["clear", "unclear"]) {
			for (const reviewRequired of [false, true]) {
				const slug = `${intent}-${reviewRequired}`;
				await scaffold(dir, { slug, intent, reviewRequired, draftOnly: true });
				const state = fields(await readFile(join(dir, ".omo/drafts", `${slug}.md`), "utf8"));
				assert.equal(state.intent, intent);
				assert.equal(state.status, "drafting");
				assert.equal(state.review_required, String(reviewRequired));
				assert.equal(state.review_selection, reviewRequired ? "explicit" : "not-selected");
				assert.equal(state.plan_path, `.omo/plans/${slug}.md`);
				assert.equal(state["pending-action"], `${reviewRequired ? "write and review" : "write"} .omo/plans/${slug}.md`);
				assert.equal(Object.hasOwn(state, "plan_sha256"), false);
				await assert.rejects(readFile(join(dir, state.plan_path)), { code: "ENOENT" });
			}
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("#given the ulw-plan skill legacy drafts and edited plans #when resumed with different flags #then artifacts remain byte-identical and reset remains guarded", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ulwp-legacy-"));
	try {
		await scaffold(dir, { slug: "legacy", intent: "unclear" });
		const draftPath = join(dir, ".omo/drafts/legacy.md");
		const planPath = join(dir, ".omo/plans/legacy.md");
		const legacy = "---\nintent: unclear\nreview_required: true\nplan_sha256: old-snapshot\n---\n# Draft: legacy\n## Approval gate\nUser explicitly requested both reviews. Momus pending.\n";
		const plan = (await readFile(planPath, "utf8")).replace("- [ ] 1. <title>", "- [x] 1. Completed stable task\n  Evidence: /tmp/task-result.txt") + "\nUser's remaining dependency: provider contract decision.\n";
		await writeFile(draftPath, legacy);
		await writeFile(planPath, plan);
		const result = await scaffold(dir, { slug: "legacy", intent: "clear", reviewRequired: false });
		assert.deepEqual(result.map(({ status }) => status), ["exists", "exists"]);
		assert.equal(await readFile(draftPath, "utf8"), legacy);
		assert.equal(await readFile(planPath, "utf8"), plan);
		await assert.rejects(scaffold(dir, { slug: "legacy", intent: "clear", reset: true }), /--force/);
		assert.equal(await readFile(draftPath, "utf8"), legacy);
		assert.equal(await readFile(planPath, "utf8"), plan);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("#given the ulw-plan skill scaffold #when the shipped checklist reader consumes its plan #then numeric and final verifier rows survive while prose is not work", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ulwp-reader-"));
	try {
		await scaffold(dir, { slug: "reader", intent: "clear" });
		const planPath = join(dir, ".omo/plans/reader.md");
		assert.deepEqual(getPlanChecklist(planPath), { completed: 0, remaining: 5, total: 5, nextTaskLabel: "1. <title>" });
		const plan = (await readFile(planPath, "utf8")).replace("- [ ] 1. <title>", "- [x] 1. Stable task\n  - [ ] 99. nested non-task\n- ordinary prose\n2. paragraph, not a task\n- [ ] 2. Next stable task");
		await writeFile(planPath, plan);
		assert.deepEqual(getPlanChecklist(planPath), { completed: 1, remaining: 5, total: 6, nextTaskLabel: "2. Next stable task" });
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
