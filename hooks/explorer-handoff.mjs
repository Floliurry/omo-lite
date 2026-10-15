#!/usr/bin/env node
// PostToolUse hook for spawn_agent: right after the lead hands an investigation to the explorer, remind it
// that the judgment inside that scope now belongs to the explorer. lead.md says the same, but in test runs
// the lead still reread the explorer's sources to choose again; a note at the moment of delegation lands better.
import { pathToFileURL } from "node:url";

// Codex joins a tool's namespace and name without a separator, so spawn_agent arrives as "collaborationspawn_agent".
const SPAWN_TOOL_NAMES = new Set(["spawn_agent", "collaborationspawn_agent", "collaboration.spawn_agent"]);

const REMINDER =
    "You handed this investigation to the explorer, so the judgment inside its scope is now its own: what to read and which candidates to keep. Wait for its conclusion. If it looks wrong or incomplete, send it the reason and let it revise, rather than rereading its sources to choose again.";

// Returns the hook output for one PostToolUse payload, or "" when the call was not an explorer spawn.
export function explorerHandoffOutput(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        return "";
    }
    if (payload?.hook_event_name !== "PostToolUse" || !SPAWN_TOOL_NAMES.has(payload.tool_name)) return "";
    if (payload.tool_input?.agent_type !== "explorer") return "";
    return `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: REMINDER } })}\n`;
}

function readAll(stdin) {
    return new Promise((resolve, reject) => {
        let data = "";
        stdin.setEncoding("utf8");
        stdin.on("data", (chunk) => {
            data += chunk;
        });
        stdin.once("error", reject);
        stdin.once("end", () => resolve(data));
    });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.stdout.write(explorerHandoffOutput(await readAll(process.stdin)));
}
