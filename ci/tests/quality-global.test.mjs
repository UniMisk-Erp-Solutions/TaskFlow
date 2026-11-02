// The checks for "no build step, one shared global scope" applications, SQL migrations, documentation indexes and
// project-specific forbidden patterns. Each rule must fire on bad input and stay quiet on good input.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runChecks } from "../verify/quality/run.mjs";
import { CHECKS } from "../verify/quality/lib/checks.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HTML = (srcs) => `<html><body>\n<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-x"></script>\n${srcs.map((s) => `<script type="text/babel" src="src/${s}"></script>`).join("\n")}\n</body></html>\n`;

const POLICY = {
  project: "fixture", typescriptFrom: [path.join(REPO, "frontend")],
  sourceRoots: ["web/src"], testPattern: ["__tests__/"], packages: [], protectedFiles: [], aliases: [],
  thresholds: { functionLines: { warn: 60, fail: 100 }, cyclomatic: { warn: 10, fail: 15 }, cognitive: { fail: 15 }, nesting: { fail: 4 }, params: { warn: 5 }, fileLines: { warn: 400, fail: 700 }, duplication: { window: 50, maxPercent: 3, tolerance: 0.25 } },
  globals: { scope: ["web/src"], html: "web/index.html", ambient: ["React", "ReactDOM"] },
  database: { migrations: "db/migrations" },
  docs: { dir: "docs", index: "docs/INDEX.md" },
  architecture: { rules: [], modules: [] },
};

function fixture(files, policyOver = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qglobal-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  const order = Object.keys(files).filter((n) => n.startsWith("web/src/")).map((n) => n.replace("web/src/", ""));
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  if (!files["web/index.html"]) put("web/index.html", HTML(order));
  const policyFile = path.join(root, "policy.json"), baselineFile = path.join(root, "baseline.json");
  fs.writeFileSync(policyFile, JSON.stringify({ ...POLICY, ...policyOver }));
  const run = (names, audit = false) => runChecks({ root, policyFile, baselineFile, names, audit }).results;
  const snapshot = () => { const r = run(Object.keys(CHECKS), true); const b = {}; for (const x of Object.values(r)) Object.assign(b, x.snapshot); fs.writeFileSync(baselineFile, JSON.stringify(b)); };
  return { root, put, run, snapshot };
}
const rules = (r) => r.violations.map((v) => v.rule);

test("GLOBALS: a clean shared-global app passes; names shared through window and bare reads resolve", () => {
  const f = fixture({
    "web/src/utils.jsx": "const fmt = (n) => String(n);\nwindow.fmt2 = fmt;\nObject.assign(window, { shared });\nfunction shared() { return 1; }\n",
    "web/src/screen.jsx": "function Screen({ error }) { const info = { error }; return React.createElement('div', null, fmt(1) + fmt2(2) + shared() + typeof maybeMissing + info.error); }\n",
  });
  f.snapshot();
  assert.deepEqual(rules(f.run(["globals"]).globals), []);
});

test("GLOBALS: the same top-level name in two files, a name defined nowhere, and module syntax are blocked", () => {
  const f = fixture({ "web/src/a.jsx": "const helper = 1;\n", "web/src/b.jsx": "const helper = 2;\nexport const y = 1;\nfunction f() { return missingEverywhere + 1; }\n" });
  const r = f.run(["globals"], true).globals;
  for (const id of ["GLOB-001", "GLOB-002", "GLOB-004"]) assert.ok(rules(r).includes(id), id);
  const dup = r.violations.find((v) => v.rule === "GLOB-001");
  assert.match(dup.message, /helper/); assert.ok(dup.line > 0 && dup.suggestion);
  assert.match(r.violations.find((v) => v.rule === "GLOB-002").message, /missingEverywhere/);
});

test("GLOBALS: a file the page never loads, and a script tag whose file is missing, are blocked", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n", "web/src/dead.jsx": "const dead = 1;\n", "web/index.html": HTML(["a.jsx", "gone.jsx"]) });
  const r = f.run(["globals"], true).globals;
  assert.ok(r.violations.some((v) => v.rule === "GLOB-005" && /never loads/.test(v.message) && v.file === "web/src/dead.jsx"));
  assert.ok(r.violations.some((v) => v.rule === "GLOB-005" && /does not exist/.test(v.message)));
});

test("GLOBALS: using a name while the file LOADS that a later file defines is blocked; inside a function it is fine", () => {
  const bad = fixture({ "web/src/early.jsx": "const copy = lateValue + 1;\n", "web/src/late.jsx": "const lateValue = 5;\n" });
  const r = bad.run(["globals"], true).globals;
  assert.ok(rules(r).includes("GLOB-006"));
  assert.match(r.violations.find((v) => v.rule === "GLOB-006").message, /lateValue.*LATER/s);
  const ok = fixture({ "web/src/early.jsx": "function use() { return lateValue + 1; }\n", "web/src/late.jsx": "const lateValue = 5;\n" });
  assert.deepEqual(rules(ok.run(["globals"], true).globals), []);
});

test("GLOBALS: a CDN script without an exact version is blocked; a missing integrity attribute only warns", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n", "web/index.html": '<script src="https://unpkg.com/react/umd/react.js"></script>\n<script src="https://unpkg.com/lib@1.2.3/x.js"></script>\n<script src="src/a.jsx"></script>\n' });
  const r = f.run(["globals"], true).globals;
  assert.ok(r.violations.some((v) => v.rule === "GLOB-007" && /react\/umd/.test(v.message)));
  assert.ok(r.warnings.some((w) => w.rule === "GLOB-008"));
});

test("GLOBALS: existing findings are known (baseline), a new one fails", () => {
  const f = fixture({ "web/src/a.jsx": "const helper = 1;\n", "web/src/b.jsx": "const helper = 2;\n" });
  f.snapshot();
  assert.deepEqual(rules(f.run(["globals"]).globals), []);
  f.put("web/src/c.jsx", "const another = 1;\nfunction g() { return nothingDefinesThis; }\n"); f.put("web/index.html", HTML(["a.jsx", "b.jsx", "c.jsx"]));
  assert.deepEqual(rules(f.run(["globals"]).globals), ["GLOB-002"]);
});

test("ARCHITECTURE (global scope): file-to-file reads obey the project's layer rules, by file and by name", () => {
  const policy = { architecture: { rules: [
    { id: "ARCH-A", title: "base files must not read screens", from: "^web/src/(utils|config)\\.", to: "^web/src/screens-", suggestion: "invert it" },
    { id: "ARCH-B", title: "another screen's private helpers are private", from: "^web/src/screens-(?!import)", to: "^web/src/screens-import", names: "^imp[A-Z]", suggestion: "move it to utils" },
  ], modules: [] } };
  const f = fixture({
    "web/src/utils.jsx": "function baseHelper() { return screenHelper(); }\n",
    "web/src/screens-import.jsx": "function impParse() { return 1; }\nfunction screenHelper() { return 2; }\nfunction publicImport() { return 3; }\n",
    "web/src/screens-so.jsx": "function so() { return impParse() + publicImport(); }\n",
  }, policy);
  const r = f.run(["architecture"], true).architecture;
  assert.ok(r.violations.some((v) => v.rule === "ARCH-A" && v.file === "web/src/utils.jsx"), "foundation reading a screen");
  assert.ok(r.violations.some((v) => v.rule === "ARCH-B" && /impParse/.test(v.message)), "private helper read from another screen");
  assert.ok(!r.violations.some((v) => v.rule === "ARCH-B" && /publicImport/.test(v.message)), "a name outside the private prefix is allowed");
});

test("DATABASE: a table without row-level security, destructive statements, open policies and unsafe definer functions are blocked", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n",
    "db/migrations/001_init.sql": "create table public.orders (id int);\ncreate table public.safe_one (id int);\nalter table public.safe_one enable row level security;\ncreate policy p on public.safe_one for all using (true);\n",
    "db/migrations/002_more.sql": "drop table public.old;\ndelete from public.things;\ncreate function public.f() returns int security definer language sql as $$ select 1 $$;\ncreate function public.g() returns int security definer set search_path = public language sql as $$ select 1 $$;\n" });
  const r = f.run(["database"], true).database;
  assert.ok(r.violations.some((v) => v.rule === "DB-001" && /orders/.test(v.message)));
  assert.ok(!r.violations.some((v) => v.rule === "DB-001" && /safe_one/.test(v.message)));
  const by = (id) => r.violations.find((v) => v.rule === id);
  assert.ok(by("DB-002") && /2 ×/.test(by("DB-002").message), "drop table + delete without where");
  assert.ok(by("DB-003"), "using (true)");
  assert.ok(by("DB-004") && /1 ×/.test(by("DB-004").message), "only the definer function without search_path");
});

test("DATABASE: row-level security enabled in a loop over an array of table names counts; baseline makes old migrations known", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n",
    "db/migrations/001.sql": "create table public.a (id int);\ncreate table public.b (id int);\ndo $$ declare t text; tbls text[] := array['a','b']; begin foreach t in array tbls loop execute format('alter table public.%I enable row level security;', t); end loop; end $$;\n" });
  assert.deepEqual(rules(f.run(["database"], true).database), []);
  f.put("db/migrations/002.sql", "create table public.c (id int);\n");
  const before = f.run(["database"], true).database; assert.ok(rules(before).includes("DB-001"));
  f.snapshot();
  assert.deepEqual(rules(f.run(["database"]).database), [], "known after the baseline");
  f.put("db/migrations/003.sql", "create table public.d (id int);\n");
  assert.deepEqual(rules(f.run(["database"]).database), ["DB-001"], "a NEW table without RLS fails");
});

test("DOCS: every document must be listed in the index and the index may only link to documents that exist", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n", "docs/INDEX.md": "# Index\n- [architecture](./architecture.md)\n- [gone](./gone.md)\n", "docs/architecture.md": "x", "docs/unlisted.md": "y" });
  f.snapshot();
  assert.deepEqual(rules(f.run(["repo-policy"])["repo-policy"]), [], "existing gaps are known");
  f.put("docs/another.md", "z");
  const r = f.run(["repo-policy"])["repo-policy"];
  assert.deepEqual(rules(r), ["REPO-008"]); assert.match(r.violations[0].message, /not listed/);
});

test("FORBIDDEN PATTERNS: a project-specific regex rule fires per file, with line numbers, and known occurrences do not block", () => {
  const policy = { forbiddenPatterns: [{ id: "OPC-DB", regex: "OPC_SB\\.from\\(", files: "^web/src/screens-", message: "screens must not write to the database directly (a failed write would look like a success)", suggestion: "go through the store" }] };
  const f = fixture({ "web/src/screens-a.jsx": "function a() { return window.OPC_SB.from('t'); }\n", "web/src/store.jsx": "function s() { return window.OPC_SB.from('t'); }\n" }, policy);
  f.snapshot();
  assert.deepEqual(rules(f.run(["standards"]).standards), []);
  f.put("web/src/screens-a.jsx", "function a() { return window.OPC_SB.from('t'); }\nfunction b() { return window.OPC_SB.from('u'); }\n");
  const r = f.run(["standards"]).standards;
  assert.deepEqual(rules(r), ["OPC-DB"]); assert.match(r.violations[0].message, /failed write/);
});

test("NOT CONFIGURED: a project without these sections is told so explicitly, never silently passed", () => {
  const f = fixture({ "web/src/a.jsx": "const a = 1;\n" }, { globals: undefined, database: undefined });
  const r = f.run(["globals", "database"], true);
  assert.match(r.globals.info, /not configured/); assert.match(r.database.info, /not configured/);
  assert.deepEqual(rules(r.globals), []);
});
