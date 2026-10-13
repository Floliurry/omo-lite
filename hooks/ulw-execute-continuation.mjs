#!/usr/bin/env node
// Stop / SubagentStop hook: while a selected ulw-execute plan still has work (or its final gate
// is pending), block the stop and remind the agent of the plan state.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readContinuationState } from "./lib/boulder-reader.mjs";

const hooksDir = dirname(fileURLToPath(import.meta.url));
export const ULW_EXECUTE_CONTINUATION_DIRECTIVE = readFileSync(resolve(hooksDir, "ulw-execute-continuation.md"), "utf8");

export function renderExecutionContractReference(skillPath = resolve(hooksDir, "../skills/ulw-execute/SKILL.md")) {
    try {
        if (readFileSync(skillPath, "utf8").trim().length > 0) {
            return `- Selected execution contract: \`${skillPath}\` (available)`;
        }
    }
    catch (error) {
        if (!(error instanceof Error))
            throw error;
    }
    return `- Selected execution contract: unavailable (expected readable, nonempty \`${skillPath}\`).`;
}

export function runStopHook(input, fs) {
    if (!isStopInput(input))
        return "";
    if (input.stop_hook_active)
        return "";
    if (hasAllowedExternalBlockerMarker(input.last_assistant_message))
        return "";
    if (transcriptHasContextPressureMarker(input.transcript_path, fs))
        return "";
    const state = readContinuationState(input.cwd, input.session_id);
    if (state === null)
        return "";
    return JSON.stringify({
        decision: "block",
        reason: renderDirective(state, input.session_id, input.cwd),
    });
}
function renderDirective(state, sessionId, cwd) {
    const lineBreak = String.fromCharCode(10);
    const worktreePath = state.worktreePath?.trim();
    const worktreeBlock = !worktreePath
        ? ""
        : `${lineBreak}- Worktree: \`${resolve(cwd, worktreePath)}\` (recorded execution directory)`;
    const replacements = {
        PLAN_NAME: state.planName,
        PLAN_PATH: state.planPath,
        BOULDER_PATH: state.boulderPath,
        REMAINING_COUNT: String(state.checklist.remaining),
        TOTAL_COUNT: String(state.checklist.total),
        NEXT_TASK_LABEL: state.checklist.nextTaskLabel ?? "none (final gate pending)",
        WORKTREE_BLOCK: worktreeBlock,
        LEDGER_PATH: state.ledgerPath,
        SESSION_ID: sessionId,
        CWD: cwd,
        SKILL_REFERENCE: renderExecutionContractReference(),
    };
    let rendered = ULW_EXECUTE_CONTINUATION_DIRECTIVE;
    for (const [placeholder, value] of Object.entries(replacements)) {
        rendered = rendered.replaceAll(`{{${placeholder}}}`, value);
    }
    return rendered;
}
const EXTERNAL_BLOCKER_MARKER = "<ulw-execute-blocked-external>";
// Workflow skills announce themselves with banners such as `ULTRAWORK MODE ENABLED!`; only such
// lines may precede the marker.
const MODE_BANNER_PATTERN = /^[A-Z][A-Z-]* MODE ENABLED!$/;
// The marker alone is not enough to end the turn. `ulw-execute-continuation.md` requires the exact blocker and
// the condition that resumes the work on the following lines, so at least one is required here
// too. That keeps a bare echo of the marker, whether quoted back from a prompt or produced by
// untrusted text the agent read, from skipping the continuation guard.
function hasAllowedExternalBlockerMarker(lastAssistantMessage) {
    if (lastAssistantMessage === undefined)
        return false;
    const lines = lastAssistantMessage.split(String.fromCharCode(10));
    let markerLineIndex = 0;
    while (MODE_BANNER_PATTERN.test(lines[markerLineIndex]?.trim() ?? ""))
        markerLineIndex += 1;
    if (lines[markerLineIndex]?.trim() !== EXTERNAL_BLOCKER_MARKER)
        return false;
    return lines.slice(markerLineIndex + 1).some((line) => line.trim() !== "");
}
const CONTEXT_PRESSURE_MARKERS = [
    "context compacted",
    "context_length_exceeded",
    "skill descriptions were shortened",
    "context_too_large",
    "codex ran out of room in the model's context window",
    "your input exceeds the context window",
    "long threads and multiple compactions",
];
function transcriptHasContextPressureMarker(transcriptPath, fs) {
    try {
        const transcript = fs.readFileSync(transcriptPath, "utf8").toLowerCase();
        return CONTEXT_PRESSURE_MARKERS.some((marker) => transcript.includes(marker));
    }
    catch (error) {
        if (error instanceof Error)
            return false;
        throw error;
    }
}
function isStopInput(value) {
    return (isRecord(value) &&
        isStopHookEventName(value["hook_event_name"]) &&
        typeof value["session_id"] === "string" &&
        typeof value["turn_id"] === "string" &&
        typeof value["transcript_path"] === "string" &&
        typeof value["cwd"] === "string" &&
        typeof value["model"] === "string" &&
        typeof value["permission_mode"] === "string" &&
        typeof value["stop_hook_active"] === "boolean" &&
        optionalString(value["last_assistant_message"]));
}
function isStopHookEventName(value) {
    return value === "Stop" || value === "SubagentStop";
}
function optionalString(value) {
    return value === undefined || typeof value === "string";
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
    const raw = await readStdin();
    if (raw.trim().length === 0)
        return;
    const output = runStopHook(parseHookInput(raw), { readFileSync });
    if (output.length > 0)
        processStdout.write(output);
}
function parseHookInput(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        if (error instanceof SyntaxError)
            return undefined;
        throw error;
    }
}
function readStdin() {
    return new Promise((resolve) => {
        let data = "";
        processStdin.setEncoding("utf8");
        processStdin.on("data", (chunk) => {
            data += chunk;
        });
        processStdin.once("error", () => resolve(data));
        processStdin.once("end", () => resolve(data));
    });
}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
