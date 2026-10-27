#!/usr/bin/env node
// Runs the frontend Vitest suite and compares the result with ci/known-failures.json.
//
// The suite had 3 failing tests on `main` before this pipeline existed (see the file). They are
// listed by exact name so that:
//   * any NEW failing test fails the stage (the gate is real), and
//   * a listed test that starts passing also fails the stage until the entry is deleted, so the
//     list can only shrink.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./config.mjs";

const known = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "ci", "known-failures.json"), "utf8")).tests.map((t) => t.id);
const out = path.join(REPO_ROOT, ".ci", "vitest.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });

const r = spawnSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], {
  cwd: path.join(REPO_ROOT, "frontend"), stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32",
  env: { ...process.env, CI: "true" },
});
if (!fs.existsSync(out)) { console.error("Vitest produced no report (crashed before running tests)."); process.exit(1); }

const report = JSON.parse(fs.readFileSync(out, "utf8"));
const failed = [];
const passed = new Set();
for (const f of report.testResults) {
  const file = path.relative(path.join(REPO_ROOT, "frontend"), f.name).replaceAll("\\", "/");
  for (const t of f.assertionResults) {
    const id = `${file} > ${t.fullName}`;
    if (t.status === "failed") failed.push(id); else if (t.status === "passed") passed.add(id);
  }
  if (f.status === "failed" && f.assertionResults.length === 0) failed.push(`${file} > (suite failed to load)`);
}

const unexpected = failed.filter((id) => !known.includes(id));
const fixed = known.filter((id) => passed.has(id));
console.log(`\nVitest: ${report.numPassedTests} passed, ${report.numFailedTests} failed (${known.length} known baseline failures)`);
if (unexpected.length) { console.error("\nNEW failing tests:\n  " + unexpected.join("\n  ")); }
if (fixed.length) { console.error("\nKnown failures that now PASS — remove them from ci/known-failures.json:\n  " + fixed.join("\n  ")); }
process.exit(unexpected.length || fixed.length || r.status === null ? 1 : 0);
