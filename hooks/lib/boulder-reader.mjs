import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { getPlanChecklist } from "./plan-checklist.mjs";
export { getPlanChecklist } from "./plan-checklist.mjs";
const SESSION_ID_PREFIX_PATTERN = /^(codex|opencode):/;
export function readContinuationState(cwd, sessionId) {
    const boulderPath = getBoulderFilePath(cwd);
    const boulderState = readBoulderState(boulderPath);
    if (boulderState === null)
        return null;
    const work = getWorkForSession(boulderState, normalizeSessionId(sessionId, "codex"));
    if (work === null || !isContinuableStatus(work.status))
        return null;
    const planPath = resolveBoulderPlanPathForWork(cwd, work);
    const checklist = getPlanChecklist(planPath);
    if (checklist.total === 0)
        return null;
    return {
        planName: work.planName,
        planPath,
        boulderPath,
        ledgerPath: join(cwd, ".omo", "ulw-execute", "ledger.jsonl"),
        worktreePath: work.worktreePath ?? null,
        checklist,
    };
}
function readBoulderState(path) {
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return parseBoulderState(parsed);
    }
    catch (error) {
        if (error instanceof Error)
            return null;
        throw error;
    }
}
function parseBoulderState(value) {
    if (!isRecord(value))
        return null;
    const works = [];
    const worksValue = value["works"];
    const hasWorksMap = isRecord(worksValue);
    if (hasWorksMap) {
        for (const workValue of Object.values(worksValue)) {
            const work = parseBoulderWork(workValue);
            if (work !== null)
                works.push(work);
        }
    }
    const mirrorWork = parseBoulderWork(value);
    if (works.length === 0 && mirrorWork === null)
        return null;
    return { works, mirrorWork, hasWorksMap };
}
function parseBoulderWork(value) {
    if (!isRecord(value))
        return null;
    const activePlan = value["active_plan"];
    const planName = value["plan_name"];
    if (typeof activePlan !== "string")
        return null;
    const status = parseBoulderWorkStatus(value["status"]);
    const sessionIds = parseSessionIds(value["session_ids"]);
    const worktreePath = value["worktree_path"];
    const startedAt = value["started_at"];
    const updatedAt = value["updated_at"];
    return {
        activePlan,
        planName: typeof planName === "string" ? planName : activePlan,
        sessionIds,
        ...(status === undefined ? {} : { status }),
        ...(typeof startedAt === "string" ? { startedAt } : {}),
        ...(typeof updatedAt === "string" ? { updatedAt } : {}),
        ...(typeof worktreePath === "string" ? { worktreePath } : {}),
    };
}
function getWorkForSession(state, normalizedSessionId) {
    let newestWork = null;
    let newestWorkMs = 0;
    for (const work of state.works) {
        if (!work.sessionIds.includes(normalizedSessionId))
            continue;
        const workMs = parseIsoToMs(work.updatedAt ?? work.startedAt) ?? 0;
        if (newestWork === null || workMs > newestWorkMs) {
            newestWork = work;
            newestWorkMs = workMs;
        }
    }
    if (newestWork !== null)
        return newestWork;
    if (state.hasWorksMap)
        return null;
    if (state.mirrorWork?.sessionIds.includes(normalizedSessionId) === true)
        return state.mirrorWork;
    return null;
}
function resolveBoulderPlanPathForWork(cwd, work) {
    const absolutePlanPath = resolveTrackedPath(cwd, work.activePlan);
    const worktreePath = work.worktreePath?.trim();
    if (worktreePath === undefined || worktreePath.length === 0)
        return absolutePlanPath;
    const relativePlanPath = relative(resolve(cwd), absolutePlanPath);
    if (relativePlanPath.length === 0 || relativePlanPath.startsWith("..") || isAbsolute(relativePlanPath)) {
        return absolutePlanPath;
    }
    const worktreePlanPath = resolve(resolveTrackedPath(cwd, worktreePath), relativePlanPath);
    return existsSync(worktreePlanPath) ? worktreePlanPath : absolutePlanPath;
}
function resolveTrackedPath(baseDirectory, trackedPath) {
    return isAbsolute(trackedPath) ? resolve(trackedPath) : resolve(baseDirectory, trackedPath);
}
function parseBoulderWorkStatus(value) {
    if (value === "active" || value === "paused" || value === "completed" || value === "abandoned")
        return value;
    return undefined;
}
function parseSessionIds(value) {
    if (!Array.isArray(value))
        return [];
    const sessionIds = [];
    for (const item of value) {
        if (typeof item === "string")
            sessionIds.push(normalizeSessionId(item));
    }
    return sessionIds;
}
function normalizeSessionId(sessionId, platform = "opencode") {
    if (SESSION_ID_PREFIX_PATTERN.test(sessionId))
        return sessionId;
    return `${platform}:${sessionId}`;
}
function parseIsoToMs(value) {
    if (value === undefined)
        return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}
function isContinuableStatus(status) {
    return status === "active" || status === "paused";
}
function getBoulderFilePath(cwd) {
    return join(cwd, ".omo", "boulder.json");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
