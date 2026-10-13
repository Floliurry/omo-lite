#!/usr/bin/env node
// After a compaction the output of earlier `omo read` calls has left the context, so the thread's
// read records are cleared and the next read of the same range prints the content again. A
// sub-agent's hook input carries its own thread as agent_id; the main thread's is session_id.
import { stdin as processStdin } from "node:process";
import { pathToFileURL } from "node:url";

import { forgetReads } from "../tools/omo.mjs";

export function runHook(input, readsRoot) {
	if (typeof input !== "object" || input === null || input.hook_event_name !== "PostCompact") return;
	const threadId = typeof input.agent_id === "string" ? input.agent_id : input.session_id;
	if (typeof threadId === "string" && threadId !== "") forgetReads(threadId, readsRoot);
}

async function main() {
	let raw = "";
	processStdin.setEncoding("utf8");
	for await (const chunk of processStdin) raw += chunk;
	try {
		runHook(JSON.parse(raw));
	} catch {
		// Stale records only cost the model an `omo read --again`.
	}
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
