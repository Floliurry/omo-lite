import { existsSync, readFileSync } from "node:fs";
const TODO_HEADING_PATTERN = /^##[ \t]+TODOs(?:[ \t]+#+)?[ \t]*$/i;
const FINAL_VERIFICATION_HEADING_PATTERN = /^##[ \t]+Final Verification Wave(?:[ \t]+#+)?[ \t]*$/i;
const SECTION_BOUNDARY_HEADING_PATTERN = /^#{1,2}(?:[ \t]+|$)/;
const HEADING_PATTERN = /^(#{1,6})(?:[ \t]+|$)/;
const SUPERSEDED_HEADING_PATTERN = /^#{1,6}[ \t]+Superseded\b/i;
const FENCE_PATTERN = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/;
const SIMPLE_CHECKBOX_PATTERN = /^[-*][ \t]*\[[ \t]*([xX]?)[ \t]*\][ \t]+(.+)$/;
const TODO_CHECKBOX_PATTERN = /^- \[([ xX])\] ([1-9]\d*\. .+)$/;
const FINAL_WAVE_CHECKBOX_PATTERN = /^- \[([ xX])\] (F[1-9]\d*\. .+)$/i;
export function getPlanChecklist(planPath) {
    if (!existsSync(planPath))
        return emptyChecklist();
    try {
        return parsePlanChecklist(readFileSync(planPath, "utf8"));
    }
    catch (error) {
        if (error instanceof Error)
            return emptyChecklist();
        throw error;
    }
}
export function parsePlanChecklist(markdown) {
    const lines = markdown.split(/\r?\n/);
    if (!hasStructuredSection(lines))
        return parseSimpleChecklist(lines);
    let completed = 0;
    let remaining = 0;
    let nextTaskLabel = null;
    let section = "other";
    let supersededLevel = null;
    let fence = null;
    for (const line of lines) {
        if (fence !== null) {
            if (isClosingFence(line, fence))
                fence = null;
            continue;
        }
        const openingFence = parseOpeningFence(line);
        if (openingFence !== null) {
            fence = openingFence;
            continue;
        }
        const headingLevel = parseHeadingLevel(line);
        if (headingLevel !== null) {
            supersededLevel = nextSupersededLevel(line, headingLevel, supersededLevel);
            if (SECTION_BOUNDARY_HEADING_PATTERN.test(line))
                section = parseStructuredSectionHeading(line);
            continue;
        }
        if (section === "other" || supersededLevel !== null)
            continue;
        const checkbox = parseStructuredCheckbox(line, section);
        if (checkbox === null)
            continue;
        if (checkbox.checked)
            completed += 1;
        else {
            remaining += 1;
            nextTaskLabel = nextTaskLabel ?? checkbox.label;
        }
    }
    return { completed, remaining, total: completed + remaining, nextTaskLabel };
}
function hasStructuredSection(lines) {
    let fence = null;
    for (const line of lines) {
        if (fence !== null) {
            if (isClosingFence(line, fence))
                fence = null;
            continue;
        }
        const openingFence = parseOpeningFence(line);
        if (openingFence !== null) {
            fence = openingFence;
            continue;
        }
        if (parseStructuredSectionHeading(line) !== "other")
            return true;
    }
    return false;
}
function parseSimpleChecklist(lines) {
    let completed = 0;
    let remaining = 0;
    let nextTaskLabel = null;
    let supersededLevel = null;
    let fence = null;
    for (const line of lines) {
        if (fence !== null) {
            if (isClosingFence(line, fence))
                fence = null;
            continue;
        }
        const openingFence = parseOpeningFence(line);
        if (openingFence !== null) {
            fence = openingFence;
            continue;
        }
        const headingLevel = parseHeadingLevel(line);
        if (headingLevel !== null) {
            supersededLevel = nextSupersededLevel(line, headingLevel, supersededLevel);
            continue;
        }
        if (supersededLevel !== null)
            continue;
        const checkbox = parseSimpleTopLevelCheckbox(line);
        if (checkbox === null)
            continue;
        if (checkbox.checked)
            completed += 1;
        else {
            remaining += 1;
            nextTaskLabel = nextTaskLabel ?? checkbox.label;
        }
    }
    return { completed, remaining, total: completed + remaining, nextTaskLabel };
}
function parseHeadingLevel(line) {
    return line.match(HEADING_PATTERN)?.[1]?.length ?? null;
}
// Living plans move dropped tasks under a Superseded heading at any level. Its rows are not work
// until the next heading of the same or a higher level.
function nextSupersededLevel(line, headingLevel, supersededLevel) {
    if (supersededLevel !== null && headingLevel > supersededLevel)
        return supersededLevel;
    return SUPERSEDED_HEADING_PATTERN.test(line) ? headingLevel : null;
}
function parseStructuredSectionHeading(line) {
    if (TODO_HEADING_PATTERN.test(line))
        return "todo";
    if (FINAL_VERIFICATION_HEADING_PATTERN.test(line))
        return "final-wave";
    return "other";
}
function parseStructuredCheckbox(line, section) {
    const pattern = section === "todo" ? TODO_CHECKBOX_PATTERN : FINAL_WAVE_CHECKBOX_PATTERN;
    const match = line.match(pattern);
    const marker = match?.[1];
    const label = match?.[2];
    if (marker === undefined || label === undefined)
        return null;
    return { checked: marker.toLowerCase() === "x", label };
}
function parseSimpleTopLevelCheckbox(line) {
    const match = line.match(SIMPLE_CHECKBOX_PATTERN);
    const marker = match?.[1];
    const label = match?.[2];
    if (marker === undefined || label === undefined)
        return null;
    return { checked: marker.toLowerCase() === "x", label };
}
function parseOpeningFence(line) {
    const match = line.match(FENCE_PATTERN);
    const run = match?.[1];
    const info = match?.[2];
    const marker = run?.charAt(0);
    if (run === undefined ||
        info === undefined ||
        (marker !== "`" && marker !== "~") ||
        (marker === "`" && info.includes("`")))
        return null;
    return { marker, length: run.length };
}
function isClosingFence(line, fence) {
    const run = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/)?.[1];
    return run?.charAt(0) === fence.marker && run.length >= fence.length;
}
function emptyChecklist() {
    return { completed: 0, remaining: 0, total: 0, nextTaskLabel: null };
}
