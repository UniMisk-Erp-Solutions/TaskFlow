#!/usr/bin/env node
// Pattern-based credential scan of every tracked file (named scan-credentials: the repo .gitignore excludes *secret* files). Complements Trivy's secret scanner and works
// without any external binary. Matches are NEVER printed — only file:line and the rule name — so a
// leaked value does not get copied into build logs.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./config.mjs";

export const RULES = [
  { name: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "openrouter-or-openai-key", re: /\bsk-(?:or-v1-)?[A-Za-z0-9]{32,}\b/ },
  { name: "supabase-service-role-jwt", re: /service_role[^\n]{0,40}eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/i },
  { name: "credential-in-url", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:(?![$<{])[^\s@/$]{6,}@(?!localhost|127\.0\.0\.1|example\.)[^\s/]+/i },
  { name: "assigned-secret-literal", re: /\b(?:password|passwd|secret|api[_-]?key|token)\b["']?\s*[:=]\s*["'](?!\s*["'])(?!your[-_ ]|change[-_ ]?me|fake|<|\$\{|process\.env|example|xxx|test|dummy|placeholder|ci-)[A-Za-z0-9+/=_-]{20,}["']/i },
];

const SKIP = /(^|\/)(package-lock\.json|bun\.lockb|.*\.(png|jpe?g|gif|ico|webp|pdf|woff2?|ttf|eot|mp4|zip|gz|jar|keystore|jks|traineddata))$/i;
const MAX_BYTES = 1_500_000;

export function scanText(text, rules = RULES) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.length > 4000) return; // minified bundles: Trivy covers them
    for (const r of rules) if (r.re.test(line)) hits.push({ line: i + 1, rule: r.name });
  });
  return hits;
}

export function scanRepo(root = REPO_ROOT) {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const findings = [];
  for (const rel of files) {
    if (SKIP.test(rel)) continue;
    const abs = path.join(root, rel);
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) continue; // binary
    for (const h of scanText(buf.toString("utf8"))) findings.push({ file: rel, ...h });
  }
  return { scanned: files.length, findings };
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { scanned, findings } = scanRepo();
  for (const f of findings) console.error(`✘ ${f.file}:${f.line}  [${f.rule}]`);
  console.log(`secret scan: ${scanned} tracked files, ${findings.length} finding(s)`);
  process.exit(findings.length ? 1 : 0);
}
