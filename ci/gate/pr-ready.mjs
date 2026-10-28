#!/usr/bin/env node
// Developer-side pre-PR gate. Answers one question: "may I open the final PR for what is checked out?"
//   node ci/gate/pr-ready.mjs [--file .ci/attestation.json | --url <attestation url>]
// Exit 0 only if a Jenkins-signed attestation exists for EXACTLY the current tree (all required
// checks PASS, unexpired, uncommitted changes absent). Any code change after verification makes the
// attestation not match and this command fails. The authoritative enforcement is the required
// `unimisk/verified` check in branch protection; this is the early, local version of the same rule.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { currentFingerprint, evaluateAttestation } from "../lib/attestation.mjs";

export const PUBLIC_KEY_FILE = process.env.CI_ATTEST_PUBLIC_KEY_FILE || path.join(REPO_ROOT, "ci", "gate", "attest-public-key.pub");

export async function checkPrReady({ file, url, cwd = REPO_ROOT, publicKeyFile = PUBLIC_KEY_FILE, fetchImpl = fetch, now = Date.now() } = {}) {
  const fp = currentFingerprint(cwd);
  const reasons = [];
  if (!fp.clean) reasons.push(`working tree has uncommitted changes (${fp.dirty.length}): commit them, then re-verify`);
  if (!fs.existsSync(publicKeyFile)) return { ok: false, fp, reasons: [...reasons, "ci/gate/attest-public-key.pub is missing — the Jenkins signing key has not been provisioned yet (BLOCKED)"] };

  let att = null;
  try {
    if (url) { const r = await fetchImpl(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); att = await r.json(); }
    else {
      const f = file || path.join(cwd, ".ci", "attestation.json");
      if (!fs.existsSync(f)) throw new Error(`no attestation at ${f}`);
      att = JSON.parse(fs.readFileSync(f, "utf8"));
    }
  } catch (e) { reasons.push(`cannot load attestation: ${e.message}`); return { ok: false, fp, reasons }; }

  const ev = evaluateAttestation(att, { commit: fp.commit, tree: fp.tree, publicKeyPem: fs.readFileSync(publicKeyFile, "utf8"), required: REQUIRED_CHECKS, now });
  reasons.push(...ev.reasons);
  return { ok: reasons.length === 0, fp, reasons, att };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const val = (f) => (a.includes(f) ? a[a.indexOf(f) + 1] : undefined);
  const r = await checkPrReady({ file: val("--file"), url: val("--url") || process.env.CI_ATTESTATION_URL });
  if (r.ok) console.log(`✔ READY: ${r.fp.commit.slice(0, 12)} (tree ${r.fp.tree.slice(0, 12)}) is Jenkins-verified. You may submit the PR.`);
  else { console.error(`✘ NOT READY to submit a PR for ${r.fp.commit.slice(0, 12)}:`); for (const x of r.reasons) console.error(`   - ${x}`); }
  process.exit(r.ok ? 0 : 1);
}
