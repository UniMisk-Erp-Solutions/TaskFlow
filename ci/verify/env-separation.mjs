#!/usr/bin/env node
// Verifies Preview / CI builds are separated from Production.
//
//   node ci/verify/env-separation.mjs --dist frontend/dist       build output must not reference production
//   node ci/verify/env-separation.mjs --repo                     tracked config must not hard-code production
//   node ci/verify/env-separation.mjs --vercel-env env.json      audit an export of the Vercel project's env vars
//
// Vercel export format (what `vercel env ls` / the dashboard gives you, values optional):
//   [{ "key": "VITE_API_URL", "target": ["production"], "value": "https://…" }, …]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRODUCTION_HOSTS, REPO_ROOT } from "../pipeline/config.mjs";

const SEPARATED_KEYS = ["VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

export function scanForProductionHosts(text, hosts = PRODUCTION_HOSTS) {
  const lower = text.toLowerCase();
  return hosts.filter((h) => lower.includes(h));
}

export function checkDist(dir) {
  const problems = [];
  if (!fs.existsSync(dir)) return [`dist directory not found: ${dir}`];
  let scanned = 0;
  for (const f of walk(dir)) {
    if (!/\.(js|mjs|css|html|json|map|webmanifest|txt)$/i.test(f)) continue;
    scanned++;
    for (const h of scanForProductionHosts(fs.readFileSync(f, "utf8"))) problems.push(`${path.relative(dir, f)} references production host ${h}`);
  }
  const apiUrl = process.env.VITE_API_URL || "";
  if (apiUrl && scanForProductionHosts(apiUrl).length) problems.push("VITE_API_URL for this build points at production");
  if (scanned === 0) problems.push("dist contains no scannable files");
  return problems;
}

export function checkRepo(root = REPO_ROOT) {
  const files = execFileSync("git", ["ls-files", "-z", "frontend/.env.example", "frontend/vercel.json", "frontend/vite.config.js", "frontend/index.html", "render.yaml", "ci"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean)
    .filter((f) => !f.endsWith("ci/pipeline/config.mjs") && !f.includes("ci/tests/") && !f.endsWith(".md"));
  const problems = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    for (const h of scanForProductionHosts(fs.readFileSync(abs, "utf8"))) problems.push(`${rel} hard-codes production host ${h}`);
  }
  return problems;
}

export function checkVercelEnv(entries) {
  const problems = [];
  for (const key of SEPARATED_KEYS) {
    const rows = entries.filter((e) => e.key === key);
    if (!rows.length) { problems.push(`${key} is not defined in any Vercel environment`); continue; }
    for (const r of rows) {
      const t = new Set(r.target || []);
      if (t.has("production") && (t.has("preview") || t.has("development"))) problems.push(`${key} is shared between production and preview/development; use separate values`);
      if ((t.has("preview") || t.has("development")) && r.value && scanForProductionHosts(String(r.value)).length) problems.push(`${key} (preview/development) points at a production host`);
    }
    if (!rows.some((r) => (r.target || []).includes("preview"))) problems.push(`${key} has no Preview-specific value (previews would fall back to production or break)`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const val = (flag) => a[a.indexOf(flag) + 1];
  let problems = [];
  let what = [];
  if (a.includes("--dist")) { problems.push(...checkDist(path.resolve(REPO_ROOT, val("--dist")))); what.push("dist"); }
  if (a.includes("--repo") || !a.length) { problems.push(...checkRepo()); what.push("repo"); }
  if (a.includes("--vercel-env")) { problems.push(...checkVercelEnv(JSON.parse(fs.readFileSync(val("--vercel-env"), "utf8")))); what.push("vercel-env"); }
  for (const p of problems) console.error(`✘ ${p}`);
  console.log(`env-separation (${what.join(", ")}): ${problems.length ? `${problems.length} problem(s)` : "OK — no production references"}`);
  process.exit(problems.length ? 1 : 0);
}
