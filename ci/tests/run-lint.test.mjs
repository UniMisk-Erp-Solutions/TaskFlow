// The baseline-aware lint stage: existing errors are allowed, a new or worse one is not.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { countErrors, compare } from "../pipeline/run-lint.mjs";

const root = path.resolve("/proj");
const f = (rel, msgs) => ({ filePath: path.join(root, rel), messages: msgs.map(([ruleId, severity]) => ({ ruleId, severity })) });

test("LINT: only severity-2 errors are counted, per file and rule", () => {
  const c = countErrors([f("src/a.ts", [["no-explicit-any", 2], ["no-explicit-any", 2], ["prefer-const", 1]]), f("src/b.ts", [[null, 2]])], root);
  assert.deepEqual(c, { "src/a.ts|no-explicit-any": 2, "src/b.ts|parse-error": 1 });
});

test("LINT: a new rule in a file, or more of the same, is worse; fewer is better; equal is fine", () => {
  const base = { "src/a.ts|no-explicit-any": 2 };
  assert.deepEqual(compare({ "src/a.ts|no-explicit-any": 2 }, base), { worse: [], better: [] });
  assert.equal(compare({ "src/a.ts|no-explicit-any": 3 }, base).worse.length, 1);
  assert.equal(compare({ "src/a.ts|no-explicit-any": 2, "src/a.ts|no-case-declarations": 1 }, base).worse.length, 1);
  assert.equal(compare({ "src/new.ts|no-explicit-any": 1 }, base).worse.length, 1, "a new file may not bring debt");
  assert.equal(compare({}, base).better.length, 1);
});
