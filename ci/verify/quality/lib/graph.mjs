// Import graph of the production code: who imports whom, circular dependencies, and the project's forbidden-import rules.
import path from "node:path";
import { lineOf, matchesAny } from "./project.mjs";

const EXT_TRY = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"];

/** Import specifiers of one file: static imports, re-exports, require(), dynamic import(). */
export function importsOf(ts, file) {
  const K = ts.SyntaxKind, out = [];
  const visit = (n) => {
    if ((n.kind === K.ImportDeclaration || n.kind === K.ExportDeclaration) && n.moduleSpecifier && n.moduleSpecifier.text !== undefined) {
      out.push({ spec: n.moduleSpecifier.text, line: lineOf(file.sf, n) });
    } else if (n.kind === K.CallExpression && n.arguments.length === 1 && n.arguments[0].kind === K.StringLiteral) {
      const c = n.expression;
      if ((c.kind === K.Identifier && c.text === "require") || c.kind === K.ImportKeyword) out.push({ spec: n.arguments[0].text, line: lineOf(file.sf, n) });
    }
    ts.forEachChild(n, visit);
  };
  visit(file.sf);
  return out;
}

export function buildGraph(project) {
  const { ts, files, policy, byRel } = project;
  const aliases = policy.aliases || [];
  const known = new Set(files.map((f) => f.rel));
  const resolveFile = (base) => {
    if (known.has(base)) return base;
    for (const e of EXT_TRY) if (known.has(base + e)) return base + e;
    for (const e of EXT_TRY) if (known.has(`${base}/index${e}`)) return `${base}/index${e}`;
    return null;
  };
  const edges = [];
  for (const f of project.prod) {
    for (const imp of importsOf(ts, f)) {
      let target = null;
      if (imp.spec.startsWith(".")) {
        const joined = path.posix.normalize(path.posix.join(path.posix.dirname(f.rel), imp.spec));
        target = resolveFile(joined) || `unresolved:${joined}`;
      } else {
        const al = aliases.find((a) => imp.spec.startsWith(a.prefix));
        if (al) { const joined = path.posix.normalize(al.to + imp.spec.slice(al.prefix.length)); target = resolveFile(joined) || `unresolved:${joined}`; }
        else target = `pkg:${imp.spec}`;
      }
      if (target && !byRel.get(target)?.test) edges.push({ from: f.rel, to: target, line: imp.line, spec: imp.spec });
    }
  }
  return edges;
}

/** Strongly connected components with more than one file (or a file importing itself). */
export function findCycles(edges) {
  const adj = new Map();
  for (const e of edges) { if (e.to.startsWith("pkg:") || e.to.startsWith("unresolved:")) continue; (adj.get(e.from) || adj.set(e.from, []).get(e.from)).push(e.to); }
  let index = 0; const stack = [], on = new Set(), idx = new Map(), low = new Map(), out = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
    for (const w of adj.get(v) || []) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = []; let w;
      do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1 || (adj.get(v) || []).includes(v)) out.push(comp.sort());
    }
  };
  for (const v of adj.keys()) if (!idx.has(v)) strong(v);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Expands the policy's module declarations into plain forbidden-import rules. */
export function expandRules(policy) {
  const rules = [...(policy.architecture?.rules || [])];
  for (const m of policy.architecture?.modules || []) {
    const inside = `^${m.root.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c)}/`;
    const publicRx = (m.public || []).map((p) => `${m.root}/${p}`.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c)).join("|");
    rules.push({
      id: m.id || `MODULE-${m.name}`, title: `module "${m.name}" may only be used through its public interface (${(m.public || []).join(", ") || "none declared"})`,
      from: `^(?!${inside.slice(1)})`, to: `${inside}(?!(${publicRx || "$^"})$)`, suggestion: `import from ${m.root}/${(m.public || ["index.js"])[0]} instead of its internals`,
    });
  }
  return rules;
}

export function violatingEdges(edges, rules) {
  const out = [];
  for (const r of rules) {
    const nameRx = r.names ? new RegExp(r.names) : null;
    const from = new RegExp(r.from), to = new RegExp(r.to), exFrom = (r.exceptFrom || []).map((s) => new RegExp(s)), exTo = (r.exceptTo || []).map((s) => new RegExp(s));
    for (const e of edges) {
      if (e.to.startsWith("unresolved:")) continue;
      if (nameRx && !nameRx.test(e.spec)) continue; // a rule may be about specific NAMES read across files (no-build apps have no imports)
      if (from.test(e.from) && to.test(e.to) && !matchesAny(exFrom, e.from) && !matchesAny(exTo, e.to)) out.push({ rule: r, edge: e });
    }
  }
  return out;
}
