#!/usr/bin/env node
// omo: read, search and run with bounded output. Codex has no read tool of its own and passes on
// whatever a command prints, cutting an exec's output only past about 10,000 tokens (keeping the
// head and the tail, so the lines that mattered can be the ones dropped). These commands bound
// their own output and say how to get the rest:
//
//   omo read FILE [RANGE] [FILE [RANGE] ...]      files with line numbers, a page or whole files at a time
//   omo grep [rg options] PATTERN [PATH...]        matching lines with line numbers, capped
//   omo glob [--hidden] [--no-ignore] PATTERN [DIR...]  matching file paths, capped
//   omo run [--grep REGEX] [--tail N] COMMAND      exit code and tail; the full output goes to a file
//
// Re-reading an unchanged range in the same Codex thread (CODEX_THREAD_ID) prints a note instead of
// the content. The records live in the temp directory; hooks/read-reset.mjs clears a thread's
// records after a compaction, when the earlier output has left the context.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

// Codex counts 4 bytes as a token when it cuts exec output. A page stays well under its cut, so a
// single read is never cut by Codex.
export const READ_PAGE_BYTES = 32_000;
const MAX_LINE_CHARS = 2_000;
const GREP_MAX_LINES = 100;
const GREP_PAGE_BYTES = 16_000;
const GREP_MAX_COLUMNS = 300;
// Past this many matches grep stops counting; the total is then reported as "more than".
const GREP_COUNT_LIMIT = 10_000;
const GLOB_MAX_PATHS = 100;
const RUN_TAIL_LINES = 40;
const RUN_MAX_MATCHES = 40;
const RUN_WHOLE_BYTES = 8_000;
const RUN_MAX_LINE_CHARS = 500;

const HELP = `omo read FILE [START-END | START] [FILE [RANGE] ...] [--again]
  Print each FILE with line numbers (number, tab, text); a range applies to the file before it. A
  single file too large for one view comes back as its first page with the command for the next
  one. Several files are printed whole; those that no longer fit are left for one next command.
  --again prints a range this thread already read.
omo grep [rg options] PATTERN [PATH...]
  Matching lines with line numbers, grouped by file, at most ${GREP_MAX_LINES} lines. -l lists the files with
  their match counts instead. Other rg options pass through (-C 3, -i, -F, -w, -g '*.ts').
omo glob [--hidden] [--no-ignore] PATTERN [DIR...]
  Files matching a glob (for example 'src/**/*.ts'), at most ${GLOB_MAX_PATHS}, sorted by path. Hidden and
  .gitignore'd files are skipped; add --hidden or --no-ignore to include them.
omo run [--grep REGEX] [--tail N] COMMAND...
  Run COMMAND (one argument goes to bash -c; several run as a program and its arguments), save
  everything it prints to a file, and print the exit code, the line count, the lines matching
  REGEX and the last ${RUN_TAIL_LINES} lines. The file's path is printed first, before COMMAND starts. Short output is printed whole. The options may also follow
  COMMAND; everything after -- belongs to COMMAND.`;

export async function main(argv, options = {}) {
	const [command, ...args] = argv;
	switch (command) {
		case "read":
			return readCommand(args, options);
		case "grep":
			return grepCommand(args, options);
		case "glob":
			return globCommand(args, options);
		case "run":
			return runCommand(args, options);
		case undefined:
		case "help":
		case "-h":
		case "--help":
			return ok(HELP);
		default:
			return fail(`omo: unknown command "${command}".\n\n${HELP}`, 2);
	}
}

// ---- read ----

export function readCommand(args, options = {}) {
	const { cwd = process.cwd(), threadId = process.env.CODEX_THREAD_ID, readsRoot = defaultReadsRoot(), pageBytes = READ_PAGE_BYTES } = options;
	const again = args.includes("--again");
	const requests = parseReadArgs(args.filter((arg) => arg !== "--again"));
	if (typeof requests === "string") return fail(requests, 2);
	const context = { cwd, threadId, readsRoot, again };
	if (requests.length === 1) {
		const result = readOne(requests[0], context, pageBytes, true);
		return result.failed ? fail(result.text) : ok(result.text);
	}

	// Several files are read whole: one that no longer fits waits, with the rest, for the next
	// command instead of being cut, so no file has to be pieced together. Only a first file that
	// is larger than a page by itself is paged.
	const parts = [];
	let used = 0;
	let printed = false;
	let failures = 0;
	for (const [index, request] of requests.entries()) {
		const result = readOne(request, context, printed ? pageBytes - used : pageBytes, !printed);
		if (result.deferred) {
			const rest = requests.slice(index).map(({ file, rangeText }) => (rangeText === undefined ? quoteArg(file) : `${quoteArg(file)} ${rangeText}`));
			parts.push(`[omo read: stopped before ${request.file} to keep this output under about ${Math.round(pageBytes / 4).toLocaleString("en-US")} tokens. Next: omo read ${rest.join(" ")}]`);
			break;
		}
		parts.push(result.text);
		used += Buffer.byteLength(result.text) + 1;
		if (result.failed) failures += 1;
		else printed = true;
	}
	const text = parts.join("\n\n");
	return failures === requests.length ? fail(text) : ok(text);
}

// FILE [RANGE] pairs: a range applies to the file before it.
function parseReadArgs(positional) {
	const usage = "usage: omo read FILE [START-END | START] [FILE [RANGE] ...] [--again]";
	const requests = [];
	for (const arg of positional) {
		const previous = requests.at(-1);
		if (/^\d+(?:-\d*)?$/.test(arg) && previous !== undefined && previous.rangeText === undefined) {
			previous.rangeText = arg;
			continue;
		}
		if (/^\d+(?:-\d*)?$/.test(arg) && previous === undefined) return usage;
		requests.push({ file: arg, rangeText: undefined });
	}
	if (requests.length === 0) return usage;
	for (const request of requests) {
		if (parseRange(request.rangeText) === null) return `omo read: "${request.rangeText}" is not a line range; use START-END or START, for example 120-180.`;
	}
	return requests;
}

// One file's output. With `mayPage`, a file larger than `budget` comes back as its first page;
// without it, such a file is `deferred` and nothing is printed for it.
function readOne({ file, rangeText }, { cwd, threadId, readsRoot, again }, budget, mayPage) {
	const range = parseRange(rangeText);
	const path = isAbsolute(file) ? file : resolve(cwd, file);
	let stat;
	try {
		stat = statSync(path);
	} catch {
		return { failed: true, text: `omo read: ${file} does not exist.` };
	}
	if (stat.isDirectory()) return { failed: true, text: `omo read: ${file} is a directory; list it with omo glob '*' ${quoteArg(file)}.` };

	const scan = scanLines(path, range, Math.max(budget, 0));
	if (scan.binary) return { failed: true, text: `omo read: ${file} is a binary file (${stat.size} bytes); not printed.` };
	if (scan.total === 0) return { failed: false, text: `${file} (empty file)` };
	if (range.start > scan.total) return { failed: true, text: `omo read: ${file} has ${scan.total} lines; line ${range.start} is past the end.` };

	const first = range.start;
	const last = first + scan.lines.length - 1;
	const wantedLast = Math.min(range.end, scan.total);
	if (!mayPage && (last < wantedLast || budget <= 0)) return { deferred: true };
	const record = threadId ? recordPath(readsRoot, threadId, path, first, last) : null;
	if (record !== null && !again && sameAsRecorded(record, stat)) {
		return { failed: false, text: `${file} lines ${first}-${last}: unchanged since this thread read them; use that output. If it was cut or is no longer in your context, run: omo read ${quoteArg(file)} ${first}-${last} --again` };
	}

	const out = [`${file} (lines ${first}-${last} of ${scan.total})`, ...scan.lines.map((line) => `${line.number}\t${line.text}`)];
	const cut = scan.lines.filter((line) => line.cut).map((line) => line.number);
	if (cut.length > 0) out.push(`[omo read: line${cut.length > 1 ? "s" : ""} ${cut.join(", ")} ${cut.length > 1 ? "are" : "is"} longer than ${MAX_LINE_CHARS.toLocaleString("en-US")} characters and cut where marked.]`);
	if (last < wantedLast) {
		// The next command keeps the requested end, so each page is again cut only by its size and
		// following the commands reaches the end of the range.
		const nextRange = range.end === Infinity ? `${last + 1}` : `${last + 1}-${range.end}`;
		out.push(
			`[omo read: stopped at line ${last} of ${scan.total} to keep this output under about ${Math.round(budget / 4).toLocaleString("en-US")} tokens. Next page: omo read ${quoteArg(file)} ${nextRange}. To find a section first: omo grep PATTERN ${quoteArg(file)}. Do not conclude from this page alone if the answer may be further in the file.]`,
		);
	}
	if (record !== null) remember(record, stat);
	return { failed: false, text: out.join("\n") };
}

function parseRange(text) {
	if (text === undefined) return { start: 1, end: Infinity };
	const match = /^(\d+)(?:-(\d*))?$/.exec(text);
	if (match === null) return null;
	const start = Number(match[1]);
	const end = match[2] === undefined || match[2] === "" ? Infinity : Number(match[2]);
	if (start < 1 || end < start) return null;
	return { start, end };
}

// Reads the file in chunks, keeping the lines of `range` that fit in `pageBytes` and counting the
// rest, so the total is known without holding a large file in memory.
function scanLines(path, range, pageBytes) {
	const fd = openSync(path, "r");
	try {
		const chunk = Buffer.alloc(1 << 20);
		const keepBytes = MAX_LINE_CHARS * 4 + 4;
		const lines = [];
		let total = 0;
		let used = 0;
		let full = false;
		let parts = [];
		let kept = 0;
		let lineBytes = 0;
		let firstChunk = true;
		const wanted = (number) => !full && number >= range.start && number <= range.end;
		const finishLine = () => {
			total += 1;
			if (wanted(total)) {
				let text = Buffer.concat(parts).toString("utf8").replace(/\r$/, "");
				const isCut = text.length > MAX_LINE_CHARS || lineBytes > kept;
				if (isCut) text = `${text.slice(0, MAX_LINE_CHARS)} [... cut; the line has ${lineBytes} bytes]`;
				const size = Buffer.byteLength(`${total}\t${text}\n`);
				if (lines.length > 0 && used + size > pageBytes) full = true;
				else {
					lines.push({ number: total, text, cut: isCut });
					used += size;
				}
			}
			parts = [];
			kept = 0;
			lineBytes = 0;
		};
		for (;;) {
			const read = readSync(fd, chunk, 0, chunk.length, null);
			if (read === 0) break;
			const data = chunk.subarray(0, read);
			if (firstChunk) {
				firstChunk = false;
				if (data.subarray(0, 8192).includes(0)) return { binary: true };
			}
			let from = 0;
			for (;;) {
				const newline = data.indexOf(10, from);
				const end = newline === -1 ? read : newline;
				lineBytes += end - from;
				if (wanted(total + 1) && kept < keepBytes) {
					const piece = data.subarray(from, Math.min(end, from + keepBytes - kept));
					parts.push(Buffer.from(piece));
					kept += piece.length;
				}
				if (newline === -1) break;
				finishLine();
				from = newline + 1;
			}
		}
		if (lineBytes > 0) finishLine();
		return { binary: false, lines, total };
	} finally {
		closeSync(fd);
	}
}

function defaultReadsRoot() {
	return join(tmpdir(), "omo-reads");
}

function recordPath(readsRoot, threadId, path, first, last) {
	const name = createHash("sha1").update(`${path}\0${first}\0${last}`).digest("hex");
	return join(readsRoot, safeName(threadId), `${name}.json`);
}

function sameAsRecorded(record, stat) {
	try {
		const saved = JSON.parse(readFileSync(record, "utf8"));
		return saved.mtimeMs === stat.mtimeMs && saved.size === stat.size;
	} catch {
		return false;
	}
}

function remember(record, stat) {
	try {
		mkdirSync(dirname(record), { recursive: true });
		writeFileSync(record, JSON.stringify({ mtimeMs: stat.mtimeMs, size: stat.size }));
	} catch {
		// Without a record the next read prints the content again, which is only wasteful.
	}
}

export function forgetReads(threadId, readsRoot = defaultReadsRoot()) {
	rmSync(join(readsRoot, safeName(threadId)), { recursive: true, force: true });
}

// ---- grep ----

export async function grepCommand(args, options = {}) {
	const { cwd = process.cwd(), maxLines = GREP_MAX_LINES, pageBytes = GREP_PAGE_BYTES } = options;
	if (args.length === 0) return fail("usage: omo grep [rg options] PATTERN [PATH...]", 2);
	const listFiles = args.some((arg) => arg === "-l" || arg === "--files-with-matches");
	const passed = args.filter((arg) => arg !== "-l" && arg !== "--files-with-matches");
	const own = listFiles ? ["--count", "--with-filename"] : ["--line-number", "--heading", "--with-filename", `--max-columns=${GREP_MAX_COLUMNS}`, "--max-columns-preview"];

	const shown = [];
	let used = 0;
	let full = false;
	let matches = 0;
	let files = 0;
	const result = await streamLines("rg", [...own, "--color=never", "--sort=path", ...passed], cwd, (line) => {
		if (listFiles) {
			files += 1;
			matches += Number(/:(\d+)$/.exec(line)?.[1] ?? 0);
		} else if (/^\d+:/.test(line)) matches += 1;
		else if (line !== "" && line !== "--" && !/^\d+-/.test(line)) files += 1;
		if (!full) {
			const size = Buffer.byteLength(line) + 1;
			if (shown.length >= maxLines || (shown.length > 0 && used + size > pageBytes)) full = true;
			else {
				shown.push(line);
				used += size;
			}
		}
		return matches < GREP_COUNT_LIMIT;
	});
	if (result.error?.code === "ENOENT") return fail("omo grep needs ripgrep (rg) on PATH.", 2);
	if (result.code === 2 && shown.length === 0) return fail(result.stderr.trim() || "omo grep: rg failed.", 2);
	if (shown.length === 0) return fail("No matches.");

	const out = [...shown];
	while (out.at(-1) === "" || out.at(-1) === "--") out.pop();
	if (full) {
		const counted = result.stopped ? `more than ${matches.toLocaleString("en-US")}` : matches.toLocaleString("en-US");
		out.push(
			listFiles
				? `[omo grep: showing ${shown.length} of ${result.stopped ? "more than " : ""}${files} files (${counted} matching lines). Narrow the pattern or the paths.]`
				: `[omo grep: showing the first ${shown.length} lines of ${counted} matching lines in ${result.stopped ? "more than " : ""}${files} files. Narrow the pattern or the paths, or list the files first with omo grep -l.]`,
		);
	}
	return withSearchErrors("grep", out, result);
}

// ---- glob ----

export async function globCommand(args, options = {}) {
	const { cwd = process.cwd(), maxPaths = GLOB_MAX_PATHS } = options;
	const flags = args.filter((arg) => arg.startsWith("-"));
	const [pattern, ...dirs] = args.filter((arg) => !arg.startsWith("-"));
	if (pattern === undefined) return fail("usage: omo glob [--hidden] [--no-ignore] PATTERN [DIR...]", 2);

	const shown = [];
	let total = 0;
	const result = await streamLines("rg", ["--files", "--color=never", "--sort=path", ...flags, "--glob", pattern, ...dirs], cwd, (line) => {
		total += 1;
		if (shown.length < maxPaths) shown.push(line);
		return true;
	});
	if (result.error?.code === "ENOENT") return fail("omo glob needs ripgrep (rg) on PATH.", 2);
	if (result.code === 2 && shown.length === 0) return fail(result.stderr.trim() || "omo glob: rg failed.", 2);
	if (shown.length === 0) return fail(`No files match ${pattern}.`);
	if (total > shown.length) shown.push(`[omo glob: showing ${shown.length} of ${total} files. Narrow the pattern or the directory.]`);
	return withSearchErrors("glob", shown, result);
}

// rg exits with 2 when part of the search failed, such as a path that does not exist, even when
// other paths matched. The matches are still printed, with rg's message and its exit code, so a
// partial search is not taken for a complete one.
function withSearchErrors(command, lines, result) {
	if (result.code !== 2) return ok(lines.join("\n"));
	const message = result.stderr.trim().split("\n").slice(0, 3).join("; ");
	return fail([...lines, `[omo ${command}: rg also reported errors, so these results may be incomplete: ${message || "no message"}]`].join("\n"), 2);
}

// Streams a program's stdout line by line. `onLine` returns false to stop early; the program is
// then killed and the result is marked `stopped`.
function streamLines(program, args, cwd, onLine) {
	return new Promise((resolvePromise) => {
		const child = spawn(program, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		let stopped = false;
		let error = null;
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (text) => {
			if (stderr.length < 4000) stderr += text;
		});
		child.on("error", (spawnError) => {
			error = spawnError;
			resolvePromise({ code: null, stderr, stopped, error });
		});
		const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
		reader.on("line", (line) => {
			if (stopped) return;
			if (onLine(line) === false) {
				stopped = true;
				child.kill();
			}
		});
		child.on("close", (code) => resolvePromise({ code, stderr, stopped, error }));
	});
}

// ---- run ----

// Prints where the output goes before the command starts: exec_command may return before a long
// command ends, and the caller should see where to look and that the session is still running.
export async function runCommand(args, options = {}) {
	const { cwd = process.cwd(), logDir = join(tmpdir(), "omo-run") } = options;
	const printed = [];
	const print = options.print ?? ((line) => printed.push(line));
	const finish = (lines, code) => {
		for (const line of lines) print(line);
		return { output: printed.join("\n"), code };
	};
	// Our options may come before or after the command; everything after `--` is the command's own.
	let tail = RUN_TAIL_LINES;
	let pattern = null;
	const command = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") {
			command.push(...args.slice(index + 1));
			break;
		}
		if (arg === "--tail") tail = Number(args[++index]);
		else if (arg === "--grep") pattern = args[++index];
		else command.push(arg);
	}
	if (command.length === 0 || !Number.isInteger(tail) || tail < 0 || pattern === undefined) return fail("usage: omo run [--grep REGEX] [--tail N] COMMAND...", 2);
	let regex = null;
	if (pattern !== null) {
		try {
			regex = new RegExp(pattern);
		} catch (error) {
			return fail(`omo run: --grep ${pattern} is not a valid regular expression: ${error.message}`, 2);
		}
	}

	let logPath = null;
	let fd = null;
	try {
		mkdirSync(logDir, { recursive: true });
		// The random part keeps two runs of the same command in the same millisecond apart; "wx"
		// refuses to reuse a file that exists anyway.
		logPath = join(logDir, `${Date.now()}-${randomBytes(4).toString("hex")}-${slug(command.join(" "))}.log`);
		fd = openSync(logPath, "wx");
	} catch {
		logPath = null;
	}
	print(logPath === null ? "omo run: the temp directory is not writable, so the output is not saved" : `omo run: saving the output to ${logPath}`);
	const [program, programArgs] = command.length === 1 ? ["bash", ["-c", command[0]]] : [command[0], command.slice(1)];
	const run = await runToEnd(program, programArgs, cwd, fd);
	if (fd !== null) closeSync(fd);
	if (run.error !== null) return finish([`omo run: could not start ${program} (${run.error.code ?? run.error.message}).`], 127);

	const text = logPath === null ? run.output : readFileSync(logPath, "utf8");
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	const numbered = (number) => {
		const line = lines[number - 1];
		return `${number}\t${line.length > RUN_MAX_LINE_CHARS ? `${line.slice(0, RUN_MAX_LINE_CHARS)} [... cut]` : line}`;
	};
	const header = `exit=${run.code} lines=${lines.length}`;
	if (lines.length <= tail + tail / 2 && Buffer.byteLength(text) <= RUN_WHOLE_BYTES) {
		return finish([header, ...lines.map((_, offset) => numbered(offset + 1))], run.code);
	}

	const out = [header];
	if (regex !== null) {
		const hits = [];
		lines.forEach((line, offset) => {
			if (regex.test(line)) hits.push(offset + 1);
		});
		out.push(`lines matching ${pattern} (${hits.length}${hits.length > RUN_MAX_MATCHES ? `, first ${RUN_MAX_MATCHES}` : ""}):`, ...hits.slice(0, RUN_MAX_MATCHES).map(numbered));
	}
	const from = Math.max(1, lines.length - tail + 1);
	if (tail > 0) out.push(`last ${lines.length - from + 1} lines:`, ...lines.slice(from - 1).map((_, offset) => numbered(from + offset)));
	if (logPath !== null) out.push(`[omo run: read more of the output with omo read ${quoteArg(logPath)} START-END.]`);
	return finish(out, run.code);
}

// Runs a program to completion, sending stdout and stderr to `fd` (in order) or collecting them.
function runToEnd(program, args, cwd, fd) {
	return new Promise((resolvePromise) => {
		const child = spawn(program, args, { cwd, stdio: ["ignore", fd ?? "pipe", fd ?? "pipe"] });
		let output = "";
		let error = null;
		if (fd === null) {
			for (const stream of [child.stdout, child.stderr]) {
				stream.setEncoding("utf8");
				stream.on("data", (text) => {
					output += text;
				});
			}
		}
		child.on("error", (spawnError) => {
			error = spawnError;
			resolvePromise({ code: 127, output, error });
		});
		child.on("close", (code, signal) => resolvePromise({ code: code ?? (signal ? 128 : 1), output, error }));
	});
}

function slug(text) {
	return text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "command";
}

// ---- shared ----

function ok(output) {
	return { output, code: 0 };
}

function fail(output, code = 1) {
	return { output, code };
}

function safeName(text) {
	return String(text).replace(/[^A-Za-z0-9._-]/g, "_");
}

function quoteArg(text) {
	return /^[\w@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { output, code } = await main(process.argv.slice(2), { print: (line) => process.stdout.write(`${line}\n`) });
	if (output.length > 0) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
	process.exitCode = code;
}
