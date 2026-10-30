// The bootstrap tool must produce a project CI that is internally consistent (every stage is run, every required check
// is a real stage), carries no credentials, and fails loudly when the toolkit it copies from has changed shape.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planProject, detectPackages } from "../bootstrap/new-project.mjs";
import { parseRegistry } from "../gate-service/projects.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "boot-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put("web/package.json", JSON.stringify({ scripts: { lint: "eslint .", typecheck: "tsc --noEmit", build: "vite build", test: "vitest run" } }));
  put("web/eslint.config.js", "export default [];\n");
  put("web/tsconfig.ci.json", "{}\n");
  put("api/package.json", JSON.stringify({ scripts: { lint: "eslint ." } }));
  put("web/src/a.js", "export const a = 1;\n");
  return { root, put };
}
const plan = (root, over = {}) => planProject({ id: "acme", repo: "Org/Acme", display: "Acme", target: root, ...over });

test("BOOTSTRAP: finds the packages and builds the stage list from the scripts they really have", () => {
  const f = fixture();
  assert.deepEqual(detectPackages(f.root).map((p) => p.dir).sort(), ["api", "web"]);
  const { stages } = plan(f.root);
  assert.deepEqual(Object.keys(stages), ["lint", "typecheck", "build", "unit-tests", "trivy-deps", "trivy-secrets", "repo-policy", "code-standards", "maintainability", "architecture"]);
  assert.equal(stages.lint.commands.length, 2, "lint runs in both packages");
  assert.equal(stages.typecheck.commands.length, 1, "typecheck only where the script exists");
});

test("BOOTSTRAP: a stage that no package supports is left out, never faked", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.root, "web/package.json"), JSON.stringify({ scripts: { lint: "eslint ." } }));
  const { stages } = plan(f.root);
  assert.ok(!stages.build && !stages["unit-tests"] && !stages.typecheck);
  assert.ok(stages["trivy-secrets"] && stages.architecture, "the universal stages always exist");
});

test("BOOTSTRAP: the Jenkinsfile runs every stage exactly once, runs no unknown stage, and holds no credentials, deploy, merge or push", () => {
  const f = fixture();
  const { stages, files } = plan(f.root);
  const jf = files.get("Jenkinsfile");
  const run = [...jf.matchAll(/run-stage\.mjs (\S+?)'/g)].map((m) => m[1]);
  assert.deepEqual([...run].sort(), Object.keys(stages).sort(), "every stage is run, none is unknown");
  assert.equal(new Set(run).size, run.length, "no stage runs twice");
  assert.match(jf, /CI_REPO\s+= 'Org\/Acme'/);
  assert.match(jf, /label 'untrusted'/);
  assert.doesNotMatch(jf.replace(/\/\/.*$/gm, ""), /credentials|withCredentials|deploy|git push|merge|vercel|--force/i);
});

test("BOOTSTRAP: the generated config is a valid module whose required checks equal the registry entry", async () => {
  const f = fixture();
  const p = plan(f.root);
  for (const [rel, text] of p.files) { fs.mkdirSync(path.dirname(path.join(f.root, rel)), { recursive: true }); fs.writeFileSync(path.join(f.root, rel), text); }
  const cfg = await import(pathToFileURL(path.join(f.root, "ci/pipeline/config.mjs")).href);
  assert.deepEqual(cfg.REQUIRED_CHECKS, p.registryEntry.requiredChecks);
  assert.equal(cfg.GITHUB_CHECK_NAME, "unimisk/verified");
  for (const s of Object.values(cfg.STAGES)) for (const c of s.commands) for (const a of c.args) if (/^ci\/[^*]+\.mjs$/.test(a)) assert.ok(fs.existsSync(path.join(f.root, a)), `${a} must exist in the new project`);
  // the registry accepts the entry once developers are added
  const taskflow = JSON.parse(fs.readFileSync(path.join(HERE, "..", "projects.json"), "utf8"));
  const reg = parseRegistry({ ...taskflow, projects: [...taskflow.projects, { ...p.registryEntry, developers: [{ user: "zed", prefixes: ["zed"] }] }] });
  assert.equal(reg.projects.length, taskflow.projects.length + 1, "the entry is accepted next to every project already registered");
  for (const rel of ["ci/pipeline/overlay.mjs", "ci/pipeline/run-trivy.mjs"]) { const t = p.files.get(rel); assert.ok(!t.includes('"frontend"') && t.includes('"web"') && t.includes('"api"'), `${rel} is adapted to this project's packages`); }
  assert.match(p.files.get("ci/pipeline/overlay.mjs"), /"web\/eslint\.config\.js"/, "the trusted lint config replaces the branch's own");
  assert.match(p.files.get("ci/pipeline/overlay.mjs"), /"web\/tsconfig\.ci\.json"/);
  assert.equal(JSON.parse(p.files.get("ci/verify/quality/policy.json")).project, "Acme");
});

test("BOOTSTRAP: bad input and a changed toolkit fail loudly", () => {
  const f = fixture();
  assert.throws(() => plan(f.root, { id: "Bad Id" }), /lowercase letters/);
  assert.throws(() => plan(f.root, { repo: "not-a-repo" }), /owner\/name/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "boot-empty-"));
  assert.throws(() => plan(empty), /no package\.json/);
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), "boot-toolkit-"));
  const real = path.resolve(HERE, "..", "..");
  fs.cpSync(path.join(real, "ci"), path.join(fake, "ci"), { recursive: true });
  const ov = path.join(fake, "ci/pipeline/overlay.mjs");
  fs.writeFileSync(ov, fs.readFileSync(ov, "utf8").replace('const PACKAGES = ["frontend", "backend"];', "const PACKAGES = [];"));
  assert.throws(() => plan(f.root, { toolkit: fake }), /bootstrap anchor missing in overlay PACKAGES/);
});

test("BOOTSTRAP: install commands, the global-scope and database checks and project stages are wired into config and Jenkinsfile; unsafe titles are refused", () => {
  const f = fixture();
  const p = plan(f.root, { installs: ["npm i --no-save a@1.0.0 b@2.0.0", "npm --prefix api install"], qualityExtra: ["globals", "database"], extraStages: [{ name: "ui-checks", title: "UI checks", cmd: "node", args: ["ci/pipeline/run-ui-checks.mjs"] }] });
  const jf = p.files.get("Jenkinsfile");
  assert.match(jf, /sh 'npm i --no-save a@1\.0\.0 b@2\.0\.0'/);
  assert.doesNotMatch(jf, /--prefix web install/, "the default installs are replaced");
  const run = [...jf.matchAll(/run-stage\.mjs (\S+?)'/g)].map((m) => m[1]);
  assert.deepEqual([...run].sort(), Object.keys(p.stages).sort(), "every stage including the extra ones is run exactly once");
  assert.ok(p.stages.globals && p.stages.database && p.stages["ui-checks"]);
  assert.match(p.files.get("ci/pipeline/config.mjs"), /"ui-checks"/);
  assert.throws(() => plan(f.root, { extraStages: [{ name: "x", title: "it's bad", cmd: "node", args: [] }] }), /must not contain quotes/);
  assert.throws(() => plan(f.root, { qualityExtra: ["nonsense"] }), /unknown quality check/);
});

test("BOOTSTRAP: the dependency scan only covers folders that have a lockfile", () => {
  const f = fixture();
  f.put("package.json", JSON.stringify({ scripts: { dev: "x" } }));            // a root package.json with no dependencies and no lockfile
  f.put("web/package-lock.json", "{}\n"); f.put("api/package-lock.json", "{}\n");
  const trivy = plan(f.root).files.get("ci/pipeline/run-trivy.mjs");
  assert.match(trivy, /for \(const dir of \[\s*"api"\s*,\s*"web"\s*\]\)/);
  assert.doesNotMatch(trivy, /for \(const dir of \[[^\]]*"\."/);
});

test("BOOTSTRAP: a .trivyignore is created when the project has none (Trivy refuses to run without it) and an existing one is never overwritten", () => {
  const f = fixture();
  assert.match(plan(f.root).files.get(".trivyignore"), /Accepted, reviewed Trivy exceptions only/);
  f.put(".trivyignore", "CVE-2099-0001\n");
  assert.equal(plan(f.root).files.has(".trivyignore"), false);
});
