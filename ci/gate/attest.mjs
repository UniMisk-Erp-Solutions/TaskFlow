#!/usr/bin/env node
// Jenkins-only: turns the per-stage results of THIS exact commit into a signed attestation, then
// publishes the `unimisk/verified` check run on GitHub (as the Jenkins GitHub App).
//   node ci/gate/attest.mjs
// Env: CI_ATTEST_PRIVATE_KEY (PEM, from Jenkins credentials), BUILD_URL, GITHUB_APP_* (check publishing)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { GITHUB_CHECK_NAME, REPO_ROOT, REQUIRED_CHECKS, RESULTS_DIR } from "../pipeline/config.mjs";
import { createAttestation, currentFingerprint } from "../lib/attestation.mjs";
import { publishCheck } from "../lib/github-check.mjs";

/** Reads .ci/results/*.json and keeps only results produced for exactly this commit + tree. */
export function collectChecks(fp, resultsDir = RESULTS_DIR, required = REQUIRED_CHECKS) {
  return required.map((name) => {
    const f = path.join(resultsDir, `${name}.json`);
    if (!fs.existsSync(f)) return { name, status: "MISSING" };
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    if (r.tree !== fp.tree || r.commit !== fp.commit) return { name, status: "STALE" }; // ran against different code
    return { name, status: r.status, durationMs: r.durationMs };
  });
}

/** CI_ATTEST_TTL_SECONDS shortens the attestation lifetime (test only); unset = the 7-day default. */
export function ttlFromEnv(env) {
  if (!env.CI_ATTEST_TTL_SECONDS) return undefined;
  const sec = Number(env.CI_ATTEST_TTL_SECONDS);
  if (!Number.isInteger(sec) || sec < 30 || sec > 604800) throw new Error("CI_ATTEST_TTL_SECONDS must be an integer between 30 and 604800");
  return sec * 1000;
}

export async function attest({ cwd = REPO_ROOT, env = process.env } = {}) {
  const fp = currentFingerprint(cwd);
  const repo = env.CI_REPO || "UniMisk-Erp-Solutions/TaskFlow";
  const branch = env.BRANCH_NAME || fp.branch;
  const checks = collectChecks(fp);
  const failing = checks.filter((c) => c.status !== "PASS");
  if (!fp.clean) failing.push({ name: "clean-worktree", status: `DIRTY (${fp.dirty.length} files)` });

  if (failing.length) {
    const summary = `Not verified: ${failing.map((c) => `${c.name}=${c.status}`).join(", ")}`;
    const pub = await publishCheck({ repo, sha: fp.commit, name: GITHUB_CHECK_NAME, conclusion: "failure", title: "Not verified", summary, detailsUrl: env.BUILD_URL, env }).catch((e) => ({ ok: false, reason: e.message }));
    if (!pub.ok) console.warn(`[ci] GitHub check NOT published: ${pub.reason}`);
    console.error(`✘ ${summary}`);
    return { ok: false, failing };
  }

  const att = createAttestation({ repo, branch, commit: fp.commit, tree: fp.tree, checks, required: REQUIRED_CHECKS, privateKeyPem: env.CI_ATTEST_PRIVATE_KEY, buildUrl: env.BUILD_URL || null, ttlMs: ttlFromEnv(env) });
  fs.mkdirSync(path.join(cwd, ".ci"), { recursive: true });
  fs.writeFileSync(path.join(cwd, ".ci", "attestation.json"), JSON.stringify(att, null, 2));
  const summary = `All ${REQUIRED_CHECKS.length} required checks passed for tree ${fp.tree.slice(0, 12)}.`;
  const pub = await publishCheck({ repo, sha: fp.commit, name: GITHUB_CHECK_NAME, conclusion: "success", title: "Verified", summary, detailsUrl: env.BUILD_URL, env }).catch((e) => ({ ok: false, reason: e.message }));
  if (!pub.ok) console.warn(`[ci] GitHub check NOT published: ${pub.reason}`);
  console.log(`✔ attested ${fp.commit.slice(0, 12)} (tree ${fp.tree.slice(0, 12)})`);
  return { ok: true, att };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = await attest();
  process.exit(r.ok ? 0 : 1);
}
