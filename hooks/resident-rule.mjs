#!/usr/bin/env node
// Injects the resident lead rule when a session starts or is cleared, with the session's model
// named in its opening line. A resumed session already holds it. Compaction keeps the history only as an encrypted item, so
// the rule cannot be checked there and is not re-injected; after a compaction the agent gets a
// one-line pointer to the rule file instead. SessionStart(source=compact) delivers the pointer;
// otherwise PostCompact leaves a marker and the next UserPromptSubmit delivers it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const RULES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../rules");
const RULE_FILE = "lead.md";
const MODEL_PLACEHOLDER = "{{model}}";
const CONTEXT_PRESSURE_MARKERS = [
	"context compacted",
	"context_length_exceeded",
	"skill descriptions were shortened",
	"context_too_large",
	"codex ran out of room in the model's context window",
	"your input exceeds the context window",
	"long threads and multiple compactions",
];

function rulePath(rulesDir = RULES_DIR) {
	return join(rulesDir, RULE_FILE);
}

export function loadRule(model, rulesDir = RULES_DIR) {
	const path = rulePath(rulesDir);
	const name = typeof model === "string" && model.trim() !== "" ? model.trim() : "a GPT model";
	const body = readFileSync(path, "utf8")
		.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
		.trim()
		.replaceAll(MODEL_PLACEHOLDER, name);
	return { path, body };
}

export function compactionPointer(rulePath) {
	return `This session's resident lead rule was loaded at session start from \`${rulePath}\`. Reopen it if the current work needs its exact text; this reminder does not require a reread.`;
}

export function runHook(input, options = {}) {
	if (!isRecord(input) || typeof input.session_id !== "string") return "";
	const rulesDir = options.rulesDir ?? RULES_DIR;
	const markerPath = compactMarkerPath(input.session_id, options.dataRoot);

	switch (input.hook_event_name) {
		case "SessionStart": {
			if (input.source === "resume") return "";
			if (input.source === "compact") {
				rmSync(markerPath, { force: true });
				return formatOutput("SessionStart", compactionPointer(rulePath(rulesDir)));
			}
			const rule = loadRule(input.model, rulesDir);
			return formatOutput("SessionStart", `Instructions from: ${rule.path}\n\n${rule.body}`);
		}
		case "PostCompact": {
			mkdirSync(dirname(markerPath), { recursive: true });
			writeFileSync(markerPath, "");
			return "";
		}
		case "UserPromptSubmit": {
			if (!existsSync(markerPath)) return "";
			const prompt = typeof input.prompt === "string" ? input.prompt.toLowerCase() : "";
			if (CONTEXT_PRESSURE_MARKERS.some((marker) => prompt.includes(marker))) return "";
			rmSync(markerPath, { force: true });
			return formatOutput("UserPromptSubmit", compactionPointer(rulePath(rulesDir)));
		}
		default:
			return "";
	}
}

function formatOutput(eventName, additionalContext) {
	return `${JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext } })}\n`;
}

function compactMarkerPath(sessionId, dataRoot) {
	const root = dataRoot ?? process.env.PLUGIN_DATA ?? join(homedir(), ".codex", "omo-lite");
	return join(root, "compacted", `${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.flag`);
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
	let raw = "";
	processStdin.setEncoding("utf8");
	for await (const chunk of processStdin) raw += chunk;
	if (raw.trim().length === 0) return;
	let input;
	try {
		input = JSON.parse(raw);
	} catch {
		return;
	}
	const output = runHook(input);
	if (output.length > 0) processStdout.write(output);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
