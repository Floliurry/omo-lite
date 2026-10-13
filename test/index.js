// Suite loader for `node --test test/`: Node resolves the directory argument to this file, which
// loads every `*.test.mjs` next to it in name order. `node --test test/*.test.mjs` also works and
// runs each file in its own process. CommonJS on purpose: there is no package.json to make a
// `.js` file ESM, and a directory only resolves to `index.js`.
"use strict";

const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
	const testFiles = readdirSync(__dirname)
		.filter((entry) => entry.endsWith(".test.mjs"))
		.sort((left, right) => left.localeCompare(right));
	for (const testFile of testFiles) {
		await import(pathToFileURL(join(__dirname, testFile)).href);
	}
})();
