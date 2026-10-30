// "No build step, one shared global scope" applications (script tags, Babel in the browser, no import/export).
// Files share things by declaring top-level names or assigning to `window`, and read each other's names as bare globals.
// A mistake there is a RUNTIME error (a white page), never a build error, so it is checked statically here:
//   GLOB-001 the same top-level name declared in two files (they silently break each other)
//   GLOB-002 a name that is read but defined nowhere (ReferenceError at run time)
//   GLOB-004 import/export syntax in a file that is loaded as a plain script (it would not run)
//   GLOB-005 a source file the page never loads, or a script tag whose file does not exist
//   GLOB-006 a name used while the file is LOADING that is only defined by a file loaded later
//   GLOB-007 a CDN script that is not pinned to an exact version
// The same analysis yields the "file A reads names defined in file B" graph used by the architecture rules.
import fs from "node:fs";
import path from "node:path";
import { lineOf } from "./project.mjs";

const AMBIENT = "/__opc_ambient__.d.ts";
const BUILTIN = new Set(["undefined", "NaN", "Infinity", "arguments"]);
const posix = (p) => p.split(path.sep).join("/");

function bindingNames(ts, name, out) {
  if (ts.isIdentifier(name)) out.push(name);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(ts, el.name, out);
}

/** Top-level declarations and `window.X =` / `Object.assign(window, {...})` assignments of one file. */
function collect(ts, f) {
  const decls = [], assigns = [];
  const isWindow = (e) => ts.isIdentifier(e) && (e.text === "window" || e.text === "globalThis");
  for (const st of f.sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { const ids = []; bindingNames(ts, d.name, ids); ids.forEach((i) => decls.push({ name: i.text, line: lineOf(f.sf, i) })); }
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) decls.push({ name: st.name.text, line: lineOf(f.sf, st.name) });
  }
  const visit = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const l = n.left;
      if (ts.isPropertyAccessExpression(l) && isWindow(l.expression)) assigns.push({ name: l.name.text, line: lineOf(f.sf, n) });
      else if (ts.isElementAccessExpression(l) && isWindow(l.expression) && ts.isStringLiteral(l.argumentExpression)) assigns.push({ name: l.argumentExpression.text, line: lineOf(f.sf, n) });
    } else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "assign" && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "Object" && n.arguments.length >= 2 && isWindow(n.arguments[0])) {
      for (const a of n.arguments.slice(1)) if (ts.isObjectLiteralExpression(a)) for (const p of a.properties) if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) assigns.push({ name: p.name.text, line: lineOf(f.sf, p) });
    }
    ts.forEachChild(n, visit);
  };
  visit(f.sf);
  return { decls, assigns };
}




/** Only real definitions count. TypeScript also records expando assignments (`window.X = ...`) as declarations of `window`; those never define a name. */
function isDefinition(ts, d) {
  return ts.isVariableDeclaration(d) || ts.isParameter(d) || ts.isBindingElement(d) || ts.isFunctionDeclaration(d) || ts.isFunctionExpression(d)
    || ts.isClassDeclaration(d) || ts.isClassExpression(d) || ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d) || ts.isEnumDeclaration(d) || ts.isModuleDeclaration(d)
    || ts.isImportSpecifier(d) || ts.isImportClause(d) || ts.isNamespaceImport(d) || ts.isCatchClause(d);
}

function isReference(ts, n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
  if (ts.isQualifiedName(p) && p.right === n) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === n) return false;
  if (ts.isBindingElement(p) && p.propertyName === n) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p) || ts.isBindingElement(p)) && p.name === n) return false;
  if (ts.isJsxAttribute(p) && p.name === n) return false;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n && /^[a-z]/.test(n.text)) return false; // <div>, an intrinsic element
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false;
  if (ts.isTypeOfExpression(p)) return false; // `typeof X !== 'undefined'` is the safe way to probe a global
  if (ts.isShorthandPropertyAssignment(p) && p.name !== n) return false;
  return true;
}

const insideFunction = (ts, n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p) || ts.isClassStaticBlockDeclaration?.(p)) return true; return false; };

/** Script tags of the page, in load order: [{ src, cdn }]. */
export function pageScripts(htmlText) {
  const out = [];
  const re = /<script\b([^>]*)>/gi; let m;
  while ((m = re.exec(htmlText))) { const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[1]); if (src) out.push({ src: src[1], tag: m[1], line: htmlText.slice(0, m.index).split("\n").length }); }
  return out;
}

export function analyzeGlobals(project) {
  const { ts, root, policy } = project;
  const cfg = policy.globals;
  const scope = (cfg.scope || []).map((s) => (s.endsWith("/") ? s : s + "/"));
  const inScope = (rel) => scope.some((s) => rel.startsWith(s));
  const files = project.prod.filter((f) => inScope(f.rel) && (f.ext === ".js" || f.ext === ".jsx"));
  const result = { files, decls: new Map(), windowNames: new Map(), edges: [], undeclared: [], moduleSyntax: [], dead: [], missing: [], order: new Map(), lateUse: [], cdn: [], scripts: [] };

  // 1) what each file declares / assigns to window
  const perFile = new Map();
  for (const f of files) {
    const c = collect(ts, f); perFile.set(f.rel, c);
    for (const d of c.decls) (result.decls.get(d.name) || result.decls.set(d.name, []).get(d.name)).push({ file: f.rel, line: d.line });
    for (const a of c.assigns) (result.windowNames.get(a.name) || result.windowNames.set(a.name, []).get(a.name)).push({ file: f.rel, line: a.line });
    f.sf.statements.forEach((st) => { if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isExportAssignment(st) || (ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))) result.moduleSyntax.push({ file: f.rel, line: lineOf(f.sf, st) }); });
  }

  // 2) the page: load order, dead files, missing files, CDN pins
  if (cfg.html) {
    const htmlFile = path.resolve(root, cfg.html);
    const text = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, "utf8") : "";
    const base = posix(path.dirname(cfg.html)).replace(/^\.$/, "");
    result.scripts = pageScripts(text);
    let i = 0;
    for (const s of result.scripts) {
      if (/^https?:\/\//.test(s.src)) {
        if (/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/.test(s.src) && !/[@/]v?\d+\.\d+\.\d+/.test(s.src)) result.cdn.push({ src: s.src, line: s.line, kind: "unpinned" });
        else if (!/\bintegrity\s*=/.test(s.tag) && /(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/.test(s.src)) result.cdn.push({ src: s.src, line: s.line, kind: "no-integrity" });
        continue;
      }
      const rel = posix(path.normalize(path.posix.join(base, s.src.split("?")[0])));
      result.order.set(rel, i++);
      if (inScope(rel) && !fs.existsSync(path.resolve(root, rel))) result.missing.push({ file: rel, line: s.line });
    }
    for (const f of files) if (!result.order.has(f.rel)) result.dead.push({ file: f.rel });
  }

  // 3) resolve every name read by a file to the file that defines it, using the TypeScript binder (handles every local scope)
  const ambientNames = new Set(cfg.ambient || []);
  const declared = new Set(result.decls.keys());
  const ambientText = [...ambientNames, ...[...result.windowNames.keys()].filter((n) => !declared.has(n) && !ambientNames.has(n))].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n)).map((n) => `declare var ${n}: any;`).join("\n") + "\n";
  const options = { allowJs: true, checkJs: false, noEmit: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], types: [], noResolve: true, skipLibCheck: true, moduleDetection: ts.ModuleDetectionKind.Legacy };
  const host = ts.createCompilerHost(options, true);
  const getSource = host.getSourceFile.bind(host), fileExists = host.fileExists.bind(host), readFile = host.readFile.bind(host);
  host.getSourceFile = (fn, lang, ...rest) => (fn === AMBIENT ? ts.createSourceFile(fn, ambientText, lang) : getSource(fn, lang, ...rest));
  host.fileExists = (fn) => fn === AMBIENT || fileExists(fn);
  host.readFile = (fn) => (fn === AMBIENT ? ambientText : readFile(fn));
  const abs = (rel) => path.resolve(root, rel).split(path.sep).join("/");
  const program = ts.createProgram({ rootNames: [AMBIENT, ...files.map((f) => abs(f.rel))], options, host });
  const checker = program.getTypeChecker();
  const relOf = new Map(files.map((f) => [abs(f.rel).toLowerCase(), f.rel]));

  for (const f of files) {
    const sf = program.getSourceFile(abs(f.rel));
    if (!sf) continue;
    const seen = new Set();
    const visit = (n) => {
      if (ts.isIdentifier(n) && isReference(ts, n)) {
        // in `{ a }` the identifier is both the key and a read of the variable `a`: ask for the variable's symbol
        const sym = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
        // TypeScript also records expando assignments (`window.X = ...`) as extra "declarations" of `window`; those never define a name
        const decls = (sym?.declarations || []).filter((d) => isDefinition(ts, d));
        if (!sym || decls.length === 0) {
          if (BUILTIN.has(n.text)) { ts.forEachChild(n, visit); return; }
          if (!ts.isShorthandPropertyAssignment(n.parent) || n.parent.name === n) { const k = `${n.text}`; if (!seen.has("u" + k)) { seen.add("u" + k); result.undeclared.push({ file: f.rel, line: lineOf(f.sf, n), name: n.text }); } }
        } else {
          const targets = new Set();
          for (const d of decls) {
            const df = d.getSourceFile().fileName;
            if (df === AMBIENT) { for (const w of result.windowNames.get(n.text) || []) targets.add(w.file); continue; }
            const rel = relOf.get(df.toLowerCase());
            if (rel) targets.add(rel);
          }
          const topLevelRead = !insideFunction(ts, n);
          for (const t of targets) {
            if (t === f.rel) continue;
            const key = `${t}|${n.text}`;
            if (!seen.has(key)) { seen.add(key); result.edges.push({ from: f.rel, to: t, line: lineOf(f.sf, n), spec: n.text }); }
            if (topLevelRead && result.order.size && (result.order.get(t) ?? Infinity) > (result.order.get(f.rel) ?? -1)) result.lateUse.push({ file: f.rel, line: lineOf(f.sf, n), name: n.text, definedIn: t });
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return result;
}
