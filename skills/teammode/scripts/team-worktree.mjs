// team-worktree.mjs - git worktree provisioning + merge integration for teammode.
//
// Shells out to `git` through node:child_process so the leader never hand-runs worktree or
// merge commands and never improvises a branch name. Zero npm dependencies, like the rest of
// the skill. team-state.mjs stays the pure state model; this file owns the git side only.

import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

// A member id that also names a directory and a branch segment: no "/", no "..", no leading dot.
const MEMBER_ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// Compare two on-disk paths regardless of OS. realpathSync canonicalizes separators, Windows
// 8.3 short names (RUNNER~1) and drive-letter case, and the macOS /var -> /private/var symlink -
// none of which plain resolve() reconciles. Returns false if either side no longer exists.
function samePath(a, b) {
	try {
		return realpathSync(a) === realpathSync(b);
	} catch {
		return false;
	}
}

function git(cwd, args) {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.error) throw new Error(`git ${args.join(" ")} could not run: ${result.error.message}`);
	return result;
}

function gitOrThrow(cwd, args) {
	const result = git(cwd, args);
	if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
	return result.stdout ?? "";
}

export function deriveMemberBranch(team, member) {
	if (member.worktree?.branch) return member.worktree.branch;
	return `team/${team.sessionId ?? team.teamId}/${member.id}`;
}

// Confine a member worktree to <worktree.root>/<member id>; reject any id that would escape it.
export function memberWorktreePath(team, member) {
	if (!MEMBER_ID_SEGMENT.test(member.id ?? "")) throw new Error(`unsafe member id for a worktree path: "${member.id}"`);
	const root = team.worktree?.root;
	if (!root) throw new Error("team has no worktree root; re-init the team");
	const path = join(root, member.id);
	const rel = relative(root, path);
	if (rel !== member.id || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`refused: worktree path escapes ${root}`);
	return path;
}

export function listWorktrees(cwd) {
	const out = gitOrThrow(cwd, ["worktree", "list", "--porcelain"]);
	const worktrees = [];
	let current = null;
	for (const line of out.split("\n")) {
		if (line.startsWith("worktree ")) {
			current = { path: line.slice("worktree ".length) };
			worktrees.push(current);
		} else if (line.startsWith("branch ") && current) {
			current.branch = line.slice("branch ".length);
		}
	}
	return worktrees;
}

function branchExists(cwd, branch) {
	return git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
}

function currentBranch(cwd) {
	return gitOrThrow(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

export function addMemberWorktree(cwd, team, member, { baseBranch } = {}) {
	const base = baseBranch || team.worktree?.baseBranch || "dev";
	const branch = deriveMemberBranch(team, member);
	const path = memberWorktreePath(team, member);
	// Idempotent only when the member's directory already holds the member's branch. The branch is
	// matched on its ref, which is OS-agnostic, and the directory on realpath, so a Windows 8.3 git
	// path and a long script path still compare equal. When only one of the two matches, the branch
	// is checked out elsewhere or the directory holds another branch; recording the expected
	// directory then would send the member to the wrong cwd, so the leader is told instead.
	const branchRef = `refs/heads/${branch}`;
	const atPath = (w) => samePath(resolve(cwd, w.path), resolve(cwd, path));
	const worktrees = listWorktrees(cwd);
	if (worktrees.some((w) => w.branch === branchRef && atPath(w))) return { path, branch, base, created: false };
	const elsewhere = worktrees.find((w) => w.branch === branchRef);
	if (elsewhere) throw new Error(`branch ${branch} is already checked out at ${elsewhere.path}, not at the member's worktree ${path}; remove that worktree (git worktree remove "${elsewhere.path}") and run worktree-add again`);
	const occupied = worktrees.find(atPath);
	if (occupied) throw new Error(`${path} is already a worktree on ${occupied.branch?.replace(/^refs\/heads\//, "") ?? "a detached HEAD"}, not on ${branch}; remove it and run worktree-add again`);
	const add = branchExists(cwd, branch)
		? ["worktree", "add", path, branch]
		: ["worktree", "add", "-b", branch, path, base];
	gitOrThrow(cwd, add);
	return { path, branch, base, created: true };
}

export function removeMemberWorktree(cwd, team, member, { force = false } = {}) {
	const path = memberWorktreePath(team, member);
	gitOrThrow(cwd, ["worktree", "remove", ...(force ? ["--force"] : []), path]);
	return { path };
}

// Land a member branch with a MERGE COMMIT (--no-ff). Never squash, never rebase (repo policy).
// On conflict the working tree is left mid-merge so the leader can resolve and re-run.
export function integrateMemberBranch(cwd, branch) {
	const result = git(cwd, ["merge", "--no-ff", "--no-edit", branch]);
	if (result.status === 0) return { branch, merged: true, into: currentBranch(cwd) };
	const conflicts = gitOrThrow(cwd, ["diff", "--name-only", "--diff-filter=U"]).trim();
	return {
		branch,
		merged: false,
		into: currentBranch(cwd),
		conflicts: conflicts ? conflicts.split("\n") : [],
		message: (result.stderr || result.stdout || "").trim(),
	};
}

// Deleting metadata must never implicitly discard member checkouts, including orphaned content.
export function assertWorktreesRemoved(team, dir) {
	if (team.members.some((member) => member.worktree?.path)) {
		throw new Error("refused: member worktrees remain; preserve changes and use worktree-remove before deleting team state");
	}
	const root = join(dir, "worktrees");
	try {
		const stat = lstatSync(root);
		if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(root).length > 0) {
			throw new Error("refused: worktree content remains; preserve changes and remove worktrees safely before deleting team state");
		}
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
		throw error;
	}
}
