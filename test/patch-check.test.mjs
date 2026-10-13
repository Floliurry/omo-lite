import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describeChanges, findAmbiguousHunks, parsePatch, plannedChanges, runHook } from "../hooks/patch-check.mjs";
import { describe, it } from "./expect.mjs";

const HOOK_PATH = fileURLToPath(new URL("../hooks/patch-check.mjs", import.meta.url));
const CWD = "/repo";

function files(map) {
	return (path) => map[path] ?? null;
}

function patch(...body) {
	return ["*** Begin Patch", ...body, "*** End Patch"].join("\n");
}

function preToolUse(command, readText) {
	const output = runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command }, cwd: CWD }, readText);
	return output === "" ? null : JSON.parse(output).hookSpecificOutput;
}

describe("patch-check before apply_patch", () => {
	it("#given a hunk that matches one place #when checked #then the patch is allowed", () => {
		const readText = files({ "/repo/a.txt": "one\ntwo\nthree\n" });
		assert.equal(preToolUse(patch("*** Update File: a.txt", "@@", " one", "-two", "+TWO"), readText), null);
	});

	it("#given a hunk whose lines occur twice #when checked #then it is refused with both line numbers", () => {
		const readText = files({ "/repo/a.txt": "value=old\nkeep\nvalue=old\n" });

		const decision = preToolUse(patch("*** Update File: a.txt", "@@", "-value=old", "+value=new"), readText);

		assert.equal(decision.permissionDecision, "deny");
		assert.match(decision.permissionDecisionReason, /a\.txt: hunk 1 matches 2 places \(lines 1, 3\)/);
		assert.match(decision.permissionDecisionReason, /@@/);
	});

	it("#given repeated lines under different headings #when an @@ anchor names the second heading #then the hunk matches one place", () => {
		const readText = files({ "/repo/a.toml": "[a]\nenabled = true\n[b]\nenabled = true\n" });
		assert.equal(preToolUse(patch("*** Update File: a.toml", "@@ [b]", "-enabled = true", "+enabled = false"), readText), null);
	});

	it("#given an @@ anchor above the first of two identical lines #when checked #then the first match after the anchor is the only place and the patch is allowed", () => {
		const readText = files({ "/repo/a.toml": "[alpha]\nenabled = true\n[beta]\nenabled = true\n" });
		assert.equal(preToolUse(patch("*** Update File: a.toml", "@@ [alpha]", "-enabled = true", "+enabled = false"), readText), null);
	});

	it("#given an @@ anchor line that occurs twice #when each occurrence leads to a different match #then the hunk is refused with both places", () => {
		const readText = files({ "/repo/a.rs": "fn run() {\n    x();\n}\nfn run() {\n    x();\n}\n" });
		assert.deepEqual(findAmbiguousHunks(patch("*** Update File: a.rs", "@@ fn run() {", "-    x();", "+    y();"), CWD, readText), [{ path: "a.rs", hunk: 1, lines: [2, 5] }]);
	});

	it("#given two hunks for a line that occurs twice #when the first hunk consumes the first occurrence #then the second searches after it and is allowed", () => {
		const readText = files({ "/repo/a.txt": "start\nx\nmiddle\nx\n" });
		const command = patch("*** Update File: a.txt", "@@", " start", "-x", "+x1", "@@", "-x", "+x2");
		assert.deepEqual(findAmbiguousHunks(command, CWD, readText), []);
	});

	it("#given one exact match and one match differing only in trailing spaces #when checked #then the exact level decides and the patch is allowed", () => {
		const readText = files({ "/repo/a.txt": "foo  \nfoo\n" });
		assert.equal(preToolUse(patch("*** Update File: a.txt", "@@", "-foo", "+bar"), readText), null);
	});

	it("#given lines that differ only in quote style #when a pattern matches one exactly #then only that line counts, and a pattern matching both only after normalising reports both", () => {
		const readText = files({ "/repo/a.txt": "say “hi”\nsay \"hi\"\n" });
		assert.deepEqual(findAmbiguousHunks(patch("*** Update File: a.txt", "@@", "-say “hi”", "+say bye"), CWD, readText), []);
		const both = findAmbiguousHunks(patch("*** Update File: a.txt", "@@", "-say „hi“", "+say bye"), CWD, readText);
		assert.deepEqual(both, [{ path: "a.txt", hunk: 1, lines: [1, 2] }]);
	});

	it("#given an end-of-file hunk whose lines also occur earlier #when checked #then only the end of the file is considered", () => {
		const readText = files({ "/repo/a.txt": "}\nmore\n}\n" });
		assert.equal(preToolUse(patch("*** Update File: a.txt", "@@", "-}", "+};", "*** End of File"), readText), null);
	});

	it("#given a stale hunk that matches nowhere #when checked #then it is left for apply_patch to report", () => {
		const readText = files({ "/repo/a.txt": "new\n" });
		assert.equal(preToolUse(patch("*** Update File: a.txt", "@@", "-old", "+newer"), readText), null);
	});

	it("#given added, deleted and missing files #when checked #then only updates of existing files are examined", () => {
		const command = patch("*** Add File: b.txt", "+x", "*** Delete File: c.txt", "*** Update File: missing.txt", "@@", "-x", "+y");
		assert.equal(preToolUse(command, files({})), null);
	});

	it("#given a heredoc-wrapped patch #when parsed #then the markers are stripped as apply_patch does", () => {
		const hunks = parsePatch(`<<'EOF'\n${patch("*** Update File: a.txt", "@@ fn main", " a", "-b", "+c")}\nEOF`);
		assert.equal(hunks.length, 1);
		assert.deepEqual(hunks[0].chunks[0], { context: "fn main", oldLines: ["a", "b"], newLines: ["a", "c"], kinds: ["context", "old", "new"], eof: false });
	});

	it("#given a context line that starts with a space and looks like a header #when parsed #then it stays a context line", () => {
		const hunks = parsePatch(patch("*** Update File: a.md", "@@", " *** Add File: not-a-header", "-x", "+y"));
		assert.equal(hunks.length, 1);
		assert.deepEqual(hunks[0].chunks[0].oldLines, ["*** Add File: not-a-header", "x"]);
	});
});

describe("patch-check after apply_patch", () => {
	it("#given a successful patch #when described #then each file lists the changed lines in the new file", () => {
		const readText = files({ "/repo/a.txt": "one\nTWO\nTHREE\nfour\n", "/repo/new.txt": "x\ny\n" });
		const command = patch("*** Update File: a.txt", "@@", " one", "-two", "-three", "+TWO", "+THREE", " four", "*** Add File: new.txt", "+x", "+y", "*** Delete File: old.txt");

		assert.deepEqual(describeChanges(command, CWD, readText), ["a.txt lines 2-3", "new.txt (new, 2 lines)", "old.txt (deleted)"]);
	});

	it("#given a moved file and a pure deletion #when described #then the move and the removal point are named", () => {
		const readText = files({ "/repo/b.txt": "keep\nend\n" });
		const command = patch("*** Update File: a.txt", "*** Move to: b.txt", "@@", " keep", "-drop", " end");

		assert.deepEqual(describeChanges(command, CWD, readText), ["a.txt -> b.txt lines removed before line 2"]);
	});

	it("#given PostToolUse input #when the hook runs #then the receipt is additional context", () => {
		const readText = files({ "/repo/a.txt": "one\nTWO\n" });
		const output = runHook({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: patch("*** Update File: a.txt", "@@", " one", "-two", "+TWO") }, cwd: CWD }, readText);

		const parsed = JSON.parse(output).hookSpecificOutput;
		assert.equal(parsed.hookEventName, "PostToolUse");
		assert.match(parsed.additionalContext, /^Patched: a\.txt line 2\./);
	});

	it("#given another tool or malformed input #when the hook runs #then it stays silent", () => {
		for (const input of [null, {}, { hook_event_name: "PreToolUse", tool_name: "exec_command", tool_input: { command: "ls" } }, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: {} }]) {
			assert.equal(runHook(input, files({})), "");
		}
		assert.equal(preToolUse("not a patch", files({ "/repo/a.txt": "x\nx\n" })), null);
	});
});

describe("patch-check receipt worked out before the patch", () => {
	// Receipts kept in memory, standing in for the files that carry them from Pre to Post.
	function memoryReceipts() {
		const saved = new Map();
		return { save: (id, parts) => saved.set(id, parts), take: (id) => saved.get(id) ?? null };
	}

	function preThenPost(command, before, after) {
		const receipts = memoryReceipts();
		const input = { tool_name: "apply_patch", tool_use_id: "call-1", cwd: CWD };
		const pre = runHook({ ...input, hook_event_name: "PreToolUse", tool_input: { command } }, files({ "/repo/a.txt": before }), receipts);
		const sent = pre === "" ? command : (JSON.parse(pre).hookSpecificOutput.updatedInput?.command ?? command);
		const post = runHook({ ...input, hook_event_name: "PostToolUse", tool_input: { command: sent } }, files({ "/repo/a.txt": after }), receipts);
		return JSON.parse(post).hookSpecificOutput.additionalContext;
	}

	it("#given an edit whose new text already occurs above it #when it runs as JSON or as a patch #then the receipt names the edited line", () => {
		const json = JSON.stringify({ edit: "a.txt", old: "old", new: "new" });
		assert.match(preThenPost(json, "new\nold\n", "new\nnew\n"), /^Patched: a\.txt line 2\./);
		assert.match(preThenPost(patch("*** Update File: a.txt", "@@", "-old", "+new"), "new\nold\n", "new\nnew\n"), /^Patched: a\.txt line 2\./);
	});

	it("#given chunks that add lines above later ones and a chunk with no old lines #when planned #then each range is in the new file", () => {
		const readText = files({ "/repo/a.txt": "a\nb\nc\nd\n" });
		const command = patch("*** Update File: a.txt", "@@", " a", "+a1", "+a2", " b", "@@", " c", "-d", "+D", "@@", "+end");

		assert.deepEqual(plannedChanges(command, CWD, readText), ["a.txt lines 2-3, line 6, line 7"]);
	});
});

describe("patch-check for an edit sent as JSON", () => {
	it("#given an edit whose old text occurs once #when checked #then apply_patch gets a patch for that place", () => {
		const readText = files({ "/repo/a.txt": "a\n}\nb\n}\nc\n" });
		const decision = preToolUse(JSON.stringify({ edit: "a.txt", old: "b\n}", new: "b\n};" }), readText);

		assert.equal(decision.permissionDecision, "allow");
		assert.equal(decision.updatedInput.command, patch("*** Update File: a.txt", "@@", " b", "-}", "+};"));
	});

	it("#given a write to an existing file and one to a new file #when checked #then the first changes only differing lines and the second adds the file", () => {
		const readText = files({ "/repo/a.txt": "old\nsame\n" });
		const decision = preToolUse(JSON.stringify([{ write: "a.txt", content: "new\nsame\n" }, { write: "n.txt", content: "x\n" }]), readText);

		assert.equal(decision.updatedInput.command, patch("*** Update File: a.txt", "@@", "-old", "+new", "*** Add File: n.txt", "+x"));
	});

	it("#given old text that occurs twice or not at all #when checked #then the edit is refused with the reason", () => {
		const readText = files({ "/repo/a.txt": "a\nb\na\n" });

		assert.match(preToolUse(JSON.stringify({ edit: "a.txt", old: "a", new: "y" }), readText).permissionDecisionReason, /occurs 2 times in a\.txt \(lines 1, 3\)/);
		assert.match(preToolUse(JSON.stringify({ edit: "a.txt", old: "z", new: "y" }), readText).permissionDecisionReason, /not found in a\.txt/);
	});

	it("#given old text that differs from the file only in full-width punctuation #when checked #then the refusal quotes the file's text and line", () => {
		const readText = files({ "/repo/a.md": "# 标题\n接地仅单列数据，不纳入判定。线路按 20% 评价。\n" });
		const reason = preToolUse(JSON.stringify({ edit: "a.md", old: "不纳入判定.线路", new: "不纳入判定.线路回路" }), readText).permissionDecisionReason;

		assert.match(reason, /not found in a\.md\. It matches one place once full-width and ASCII punctuation are treated alike: line 2 has "不纳入判定。" where the old text has "不纳入判定\."/);
	});

	it("#given old text whose punctuation-folded form matches two places #when checked #then the plain not-found reason is given", () => {
		const readText = files({ "/repo/a.md": "（完成）\n(完成)\n" });
		const reason = preToolUse(JSON.stringify({ edit: "a.md", old: "(完成）", new: "x" }), readText).permissionDecisionReason;

		assert.match(reason, /not found in a\.md\. Copy it from the file exactly, including whitespace, punctuation and line breaks/);
	});

	it("#given PostToolUse input that still holds the JSON #when the hook runs #then the receipt names the new lines", () => {
		const readText = files({ "/repo/a.txt": "one\nTWO\nthree\n" });
		const output = runHook({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: JSON.stringify({ edit: "a.txt", old: "two", new: "TWO" }) }, cwd: CWD }, readText);

		assert.match(JSON.parse(output).hookSpecificOutput.additionalContext, /^Patched: a\.txt line 2\./);
	});

	it("#given JSON that is not an edit #when checked #then it is left for apply_patch", () => {
		assert.equal(preToolUse(JSON.stringify({ path: "a.txt" }), files({})), null);
	});
});

describe("patch-check for a patch sent through the shell", () => {
	function shell(event, command, readText) {
		return runHook({ hook_event_name: event, tool_name: "Bash", tool_input: { command }, cwd: CWD }, readText);
	}

	it("#given apply_patch in a heredoc with an ambiguous hunk #when checked #then it is refused like the tool call", () => {
		const readText = files({ "/repo/a.txt": "value=old\nvalue=old\n" });

		const output = shell("PreToolUse", `apply_patch <<'EOF'\n${patch("*** Update File: a.txt", "@@", "-value=old", "+value=new")}\nEOF\n`, readText);

		assert.match(JSON.parse(output).hookSpecificOutput.permissionDecisionReason, /a\.txt: hunk 1 matches 2 places \(lines 1, 2\)/);
	});

	it("#given cd before apply_patch #when checked #then the patch paths resolve inside that directory", () => {
		const readText = files({ "/repo/sub/a.txt": "x\nx\n", "/repo/a.txt": "x\n" });

		const output = shell("PreToolUse", `cd 'sub' && applypatch <<EOF\n${patch("*** Update File: a.txt", "@@", "-x", "+y")}\nEOF`, readText);

		assert.equal(JSON.parse(output).hookSpecificOutput.permissionDecision, "deny");
	});

	it("#given other shell commands, including ones that only mention apply_patch #when checked #then the hook stays silent", () => {
		const readText = files({ "/repo/a.txt": "x\nx\n" });
		for (const command of ["ls -la", "rg -n apply_patch src", `echo hi && apply_patch <<'EOF'\n${patch("*** Update File: a.txt", "@@", "-x", "+y")}\nEOF`]) {
			assert.equal(shell("PreToolUse", command, readText), "");
		}
	});
});

describe("patch-check CLI", () => {
	it("#given a real file with a repeated line #when the hook runs as a process #then stdout carries the deny decision", () => {
		const dir = mkdtempSync(join(tmpdir(), "omo-patch-check-"));
		try {
			writeFileSync(join(dir, "a.txt"), "value=old\nvalue=old\n");
			const input = { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: patch("*** Update File: a.txt", "@@", "-value=old", "+value=new") }, cwd: dir };

			const result = spawnSync(process.execPath, [HOOK_PATH], { input: JSON.stringify(input), encoding: "utf8" });

			assert.equal(result.status, 0, result.stderr);
			assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("#given a real patch run in two processes #when PostToolUse follows PreToolUse for the same call #then the receipt saved before names the edited line", () => {
		const dir = mkdtempSync(join(tmpdir(), "omo-patch-check-"));
		try {
			writeFileSync(join(dir, "a.txt"), "new\nold\n");
			const call = { tool_name: "apply_patch", tool_use_id: `call-${process.pid}-${Date.now()}`, tool_input: { command: patch("*** Update File: a.txt", "@@", "-old", "+new") }, cwd: dir };
			const hook = (event) => spawnSync(process.execPath, [HOOK_PATH], { input: JSON.stringify({ ...call, hook_event_name: event }), encoding: "utf8" });

			assert.equal(hook("PreToolUse").stdout, "");
			writeFileSync(join(dir, "a.txt"), "new\nnew\n");
			const post = hook("PostToolUse");

			assert.match(JSON.parse(post.stdout).hookSpecificOutput.additionalContext, /^Patched: a\.txt line 2\./);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("#given malformed stdin #when the hook runs as a process #then it exits cleanly without output", () => {
		const result = spawnSync(process.execPath, [HOOK_PATH], { input: "{broken", encoding: "utf8" });
		assert.equal(result.status, 0);
		assert.equal(result.stdout, "");
	});
});
