import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runHook as resetReads } from "../hooks/read-reset.mjs";
import { globCommand, grepCommand, main, readCommand, runCommand } from "../tools/omo.mjs";
import { afterEach, beforeEach, describe, it } from "./expect.mjs";

const TOOL_PATH = fileURLToPath(new URL("../tools/omo.mjs", import.meta.url));

let root;
let readsRoot;

function setup() {
	root = mkdtempSync(join(tmpdir(), "omo-tools-"));
	readsRoot = join(root, ".reads");
}

function teardown() {
	rmSync(root, { recursive: true, force: true });
}

function write(name, text) {
	const path = join(root, name);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, text);
	return path;
}

function read(args, options = {}) {
	return readCommand(args, { cwd: root, threadId: undefined, readsRoot, ...options });
}

function numbered(count) {
	return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n");
}

describe("omo read", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("#given a small file #when read without a range #then every line is printed with its number after a header", () => {
		write("a.txt", "alpha\n\tbeta\n\ngamma");
		assert.deepEqual(read(["a.txt"]), { output: "a.txt (lines 1-4 of 4)\n1\talpha\n2\t\tbeta\n3\t\n4\tgamma", code: 0 });
	});

	it("#given a range #when read #then only those lines are printed and an open range runs to the end", () => {
		write("a.txt", `${numbered(10)}\n`);
		assert.equal(read(["a.txt", "3-4"]).output, "a.txt (lines 3-4 of 10)\n3\tline 3\n4\tline 4");
		assert.equal(read(["a.txt", "9"]).output, "a.txt (lines 9-10 of 10)\n9\tline 9\n10\tline 10");
	});

	it("#given a file larger than one page #when read #then the first page ends with the command for the next page", () => {
		write("big.txt", `${numbered(100)}\n`);

		const { output } = read(["big.txt"], { pageBytes: 100 });

		const lines = output.split("\n");
		assert.equal(lines[0], "big.txt (lines 1-10 of 100)");
		assert.equal(lines[10], "10\tline 10");
		assert.match(lines[11], /^\[omo read: stopped at line 10 of 100 .* Next page: omo read big\.txt 11\. .*Do not conclude from this page alone/);
	});

	it("#given a bounded range larger than a page #when read #then the next page stays inside the range", () => {
		write("big.txt", `${numbered(100)}\n`);
		assert.match(read(["big.txt", "1-15"], { pageBytes: 100 }).output, /Next page: omo read big\.txt 11-15\./);
	});

	it("#given pages of different widths #when each next-page command is followed #then the reads reach the last line", () => {
		write("big.txt", `${numbered(1200)}\n`);
		for (const range of [undefined, "1-1150"]) {
			let args = range === undefined ? ["big.txt"] : ["big.txt", range];
			let lastLine = null;
			for (let reads = 0; reads < 50; reads += 1) {
				const { output } = read(args, { pageBytes: 3000 });
				lastLine = output.split("\n").filter((line) => /^\d+\t/.test(line)).at(-1).split("\t")[0];
				const next = /Next page: omo read (\S+) (\S+)\./.exec(output);
				if (next === null) break;
				args = [next[1], next[2]];
			}
			assert.equal(lastLine, range === undefined ? "1200" : "1150");
		}
	});

	it("#given CRLF line ends and a very long line #when read #then the carriage returns are dropped and the long line is cut with a note", () => {
		write("a.txt", `short\r\n${"x".repeat(2500)}\r\n`);

		const lines = read(["a.txt"]).output.split("\n");

		assert.equal(lines[1], "1\tshort");
		assert.equal(lines[2], `2\t${"x".repeat(2000)} [... cut; the line has 2501 bytes]`);
		assert.match(lines[3], /line 2 is longer than 2,000 characters/);
	});

	it("#given a missing file, a directory, an empty file, a binary file and a range past the end #when read #then each gets a one-line explanation", () => {
		mkdirSync(join(root, "dir"));
		write("empty.txt", "");
		write("bin.dat", Buffer.from([1, 0, 2]));
		write("a.txt", "one\n");

		assert.deepEqual(read(["nope.txt"]), { output: "omo read: nope.txt does not exist.", code: 1 });
		assert.match(read(["dir"]).output, /is a directory; list it with omo glob '\*' dir/);
		assert.deepEqual(read(["empty.txt"]), { output: "empty.txt (empty file)", code: 0 });
		assert.match(read(["bin.dat"]).output, /is a binary file \(3 bytes\)/);
		assert.match(read(["a.txt", "5"]).output, /has 1 lines; line 5 is past the end/);
		assert.equal(read(["a.txt", "5-2"]).code, 2);
	});
});

describe("omo read with several files", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("#given two files and a range after the second #when read #then each is printed under its own header and the range applies to the second", () => {
		write("a.txt", "alpha\n");
		write("b.txt", `${numbered(10)}\n`);
		assert.deepEqual(read(["a.txt", "b.txt", "3-4"]), { output: "a.txt (lines 1-1 of 1)\n1\talpha\n\nb.txt (lines 3-4 of 10)\n3\tline 3\n4\tline 4", code: 0 });
	});

	it("#given files that do not all fit in a page #when read #then the ones that fit are whole and the rest wait for one next command", () => {
		write("a.txt", `${numbered(5)}\n`);
		write("b.txt", `${numbered(5)}\n`);
		write("c.txt", `${numbered(5)}\n`);

		const { output } = read(["a.txt", "b.txt", "c.txt", "2-4"], { pageBytes: 120 });

		assert.match(output, /^a\.txt \(lines 1-5 of 5\)\n(.*\n){5}\nb\.txt \(lines 1-5 of 5\)/);
		assert.doesNotMatch(output, /c\.txt \(lines/);
		assert.match(output, /\[omo read: stopped before c\.txt .* Next: omo read c\.txt 2-4\]$/);
	});

	it("#given a first file larger than a page #when read with others #then it is paged and the others wait", () => {
		write("big.txt", `${numbered(100)}\n`);
		write("small.txt", "x\n");

		const { output } = read(["big.txt", "small.txt"], { pageBytes: 100 });

		assert.match(output, /Next page: omo read big\.txt 11\./);
		assert.match(output, /Next: omo read small\.txt\]$/);
	});

	it("#given a missing file among others #when read #then it gets a one-line note and the others are printed", () => {
		write("a.txt", "alpha\n");
		assert.deepEqual(read(["gone.txt", "a.txt"]), { output: "omo read: gone.txt does not exist.\n\na.txt (lines 1-1 of 1)\n1\talpha", code: 0 });
		assert.equal(read(["gone.txt", "also-gone.txt"]).code, 1);
	});

	it("#given a range with no file before it #when read #then the usage is printed", () => {
		assert.equal(read(["3-4", "a.txt"]).code, 2);
	});
});

describe("omo read in a Codex thread", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("#given a range this thread already read #when it is read again unchanged #then a note replaces the content, and --again prints it", () => {
		write("a.txt", `${numbered(5)}\n`);
		const options = { threadId: "thread-1" };

		read(["a.txt", "2-3"], options);
		const repeat = read(["a.txt", "2-3"], options);
		const forced = read(["a.txt", "2-3", "--again"], options);

		assert.match(repeat.output, /^a\.txt lines 2-3: unchanged since this thread read them; .* omo read a\.txt 2-3 --again$/);
		assert.equal(forced.output, "a.txt (lines 2-3 of 5)\n2\tline 2\n3\tline 3");
	});

	it("#given a read range #when the file changes, another thread reads it or no thread is set #then the content is printed", () => {
		const path = write("a.txt", `${numbered(5)}\n`);
		read(["a.txt"], { threadId: "thread-1" });

		assert.match(read(["a.txt"], { threadId: "thread-2" }).output, /^a\.txt \(lines 1-5 of 5\)/);
		assert.match(read(["a.txt"]).output, /^a\.txt \(lines 1-5 of 5\)/);
		utimesSync(path, new Date(), new Date(Date.now() + 5000));
		assert.match(read(["a.txt"], { threadId: "thread-1" }).output, /^a\.txt \(lines 1-5 of 5\)/);
	});

	it("#given a compaction in the thread #when the reset hook runs #then the same range prints its content again", () => {
		write("a.txt", "one\n");
		read(["a.txt"], { threadId: "main-thread" });
		read(["a.txt"], { threadId: "child-thread" });

		resetReads({ hook_event_name: "PostCompact", session_id: "main-thread", agent_id: "child-thread" }, readsRoot);

		assert.match(read(["a.txt"], { threadId: "child-thread" }).output, /^a\.txt \(lines 1-1 of 1\)/);
		assert.match(read(["a.txt"], { threadId: "main-thread" }).output, /unchanged since this thread read them/);
		resetReads({ hook_event_name: "PostCompact", session_id: "main-thread" }, readsRoot);
		assert.match(read(["a.txt"], { threadId: "main-thread" }).output, /^a\.txt \(lines 1-1 of 1\)/);
	});
});

describe("omo grep and glob", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("#given matches in two files #when searched #then lines are grouped under each file with their numbers", async () => {
		write("src/a.js", "const x = 1;\nfoo();\n");
		write("src/b.js", "foo(1);\n");

		const { output, code } = await grepCommand(["foo", "src"], { cwd: root });

		assert.equal(code, 0);
		assert.equal(output, "src/a.js\n2:foo();\n\nsrc/b.js\n1:foo(1);");
	});

	it("#given more matching lines than the cap #when searched #then the output stops with the total and how to narrow it", async () => {
		write("a.txt", `${"hit\n".repeat(30)}`);
		write("b.txt", "hit\n");

		const { output } = await grepCommand(["hit"], { cwd: root, maxLines: 5 });

		const lines = output.split("\n");
		assert.equal(lines.length, 6);
		assert.equal(lines[5], "[omo grep: showing the first 5 lines of 31 matching lines in 2 files. Narrow the pattern or the paths, or list the files first with omo grep -l.]");
	});

	it("#given -l #when searched #then each file is listed with its count of matching lines", async () => {
		write("a.txt", "hit\nhit\n");
		write("b.txt", "miss\n");
		assert.deepEqual(await grepCommand(["-l", "hit"], { cwd: root }), { output: "a.txt:2", code: 0 });
	});

	it("#given no match or a bad pattern #when searched #then the result says so with rg's exit code", async () => {
		write("a.txt", "x\n");
		assert.deepEqual(await grepCommand(["nothing"], { cwd: root }), { output: "No matches.", code: 1 });
		assert.equal((await grepCommand(["("], { cwd: root })).code, 2);
	});

	it("#given more files than the cap #when globbed #then paths are sorted and the rest is counted", async () => {
		for (const name of ["c.ts", "a.ts", "b.ts", "d.md"]) write(`src/${name}`, "");

		assert.deepEqual(await globCommand(["*.ts"], { cwd: root, maxPaths: 2 }), { output: "src/a.ts\nsrc/b.ts\n[omo glob: showing 2 of 3 files. Narrow the pattern or the directory.]", code: 0 });
		assert.deepEqual(await globCommand(["*.py"], { cwd: root }), { output: "No files match *.py.", code: 1 });
	});
});

describe("omo run", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("#given a command with short output #when run #then the exit code, line count, log path and every line are printed", async () => {
		const { output, code } = await runCommand(["echo one; echo two >&2; exit 3"], { cwd: root, logDir: join(root, "logs") });

		const lines = output.split("\n");
		assert.equal(code, 3);
		assert.match(lines[0], /^omo run: saving the output to .*\/logs\/\d+-echo-one-echo-two-2-exit-3\.log$/);
		assert.deepEqual(lines.slice(1), ["exit=3 lines=2", "1\tone", "2\ttwo"]);
	});

	it("#given long output and --grep after the command #when run #then the matching lines and the tail are printed and the full output is saved", async () => {
		const script = "for i in $(seq 1 200); do echo \"line $i\"; done; echo 'FAIL: case 7' >&2";

		const { output, code } = await runCommand([script, "--grep", "FAIL", "--tail", "3"], { cwd: root, logDir: join(root, "logs") });

		const lines = output.split("\n");
		const logPath = /saving the output to (\S+)$/.exec(lines[0])[1];
		assert.equal(code, 0);
		assert.equal(lines[1], "exit=0 lines=201");
		assert.deepEqual(lines.slice(2, 9), ["lines matching FAIL (1):", "201\tFAIL: case 7", "last 3 lines:", "199\tline 199", "200\tline 200", "201\tFAIL: case 7", `[omo run: read more of the output with omo read ${logPath} START-END.]`]);
		assert.ok(existsSync(logPath));
	});

	it("#given several arguments #when run #then they run as a program without a shell", async () => {
		const { output } = await runCommand(["--", "printf", "%s|", "a b", "$HOME"], { cwd: root, logDir: join(root, "logs") });
		assert.equal(output.split("\n")[2], "1\ta b|$HOME|");
	});

	it("#given a missing program or no command #when run #then the failure is explained", async () => {
		const missing = await runCommand(["no-such-program-omo", "x"], { cwd: root, logDir: join(root, "logs") });
		assert.equal(missing.code, 127);
		assert.match(missing.output, /\nomo run: could not start no-such-program-omo \(ENOENT\)\.$/);
		assert.equal((await runCommand(["--grep", "x"], { cwd: root })).code, 2);
	});
});

describe("omo CLI", () => {
	it("#given no arguments or an unknown command #when run #then the usage is printed", async () => {
		assert.match((await main([])).output, /^omo read FILE/);
		assert.equal((await main(["frobnicate"])).code, 2);
	});

	it("#given a command that is still running #when omo run is a real process #then the log path is already on stdout", { timeout: 10_000 }, async () => {
		const child = spawn(process.execPath, [TOOL_PATH, "run", "sleep 5"], { stdio: ["ignore", "pipe", "ignore"] });
		// Settle on exit too: a child with no output (as under Codex's sandbox) must fail, not hang.
		const first = await new Promise((resolvePromise) => {
			child.stdout.once("data", (data) => resolvePromise(String(data)));
			child.once("close", () => resolvePromise(""));
		});
		child.kill();
		assert.match(first, /^omo run: saving the output to \S+\.log\n$/);
	});

	it("#given a real process #when omo read runs #then the numbered file reaches stdout with exit 0", () => {
		const result = spawnSync(process.execPath, [TOOL_PATH, "read", TOOL_PATH, "1-1"], { encoding: "utf8", env: { ...process.env, CODEX_THREAD_ID: "" } });
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /\(lines 1-1 of \d+\)\n1\t#!\/usr\/bin\/env node\n$/);
	});
});
