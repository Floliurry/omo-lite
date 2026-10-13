#!/usr/bin/env node
// codex-base.md replaces a model's built-in Codex instructions. The built-in text it was written
// against is kept as upstream-<model>.md. This compares that snapshot with the text Codex currently
// caches for the model, so a change upstream can be read and what applies taken over by hand.
//
//   node instructions/check-upstream.mjs [--codex-home <dir>]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INSTRUCTIONS_DIR = dirname(fileURLToPath(import.meta.url));

export function checkUpstream({ codexHome, instructionsDir = INSTRUCTIONS_DIR, outputDir = tmpdir() }) {
	const snapshotFile = readdirSync(instructionsDir).find((file) => /^upstream-.+\.md$/.test(file));
	if (snapshotFile === undefined) return { status: "no-snapshot" };
	const model = snapshotFile.slice("upstream-".length, -".md".length);
	const snapshot = readFileSync(join(instructionsDir, snapshotFile), "utf8");
	const current = cachedInstructions(codexHome, model);
	if (current === null) return { status: "not-cached", model };
	if (current === snapshot) return { status: "same", model };
	const currentPath = join(outputDir, `codex-upstream-${model}.md`);
	writeFileSync(currentPath, current);
	return { status: "changed", model, snapshotPath: join(instructionsDir, snapshotFile), currentPath, sections: changedSections(snapshot, current) };
}

export function describeResult(result) {
	switch (result.status) {
		case "same":
			return `built-in ${result.model} instructions match the snapshot codex-base.md was edited from`;
		case "changed":
			return [
				`built-in ${result.model} instructions changed upstream; merge into codex-base.md, then replace the snapshot`,
				`  sections: ${result.sections.join(", ")}`,
				`  diff: git diff --no-index ${result.snapshotPath} ${result.currentPath}`,
			].join("\n");
		case "not-cached":
			return `no cached ${result.model} instructions in models_cache.json; start Codex once, then rerun this check`;
		default:
			return "no upstream snapshot in instructions/";
	}
}

function cachedInstructions(codexHome, model) {
	try {
		const cache = JSON.parse(readFileSync(join(codexHome, "models_cache.json"), "utf8"));
		const entry = cache.models?.find((candidate) => candidate.slug === model);
		return entry?.model_messages?.instructions_template ?? null;
	} catch {
		return null;
	}
}

// Headings whose section text differs, plus headings present on only one side.
function changedSections(before, after) {
	const left = splitSections(before);
	const right = splitSections(after);
	const headings = [...new Set([...left.keys(), ...right.keys()])];
	return headings.filter((heading) => left.get(heading) !== right.get(heading));
}

function splitSections(text) {
	const sections = new Map();
	let heading = "(opening)";
	let lines = [];
	for (const line of text.split("\n")) {
		if (/^#{1,3} /.test(line)) {
			sections.set(heading, lines.join("\n"));
			heading = line.trim();
			lines = [];
		} else {
			lines.push(line);
		}
	}
	sections.set(heading, lines.join("\n"));
	return sections;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const index = process.argv.indexOf("--codex-home");
	const codexHome = index === -1 ? process.env.CODEX_HOME || join(homedir(), ".codex") : resolve(process.argv[index + 1]);
	const result = checkUpstream({ codexHome });
	console.log(describeResult(result));
	process.exitCode = result.status === "changed" ? 1 : 0;
}
