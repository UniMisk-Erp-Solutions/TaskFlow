// The central pipeline: any branch gets the trusted CI files from the toolkit, and the application code is never touched.
// Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyOverlay, mergePackageJson } from "../pipeline/overlay.mjs";

const w = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();

test("mergePackageJson adds only MISSING tooling and never overrides what the branch already has", () => {
  const r = mergePackageJson(
    { scripts: { build: "vite build", lint: "my-lint" }, devDependencies: { vite: "^5" }, dependencies: { react: "18" } },
    { scripts: { build: "other", lint: "eslint .", e2e: "playwright test" }, devDependencies: { vite: "^6", eslint: "^9" }, dependencies: { evil: "1" } });
  assert.equal(r.json.scripts.build, "vite build");
  assert.equal(r.json.scripts.lint, "my-lint");
  assert.equal(r.json.scripts.e2e, "playwright test");
  assert.equal(r.json.devDependencies.vite, "^5");
  assert.equal(r.json.devDependencies.eslint, "^9");
  assert.deepEqual(r.json.dependencies, { react: "18" }, "runtime dependencies are the application's, never the pipeline's");
  assert.deepEqual(r.added.sort(), ["devDependencies.eslint", "scripts.e2e"]);
});

test("applyOverlay: a branch with none of the CI files gets them from the toolkit; its application code is untouched; the toolkit hashes are recorded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-"));
  const tk = path.join(dir, "tk"), ws = path.join(dir, "ws");
  fs.mkdirSync(tk); g(tk, "init", "-q", "-b", "main"); g(tk, "config", "user.email", "t@example.test"); g(tk, "config", "user.name", "t");
  w(tk, "Jenkinsfile", "pipeline {}"); w(tk, "ci/pipeline/run-stage.mjs", "// stage"); w(tk, "ci/lib/a.mjs", "//"); w(tk, "ci/gate/a.mjs", "//"); w(tk, "ci/verify/a.mjs", "//");
  w(tk, "frontend/eslint.config.js", "export default []"); w(tk, "frontend/e2e/smoke.spec.js", "// e2e"); w(tk, "frontend/src/App.jsx", "TOOLKIT APP CODE");
  w(tk, "frontend/package.json", JSON.stringify({ scripts: { lint: "eslint ." }, devDependencies: { eslint: "^9" } }));
  g(tk, "add", "-A"); g(tk, "commit", "-qm", "toolkit");
  w(ws, "frontend/src/App.jsx", "BRANCH APP CODE"); w(ws, "frontend/package.json", JSON.stringify({ scripts: { build: "vite build" } }));
  w(ws, "ci/pipeline/run-stage.mjs", "// branch tried to tamper with the pipeline");

  const rec = applyOverlay({ toolkit: tk, workspace: ws });
  assert.equal(rec.toolkitCommit, g(tk, "rev-parse", "HEAD"));
  assert.equal(rec.pinned["ci/pipeline"], g(tk, "rev-parse", "HEAD:ci/pipeline"));
  assert.equal(fs.readFileSync(path.join(ws, "ci/pipeline/run-stage.mjs"), "utf8"), "// stage", "the branch cannot alter the pipeline that judges it");
  assert.equal(fs.readFileSync(path.join(ws, "frontend/src/App.jsx"), "utf8"), "BRANCH APP CODE");
  assert.equal(fs.existsSync(path.join(ws, "frontend/e2e/smoke.spec.js")), true);
  const pkg = JSON.parse(fs.readFileSync(path.join(ws, "frontend/package.json"), "utf8"));
  assert.deepEqual(pkg.scripts, { build: "vite build", lint: "eslint ." });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ws, ".ci/toolkit.json"), "utf8")).toolkitCommit, rec.toolkitCommit);
});

test("applyOverlay refuses a toolkit that has no pipeline", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-"));
  const tk = path.join(dir, "tk"); fs.mkdirSync(tk); g(tk, "init", "-q", "-b", "main"); g(tk, "config", "user.email", "t@example.test"); g(tk, "config", "user.name", "t");
  w(tk, "README.md", "x"); g(tk, "add", "-A"); g(tk, "commit", "-qm", "empty");
  assert.throws(() => applyOverlay({ toolkit: tk, workspace: path.join(dir, "ws") }), /no pipeline/);
});
