#!/usr/bin/env node
// UniMisk engineering-quality engine. Project-neutral: everything specific to one application lives in its policy.json
// (source roots, thresholds, architecture rules) and baseline.json (the existing debt that may not grow).
//
//   node ci/verify/quality/run.mjs <maintainability|standards|architecture|repo-policy|all>   enforce (exit 1 on a new violation)
//   node ci/verify/quality/run.mjs all --audit                                                 report everything, never fail (phase 1)
//   node ci/verify/quality/run.mjs all --update-baseline                                       admin only: record the current tree as the baseline
//   node ci/verify/quality/run.mjs --init                                                      write a starter policy.json for a new project
//   options: --root <repo>  --policy <file>  --baseline <file>  --report-dir <dir>
// Every violation names the rule, file, line, severity and a suggested fix. Only NEW or WORSENED problems fail the stage.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadProject } from "./lib/project.mjs";
import { CHECKS } from "./lib/checks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }

export function runChecks({ root, policyFile, baselineFile, names, audit = false }) {
  const policy = readJson(policyFile);
  if (!policy) throw new Error(`policy not found: ${policyFile}`);
  const baseline = audit ? null : readJson(baselineFile, null);
  if (!audit && !baseline) throw new Error(`baseline not found: ${baselineFile} (an admin creates it with --update-baseline)`);
  const project = loadProject(root, policy);
  const results = {};
  for (const n of names) results[n] = CHECKS[n](project, baseline);
  return { policy, project, results };
}

/** Starter policy for a repository that has none: finds the package.json folders and their source folders. */
export function initPolicy(root, project = path.basename(path.resolve(root))) {
  const pkgs = [];
  const skip = new Set(["node_modules", ".git", ".ci", "dist", "build", "ci"]);
  const scan = (rel, depth) => {
    const abs = path.join(root, rel);
    if (fs.existsSync(path.join(abs, "package.json"))) pkgs.push(rel || ".");
    if (depth >= 2) return;
    for (const d of fs.readdirSync(abs, { withFileTypes: true })) if (d.isDirectory() && !skip.has(d.name)) scan(rel ? `${rel}/${d.name}` : d.name, depth + 1);
  };
  scan("", 0);
  const roots = pkgs.map((p) => { const base = p === "." ? "" : `${p}/`; return fs.existsSync(path.join(root, `${base}src`)) ? `${base}src` : p; });
  const BS = String.fromCharCode(92);
  return {
    project, typescriptFrom: pkgs.length ? pkgs : ["."], sourceRoots: roots, extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    exclude: ["(^|/)public/", `${BS}.min${BS}.js$`, "(^|/)generated/"],
    testPattern: ["(^|/)(__tests__|test|tests|e2e)/", `${BS}.(test|spec)${BS}.[cm]?[jt]sx?$`],
    consoleAllowed: [], packages: pkgs, protectedFiles: [], aliases: [],
    thresholds: { functionLines: { warn: 60, fail: 100 }, cyclomatic: { warn: 10, fail: 15 }, cognitive: { fail: 15 }, nesting: { fail: 4 }, params: { warn: 5 }, fileLines: { warn: 400, fail: 700 }, duplication: { window: 50, maxPercent: 3, tolerance: 0.25 } },
    architecture: { rules: [], modules: [], _help: "Add forbidden-import rules for THIS project's real layers: { id, title, from: regex, to: regex, suggestion }. See docs/engineering-quality.md." },
  };
}

const fmt = (v) => `${v.severity === "error" ? "✘" : v.severity === "review" ? "?" : "!"} [${v.rule}] ${v.file}${v.line ? `:${v.line}` : ""}  ${v.message}${v.suggestion ? `  → ${v.suggestion}` : ""}`;

function main() {
  const a = process.argv.slice(2);
  const opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
  const which = a.find((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--")) || "all";
  const root = path.resolve(opt("root", process.cwd()));
  const policyFile = path.resolve(opt("policy", path.join(HERE, "policy.json")));
  const baselineFile = path.resolve(opt("baseline", path.join(HERE, "baseline.json")));
  const audit = a.includes("--audit"), update = a.includes("--update-baseline");

  if (a.includes("--init")) {
    if (fs.existsSync(policyFile)) { console.error(`✘ ${path.relative(process.cwd(), policyFile)} already exists; edit it instead`); process.exit(2); }
    fs.mkdirSync(path.dirname(policyFile), { recursive: true });
    fs.writeFileSync(policyFile, JSON.stringify(initPolicy(root), null, 2) + "\n");
    console.log(`✔ starter policy written: ${path.relative(process.cwd(), policyFile)}\n  next: review sourceRoots/aliases/architecture rules, then  node ci/verify/quality/run.mjs all --audit  and  --update-baseline`);
    return;
  }

  const names = which === "all" ? Object.keys(CHECKS) : [which];
  if (names.some((n) => !CHECKS[n])) { console.error(`✘ unknown check "${which}". Known: ${Object.keys(CHECKS).join(", ")}, all`); process.exit(2); }

  let out;
  try { out = runChecks({ root, policyFile, baselineFile, names: update ? Object.keys(CHECKS) : names, audit: audit || update }); }
  catch (e) { console.error(`✘ quality: ${e.message}`); process.exit(2); }

  if (update) {
    const base = { _note: "Existing debt that may not grow. Edited only by an admin via --update-baseline, reviewed in a pull request.", generatedAt: new Date().toISOString().slice(0, 10) };
    for (const r of Object.values(out.results)) Object.assign(base, r.snapshot);
    base.generatedFromPolicy = out.policy.project;
    fs.writeFileSync(baselineFile, JSON.stringify(base, null, 2) + "\n");
    console.log(`✔ baseline written: ${path.relative(process.cwd(), baselineFile)}`);
    return;
  }

  let failed = 0, first = null;
  const reportDir = path.resolve(root, opt("report-dir", ".ci/quality"));
  fs.mkdirSync(reportDir, { recursive: true });
  const cap = audit ? 400 : 12;
  for (const [name, r] of Object.entries(out.results)) {
    console.log(`\n── ${name}: ${r.info}`);
    for (const v of r.violations) console.log(fmt(v));
    for (const v of r.warnings.slice(0, cap)) console.log(fmt(v));
    if (r.warnings.length > cap) console.log(`  … ${r.warnings.length - cap} more warning(s) in the report`);
    console.log(`${r.violations.length ? "✘" : "✔"} ${name}: ${r.violations.length} new violation(s), ${r.baselined} known (baselined), ${r.warnings.length} warning(s)`);
    if (r.violations.length && !first) first = r.violations[0];
    failed += r.violations.length;
    fs.writeFileSync(path.join(reportDir, `${name}.json`), JSON.stringify({ check: name, violations: r.violations, warnings: r.warnings, baselined: r.baselined }, null, 2));
  }
  if (audit) { console.log("\naudit mode: nothing is enforced"); return; }
  if (failed) { console.error(`\n✘ quality gate: ${failed} new violation(s). First: [${first.rule}] ${first.file}${first.line ? `:${first.line}` : ""} ${first.message}`); process.exit(1); }
  console.log("\n✔ quality gate passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
