#!/usr/bin/env node
// Checks apply_patch edits the way an editing tool with a uniqueness check would. apply_patch
// changes the first place a hunk matches and reports success even when the hunk matched several
// places. Before the patch runs, a hunk that matches more than one place is refused, with the
// matching line numbers, so the model adds context. After a successful patch, the model is told
// which lines changed, so it can check those lines instead of reading the file back.
//
// Parsing and matching follow Codex's apply-patch crate (streaming_parser.rs, file_update.rs,
// seek_sequence.rs) in its default LF-normalizing mode, so a refusal means apply_patch itself
// would have picked the first of several matches.
//
// Codex also applies a patch sent as a shell command, `apply_patch <<'EOF' ... EOF` with an
// optional `cd <dir> &&` in front (invocation.rs). The hook then sees tool_name "Bash" and the
// whole command, so every shell command reaches this script and all but those return at once. Codex
// runs no PostToolUse hook for such a patch, so only the check before it applies there.
//
// apply_patch may also receive an edit as JSON (see parseEdits). Before it runs, the hook replaces
// the JSON with the equivalent patch, so the change still goes through Codex's own patch handling
// and shows as a diff. Without the hook, apply_patch rejects the JSON as an invalid patch.
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { pathToFileURL } from "node:url";

const PATCH_TOOL_NAMES = new Set(["apply_patch", "Edit", "Write"]);
const SHELL_PATCH = /^\s*(?:cd\s+('[^']*'|"[^"]*"|[^\s;&|'"]+)\s*&&\s*)?(?:apply_patch|applypatch)\s*<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\3\s*$/;

export function parsePatch(text) {
	let lines = text.trim().split(/\r?\n/);
	if (/^<<(EOF|'EOF'|"EOF")$/.test(lines[0] ?? "") && lines.at(-1)?.endsWith("EOF")) lines = lines.slice(1, -1);
	const hunks = [];
	let current = null;
	for (const line of lines) {
		// Inside a file section only trailing whitespace is ignored, so " *** ..." stays a context line.
		const trimmed = current === null ? line.trim() : line.trimEnd();
		if (trimmed === "*** Begin Patch" || trimmed.startsWith("*** Environment ID:")) continue;
		if (trimmed === "*** End Patch") break;
		const header = /^\*\*\* (Add|Delete|Update) File: (.+)$/.exec(trimmed);
		if (header !== null) {
			current = { kind: header[1].toLowerCase(), path: header[2], movePath: null, addLines: [], chunks: [] };
			hunks.push(current);
			continue;
		}
		if (current?.kind === "add") {
			if (!line.startsWith("+")) return null;
			current.addLines.push(line.slice(1));
			continue;
		}
		if (current?.kind !== "update") return null;
		const updateLine = line.trimEnd();
		const chunks = current.chunks;
		if (chunks.length === 0 && current.movePath === null && updateLine.startsWith("*** Move to: ")) {
			current.movePath = updateLine.slice("*** Move to: ".length);
		} else if (updateLine === "@@" || updateLine.startsWith("@@ ")) {
			chunks.push(newChunk(updateLine === "@@" ? null : updateLine.slice(3)));
		} else if (updateLine === "*** End of File") {
			if (chunks.length > 0) chunks.at(-1).eof = true;
		} else if (line === "" || line.startsWith(" ") || line.startsWith("+") || line.startsWith("-")) {
			if (chunks.length === 0) chunks.push(newChunk(null));
			const chunk = chunks.at(-1);
			const kind = line === "" || line.startsWith(" ") ? "context" : line.startsWith("+") ? "new" : "old";
			const content = line === "" ? "" : line.slice(1);
			if (kind !== "new") chunk.oldLines.push(content);
			if (kind !== "old") chunk.newLines.push(content);
			chunk.kinds.push(kind);
		} else {
			return null;
		}
	}
	return hunks;
}

function newChunk(context) {
	return { context, oldLines: [], newLines: [], kinds: [], eof: false };
}

const LEVELS = [(line) => line, (line) => line.trimEnd(), (line) => line.trim(), normalise];

function normalise(line) {
	return line
		.trim()
		.replace(/[\u2010-\u2015\u2212]/g, "-")
		.replace(/[\u2018-\u201B]/g, "'")
		.replace(/[\u201C-\u201F]/g, '"')
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

// Every start index where `pattern` matches, at the first comparison level that matches at all.
// apply_patch uses the first index of that same list.
export function seekAll(lines, pattern, start, eof) {
	if (pattern.length === 0) return [start];
	if (pattern.length > lines.length) return [];
	const searchStart = eof ? lines.length - pattern.length : start;
	for (const level of LEVELS) {
		const wanted = pattern.map(level);
		const found = [];
		for (let index = searchStart; index <= lines.length - pattern.length; index += 1) {
			if (wanted.every((line, offset) => level(lines[index + offset]) === line)) found.push(index);
		}
		if (found.length > 0) return found;
	}
	return [];
}

// Walks the chunks as apply_patch does and calls `visit(chunk, number, places, pattern)` with the
// places the chunk could apply for `side` ("oldLines" before the patch, "newLines" after it); the
// first is where apply_patch applies it. Without an @@ anchor every match is such a place. With
// one, apply_patch takes the first match after the first anchor line, so the places are the first
// match after each occurrence of the anchor line. Stops at the first chunk that does not match,
// where apply_patch itself reports the failure.
function walkChunks(lines, chunks, side, visit) {
	let lineIndex = 0;
	for (const [position, chunk] of chunks.entries()) {
		let starts = [lineIndex];
		if (chunk.context !== null) {
			const anchors = seekAll(lines, [chunk.context], lineIndex, false);
			if (anchors.length === 0) return;
			starts = anchors.map((anchor) => anchor + 1);
			lineIndex = starts[0];
		}
		if (side === "oldLines" && chunk.oldLines.length === 0) continue;
		const found = seekChunk(lines, chunk[side], lineIndex, chunk.eof);
		if (found === null) return;
		const places = chunk.context === null ? found.matches : [...new Set(starts.map((start) => seekChunk(lines, chunk[side], start, chunk.eof)?.matches[0]).filter((place) => place !== undefined))];
		visit(chunk, position + 1, places, found.pattern);
		lineIndex = found.matches[0] + found.pattern.length;
	}
}

// apply_patch retries a pattern that ends in an empty line without that line.
function seekChunk(lines, pattern, start, eof) {
	let matches = seekAll(lines, pattern, start, eof);
	if (matches.length === 0 && pattern.at(-1) === "") {
		pattern = pattern.slice(0, -1);
		matches = seekAll(lines, pattern, start, eof);
	}
	return matches.length === 0 ? null : { matches, pattern };
}

export function findAmbiguousHunks(patchText, cwd, readText = readTextFile) {
	const ambiguous = [];
	for (const hunk of parsePatch(patchText) ?? []) {
		if (hunk.kind !== "update") continue;
		const lines = fileLines(readText, resolvePath(cwd, hunk.path));
		if (lines === null) continue;
		walkChunks(lines, hunk.chunks, "oldLines", (_chunk, number, matches) => {
			if (matches.length > 1) ambiguous.push({ path: hunk.path, hunk: number, lines: matches.map((index) => index + 1) });
		});
	}
	return ambiguous;
}

export function describeChanges(patchText, cwd, readText = readTextFile) {
	const parts = [];
	for (const hunk of parsePatch(patchText) ?? []) {
		if (hunk.kind === "add") parts.push(`${hunk.path} (new, ${hunk.addLines.length} lines)`);
		if (hunk.kind === "delete") parts.push(`${hunk.path} (deleted)`);
		if (hunk.kind !== "update") continue;
		const path = hunk.movePath ?? hunk.path;
		const lines = fileLines(readText, resolvePath(cwd, path));
		const ranges = [];
		if (lines !== null) {
			walkChunks(lines, hunk.chunks, "newLines", (chunk, _number, matches) => ranges.push(changedRange(chunk, matches[0])));
		}
		const label = hunk.movePath === null ? path : `${hunk.path} -> ${path}`;
		parts.push(ranges.length === 0 ? label : `${label} ${ranges.join(", ")}`);
	}
	return parts;
}

// The changed lines in the new file: the chunk's new lines without its leading and trailing context.
function changedRange(chunk, start) {
	const leading = countContext(chunk.kinds);
	const trailing = countContext([...chunk.kinds].reverse());
	const first = start + leading;
	const last = start + chunk.newLines.length - trailing - 1;
	if (last < first) return `lines removed before line ${first + 1}`;
	return first === last ? `line ${first + 1}` : `lines ${first + 1}-${last + 1}`;
}

function countContext(kinds) {
	const index = kinds.findIndex((kind) => kind !== "context");
	return index === -1 ? kinds.length : index;
}

// An edit can reach apply_patch as JSON instead of a patch: {"edit": path, "old": text, "new": text}
// replaces the one place `old` occurs, and {"write": path, "content": text} sets the whole file; an
// array applies several in order. Before apply_patch runs, the hook turns them into the patch it
// expects, so Codex still records the change and shows its diff.
export function parseEdits(text) {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
	let value;
	try {
		value = JSON.parse(trimmed);
	} catch {
		return null;
	}
	const edits = Array.isArray(value) ? value : [value];
	const valid = edits.length > 0 && edits.every((edit) => isRecord(edit) && (
		(typeof edit.edit === "string" && typeof edit.old === "string" && typeof edit.new === "string") ||
		(typeof edit.write === "string" && typeof edit.content === "string")
	));
	return valid ? edits : null;
}

// Returns { patch } or { error }. Each file becomes one hunk: the lines that differ between the
// file and its edited text, widened with context until they match only one place in the file.
export function editsToPatch(edits, cwd, readText = readTextFile) {
	const files = new Map();
	for (const edit of edits) {
		const path = edit.edit ?? edit.write;
		if (!files.has(path)) {
			const original = readText(resolvePath(cwd, path));
			files.set(path, { original: original === null ? null : toLf(original), text: original === null ? null : toLf(original), edited: false });
		}
		const file = files.get(path);
		if (edit.write !== undefined) {
			file.text = toLf(edit.content);
			file.edited = true;
			continue;
		}
		if (file.text === null) return { error: `apply_patch was not run. ${path} does not exist; send {"write": path, "content": text} to create it.` };
		const old = toLf(edit.old);
		if (old === "") return { error: `apply_patch was not run. The old text for ${path} is empty; include the text the change replaces.` };
		const places = occurrences(file.text, old);
		const after = file.edited ? " after the earlier edits" : "";
		if (places.length === 0) return { error: notFound(file.text, old, `${path}${after}`) };
		if (places.length > 1) {
			const lines = places.map((index) => file.text.slice(0, index).split("\n").length);
			return { error: `apply_patch was not run. The old text occurs ${places.length} times in ${path}${after} (lines ${lines.join(", ")}). Include more of the surrounding text so it occurs once.` };
		}
		file.text = file.text.slice(0, places[0]) + toLf(edit.new) + file.text.slice(places[0] + old.length);
		file.edited = true;
	}
	const sections = [];
	for (const [path, { original, text }] of files) {
		if (original === null || original === "") {
			sections.push(`*** Add File: ${path}`, ...splitLines(text).map((line) => `+${line}`));
			continue;
		}
		const hunk = hunkFor(splitLines(original), splitLines(text));
		if (hunk === null) return { error: `apply_patch was not run. The edit leaves ${path} unchanged.` };
		sections.push(`*** Update File: ${path}`, ...hunk);
	}
	return { patch: ["*** Begin Patch", ...sections, "*** End Patch"].join("\n") };
}

// One chunk per changed region, widened with unchanged lines (above first) until its old side
// matches only one place in the file; regions whose context would overlap share a chunk.
function hunkFor(before, after) {
	const regions = changedRegions(before, after);
	if (regions.length === 0) return null;
	const chunks = [];
	for (const region of regions) {
		let chunk = { start: region.beforeStart, end: region.beforeEnd, regions: [region] };
		for (;;) {
			const previous = chunks.at(-1);
			if (previous !== undefined && chunk.start <= previous.end) {
				chunks.pop();
				chunk = { start: previous.start, end: Math.max(previous.end, chunk.end), regions: [...previous.regions, ...chunk.regions] };
				continue;
			}
			const block = before.slice(chunk.start, chunk.end);
			const whole = chunk.start === 0 && chunk.end === before.length;
			if (whole || (block.length > 0 && seekAll(before, block, 0, false).length === 1)) break;
			if (chunk.start > (previous?.end ?? 0)) chunk.start -= 1;
			else if (chunk.end < before.length) chunk.end += 1;
			else chunk.start -= 1;
		}
		chunks.push(chunk);
	}
	const lines = [];
	for (const chunk of chunks) {
		lines.push("@@");
		let cursor = chunk.start;
		for (const region of chunk.regions) {
			for (const line of before.slice(cursor, region.beforeStart)) lines.push(` ${line}`);
			for (const line of before.slice(region.beforeStart, region.beforeEnd)) lines.push(`-${line}`);
			for (const line of after.slice(region.afterStart, region.afterEnd)) lines.push(`+${line}`);
			cursor = region.beforeEnd;
		}
		for (const line of before.slice(cursor, chunk.end)) lines.push(` ${line}`);
	}
	return lines;
}

// The runs of lines that differ, from a Myers line diff. Past MAX_DIFF_STEPS, as when most of a
// file is rewritten, everything between the common start and end counts as one region.
const MAX_DIFF_STEPS = 2000;

function changedRegions(before, after) {
	let prefix = 0;
	while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
	let suffix = 0;
	while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
	const a = before.slice(prefix, before.length - suffix);
	const b = after.slice(prefix, after.length - suffix);
	if (a.length === 0 && b.length === 0) return [];
	const pairs = matchedLines(a, b);
	if (pairs === null) return [{ beforeStart: prefix, beforeEnd: prefix + a.length, afterStart: prefix, afterEnd: prefix + b.length }];
	const regions = [];
	let x = 0;
	let y = 0;
	for (const [matchX, matchY] of [...pairs, [a.length, b.length]]) {
		if (matchX > x || matchY > y) regions.push({ beforeStart: prefix + x, beforeEnd: prefix + matchX, afterStart: prefix + y, afterEnd: prefix + matchY });
		x = matchX + 1;
		y = matchY + 1;
	}
	return regions;
}

// Pairs of equal lines [indexInA, indexInB] in order, or null past MAX_DIFF_STEPS.
function matchedLines(a, b) {
	const n = a.length;
	const m = b.length;
	const offset = n + m + 1;
	const v = new Int32Array(2 * offset + 2);
	const trace = [];
	let done = false;
	for (let d = 0; d <= n + m && !done; d += 1) {
		if (d > MAX_DIFF_STEPS) return null;
		trace.push(v.slice(offset - d - 1, offset + d + 2));
		for (let k = -d; k <= d; k += 2) {
			let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
			let y = x - k;
			while (x < n && y < m && a[x] === b[y]) {
				x += 1;
				y += 1;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) {
				done = true;
				break;
			}
		}
	}
	const pairs = [];
	let x = n;
	let y = m;
	for (let d = trace.length - 1; d >= 0; d -= 1) {
		const snapshot = trace[d];
		const at = (k) => snapshot[k + d + 1];
		const k = x - y;
		const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
		const previousX = d === 0 ? 0 : at(previousK);
		const previousY = d === 0 ? 0 : previousX - previousK;
		while (x > previousX && y > previousY) {
			x -= 1;
			y -= 1;
			pairs.push([x, y]);
		}
		x = previousX;
		y = previousY;
	}
	return pairs.reverse();
}

// Old text retyped from memory most often misses by its punctuation, an ASCII "." where the file
// has "。". Folding full-width punctuation to ASCII, one character for one so positions carry
// over, finds that place; the refusal then quotes what the file has there.
const FULL_WIDTH = "。，、；：！？（）“”‘’";
const ASCII = ".,,;:!?()\"\"''";
const MAX_DIFFERENCES = 5;

function notFound(text, old, where) {
	const reason = `apply_patch was not run. The old text was not found in ${where}.`;
	const loose = occurrences(foldPunctuation(text), foldPunctuation(old));
	if (loose.length !== 1) return `${reason} Copy it from the file exactly, including whitespace, punctuation and line breaks.`;
	const start = loose[0];
	const differences = [];
	for (let index = 0; index < old.length; index++) {
		const at = start + index;
		if (text[at] === old[index]) continue;
		const from = Math.max(start, text.lastIndexOf("\n", at - 1) + 1, at - 6);
		const line = text.slice(0, at).split("\n").length;
		differences.push(`line ${line} has ${JSON.stringify(text.slice(from, at + 1))} where the old text has ${JSON.stringify(old.slice(from - start, index + 1))}`);
	}
	const shown = differences.slice(0, MAX_DIFFERENCES).join("; ");
	const more = differences.length > MAX_DIFFERENCES ? `; and ${differences.length - MAX_DIFFERENCES} more` : "";
	return `${reason} It matches one place once full-width and ASCII punctuation are treated alike: ${shown}${more}. Use the file's punctuation in the old text, and in the new text where it keeps those sentences.`;
}

function foldPunctuation(text) {
	let folded = "";
	for (const character of text) {
		const index = FULL_WIDTH.indexOf(character);
		folded += index === -1 ? character : ASCII[index];
	}
	return folded;
}

function occurrences(text, part) {
	const found = [];
	for (let index = text.indexOf(part); index !== -1; index = text.indexOf(part, index + 1)) found.push(index);
	return found;
}

function toLf(text) {
	return text.replace(/\r\n/g, "\n");
}

function splitLines(text) {
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

// After the patch ran, PostToolUse may carry the JSON the model sent rather than the rewritten patch.
function describeEdits(edits, cwd, readText) {
	const parts = [];
	for (const edit of edits) {
		const path = edit.edit ?? edit.write;
		const text = readText(resolvePath(cwd, path));
		if (text === null) continue;
		if (edit.write !== undefined) {
			parts.push(`${path} (written, ${splitLines(toLf(text)).length} lines)`);
			continue;
		}
		const index = toLf(text).indexOf(toLf(edit.new));
		if (index === -1 || edit.new === "") {
			parts.push(path);
			continue;
		}
		const first = toLf(text).slice(0, index).split("\n").length;
		const last = first + Math.max(0, splitLines(toLf(edit.new)).length - 1);
		parts.push(`${path} ${first === last ? `line ${first}` : `lines ${first}-${last}`}`);
	}
	return parts;
}

export function runHook(input, readText = readTextFile) {
	const target = patchTarget(input);
	if (target === null) return "";
	const { patch, cwd } = target;
	const edits = input.tool_name === "Bash" ? null : parseEdits(patch);

	if (input.hook_event_name === "PreToolUse" && edits !== null) {
		const result = editsToPatch(edits, cwd, readText);
		if (result.error !== undefined) return output({ hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: denyReason(result.error) });
		return output({ hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { ...input.tool_input, command: result.patch } });
	}
	if (input.hook_event_name === "PostToolUse" && edits !== null) {
		const changes = describeEdits(edits, cwd, readText);
		if (changes.length === 0) return "";
		return output({ hookEventName: "PostToolUse", additionalContext: `Patched: ${changes.join("; ")}. To check the edit, print those lines rather than the whole file.` });
	}
	if (input.hook_event_name === "PreToolUse") {
		const ambiguous = findAmbiguousHunks(patch, cwd, readText);
		if (ambiguous.length === 0) return "";
		const details = ambiguous.map(({ path, hunk, lines }) => `${path}: hunk ${hunk} matches ${lines.length} places (lines ${lines.join(", ")})`);
		const reason = `apply_patch was not run. ${details.join("; ")}. It would change only the first match. Add surrounding lines, or an "@@ <line above the change>" anchor that occurs only once, so each hunk matches one place, then send the patch again.`;
		return output({ hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: denyReason(reason) });
	}
	if (input.hook_event_name === "PostToolUse") {
		const changes = describeChanges(patch, cwd, readText);
		if (changes.length === 0) return "";
		return output({ hookEventName: "PostToolUse", additionalContext: `Patched: ${changes.join("; ")}. To check the edit, print those lines rather than the whole file.` });
	}
	return "";
}

// The patch text and the directory its paths are relative to, or null when the call is no patch.
function patchTarget(input) {
	if (!isRecord(input) || typeof input.tool_input?.command !== "string") return null;
	const command = input.tool_input.command;
	const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
	if (PATCH_TOOL_NAMES.has(input.tool_name)) return { patch: command, cwd };
	if (input.tool_name !== "Bash" || !/apply_?patch/.test(command)) return null;
	const match = SHELL_PATCH.exec(command);
	if (match === null) return null;
	const dir = match[1] === undefined ? cwd : resolvePath(cwd, match[1].replace(/^(['"])(.*)\1$/, "$2"));
	return { patch: match[4], cwd: dir };
}

// Codex shows a refusal as "<reason>. Command: <input>", so the reason carries no final period.
function denyReason(text) {
	return text.replace(/\.$/, "");
}

function output(hookSpecificOutput) {
	return `${JSON.stringify({ hookSpecificOutput })}\n`;
}

function fileLines(readText, path) {
	const text = readText(path);
	if (text === null) return null;
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

function resolvePath(cwd, path) {
	return isAbsolute(path) ? path : resolve(cwd, path);
}

function readTextFile(path) {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
	let raw = "";
	processStdin.setEncoding("utf8");
	for await (const chunk of processStdin) raw += chunk;
	let text = "";
	try {
		text = runHook(JSON.parse(raw));
	} catch {
		// A broken check must never block an edit.
	}
	if (text.length > 0) processStdout.write(text);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
