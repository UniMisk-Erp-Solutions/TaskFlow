// The four quality checks. Each returns { violations, warnings, baselined, snapshot }:
//   violations  new or worsened problems: these FAIL the stage
//   warnings    reported, never blocking (thresholds the policy marks as "warn")
//   baselined   known existing problems that did not get worse (technical debt, listed in baseline.json)
//   snapshot    what the baseline would contain for this check (written by --update-baseline)
// A violation is NEW when its key is not in the baseline, and WORSENED when its measured value exceeds the baseline value,
// so existing debt never blocks work but can never grow.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { lineOf } from "./project.mjs";
import { fileLoc, measureDuplication, measureFunctions } from "./metrics.mjs";
import { buildGraph, expandRules, findCycles, violatingEdges } from "./graph.mjs";
import { analyzeGlobals } from "./globals.mjs";
import { analyzeMigrations } from "./database.mjs";

const skipped = (why) => ({ violations: [], warnings: [], baselined: 0, snapshot: {}, info: `not configured: ${why}` });
const globalsOf = (project) => (project._globals ||= analyzeGlobals(project));

const V = (check, rule, severity, file, line, message, suggestion, key, value) => ({ check, rule, severity, file, line, message, suggestion, key, value });
const sortV = (a) => a.sort((x, y) => (x.file + String(x.line).padStart(7, "0")).localeCompare(y.file + String(y.line).padStart(7, "0")));

/** key->value measurements against a baseline map: returns [new/worsened, unchanged-known]. */
function diffAgainst(current, base) {
  const worse = [], same = [];
  for (const m of current) {
    const b = base?.[m.key];
    if (b === undefined || m.value > b) worse.push({ ...m, was: b }); else same.push(m);
  }
  return [worse, same];
}

// ───────────────────────────── 1. maintainability ─────────────────────────────
export function maintainability(project, baseline) {
  const { ts, policy } = project;
  const t = policy.thresholds;
  const errors = [], warnings = [];
  const loc = {};
  for (const f of project.prod) {
    loc[f.rel] = fileLoc(f.text);
    if (loc[f.rel] > t.fileLines.fail) errors.push({ ...V("maintainability", "MAINT-009", "error", f.rel, 1, `file has ${loc[f.rel]} code lines (limit ${t.fileLines.fail})`, "split by responsibility (data access, state, view) into smaller modules", `MAINT-009|${f.rel}`, loc[f.rel]) });
    else if (loc[f.rel] > t.fileLines.warn) warnings.push(V("maintainability", "MAINT-008", "warn", f.rel, 1, `file has ${loc[f.rel]} code lines (warning above ${t.fileLines.warn})`, "consider splitting by responsibility", `MAINT-008|${f.rel}`, loc[f.rel]));
    for (const fn of measureFunctions(ts, f)) {
      const at = (rule, label, value, limit, hint) => errors.push(V("maintainability", rule, "error", f.rel, fn.line, `function "${fn.name}" ${label} ${value} (limit ${limit})`, hint, `${rule}|${f.rel}|${fn.symbol}`, value));
      const warn = (rule, label, value, limit) => warnings.push(V("maintainability", rule, "warn", f.rel, fn.line, `function "${fn.name}" ${label} ${value} (warning above ${limit})`, "", `${rule}|${f.rel}|${fn.symbol}`, value));
      if (fn.length > t.functionLines.fail) at("MAINT-002", "has code lines:", fn.length, t.functionLines.fail, "extract steps into well-named helper functions or hooks");
      else if (fn.length > t.functionLines.warn) warn("MAINT-001", "has code lines:", fn.length, t.functionLines.warn);
      if (fn.cyclomatic > t.cyclomatic.fail) at("MAINT-004", "has cyclomatic complexity", fn.cyclomatic, t.cyclomatic.fail, "replace nested conditions with early returns, lookup tables or smaller functions");
      else if (fn.cyclomatic > t.cyclomatic.warn) warn("MAINT-003", "has cyclomatic complexity", fn.cyclomatic, t.cyclomatic.warn);
      if (fn.cognitive > t.cognitive.fail) at("MAINT-005", "has cognitive complexity", fn.cognitive, t.cognitive.fail, "flatten nesting and split the decision logic");
      if (fn.nesting > t.nesting.fail) at("MAINT-006", "nests control flow", fn.nesting, t.nesting.fail, "invert conditions (guard clauses) or extract the inner block");
      if (fn.params > t.params.warn) warn("MAINT-007", "takes parameters:", fn.params, t.params.warn);
    }
  }
  const dup = measureDuplication(ts, project.prod, t.duplication.window);
  const dupBase = baseline?.duplication?.percent;
  const dupLimit = Math.max(t.duplication.maxPercent, (dupBase ?? 0) + t.duplication.tolerance);
  const violations = [];
  if (dup.percent > dupLimit) {
    const worst = Object.entries(dup.perFile).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${f} (${n} tokens)`).join(", ");
    violations.push(V("maintainability", "MAINT-010", "error", "(project)", 0, `duplicated code is ${dup.percent}% of the source (allowed ${dupLimit}%; baseline ${dupBase ?? "none"}%). Most duplicated: ${worst}`, "extract the repeated block into a shared function or component", "MAINT-010", dup.percent));
  }
  const [worse, same] = diffAgainst(errors, baseline?.maintainability);
  violations.push(...worse.map((m) => ({ ...m, message: m.message + (m.was !== undefined ? ` — worse than the baseline (${m.was})` : "") })));
  const snapshot = { maintainability: Object.fromEntries(errors.map((m) => [m.key, m.value])), duplication: { percent: dup.percent, tokens: dup.totalTokens } };
  return { violations: sortV(violations), warnings: sortV(warnings), baselined: same.length, snapshot, info: `${project.prod.length} files, duplication ${dup.percent}%` };
}

// ───────────────────────────── 2. code standards ─────────────────────────────
export function standards(project, baseline) {
  const { ts, policy } = project;
  const K = ts.SyntaxKind;
  const allowConsole = (policy.consoleAllowed || []).map((s) => new RegExp(s));
  const found = new Map(); // key -> { rule, file, lines[] }
  const hit = (rule, file, line, msg, sug, sev = "error") => {
    const key = `${rule}|${file.rel}`;
    if (!found.has(key)) found.set(key, { rule, file: file.rel, lines: [], msg, sug, sev });
    found.get(key).lines.push(line);
  };
  for (const f of project.prod) {
    const { sf } = f;
    const isTs = f.ext === ".ts" || f.ext === ".tsx";
    const consoleOk = allowConsole.some((r) => r.test(f.rel));
    const visit = (n) => {
      const line = () => lineOf(sf, n);
      if (n.kind === K.AnyKeyword && isTs) hit("STD-001", f, line(), "explicit `any`", "use a precise type or `unknown` with narrowing");
      else if (n.kind === K.AsExpression && n.expression.kind === K.AsExpression && n.expression.type.kind === K.UnknownKeyword) hit("STD-003", f, line(), "unsafe double cast `as unknown as T`", "fix the types instead of forcing them");
      else if (n.kind === K.NonNullExpression) hit("STD-008", f, line(), "non-null assertion `!`", "handle the null case explicitly", "warn");
      else if (n.kind === K.DebuggerStatement) hit("STD-005", f, line(), "`debugger` statement", "remove it");
      else if (n.kind === K.CallExpression) {
        const c = n.expression;
        if (c.kind === K.PropertyAccessExpression && c.expression.kind === K.Identifier && c.expression.text === "console" && ["log", "debug", "trace"].includes(c.name.text) && !consoleOk) hit("STD-004", f, line(), `console.${c.name.text} in production code`, "remove it or use the project's logger");
        else if (c.kind === K.Identifier && c.text === "eval") hit("STD-007", f, line(), "`eval` call", "never evaluate strings as code");
        else if (c.kind === K.PropertyAccessExpression && c.name.text === "insertAdjacentHTML") hit("STD-006", f, line(), "unsafe HTML injection via insertAdjacentHTML", "render through the framework or sanitise the input");
        else if (c.kind === K.PropertyAccessExpression && c.expression.kind === K.Identifier && c.expression.text === "document" && c.name.text === "write") hit("STD-006", f, line(), "document.write", "render through the framework");
      } else if (n.kind === K.NewExpression && n.expression.kind === K.Identifier && n.expression.text === "Function") hit("STD-007", f, line(), "`new Function` call", "never build code from strings");
      else if (n.kind === K.JsxAttribute && n.name.getText(sf) === "dangerouslySetInnerHTML") hit("STD-006", f, line(), "unsafe HTML injection via dangerouslySetInnerHTML", "render as React elements or sanitise the input with an approved sanitiser");
      else if (n.kind === K.BinaryExpression && n.operatorToken.kind === K.EqualsToken && n.left.kind === K.PropertyAccessExpression && ["innerHTML", "outerHTML"].includes(n.left.name.text)) hit("STD-006", f, line(), `unsafe HTML injection via .${n.left.name.text} =`, "use textContent or render through the framework");
      ts.forEachChild(n, visit);
    };
    visit(sf);
    // formatting hygiene on exactly what Prettier would also reject
    const lines = f.text.split("\n");
    const trailing = lines.filter((l) => /[ \t]+$/.test(l)).length;
    if (trailing) hit("STD-010", f, lines.findIndex((l) => /[ \t]+$/.test(l)) + 1, `${trailing} line(s) with trailing whitespace`, "strip trailing whitespace", "error");
    if (f.raw.includes("\r\n") && /[^\r]\n/.test(f.raw)) hit("STD-011", f, 1, "mixed CRLF and LF line endings", "use one line ending per file", "error");
    if (f.text.length && !f.text.endsWith("\n")) hit("STD-012", f, lines.length, "missing final newline", "end the file with a newline", "error");
  }
  for (const fp of policy.forbiddenPatterns || []) {
    const rx = new RegExp(fp.regex, fp.flags || ""), only = fp.files ? new RegExp(fp.files) : null;
    for (const f of project.prod) {
      if (only && !only.test(f.rel)) continue;
      f.text.split("\n").forEach((line, i) => { if (rx.test(line)) hit(fp.id, f, i + 1, fp.message, fp.suggestion || "", fp.severity || "error"); });
    }
  }
  const measures = [...found.values()].map((x) => ({ ...x, key: `${x.rule}|${x.file}`, value: x.lines.length }));
  const errs = measures.filter((m) => m.sev === "error"), warns = measures.filter((m) => m.sev === "warn");
  const [worse, same] = diffAgainst(errs, baseline?.standards);
  const violations = worse.map((m) => V("standards", m.rule, "error", m.file, m.lines[m.lines.length - 1], `${m.msg}${m.lines.length > 1 ? ` (${m.lines.length} in this file, baseline ${m.was ?? 0}; lines ${m.lines.slice(0, 8).join(", ")})` : ""}`, m.sug, m.key, m.value));
  return {
    violations: sortV(violations), baselined: same.length,
    warnings: warns.map((m) => V("standards", m.rule, "warn", m.file, m.lines[0], `${m.msg} x${m.lines.length}`, m.sug, m.key, m.value)),
    snapshot: { standards: Object.fromEntries(errs.map((m) => [m.key, m.value])) },
    info: `${project.prod.length} production files scanned`,
  };
}

// ───────────────────────────── 3. architecture ─────────────────────────────
export function architecture(project, baseline) {
  const rules = expandRules(project.policy);
  const edges = buildGraph(project);
  const gEdges = project.policy.globals ? globalsOf(project).edges : [];
  const hits = violatingEdges([...edges, ...gEdges], rules);
  const known = new Set(baseline?.architecture?.violations || []);
  const fp = (h) => h.fp || `${h.rule.id}|${h.edge.from}|${h.edge.to}`;
  const violations = [], same = [];
  for (const h of hits) {
    if (known.has(fp(h))) { same.push(h); continue; }
    violations.push(V("architecture", h.rule.id, "error", h.edge.from, h.edge.line, `${h.rule.title}: imports "${h.edge.spec}" (${h.edge.to})`, h.rule.suggestion || "", fp(h), 1));
  }
  // ARCH-011: a relative import that points at nothing crashes at run time (or hides dead code)
  if (project.policy.architecture?.brokenImports !== false) {
    const asset = new RegExp("\\.(css|scss|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|mp3|mp4|wasm)$", "i");
    for (const e of edges) {
      if (!e.to.startsWith("unresolved:") || asset.test(e.spec)) continue;
      const key = `ARCH-011|${e.from}|${e.spec}`;
      hits.push({ rule: { id: "ARCH-011" }, edge: e, fp: key });
      if (known.has(key)) { same.push(e); continue; }
      violations.push(V("architecture", "ARCH-011", "error", e.from, e.line, `import "${e.spec}" does not resolve to any file`, "fix the path or delete the dead file", key, 1));
    }
  }
  const cycles = findCycles(edges);
  const baseCycles = (baseline?.architecture?.cycles || []).map((c) => new Set(c));
  for (const c of cycles) {
    if (baseCycles.some((b) => c.every((f) => b.has(f)))) { same.push({ cycle: c }); continue; }
    violations.push(V("architecture", "ARCH-002", "error", c[0], 1, `circular dependency between ${c.length} files: ${c.join(" -> ")}`, "break the cycle: move the shared part to a lower-level module", `ARCH-002|${c.join("|")}`, c.length));
  }
  return {
    violations: sortV(violations), warnings: [], baselined: same.length,
    snapshot: { architecture: { violations: hits.map(fp).sort(), cycles } },
    info: `${edges.length} imports${gEdges.length ? `, ${gEdges.length} cross-file global reads` : ""}, ${rules.length} rules, ${cycles.length} existing cycle(s)`,
  };
}

// ───────────────────────────── 4. repository policy ─────────────────────────────
const SUPPRESSION = /(eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error|istanbul ignore|c8 ignore)/;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

function testCounts(project) {
  const { ts } = project, K = ts.SyntaxKind;
  const out = {};
  for (const f of project.files.filter((x) => x.test)) {
    let tests = 0, skipped = 0, only = 0;
    const visit = (n) => {
      if (n.kind === K.CallExpression) {
        const c = n.expression;
        let head = "", prop = "";
        if (c.kind === K.Identifier) head = c.text;
        else if (c.kind === K.PropertyAccessExpression && c.expression.kind === K.Identifier) { head = c.expression.text; prop = c.name.text; }
        if ((head === "it" || head === "test") && (!prop || prop === "each")) tests++;
        else if (head === "it" || head === "test" || head === "describe") { if (prop === "skip") skipped++; else if (prop === "only") only++; }
        else if (["xit", "xtest", "xdescribe"].includes(head) && !prop) skipped++;
      }
      ts.forEachChild(n, visit);
    };
    visit(f.sf);
    out[f.rel] = { tests, skipped, only };
  }
  return out;
}

export function repoPolicy(project, baseline) {
  const { policy, root } = project;
  const violations = [], review = [];
  const push = (rule, file, line, message, suggestion, key, value = 1, bucket = violations, severity = "error") => bucket.push(V("repo-policy", rule, severity, file, line, message, suggestion, key, value));

  // REPO-001 every package has a lockfile that lists exactly the dependencies of its package.json (the CI overlay's additions are excluded)
  let overlayAdds = [];
  try { overlayAdds = JSON.parse(fs.readFileSync(path.join(root, ".ci", "toolkit.json"), "utf8")).packageJsonAdditions || []; } catch { /* not a CI workspace */ }
  const deps = {};
  for (const pkg of policy.packages || []) {
    const pj = path.join(root, pkg, "package.json"), lk = path.join(root, pkg, "package-lock.json");
    if (!fs.existsSync(pj)) continue;
    const j = JSON.parse(fs.readFileSync(pj, "utf8"));
    const names = [...Object.keys(j.dependencies || {}).map((n) => ["dependencies", n]), ...Object.keys(j.devDependencies || {}).map((n) => ["devDependencies", n])]
      .filter(([sec, n]) => !overlayAdds.includes(`${pkg}:${sec}.${n}`)).map(([, n]) => n).sort();
    deps[pkg] = names;
    if (!fs.existsSync(lk)) { push("REPO-001", `${pkg}/package.json`, 1, "no package-lock.json: installs are not reproducible", "run npm install and commit the lockfile", `REPO-001|${pkg}|missing`); continue; }
    const root0 = JSON.parse(fs.readFileSync(lk, "utf8")).packages?.[""] || {};
    const locked = new Set([...Object.keys(root0.dependencies || {}), ...Object.keys(root0.devDependencies || {})]);
    const missing = names.filter((n) => !locked.has(n));
    if (missing.length) push("REPO-001", `${pkg}/package.json`, 1, `package-lock.json does not list: ${missing.join(", ")}`, "run npm install and commit the updated lockfile", `REPO-001|${pkg}|${missing.join(",")}`);
  }

  // REPO-006 new dependencies are flagged for admin review (never blocking)
  for (const [pkg, names] of Object.entries(deps)) {
    const base = new Set(baseline?.repo?.dependencies?.[pkg] || []);
    const added = baseline?.repo ? names.filter((n) => !base.has(n)) : [];
    if (added.length) push("REPO-006", `${pkg}/package.json`, 1, `new dependenc${added.length > 1 ? "ies" : "y"} need admin review: ${added.join(", ")}`, "confirm the project has no existing utility for this; then re-baseline on main", `REPO-006|${pkg}|${added.join(",")}`, 1, review, "review");
  }

  // REPO-002 suppression comments may not grow (per file)
  const supp = {};
  for (const f of project.files) { const n = f.text.split("\n").filter((l) => SUPPRESSION.test(l) && /(\/\/|\/\*|\{\/\*)/.test(l)).length; if (n) supp[f.rel] = n; }
  for (const [file, n] of Object.entries(supp)) {
    const b = baseline?.repo?.suppressions?.[file] ?? 0;
    if (n > b) push("REPO-002", file, 1, `${n} lint/type suppression comment(s) (baseline ${b}): quality checks may not be disabled to make code pass`, "fix the underlying problem; if truly unavoidable ask an admin to approve and re-baseline", `REPO-002|${file}`, n);
  }

  // REPO-003/4/5 tests may not be removed, focused or skipped
  const tests = testCounts(project);
  const baseTests = baseline?.repo?.tests || {};
  for (const [file, b] of Object.entries(baseTests)) {
    const cur = tests[file];
    if (!cur) push("REPO-003", file, 1, `test file removed (it had ${b.tests} tests)`, "restore it; tests may not be deleted to make a build pass", `REPO-003|${file}|gone`);
    else if (cur.tests < b.tests) push("REPO-003", file, 1, `${b.tests - cur.tests} test(s) removed (${b.tests} -> ${cur.tests})`, "restore the tests; fix the code instead", `REPO-003|${file}`);
    if (cur && cur.skipped > (b.skipped || 0)) push("REPO-005", file, 1, `${cur.skipped - (b.skipped || 0)} test(s) newly skipped`, "fix or delete with admin approval; do not skip", `REPO-005|${file}`);
  }
  for (const [file, c] of Object.entries(tests)) if (c.only > 0) push("REPO-004", file, 1, `${c.only} focused test(s) (.only) would silently skip the rest of the suite`, "remove .only", `REPO-004|${file}`);

  // REPO-007 protected configuration may only change through an admin-reviewed re-baseline
  const prot = {};
  for (const p of policy.protectedFiles || []) {
    const abs = path.join(root, p);
    prot[p] = fs.existsSync(abs) ? sha(fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n")) : null;
    const b = baseline?.repo?.protected?.[p];
    if (baseline?.repo?.protected && b !== undefined && prot[p] !== b) push("REPO-007", p, 1, `protected configuration changed${prot[p] === null ? " (deleted)" : ""}`, "needs admin review: a change here can weaken type checking, routing or production settings", `REPO-007|${p}`);
  }

  // REPO-008 the documentation index lists every document and links only to documents that exist
  const docKeys = [];
  if (policy.docs) {
    const dir = path.join(root, policy.docs.dir), idxFile = path.join(root, policy.docs.index);
    if (fs.existsSync(dir) && fs.existsSync(idxFile)) {
      const idx = fs.readFileSync(idxFile, "utf8"), idxName = path.basename(policy.docs.index);
      const known = new Set(baseline?.repo?.docs || []);
      const add = (key, file, msg, sug) => { docKeys.push(key); if (baseline?.repo && !known.has(key)) push("REPO-008", file, 1, msg, sug, key); };
      for (const n of fs.readdirSync(dir).filter((x) => x.endsWith(".md") && x !== idxName)) if (!idx.includes(n)) add(`REPO-008|unlisted|${n}`, `${policy.docs.dir}/${n}`, `document is not listed in ${policy.docs.index}`, "add a row to the index: it is the first thing a teammate reads");
      for (const m of idx.matchAll(/\]\(\.?\/?([\w./-]+\.md)\)/g)) if (!fs.existsSync(path.join(dir, m[1]))) add(`REPO-008|dead|${m[1]}`, policy.docs.index, `the index links to a document that does not exist: ${m[1]}`, "remove the row or restore the document");
    }
  }

  return {
    violations: sortV(violations), warnings: sortV(review), baselined: 0,
    snapshot: { repo: { dependencies: deps, suppressions: supp, tests, protected: prot, docs: docKeys.sort() } },
    info: `${project.files.filter((f) => f.test).length} test files, ${Object.keys(supp).length} files with suppressions`,
  };
}

// ───────────────────────────── 5. global scope (no-build applications) ─────────────────────────────
export function globals(project, baseline) {
  if (!project.policy.globals) return skipped("no \"globals\" section in policy.json (this is not a no-build, shared-global-scope application)");
  const g = globalsOf(project);
  const found = [];
  const add = (rule, severity, file, line, message, suggestion, key) => found.push(V("globals", rule, severity, file, line, message, suggestion, key, 1));
  for (const [name, list] of g.decls) {
    const files = [...new Set(list.map((d) => d.file))].sort();
    if (files.length > 1) add("GLOB-001", "error", list.find((d) => d.file === files[1]).file, list.find((d) => d.file === files[1]).line, `top-level \"${name}\" is declared in ${files.length} files (${files.join(", ")}): they share one global scope and break each other`, "rename one (prefix helpers that belong to one screen, e.g. imp*, alloc*)", `GLOB-001|${name}|${files.join(",")}`);
  }
  const known = new Set(project.policy.globals.knownUndefined || []);
  for (const u of g.undeclared) if (!known.has(u.name)) add("GLOB-002", "error", u.file, u.line, `\"${u.name}\" is read but defined in no file: a ReferenceError at run time (a white page)`, "define it, load the file that defines it, or fix the name", `GLOB-002|${u.file}|${u.name}`);
  for (const m of g.moduleSyntax) add("GLOB-004", "error", m.file, m.line, "import/export syntax in a file loaded as a plain script: it will not run in the browser", "share through window.* and read it as a global", `GLOB-004|${m.file}`);
  for (const d of g.dead) add("GLOB-005", "error", d.file, 1, "source file that the page never loads (dead code or a missing <script> tag)", "add its <script> tag to the page, or delete the file", `GLOB-005|dead|${d.file}`);
  for (const d of g.missing) add("GLOB-005", "error", d.file, d.line, "the page loads a script that does not exist (404, the app will not start)", "fix the path or remove the tag", `GLOB-005|missing|${d.file}`);
  for (const l of g.lateUse) add("GLOB-006", "error", l.file, l.line, `\"${l.name}\" is used while this file loads, but it is defined in ${l.definedIn}, which the page loads LATER`, "reorder the <script> tags, or read it only inside a function that runs after load", `GLOB-006|${l.file}|${l.name}`);
  for (const c of g.cdn.filter((x) => x.kind === "unpinned")) add("GLOB-007", "error", project.policy.globals.html, c.line, `CDN script is not pinned to an exact version: ${c.src}`, "pin it (a floating version can change what every user runs)", `GLOB-007|${c.src}`);
  const knownKeys = new Set(baseline?.globals?.keys || []);
  const violations = found.filter((v) => !knownKeys.has(v.key));
  const warnings = g.cdn.filter((x) => x.kind === "no-integrity").map((c) => V("globals", "GLOB-008", "warn", project.policy.globals.html, c.line, `CDN script has no integrity (SRI) attribute: ${c.src}`, "add integrity= and crossorigin=", `GLOB-008|${c.src}`, 1));
  return { violations: sortV(violations), warnings, baselined: found.length - violations.length, snapshot: { globals: { keys: found.map((f) => f.key).sort() } }, info: `${g.files.length} script files, ${g.decls.size} top-level names, ${g.edges.length} cross-file reads` };
}

// ───────────────────────────── 6. database migrations (static) ─────────────────────────────
export function database(project, baseline) {
  const cfg = project.policy.database;
  if (!cfg) return skipped("no \"database\" section in policy.json");
  const a = analyzeMigrations(project.root, cfg);
  const violations = [], keys = [];
  const known = new Set(baseline?.database?.keys || []);
  for (const [table, file] of a.tables) {
    if (a.rls.has(table) || a.dropped.has(table)) continue;
    const key = `DB-001|${table}`; keys.push(key);
    if (!known.has(key)) violations.push(V("database", "DB-001", "error", file, 1, `table \"${table}\" is created but row-level security is never enabled on it: in a multi-tenant database every tenant could read every row`, `add: alter table ${table} enable row level security; and a policy that scopes rows to the tenant`, key, 1));
  }
  const MSG = { "DB-002": ["destructive statement (DROP TABLE / DROP COLUMN / TRUNCATE / DELETE without WHERE)", "needs admin approval and a backup plan; prefer a reversible change"], "DB-003": ["open policy USING (true) / WITH CHECK (true): every row is visible or writable", "scope the policy to the tenant or the owner"], "DB-004": ["SECURITY DEFINER function without a pinned search_path (privilege-escalation risk)", "add: set search_path = public"] };
  for (const [key, value] of Object.entries(a.counts)) {
    const [rule, file] = key.split("|");
    if (value > (baseline?.database?.counts?.[key] ?? 0)) violations.push(V("database", rule, "error", file, 1, `${value} × ${MSG[rule][0]} (baseline ${baseline?.database?.counts?.[key] ?? 0})`, MSG[rule][1], key, value));
  }
  return { violations: sortV(violations), warnings: [], baselined: keys.length + Object.keys(a.counts).length - violations.length, snapshot: { database: { keys: keys.sort(), counts: a.counts } }, info: `${a.files.length} migrations, ${a.tables.size} tables` };
}

export const CHECKS = { maintainability, standards, architecture, "repo-policy": repoPolicy, globals, database };
