// Per-function and per-file maintainability measurements (function length, cyclomatic and cognitive complexity,
// nesting depth, parameter count) plus token-window duplication. All numbers come from the real syntax tree.
import { lineOf } from "./project.mjs";

/** Lines that hold code: not blank and not comment-only. Index = 1-based line number. */
export function codeLines(text) {
  const lines = text.split("\n");
  const code = new Array(lines.length + 1).fill(false);
  let inBlock = false;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (inBlock) { if (t.includes("*/")) inBlock = false; return; }
    if (!t || t.startsWith("//")) return;
    if (t.startsWith("/*")) { if (!t.includes("*/")) inBlock = true; return; }
    code[i + 1] = true;
  });
  return code;
}

export function fileLoc(text) { return codeLines(text).filter(Boolean).length; }

function isFunctionLike(ts, n) {
  const K = ts.SyntaxKind;
  return n.kind === K.FunctionDeclaration || n.kind === K.FunctionExpression || n.kind === K.ArrowFunction || n.kind === K.MethodDeclaration
    || n.kind === K.Constructor || n.kind === K.GetAccessor || n.kind === K.SetAccessor;
}

function nameOf(ts, n, sf) {
  const K = ts.SyntaxKind;
  if (n.kind === K.Constructor) return "constructor";
  if (n.name && n.name.getText) return n.name.getText(sf);
  const p = n.parent;
  if (p && p.kind === K.VariableDeclaration && p.name) return p.name.getText(sf);
  if (p && (p.kind === K.PropertyAssignment || p.kind === K.PropertyDeclaration) && p.name) return p.name.getText(sf);
  if (p && p.kind === K.BinaryExpression && p.operatorToken.kind === K.EqualsToken) return p.left.getText(sf).slice(0, 60);
  if (p && p.kind === K.ExportAssignment) return "default";
  return `anonymous@${lineOf(sf, n)}`;
}

const BRANCH_LOGIC = (ts) => new Set([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]);

function cyclomatic(ts, fn) {
  const K = ts.SyntaxKind, logic = BRANCH_LOGIC(ts);
  let c = 1;
  const visit = (n) => {
    if (n !== fn && isFunctionLike(ts, n)) return;
    switch (n.kind) {
      case K.IfStatement: case K.ForStatement: case K.ForInStatement: case K.ForOfStatement: case K.WhileStatement:
      case K.DoStatement: case K.CaseClause: case K.CatchClause: case K.ConditionalExpression: c++; break;
      case K.BinaryExpression: if (logic.has(n.operatorToken.kind)) c++; break;
      default:
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  return c;
}

/** Cognitive complexity in the spirit of the SonarSource definition (structures add 1 + current nesting; else-if and
 *  boolean-operator runs add 1; nested functions raise the nesting level). Documented as an approximation. */
function cognitive(ts, fn) {
  const K = ts.SyntaxKind, logic = BRANCH_LOGIC(ts);
  let total = 0;
  const visit = (n, nesting) => {
    switch (n.kind) {
      case K.IfStatement: {
        const isElseIf = n.parent.kind === K.IfStatement && n.parent.elseStatement === n;
        total += isElseIf ? 1 : 1 + nesting;
        visit(n.expression, nesting);
        visit(n.thenStatement, nesting + 1);
        if (n.elseStatement) {
          if (n.elseStatement.kind === K.IfStatement) visit(n.elseStatement, nesting);
          else { total += 1; visit(n.elseStatement, nesting + 1); }
        }
        return;
      }
      case K.ForStatement: case K.ForInStatement: case K.ForOfStatement: case K.WhileStatement: case K.DoStatement:
      case K.CatchClause: case K.SwitchStatement: case K.ConditionalExpression:
        total += 1 + nesting;
        ts.forEachChild(n, (c) => visit(c, nesting + 1));
        return;
      case K.BinaryExpression:
        if (logic.has(n.operatorToken.kind)) {
          const sameAsParent = n.parent.kind === K.BinaryExpression && n.parent.operatorToken.kind === n.operatorToken.kind;
          if (!sameAsParent) total += 1;
        }
        break;
      default:
        if (n !== fn && isFunctionLike(ts, n)) { ts.forEachChild(n, (c) => visit(c, nesting + 1)); return; }
    }
    ts.forEachChild(n, (c) => visit(c, nesting));
  };
  ts.forEachChild(fn, (c) => visit(c, 0));
  return total;
}

function maxNesting(ts, fn) {
  const K = ts.SyntaxKind;
  let max = 0;
  const visit = (n, d) => {
    if (n !== fn && isFunctionLike(ts, n)) return;
    let nd = d;
    switch (n.kind) {
      case K.IfStatement: if (!(n.parent.kind === K.IfStatement && n.parent.elseStatement === n)) nd = d + 1; break;
      case K.ForStatement: case K.ForInStatement: case K.ForOfStatement: case K.WhileStatement: case K.DoStatement:
      case K.SwitchStatement: case K.TryStatement: case K.CatchClause: nd = d + 1; break;
      default:
    }
    if (nd > max) max = nd;
    ts.forEachChild(n, (c) => visit(c, nd));
  };
  ts.forEachChild(fn, (c) => visit(c, 0));
  return max;
}

/** Every function of a file with its measurements. `symbol` is stable across line moves (qualified name + index). */
export function measureFunctions(ts, file) {
  const { sf, text } = file;
  const code = codeLines(text);
  const out = [];
  const seen = new Map();
  const visit = (n, chain) => {
    let next = chain;
    if (isFunctionLike(ts, n) && n.body) {
      const nm = nameOf(ts, n, sf);
      const qual = [...chain, nm].join(">");
      const idx = (seen.get(qual) || 0) + 1; seen.set(qual, idx);
      const start = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
      let len = 0; for (let l = start; l <= end; l++) if (code[l]) len++;
      out.push({
        symbol: idx > 1 ? `${qual}#${idx}` : qual, name: nm, line: start, length: len,
        cyclomatic: cyclomatic(ts, n), cognitive: cognitive(ts, n), nesting: maxNesting(ts, n), params: n.parameters.length,
      });
      next = [...chain, nm];
    }
    ts.forEachChild(n, (c) => visit(c, next));
  };
  visit(sf, []);
  return out;
}

/** Duplicated share of production tokens: windows of `window` consecutive tokens (identifiers and strings compared by text) that occur more than once. */
export function measureDuplication(ts, files, windowSize = 50) {
  const K = ts.SyntaxKind;
  const tokenKinds = (sf) => {
    const kinds = [];
    const walkTokens = (n) => {
      const kids = n.getChildren(sf);
      if (!kids.length) { if (n.kind !== K.EndOfFileToken && n.kind !== K.JsxText) kinds.push(n.kind === K.Identifier || n.kind === K.StringLiteral || n.kind === K.NoSubstitutionTemplateLiteral ? `${n.kind}:${n.text}` : n.kind); return; }
      kids.forEach(walkTokens);
    };
    walkTokens(sf);
    return kinds;
  };
  const seqs = files.map((f) => ({ rel: f.rel, kinds: tokenKinds(f.sf) }));
  const where = new Map();
  for (const s of seqs) {
    for (let i = 0; i + windowSize <= s.kinds.length; i++) {
      const key = s.kinds.slice(i, i + windowSize).join(",");
      const list = where.get(key); if (list) list.push([s.rel, i]); else where.set(key, [[s.rel, i]]);
    }
  }
  const covered = new Map(seqs.map((s) => [s.rel, new Uint8Array(s.kinds.length)]));
  const spans = new Map();
  for (const list of where.values()) {
    if (list.length < 2) continue;
    // overlapping windows in the same file are one repeated run, not two copies
    const distinct = list.filter(([rel, i], n) => !list.slice(0, n).some(([r2, j]) => r2 === rel && Math.abs(i - j) < windowSize));
    if (distinct.length < 2) continue;
    for (const [rel, i] of distinct) { const c = covered.get(rel); for (let k = i; k < i + windowSize; k++) c[k] = 1; }
    spans.set(distinct[0].join(":"), distinct.map(([rel]) => rel));
  }
  let total = 0, dup = 0; const perFile = {};
  for (const s of seqs) { const c = covered.get(s.rel); const d = c.reduce((a, b) => a + b, 0); total += s.kinds.length; dup += d; if (d) perFile[s.rel] = d; }
  return { totalTokens: total, duplicatedTokens: dup, percent: total ? Math.round((dup / total) * 10000) / 100 : 0, perFile };
}
