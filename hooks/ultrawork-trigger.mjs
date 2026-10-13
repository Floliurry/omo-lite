#!/usr/bin/env node
// UserPromptSubmit hook: a command-shaped ULW request (`ulw ...`, `/ulw`, `$ultrawork`, ...) gets a
// pointer to the ultrawork skill. The main agent still decides whether ULW applies.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ULTRAWORK_SKILL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../skills/ultrawork/SKILL.md");

export const ULTRAWORK_SKILL_POINTER_TEMPLATE = `<ultrawork-admission>
This hook recognized a command-shaped ULW request. It grants no authorization
and does not activate a workflow. The main agent must check the complete latest
user request, existing task state, and any opt-out before deciding to enable ULW.
Mixed commands, quotations, cancellations, and conflicting instructions require
that judgment; a keyword match alone is not user intent.

If admission is appropriate, read the ultrawork entry for its core execution and acceptance contract:

{{ULTRAWORK_SKILL_PATH}}

Load its references only for their stated conditions; do not read them all.
Reuse any first bounded exploration already completed. If admission
is inappropriate, continue the user's task under the existing instructions.

Workflow admission, goal creation, and subagent dispatch are separate decisions.
This pointer does not require a banner, a goal call, or any worker. Honor the
active harness's goal-authorization rules and assess each delegation's benefit.
</ultrawork-admission>
`;

// Only command-shaped requests reach admission; semantic intent belongs to the main agent.
const ULTRAWORK_CURRENT_PROMPT_PATTERN = /^ {0,3}(?:(?:[/$]|\$omo:|\/skill:)(?:ulw|ultrawork)(?=$|[\s:：])|(?:ulw|ultrawork)(?:[:：]|$))/i;
const CONTEXT_PRESSURE_MARKERS = [
    "context compacted",
    "context_length_exceeded",
    "skill descriptions were shortened",
    "context_too_large",
    "codex ran out of room in the model's context window",
    "your input exceeds the context window",
    "long threads and multiple compactions",
];
export function runUserPromptSubmitHook(input, options = {}) {
    if (!isCodexUserPromptSubmitInput(input))
        return "";
    if (!isUltraworkPrompt(input.prompt))
        return "";
    if (isContextPressureRecoveryPrompt(input.prompt))
        return "";
    const skillPath = options.skillPath ?? ULTRAWORK_SKILL_PATH;
    if (!existsSync(skillPath))
        return "";
    return formatAdditionalContextOutput(ULTRAWORK_SKILL_POINTER_TEMPLATE.replace("{{ULTRAWORK_SKILL_PATH}}", skillPath));
}
export function isUltraworkPrompt(prompt) {
    // A previous admission or activation is not authorization for this new request.
    // Preserve indentation so quoted, fenced, and indented examples stay outside the grammar.
    return ULTRAWORK_CURRENT_PROMPT_PATTERN.test(prompt.replace(/^(?:[ \t]*\r?\n)*/, "").trimEnd());
}
function isContextPressureRecoveryPrompt(prompt) {
    const normalizedPrompt = prompt.toLowerCase();
    return CONTEXT_PRESSURE_MARKERS.some((marker) => normalizedPrompt.includes(marker));
}
function formatAdditionalContextOutput(additionalContext) {
    const normalizedContext = normalizeAdditionalContext(additionalContext);
    if (normalizedContext.length === 0)
        return "";
    const output = {
        hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: normalizedContext,
        },
    };
    return `${JSON.stringify(output)}\n`;
}
function normalizeAdditionalContext(additionalContext) {
    return additionalContext.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}
function isCodexUserPromptSubmitInput(value) {
    return (isRecord(value) &&
        value["hook_event_name"] === "UserPromptSubmit" &&
        typeof value["prompt"] === "string" &&
        (value["transcript_path"] === undefined ||
            value["transcript_path"] === null ||
            typeof value["transcript_path"] === "string"));
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
    const raw = await readStdin();
    if (raw.trim().length === 0)
        return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return;
    }
    const output = runUserPromptSubmitHook(parsed);
    if (output.length > 0)
        processStdout.write(output);
}
function readStdin() {
    return new Promise((done) => {
        let data = "";
        processStdin.setEncoding("utf8");
        processStdin.on("data", (chunk) => {
            data += chunk;
        });
        processStdin.once("error", () => done(data));
        processStdin.once("end", () => done(data));
    });
}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
