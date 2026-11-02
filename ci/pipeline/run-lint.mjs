#!/usr/bin/env node
// Baseline-aware ESLint stage, for a project that adopts the CI with lint errors it already has.
//   node ci/pipeline/run-lint.mjs                     fails on a NEW or WORSE lint error (per file and rule) against ci/verify/quality/lint-baseline.json
//   node ci/pipeline/run-lint.mjs --update-baseline   records the current errors (an admin does this, in a reviewed pull request)
// Same idea as the quality engine: existing debt may not grow, it can only shrink. Warnings never count; only severity-2 errors.
// ESLint is the project's own (node_modules/eslint) with the project's own config, so the rules are the team's, not ours.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = path.join(ROOT, "ci", "verify", "quality", "lint-baseline.json");
const update = process.argv.includes("--update-baseline");

/** Pure: errors -> { "file|rule": count } */
export function countErrors(report, root = ROOT) {
  const out = {};
  for (const f of report) {
    const rel = path.relative(root, f.filePath).split(path.sep).join("/");
    for (const m of f.messages) {
      if (m.severity !== 2) continue;
      const key = `${rel}|${m.ruleId ?? "parse-error"}`;
      out[key] = (out[key] || 0) + 1;
    }
  }
  return out;
}

/** Pure: which keys grew compared with the baseline, and which shrank. */
export function compare(current, baseline) {
  const worse = [], better = [];
  for (const [k, n] of Object.entries(current)) if (n > (baseline[k] || 0)) worse.push([k, n, baseline[k] || 0]);
  for (const [k, n] of Object.entries(baseline)) if ((current[k] || 0) < n) better.push([k, current[k] || 0, n]);
  return { worse, better };
}

function main() {
  const bin = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
  if (!fs.existsSync(bin)) { console.error("run-lint: eslint is not installed (npm ci first)"); process.exit(1); }
  const r = spawnSync(process.execPath, [bin, ".", "-f", "json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  let report;
  try { report = JSON.parse(r.stdout); } catch { console.error("run-lint: ESLint did not produce a report (crashed or misconfigured):\n" + (r.stderr || r.stdout).slice(-2000)); process.exit(1); }
  const current = countErrors(report);
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify({ _note: "Existing ESLint errors that may not grow. Edited only by an admin via run-lint.mjs --update-baseline, reviewed in a pull request.", generatedAt: new Date().toISOString().slice(0, 10), errors: current }, null, 2) + "\n");
    console.log(`lint baseline written: ${total} existing error(s) in ${Object.keys(current).length} file/rule pair(s)`);
    return;
  }
  if (!fs.existsSync(BASELINE)) { console.error("run-lint: no lint baseline (ci/verify/quality/lint-baseline.json). An admin creates it with --update-baseline."); process.exit(1); }
  const { worse, better } = compare(current, JSON.parse(fs.readFileSync(BASELINE, "utf8")).errors || {});
  console.log(`ESLint: ${total} error(s) now, ${Object.keys(current).length} file/rule pair(s); ${worse.length} new or worse, ${better.length} improved`);
  if (better.length) console.log(`  (${better.length} pair(s) improved: an admin can lower the baseline with --update-baseline)`);
  if (worse.length) {
    for (const [k, n, was] of worse) {
      const [file, rule] = k.split("|");
      console.log(`✘ [lint] ${file}  ${n} × ${rule} (baseline ${was})  → fix it; existing errors are allowed, new ones are not`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
