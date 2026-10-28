#!/usr/bin/env node
// Central pipeline: puts the TRUSTED CI files into a checkout of ANY branch, so a branch never needs its own copy of
// the Jenkinsfile, the ci/ scripts or the lint/typecheck/E2E setup.
//   node .ci-toolkit/ci/pipeline/overlay.mjs --toolkit .ci-toolkit --workspace .
// The toolkit is a checkout of the repository at the trusted ref (CI_TOOLKIT_REF: `main` once the pipeline is merged).
// What it does:
//   1. copies the CI-owned files over the branch's (the branch cannot alter the pipeline that judges it),
//   2. adds the CI tooling scripts/devDependencies to package.json when the branch lacks them (never overrides one),
//   3. records which toolkit commit and which pipeline-file hashes were used (.ci/toolkit.json): the gate re-derives the
//      hashes from Git itself and refuses to sign unless they equal the admin-approved pin.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** CI-owned files and folders (relative to the repository root). Application code is never touched. */
export const OVERLAY_PATHS = [
  "ci",
  "frontend/eslint.config.js", "frontend/tsconfig.ci.json", "frontend/playwright.config.js", "frontend/e2e",
  "backend/eslint.config.js", ".trivyignore",
];
/** Pipeline files the gate pins (same list as ci/gate-service/evaluate.mjs PINNED_PATHS). */
const PINNED = ["Jenkinsfile", "ci/pipeline", "ci/lib", "ci/gate", "ci/verify"];
/** package.json sections that carry the CI tooling. Only MISSING keys are added. */
const MERGE_SECTIONS = ["scripts", "devDependencies"];
const PACKAGES = ["frontend", "backend"];

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

export function mergePackageJson(branchJson, toolkitJson) {
  const out = JSON.parse(JSON.stringify(branchJson));
  const added = [];
  for (const section of MERGE_SECTIONS) {
    for (const [k, v] of Object.entries(toolkitJson[section] || {})) {
      out[section] = out[section] || {};
      if (!(k in out[section])) { out[section][k] = v; added.push(`${section}.${k}`); }
    }
  }
  return { json: out, added };
}

export function applyOverlay({ toolkit, workspace }) {
  const tk = path.resolve(toolkit), ws = path.resolve(workspace);
  const commit = git(tk, "rev-parse", "HEAD");
  const pinned = {};
  for (const p of PINNED) { try { pinned[p] = git(tk, "rev-parse", "--verify", "--quiet", `HEAD:${p}`); } catch { pinned[p] = null; } }
  if (!pinned["ci/pipeline"] || !pinned["Jenkinsfile"]) throw new Error(`toolkit ${commit.slice(0, 12)} has no pipeline: refusing`);

  for (const rel of OVERLAY_PATHS) {
    const from = path.join(tk, rel), to = path.join(ws, rel);
    if (!fs.existsSync(from)) continue;
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, filter: (src) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(src) });
  }
  const added = [];
  for (const pkg of PACKAGES) {
    const a = path.join(ws, pkg, "package.json"), b = path.join(tk, pkg, "package.json");
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const merged = mergePackageJson(JSON.parse(fs.readFileSync(a, "utf8")), JSON.parse(fs.readFileSync(b, "utf8")));
    if (merged.added.length) { fs.writeFileSync(a, JSON.stringify(merged.json, null, 2) + "\n"); added.push(...merged.added.map((x) => `${pkg}:${x}`)); }
  }
  const record = { toolkitCommit: commit, pinned, packageJsonAdditions: added, at: new Date().toISOString() };
  fs.mkdirSync(path.join(ws, ".ci"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".ci", "toolkit.json"), JSON.stringify(record, null, 2));
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
  try {
    const r = applyOverlay({ toolkit: opt("toolkit", ".ci-toolkit"), workspace: opt("workspace", ".") });
    console.log(`✔ trusted pipeline applied from ${r.toolkitCommit.slice(0, 12)}; package.json additions: ${r.packageJsonAdditions.length ? r.packageJsonAdditions.join(", ") : "none"}`);
  } catch (e) { console.error(`✘ ${e.message}`); process.exit(1); }
}
