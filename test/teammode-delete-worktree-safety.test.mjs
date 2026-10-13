import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../skills/teammode/scripts/team.mjs", import.meta.url));

function run(cwd, args) {
	const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
	if (result.error) throw result.error;
	return result;
}

for (const force of [false, true]) {
	test(`archived team with untracked worktree content refuses deletion (force=${force})`, () => {
		const cwd = mkdtempSync(join(tmpdir(), "omo-team-delete-"));
		try {
			assert.equal(run(cwd, ["init", "--name", "fixture", "--session-name", "fixture", "--session", "s1"]).status, 0);
			assert.equal(run(cwd, ["archive", "--team", "s1"]).status, 0);
			const worktree = join(cwd, ".omo", "teams", "s1", "worktrees", "orphan");
			mkdirSync(worktree, { recursive: true });
			const sentinel = join(worktree, "untracked.txt");
			writeFileSync(sentinel, "keep this user work\n");
			const result = run(cwd, ["delete", "--team", "s1", ...(force ? ["--force"] : [])]);
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /worktree/i);
			assert.equal(readFileSync(sentinel, "utf8"), "keep this user work\n");
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
}

test("archived team without member worktrees can be deleted", () => {
	const cwd = mkdtempSync(join(tmpdir(), "omo-team-delete-"));
	try {
		assert.equal(run(cwd, ["init", "--name", "fixture", "--session-name", "fixture", "--session", "s1"]).status, 0);
		assert.equal(run(cwd, ["archive", "--team", "s1"]).status, 0);
		const result = run(cwd, ["delete", "--team", "s1"]);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /deleted team state/);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
