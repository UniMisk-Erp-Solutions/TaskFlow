// The quality engine must really catch what the engineering standard says it catches, and must not block on debt that
// is already in the baseline. Each test builds a tiny project, snapshots it as the baseline, makes it worse, and
// checks the exact rule that fires.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runChecks, initPolicy } from "../verify/quality/run.mjs";
import { CHECKS } from "../verify/quality/lib/checks.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const POLICY_REAL = JSON.parse(fs.readFileSync(path.join(REPO, "ci/verify/quality/policy.json"), "utf8"));

const POLICY = {
  project: "fixture",
  typescriptFrom: [path.join(REPO, "frontend")],
  sourceRoots: ["web/src", "api/src"],
  testPattern: ["__tests__/", "\\.test\\.[jt]sx?$"],
  packages: ["web"],
  protectedFiles: ["web/tsconfig.json"],
  aliases: [{ prefix: "@/", to: "web/" }],
  thresholds: { functionLines: { warn: 60, fail: 100 }, cyclomatic: { warn: 10, fail: 15 }, cognitive: { fail: 15 }, nesting: { fail: 4 }, params: { warn: 5 }, fileLines: { warn: 400, fail: 700 }, duplication: { window: 50, maxPercent: 3, tolerance: 0.25 } },
  architecture: {
    rules: [
      { id: "ARCH-001", title: "web must not import api", from: "^web/", to: "^api/", suggestion: "call the API" },
      { id: "ARCH-003", title: "components must not use the db client", from: "^web/src/components/", to: "^web/src/db\\.js$", suggestion: "use api.js" },
    ],
  },
};

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quality-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put("web/package.json", JSON.stringify({ dependencies: { react: "1" }, devDependencies: {} }));
  put("web/package-lock.json", JSON.stringify({ packages: { "": { dependencies: { react: "1" } } } }));
  put("web/tsconfig.json", '{"compilerOptions":{"strict":true}}');
  put("web/src/ok.js", "export const ok = () => 1;\n");
  for (const [rel, text] of Object.entries(files || {})) put(rel, text);
  const policyFile = path.join(root, "policy.json"), baselineFile = path.join(root, "baseline.json");
  fs.writeFileSync(policyFile, JSON.stringify(POLICY));
  const run = (names, opts = {}) => runChecks({ root, policyFile, baselineFile, names, ...opts }).results;
  const snapshot = () => { const r = run(Object.keys(CHECKS), { audit: true }); const b = {}; for (const x of Object.values(r)) Object.assign(b, x.snapshot); fs.writeFileSync(baselineFile, JSON.stringify(b)); };
  return { root, put, run, snapshot, rm: (rel) => fs.rmSync(path.join(root, rel)) };
}
const rules = (r) => r.violations.map((v) => v.rule).sort();

const bigFn = (n) => `export function big() {\n${"  const a = 1;\n".repeat(n)}  return a;\n}\n`;
const branchy = (n) => `export function branchy(x) {\n${Array.from({ length: n }, (_, i) => `  if (x === ${i}) return ${i};`).join("\n")}\n  return -1;\n}\n`;
const deep = "export function deep(a) {\n  if (a) { for (const i of a) { while (i) { if (i.x) { if (i.y) { return 1; } } } } }\n  return 0;\n}\n";

test("a clean project passes every check against its own baseline", () => {
  const f = fixture(); f.snapshot();
  for (const [name, r] of Object.entries(f.run(Object.keys(CHECKS)))) assert.deepEqual(rules(r), [], name);
});

test("MAINTAINABILITY: oversized, over-complex and deeply nested functions are blocked when new", () => {
  const f = fixture(); f.snapshot();
  f.put("web/src/big.js", bigFn(120)); f.put("web/src/branchy.js", branchy(17)); f.put("web/src/deep.js", deep);
  const r = f.run(["maintainability"]).maintainability;
  assert.ok(rules(r).includes("MAINT-002"), "function over 100 lines");
  assert.ok(rules(r).includes("MAINT-004"), "cyclomatic complexity over 15");
  assert.ok(rules(r).includes("MAINT-006"), "nesting deeper than 4");
  const v = r.violations.find((x) => x.rule === "MAINT-002");
  assert.equal(v.file, "web/src/big.js"); assert.ok(v.line > 0 && v.suggestion, "violation names file, line and a fix");
});

test("MAINTAINABILITY: known debt does not block, but making it worse does", () => {
  const f = fixture({ "web/src/branchy.js": branchy(17) }); f.snapshot();
  assert.deepEqual(rules(f.run(["maintainability"]).maintainability), []);
  f.put("web/src/branchy.js", branchy(25));
  const r = f.run(["maintainability"]).maintainability;
  assert.ok(rules(r).includes("MAINT-004"), "complexity grew beyond the baseline value");
  assert.match(r.violations[0].message, /worse than the baseline/);
});

test("MAINTAINABILITY: copy-pasted code beyond the allowance is blocked", () => {
  const body = Array.from({ length: 40 }, (_, i) => `  total += compute${i}(input.value${i}, options.flag${i});`).join("\n");
  const f = fixture(); f.snapshot();
  f.put("web/src/a.js", `export function a(input, options) {\n  let total = 0;\n${body}\n  return total;\n}\n`);
  f.put("web/src/b.js", `export function b(input, options) {\n  let total = 0;\n${body}\n  return total;\n}\n`);
  assert.ok(rules(f.run(["maintainability"]).maintainability).includes("MAINT-010"));
});

test("STANDARDS: any, unsafe casts, console.log, debugger and HTML injection are blocked in new code", () => {
  const f = fixture(); f.snapshot();
  f.put("web/src/bad.ts", "export const a: any = 1;\nexport const b = a as unknown as string;\nconsole.log(b);\ndebugger;\n");
  f.put("web/src/Html.jsx", "export const H = ({ s }) => <div dangerouslySetInnerHTML={{ __html: s }} />;\n");
  f.put("web/src/trail.js", "export const x = 1;   \n");
  const r = f.run(["standards"]).standards;
  for (const id of ["STD-001", "STD-003", "STD-004", "STD-005", "STD-006", "STD-010"]) assert.ok(rules(r).includes(id), id);
});

test("STANDARDS: console.log in tests and existing baselined occurrences are not blocked", () => {
  const f = fixture({ "web/src/old.js": "console.log('legacy');\n", "web/src/__tests__/t.test.js": "it('x', () => { console.log('ok'); });\n" }); f.snapshot();
  assert.deepEqual(rules(f.run(["standards"]).standards), []);
  f.put("web/src/old.js", "console.log('legacy');\nconsole.log('one more');\n");
  assert.deepEqual(rules(f.run(["standards"]).standards), ["STD-004"]);
});

test("ARCHITECTURE: forbidden imports, UI reaching the database and circular dependencies are blocked", () => {
  const f = fixture({ "api/src/server.js": "export const s = 1;\n", "web/src/db.js": "export const db = 1;\n" }); f.snapshot();
  f.put("web/src/uses-api.js", "import { s } from '../../api/src/server.js';\nexport default s;\n");
  f.put("web/src/components/Panel.jsx", "import { db } from '../db.js';\nexport default () => db;\n");
  f.put("web/src/c1.js", "import { b } from './c2.js';\nexport const a = () => b;\n");
  f.put("web/src/c2.js", "import { a } from './c1.js';\nexport const b = () => a;\n");
  const r = f.run(["architecture"]).architecture;
  assert.ok(rules(r).filter((x) => x === "ARCH-001").length === 1, "web importing api");
  assert.ok(rules(r).includes("ARCH-003"), "component importing the db client");
  assert.ok(rules(r).includes("ARCH-002"), "new cycle");
});

test("ARCHITECTURE: an import that resolves to nothing is blocked; the @/ alias and assets resolve correctly", () => {
  const f = fixture(); f.snapshot();
  f.put("web/src/good.js", "import { ok } from '@/src/ok';\nimport './style.css';\nexport default ok;\n");
  assert.deepEqual(rules(f.run(["architecture"]).architecture), []);
  f.put("web/src/broken.js", "import x from './missing';\nexport default x;\n");
  assert.deepEqual(rules(f.run(["architecture"]).architecture), ["ARCH-011"]);
});

test("ARCHITECTURE: an existing cycle is tolerated until it grows", () => {
  const f = fixture({ "web/src/c1.js": "import './c2.js';\nexport const a = 1;\n", "web/src/c2.js": "import './c1.js';\nexport const b = 1;\n" }); f.snapshot();
  assert.deepEqual(rules(f.run(["architecture"]).architecture), []);
  f.put("web/src/c3.js", "import './c1.js';\nexport const c = 1;\n"); f.put("web/src/c1.js", "import './c2.js';\nimport './c3.js';\nexport const a = 1;\n");
  assert.ok(rules(f.run(["architecture"]).architecture).includes("ARCH-002"));
});

test("REPO POLICY: deleted tests, .only, new suppressions, a missing lockfile entry and protected-config edits are blocked", () => {
  const f = fixture({ "web/src/__tests__/a.test.js": "it('one', () => {});\nit('two', () => {});\n", "web/src/__tests__/b.test.js": "it('three', () => {});\n" }); f.snapshot();
  f.put("web/src/__tests__/a.test.js", "it.only('one', () => {});\n");   // lost a test and focused another
  f.rm("web/src/__tests__/b.test.js");
  f.put("web/src/ok.js", "// eslint-disable-next-line no-undef\nexport const ok = () => 1;\n");
  f.put("web/tsconfig.json", '{"compilerOptions":{"strict":false}}');
  f.put("web/package.json", JSON.stringify({ dependencies: { react: "1", lodash: "4" }, devDependencies: {} }));
  const r = f.run(["repo-policy"])["repo-policy"];
  for (const id of ["REPO-001", "REPO-002", "REPO-003", "REPO-004", "REPO-007"]) assert.ok(rules(r).includes(id), id);
  assert.ok(r.warnings.some((w) => w.rule === "REPO-006"), "a new dependency is flagged for admin review without blocking");
  assert.ok(!r.violations.some((v) => v.rule === "REPO-006"));
});

test("a missing baseline fails loudly instead of silently passing", () => {
  const f = fixture();
  assert.throws(() => f.run(["standards"]), /baseline not found/);
});

test("TASKFLOW POLICY: every architecture rule is a valid regex and the committed baseline exists", () => {
  for (const r of POLICY_REAL.architecture.rules) { new RegExp(r.from); new RegExp(r.to); assert.ok(r.id && r.title && r.suggestion, r.title); }
  assert.ok(fs.existsSync(path.join(REPO, "ci/verify/quality/baseline.json")));
});

test("INIT: a new project gets a starter policy with its package folders and source roots detected", () => {
  const f = fixture({ "api/package.json": "{}", "api/src/a.js": "export const a = 1;\n" });
  const p = initPolicy(f.root, "demo");
  assert.deepEqual(p.packages.sort(), ["api", "web"]);
  assert.ok(p.sourceRoots.includes("web/src") && p.sourceRoots.includes("api/src"));
  assert.equal(p.thresholds.functionLines.fail, 100);
  assert.deepEqual(p.architecture.rules, []);
});
