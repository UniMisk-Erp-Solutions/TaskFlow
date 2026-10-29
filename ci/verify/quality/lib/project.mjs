// Loads a project's source files and parses them with the project's own TypeScript compiler (no new dependency:
// every UniMisk app already has `typescript`). Parsing works for .js/.jsx/.mjs/.cjs/.ts/.tsx alike.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const SKIP_DIRS = new Set(["node_modules", ".git", ".ci", "dist", "build", "coverage", ".next", "playwright-report", "test-results"]);
export const posix = (p) => p.split(path.sep).join("/");

export function loadTypescript(root, hints = ["."]) {
  for (const h of hints) {
    try { return createRequire(path.join(path.resolve(root, h), "package.json"))("typescript"); } catch { /* try the next location */ }
  }
  throw new Error(`typescript was not found under: ${hints.join(", ")} (the Install stage must run first)`);
}

const rx = (list) => (list || []).map((s) => new RegExp(s));
export const matchesAny = (regexes, s) => regexes.some((r) => r.test(s));

function walk(abs, rel, out) {
  let st;
  try { st = fs.statSync(abs); } catch { return; }
  if (st.isFile()) { out.push(rel); return; }
  if (!st.isDirectory()) return;
  for (const name of fs.readdirSync(abs)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(path.join(abs, name), rel ? `${rel}/${name}` : name, out);
  }
}

export function loadProject(root, policy) {
  const ts = loadTypescript(root, policy.typescriptFrom);
  const exts = new Set(policy.extensions || [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
  const exclude = rx(policy.exclude);
  const testRx = rx(policy.testPattern);
  const rels = [];
  for (const r of policy.sourceRoots) walk(path.resolve(root, r), posix(r), rels);
  const kindFor = (ext) => (ext === ".ts" ? ts.ScriptKind.TS : ext === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);
  const files = [];
  for (const rel of [...new Set(rels)].sort()) {
    const ext = path.extname(rel);
    if (!exts.has(ext) || matchesAny(exclude, rel) || rel.endsWith(".d.ts")) continue;
    const raw = fs.readFileSync(path.resolve(root, rel), "utf8");
    const text = raw.replace(/\r\n/g, "\n");
    files.push({ rel, ext, raw, text, test: matchesAny(testRx, rel), sf: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kindFor(ext)) });
  }
  return { ts, root, policy, files, prod: files.filter((f) => !f.test), byRel: new Map(files.map((f) => [f.rel, f])) };
}

export const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
