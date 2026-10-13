import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { getPlanChecklist, readContinuationState } from "../hooks/lib/boulder-reader.mjs";

const skillUrl = new URL("../skills/ulw-execute/SKILL.md", import.meta.url);

test("#given the no-plan bootstrap example #when the real reader loads it #then Boulder continuation sees both tasks", async () => {
	const skill = await readFile(skillUrl, "utf8");
	const bootstrap = skill.split("### No-plan bootstrap\n", 2)[1]?.split("\n## Phase 2:", 1)[0];
	assert.ok(bootstrap, "no-plan bootstrap section must exist");
	const examples = [...bootstrap.matchAll(/```markdown\n([\s\S]*?)\n```/g)];
	assert.equal(examples.length, 1, "no-plan bootstrap must contain one executable Markdown example");
	const example = examples[0][1];

	const workspace = await mkdtemp(join(tmpdir(), "ulw-execute-bootstrap-"));
	try {
		const planPath = join(workspace, ".omo", "plans", "bootstrap.md");
		await mkdir(dirname(planPath), { recursive: true });
		await writeFile(planPath, example);
		const checklist = getPlanChecklist(planPath);
		assert.equal(checklist.total, 2);
		assert.equal(checklist.remaining, 2);
		assert.ok(checklist.nextTaskLabel);
		await writeFile(planPath, example.replace("- [ ] 1.", "- [x] 1."));
		const finalWaveChecklist = getPlanChecklist(planPath);
		assert.equal(finalWaveChecklist.completed, 1);
		assert.equal(finalWaveChecklist.remaining, 1);
		assert.match(finalWaveChecklist.nextTaskLabel, /^F1\. /);

		await writeFile(join(workspace, ".omo", "boulder.json"), JSON.stringify({
			schema_version: 2,
			active_work_id: "bootstrap",
			works: {
				bootstrap: {
					work_id: "bootstrap",
					active_plan: ".omo/plans/bootstrap.md",
					plan_name: "bootstrap",
					session_ids: ["codex:bootstrap-session"],
					status: "active",
				},
			},
		}));
		assert.deepEqual(readContinuationState(workspace, "bootstrap-session")?.checklist, finalWaveChecklist);
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
});
