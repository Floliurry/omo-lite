// Minimal vitest-style `expect` over node:assert, so tests ported from the previous fork stay close
// to their originals. Only the matchers those tests use are implemented.
import assert from "node:assert/strict";
import { format } from "node:util";
import { afterEach, beforeEach, describe, it as nodeIt } from "node:test";

export { afterEach, beforeEach, describe };

export function expect(actual) {
	return {
		...matchers(actual, false),
		not: matchers(actual, true),
	};
}

function matchers(actual, negated) {
	const check = (pass, message) => {
		if (pass === negated) assert.fail(`${negated ? "not " : ""}${message}`);
	};
	return {
		toBe(expected) {
			check(Object.is(actual, expected), `expected ${show(actual)} to be ${show(expected)}`);
		},
		toEqual(expected) {
			if (negated) assert.notDeepStrictEqual(withoutUndefined(actual), withoutUndefined(expected));
			else assert.deepStrictEqual(withoutUndefined(actual), withoutUndefined(expected));
		},
		toContain(expected) {
			const pass = (typeof actual === "string" || Array.isArray(actual)) && actual.includes(expected);
			check(pass, `expected ${show(actual)} to contain ${show(expected)}`);
		},
		toMatch(expected) {
			const pass = typeof actual === "string" && (expected instanceof RegExp ? expected.test(actual) : actual.includes(expected));
			check(pass, `expected ${show(actual)} to match ${show(expected)}`);
		},
		toBeNull() {
			check(actual === null, `expected ${show(actual)} to be null`);
		},
		toBeGreaterThan(expected) {
			check(actual > expected, `expected ${show(actual)} to be greater than ${show(expected)}`);
		},
		toBeLessThan(expected) {
			check(actual < expected, `expected ${show(actual)} to be less than ${show(expected)}`);
		},
	};
}

// vitest's toEqual ignores properties whose value is undefined.
function withoutUndefined(value) {
	if (Array.isArray(value)) return value.map(withoutUndefined);
	if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.map(([key, entry]) => [key, withoutUndefined(entry)]),
	);
}

function show(value) {
	const text = typeof value === "string" ? JSON.stringify(value) : format("%o", value);
	return text.length <= 400 ? text : `${text.slice(0, 397)}...`;
}

// `it` plus vitest's `it.each(cases)(name, fn)`: `%s`, `%j`, `%i`, `%d` and `%#` in the name are
// filled from each case; an array case is spread into the test function's arguments.
export function it(...args) {
	return nodeIt(...args);
}
it.skip = nodeIt.skip;
it.todo = nodeIt.todo;
it.only = nodeIt.only;
it.each = (cases) => (name, fn) => {
	cases.forEach((testCase, index) => {
		const values = Array.isArray(testCase) ? testCase : [testCase];
		nodeIt(formatName(name, values, index), () => fn(...values));
	});
};

function formatName(name, values, index) {
	let next = 0;
	return name.replace(/%[sjdi#%]/g, (token) => {
		if (token === "%%") return "%";
		if (token === "%#") return String(index);
		const value = values[next++];
		if (token === "%j") return JSON.stringify(value) ?? "undefined";
		if (token === "%d" || token === "%i") return String(Number(value));
		return String(value);
	});
}
