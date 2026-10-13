import assert from "node:assert/strict";
import test from "node:test";

import { cleanupTeamRoot, createTeamRoot, runTeam } from "./teammode-safety-fixture.mjs";

test("#given a team member #when preparing its native spawn #then emits only exposed V2 fields", () => {
	const tempRoot = createTeamRoot("omo-teammode-v2-schema-");
	try {
		// given
		runTeam(tempRoot, "init", "--name", "Schema", "--session-name", "schema", "--session", "schema", "--transport", "multi_agent_v2");

		// when
		const added = runTeam(
			tempRoot,
			"add-member",
			"--team",
			"schema",
			"--id",
			"A",
			"--name",
			"schema-member",
			"--task-name",
			"schema_member",
			"--focus",
			"spawn schema",
			"--lens",
			"area",
			"--deliverable",
			"schema contract",
		);

		// then - the old fork pinned "using only ..." and no "model" at all, but team.mjs and the
		// teammode skill already allowed model/effort overrides when the schema exposes them, so this
		// pins the current wording: the fixed V2 fields, no unexposed field names, then bind-agent.
		assert.match(added.stdout, /spawn_agent using task_name "schema_member", message <bootstrap>, and fork_turns "none"/);
		assert.match(added.stdout, /model\/effort overrides only when exposed/);
		assert.match(added.stdout, /bind-agent --agent-path "\/root\/schema_member"/);
		assert.doesNotMatch(added.stdout, /agent_type|reasoning_effort|service_tier/);
	} finally {
		cleanupTeamRoot(tempRoot);
	}
});
