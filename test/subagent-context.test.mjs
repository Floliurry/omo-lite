import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const helperPath = fileURLToPath(new URL("../hooks/subagent-context.mjs", import.meta.url));

function payload(cwd, overrides = {}) {
	return {
		hook_event_name: "PreToolUse",
		cwd,
		model: "gpt-6-astra",
		permission_mode: "default",
		session_id: "session-1",
		turn_id: "turn-1",
		transcript_path: null,
		tool_name: "spawn_agent",
		tool_use_id: "tool-1",
		tool_input: {
			message: "Inspect the implementation.\n\nContext:\n- notes.txt#L2-L3\n",
			task_name: "inspect_notes",
			agent_type: "explorer",
			fork_turns: "none",
			metadata: { keep: true },
		},
		...overrides,
	};
}

function runHelper(input, cwd, args = []) {
	const result = spawnSync(process.execPath, [helperPath, ...args], {
		cwd,
		encoding: "utf8",
		input: typeof input === "string" ? input : JSON.stringify(input),
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	return result.stdout;
}

function runHook(input, cwd) {
	return runHelper(input, cwd);
}

function runMaterialize(references, cwd) {
	return runHelper("", cwd, ["--materialize", ...references]);
}

async function runHookChunks(input, cwd) {
	const encoded = Buffer.from(JSON.stringify(input));
	const child = spawn(process.execPath, [helperPath], { cwd, stdio: ["pipe", "pipe", "pipe"] });
	const stdout = [];
	const stderr = [];
	child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
	child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
	child.stdin.write(encoded.subarray(0, 17));
	child.stdin.end(encoded.subarray(17));
	const code = await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", resolve);
	});
	assert.equal(code, 0, Buffer.concat(stderr).toString("utf8"));
	assert.equal(Buffer.concat(stderr).toString("utf8"), "");
	return Buffer.concat(stdout).toString("utf8");
}

async function tempRoot(t) {
	const cwd = await mkdtemp(join(tmpdir(), "omo-spawn-context-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	return cwd;
}

function output(input, cwd) {
	const stdout = runHook(input, cwd);
	assert.notEqual(stdout, "");
	return JSON.parse(stdout);
}

function subagentStartPayload(cwd, overrides = {}) {
	return {
		hook_event_name: "SubagentStart",
		cwd,
		session_id: "parent-session-1",
		turn_id: "turn-1",
		agent_id: "child-1",
		permission_mode: "default",
		...overrides,
	};
}

test("#given materialize references #when the real CLI runs #then it emits one bounded self-described packet in declaration order", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "first.txt"), "first marker\n");
	await writeFile(join(cwd, "second.txt"), "one\ntwo\nthree\n");
	await writeFile(join(cwd, ".env"), "SECRET=private\n");
	await writeFile(join(cwd, "too-large.txt"), "x".repeat(128 * 1024 + 1));

	const packet = runMaterialize(["second.txt#L2-L3", "first.txt", "second.txt#L2-L3", ".env", "second.txt#L0-L1", "too-large.txt"], cwd);

	assert.match(packet, /^\n<!-- omo-spawn-context:v1 -->\n<omo-spawn-context>\n/);
	assert.match(packet, /Source: second\.txt#L2-L3/);
	assert.match(packet, /two\nthree/);
	assert.match(packet, /Source: first\.txt/);
	assert.ok(packet.indexOf("Source: second.txt#L2-L3") < packet.indexOf("Source: first.txt"));
	assert.equal((packet.match(/Source: second\.txt#L2-L3/g) ?? []).length, 1);
	assert.match(packet, /\.env.*private/);
	assert.match(packet, /second\.txt#L0-L1.*invalid reference/);
	assert.match(packet, /too-large\.txt.*bounded read limit/);
	assert.doesNotMatch(packet, /SECRET=private/);
	assert.ok(Buffer.byteLength(packet, "utf8") <= 32 * 1024);
});

test("#given a native child start without task or role fields #when the helper runs #then it emits only structured conditional loader guidance", async (t) => {
	const cwd = await tempRoot(t);
	const parsed = output(subagentStartPayload(cwd, { agent_id: undefined, turn_id: undefined }), cwd);

	assert.deepEqual(Object.keys(parsed), ["hookSpecificOutput"]);
	assert.deepEqual(Object.keys(parsed.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
	assert.equal(parsed.hookSpecificOutput.hookEventName, "SubagentStart");
	assert.equal(typeof parsed.hookSpecificOutput.additionalContext, "string");
	assert.match(parsed.hookSpecificOutput.additionalContext, /--materialize\b/);
	assert.doesNotMatch(parsed.hookSpecificOutput.additionalContext, /permissionDecision|updatedInput/);
});

test("#given a helper path with shell-sensitive characters #when startup guidance is executed #then the materialize CLI runs only that copied helper", async (t) => {
	if (process.platform === "win32") {
		t.skip("requires a POSIX shell");
		return;
	}
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "shell-safe marker\n");
	const copiedHelperPath = join(cwd, "helper 'with spaces' $(not-run).mjs");
	await copyFile(helperPath, copiedHelperPath);
	const startup = spawnSync(process.execPath, [copiedHelperPath], {
		cwd,
		encoding: "utf8",
		input: JSON.stringify(subagentStartPayload(cwd)),
	});
	assert.equal(startup.error, undefined, startup.error?.message);
	assert.equal(startup.status, 0, startup.stderr);
	assert.equal(startup.stderr, "");
	const guidance = JSON.parse(startup.stdout).hookSpecificOutput.additionalContext;
	const commandStart = guidance.indexOf("'");
	const materializeIndex = guidance.indexOf("--materialize", commandStart);
	assert.notEqual(commandStart, -1);
	assert.notEqual(materializeIndex, -1);
	const result = spawnSync(`${guidance.slice(commandStart, materializeIndex + "--materialize".length)} 'notes.txt'`, {
		cwd,
		encoding: "utf8",
		shell: "/bin/sh",
	});

	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	assert.match(result.stdout, /shell-safe marker/);
});

test("#given a Windows child startup #when the helper formats loader guidance #then it uses the PowerShell call operator and escaped single quotes", async (t) => {
	const cwd = await tempRoot(t);
	const copiedHelperPath = join(cwd, "helper 'with spaces'.mjs");
	await copyFile(helperPath, copiedHelperPath);
	const startup = spawnSync(process.execPath, [
		"--input-type=module",
		"--eval",
		`Object.defineProperty(process, "platform", { value: "win32" }); await import(process.argv[1]);`,
		pathToFileURL(copiedHelperPath).href,
	], {
		cwd,
		encoding: "utf8",
		input: JSON.stringify(subagentStartPayload(cwd)),
	});

	assert.equal(startup.error, undefined, startup.error?.message);
	assert.equal(startup.status, 0, startup.stderr);
	assert.equal(startup.stderr, "");
	const guidance = JSON.parse(startup.stdout).hookSpecificOutput.additionalContext;
	const invocation = /& '[\s\S]+?' '[\s\S]+?' --materialize\b/u.exec(guidance)?.[0];
	assert.notEqual(invocation, undefined);
	assert.match(invocation, /^& /);
	assert.match(invocation, /''with spaces''/);
});

test("#given unknown materialize arguments or no materialize references #when the helper runs #then it fails closed without output", async (t) => {
	const cwd = await tempRoot(t);

	assert.equal(runHelper("", cwd, []), "");
	assert.equal(runHelper("", cwd, ["--materialize"]), "");
	assert.equal(runHelper("", cwd, ["--unknown", "notes.txt"]), "");
});

test("#given a supported native spawn with final context references #when the helper runs #then it preserves arguments and appends only selected source data", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "first\nsecond\nthird\nfourth\n");
	const input = payload(cwd);

	const parsed = output(input, cwd);
	const updated = parsed.hookSpecificOutput.updatedInput;

	assert.deepEqual(parsed.hookSpecificOutput, {
		hookEventName: "PreToolUse",
		permissionDecision: "allow",
		updatedInput: updated,
	});
	assert.deepEqual({ ...updated, message: input.tool_input.message }, input.tool_input);
	assert.match(updated.message, /Inspect the implementation\./);
	assert.match(updated.message, /Context:\n- notes\.txt#L2-L3/);
	assert.match(updated.message, /Source: notes\.txt#L2-L3/);
	assert.match(updated.message, /second\nthird/);
	assert.doesNotMatch(updated.message.slice(input.tool_input.message.length), /first|fourth/);
});

test("#given each guarded spawn alias #when it has a valid context block #then the helper enriches it", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "marker\n");

	for (const toolName of ["spawn_agent", "collaborationspawn_agent", "collaboration.spawn_agent"]) {
		const parsed = output(payload(cwd, { tool_name: toolName, tool_input: { message: "Task\n\nContext:\n- notes.txt\n" } }), cwd);
		assert.match(parsed.hookSpecificOutput.updatedInput.message, /marker/);
	}
});

test("#given unsupported or malformed requests #when the helper runs #then it remains silent without rewriting", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "marker\n");

	assert.equal(runHook(payload(cwd, { tool_name: "Read" }), cwd), "");
	assert.equal(runHook(payload(cwd, { tool_input: { message: "Task without references" } }), cwd), "");
	assert.equal(runHook(payload(join(cwd, "does-not-exist"), { tool_input: { message: "Task without references" } }), cwd), "");
	assert.equal(runHook(payload(cwd, { tool_input: { message: "Context:\n- notes.txt\n\nMore task text" } }), cwd), "");
	assert.equal(runHook(payload(cwd, { tool_input: { message: "```md\nContext:\n- notes.txt\n```" } }), cwd), "");
	assert.equal(runHook(payload(cwd, { tool_input: { message: "> Context:\n> - notes.txt" } }), cwd), "");
	assert.equal(runHook(payload(cwd, { tool_input: { message: 42 } }), cwd), "");
	assert.equal(runHook("{not json", cwd), "");
});

test("#given an opaque native spawn message #when the helper runs #then it remains silent without recovering references from the transcript", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "source-marker\n");
	const transcript = join(cwd, "transcript.jsonl");
	await writeFile(transcript, `${JSON.stringify({ message: "Context:\n- notes.txt" })}\n`);
	const input = payload(cwd);
	input.tool_name = "collaborationspawn_agent";
	input.transcript_path = transcript;
	input.tool_input.message = "gAAAAA-opaque-fixture-not-real-ciphertext";
	assert.equal(runHook(input, cwd), "");
});

test("#given unavailable and unsafe references #when the helper runs #then it retains the references and adds bounded availability statuses", async (t) => {
	const cwd = await tempRoot(t);
	await mkdir(join(cwd, ".git"));
	await writeFile(join(cwd, ".git", "config"), "private\n");
	await writeFile(join(cwd, ".env"), "TOKEN=private\n");
	await writeFile(join(cwd, "binary.bin"), Buffer.from([0, 1, 2]));
	await writeFile(join(cwd, "malformed.txt"), Buffer.from([0xc3, 0x28]));
	await mkdir(join(cwd, ".ssh"));
	await writeFile(join(cwd, ".ssh", "config"), "private\n");
	await writeFile(join(cwd, "notes.txt"), "one\ntwo\n");
	const outside = join(tmpdir(), `omo-spawn-context-outside-${process.pid}.txt`);
	t.after(() => rm(outside, { force: true }));
	await writeFile(outside, "outside\n");
	await symlink(outside, join(cwd, "outside-link.txt"));
	await symlink(join(cwd, ".env"), join(cwd, "private-link.txt"));
	await symlink(join(cwd, ".ssh"), join(cwd, "private-dir-link"));

	const parsed = output(
		payload(cwd, {
			tool_input: {
				message:
					"Task\n\nContext:\n- missing.txt\n- notes.txt#L0-L1\n- .git/config\n- .env\n- ../outside.txt\n- /etc/passwd\n- outside-link.txt\n- private-link.txt\n- private-dir-link/config\n- binary.bin\n- malformed.txt\n",
			},
		}),
		cwd,
	);
	const message = parsed.hookSpecificOutput.updatedInput.message;

	for (const reference of ["missing.txt", "notes.txt#L0-L1", ".git/config", ".env", "../outside.txt", "/etc/passwd", "outside-link.txt", "private-link.txt", "private-dir-link/config", "binary.bin", "malformed.txt"]) {
		assert.match(message, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
	assert.match(message, /missing/);
	assert.match(message, /invalid reference/);
	assert.match(message, /private/);
	assert.match(message, /outside workspace/);
	assert.match(message, /binary/);
	assert.doesNotMatch(message, /TOKEN=private|outside\n/);
});

test("#given UTF-8 source data beyond the packet budget #when the helper runs #then it does not truncate or attach the source", async (t) => {
	const cwd = await tempRoot(t);
	const largeText = "你".repeat(11_000);
	await writeFile(join(cwd, "large.txt"), largeText);
	await writeFile(join(cwd, "small.txt"), "small marker\n");

	const input = payload(cwd, { tool_input: { message: "Task\n\nContext:\n- small.txt\n- large.txt\n" } });
	const parsed = output(input, cwd);
	const message = parsed.hookSpecificOutput.updatedInput.message;

	assert.match(message, /small marker/);
	assert.match(message, /large\.txt.*packet limit/);
	assert.doesNotMatch(message, /你/);
	assert.ok(Buffer.byteLength(message.slice(input.tool_input.message.length), "utf8") <= 32 * 1024);
});

test("#given bounded file, stdin, and reference limits #when the helper runs #then it reports unavailable material without partial source data", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "over-file-limit.txt"), "x".repeat(128 * 1024 + 1));
	const references = Array.from({ length: 65 }, (_, index) => `- missing-${index}.txt`).join("\n");
	const parsed = output(payload(cwd, { tool_input: { message: `Task\n\nContext:\n- over-file-limit.txt\n${references}\n` } }), cwd);
	const message = parsed.hookSpecificOutput.updatedInput.message;

	assert.match(message, /over-file-limit\.txt.*bounded read limit/);
	assert.match(message, /additional references.*reference limit/);
	assert.equal((message.match(/Source unavailable:/g) ?? []).length, 65);
	assert.equal(runHook(payload(cwd, { tool_input: { message: "x".repeat(256 * 1024) } }), cwd), "");
});

test("#given CRLF ranges and duplicate references #when the helper runs #then it preserves source order, deduplicates, and leaves explicit spawn settings untouched", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "first.txt"), "one\r\ntwo\r\nthree\r\n");
	await writeFile(join(cwd, "second.txt"), "second marker\r\n");
	const input = payload(cwd, {
		tool_input: {
			message: "Task\n\nContext:\n- second.txt\n- first.txt#L2-L3\n- second.txt\n",
			task_name: "inspect",
			model: "gpt-6-astra",
			reasoning_effort: "high",
			agent_type: "explorer",
		},
	});
	const updated = output(input, cwd).hookSpecificOutput.updatedInput;

	assert.deepEqual({ ...updated, message: input.tool_input.message }, input.tool_input);
	assert.ok(updated.message.indexOf("Source: second.txt") < updated.message.indexOf("Source: first.txt#L2-L3"));
	assert.equal((updated.message.match(/Source: second\.txt/g) ?? []).length, 1);
	assert.match(updated.message, /two\r\nthree\r\n/);
});

test("#given an already enriched assignment #when the helper runs again #then it is idempotent", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "marker\n");
	const first = output(payload(cwd), cwd).hookSpecificOutput.updatedInput.message;

	assert.equal(runHook(payload(cwd, { tool_input: { message: first, task_name: "unchanged" } }), cwd), "");
});

test("#given chunked native JSON stdin #when the helper runs #then it collects the complete bounded payload before enrichment", async (t) => {
	const cwd = await tempRoot(t);
	await writeFile(join(cwd, "notes.txt"), "chunked marker\n");

	const stdout = await runHookChunks(payload(cwd, { tool_input: { message: "Task\n\nContext:\n- notes.txt\n" } }), cwd);
	assert.match(JSON.parse(stdout).hookSpecificOutput.updatedInput.message, /chunked marker/);
});
