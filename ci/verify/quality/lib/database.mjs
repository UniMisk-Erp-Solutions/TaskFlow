// Static checks of SQL migrations (a disposable-database test cannot replace them, but these catch the commonest
// multi-tenant mistakes before anything runs):
//   DB-001 a table created in the public schema that never gets row-level security enabled
//   DB-002 destructive statements: DROP TABLE / DROP COLUMN / TRUNCATE / DELETE without WHERE
//   DB-003 an open policy: USING (true) or WITH CHECK (true)
//   DB-004 a SECURITY DEFINER function without a pinned search_path
// Like every check, only NEW or WORSENED findings fail; existing migrations are recorded in the baseline.
import fs from "node:fs";
import path from "node:path";

const strip = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
const ident = (s) => s.replace(/"/g, "").toLowerCase();

export function analyzeMigrations(root, cfg) {
  const dir = path.resolve(root, cfg.migrations);
  const out = { files: [], tables: new Map(), rls: new Set(), dropped: new Set(), counts: {} };
  if (!fs.existsSync(dir)) return out;
  const names = fs.readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
  const exempt = new Set((cfg.rlsExempt || []).map((s) => s.toLowerCase()));
  for (const n of names) {
    const rel = `${cfg.migrations.replace(/\/$/, "")}/${n}`;
    const text = strip(fs.readFileSync(path.join(dir, n), "utf8"));
    out.files.push(rel);
    const hit = (rule, count) => { if (count) out.counts[`${rule}|${rel}`] = count; };
    for (const m of text.matchAll(/create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(public)\.)?("?[A-Za-z_][\w]*"?)\s*(?:\(|as\b)/gi)) {
      const schemaOk = m[1] ? true : !/create\s+table\s+(?:if\s+not\s+exists\s+)?\w+\./i.test(m[0]);
      if (schemaOk && !exempt.has(ident(m[2]))) out.tables.set(ident(m[2]), out.tables.get(ident(m[2])) || rel);
    }
    for (const m of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?("?[A-Za-z_][\w]*"?)\s+enable\s+row\s+level\s+security/gi)) out.rls.add(ident(m[1]));
    // RLS enabled in a loop: execute format('alter table public.%I enable row level security', t) over the table names of an array[...] literal
    if (/execute\s+format\s*\([^;]*enable\s+row\s+level\s+security/i.test(text)) for (const arr of text.matchAll(/array\s*\[([^\]]*)\]/gi)) for (const nm of arr[1].matchAll(/'([A-Za-z_]\w*)'/g)) out.rls.add(nm[1].toLowerCase());
    for (const m of text.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?("?[A-Za-z_][\w]*"?)/gi)) out.dropped.add(ident(m[1]));
    hit("DB-002", (text.match(/\bdrop\s+table\b/gi) || []).length + (text.match(/\bdrop\s+column\b/gi) || []).length + (text.match(/\btruncate\b/gi) || []).length
      + [...text.matchAll(/\bdelete\s+from\s+[^;]*;/gi)].filter((m) => !/\bwhere\b/i.test(m[0])).length);
    hit("DB-003", (text.match(/\b(using|with\s+check)\s*\(\s*true\s*\)/gi) || []).length);
    let unsafe = 0;
    for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?function\b[\s\S]*?(?=\bas\s+\$|\bas\s+')/gi)) if (/security\s+definer/i.test(m[0]) && !/set\s+search_path/i.test(m[0])) unsafe++;
    hit("DB-004", unsafe);
  }
  return out;
}
