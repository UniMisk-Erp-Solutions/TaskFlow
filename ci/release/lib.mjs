// Independent PRODUCTION RELEASE AUTHORIZATION. GitHub Free cannot enforce branch protection on private repositories, so
// "merged into main" proves nothing by itself: anyone with write access can push to main. A production release is
// therefore authorized by TWO signatures that no pusher can produce, checked on a host the pushers do not control:
//   1. the Jenkins gate's Ed25519 attestation: this exact tree passed every required check
//   2. an ADMIN's Ed25519 approval of that exact commit and tree (their private key never leaves the admin's machine)
// The public keys used for checking come from the gate host, NOT from the repository (a pusher could change those).
import { createHash } from "node:crypto";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { canonicalize, evaluateAttestation, sign, verifySignature } from "../lib/attestation.mjs";

export const APPROVAL_VERSION = 1;
export const DEFAULT_APPROVAL_TTL_MS = 24 * 3600_000;

export const attestationDigest = (att) => createHash("sha256").update(canonicalize(att)).digest("hex");

/** Admin side: produce the signed approval. Refuses unless the Jenkins attestation really covers commit + tree. */
export function createApproval({ repo, commit, tree, attestation, approvedBy, adminPrivateKeyPem, jenkinsPublicKeyPem, now = Date.now(), ttlMs = DEFAULT_APPROVAL_TTL_MS }) {
  if (!approvedBy || !String(approvedBy).trim()) throw new Error("approvedBy (the admin's name) is required");
  const ev = evaluateAttestation(attestation, { commit, tree, publicKeyPem: jenkinsPublicKeyPem, required: REQUIRED_CHECKS, now, allowTreeMatch: false });
  if (!ev.ok) throw new Error(`cannot approve: Jenkins attestation does not cover this commit: ${ev.reasons.join("; ")}`);
  const payload = { v: APPROVAL_VERSION, repo, commit, tree, approvedBy: String(approvedBy).trim(), attestationDigest: attestationDigest(attestation), issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString() };
  return { payload, signature: sign(payload, adminPrivateKeyPem) };
}

/** Gate side: everything that must hold before production may be touched. Fails closed on any missing piece. */
export function verifyRelease({ approval, attestation, candidate, jenkinsPublicKeyPem, adminPublicKeyPem, now = Date.now() }) {
  const reasons = [];
  if (!jenkinsPublicKeyPem || !adminPublicKeyPem) return { ok: false, reasons: ["both public keys must be configured on the gate host"] };
  if (jenkinsPublicKeyPem.trim() === adminPublicKeyPem.trim()) return { ok: false, reasons: ["the admin key and the Jenkins key must be different keys"] };
  if (!candidate?.commit || !candidate?.tree) return { ok: false, reasons: ["candidate commit/tree unknown"] };

  const att = evaluateAttestation(attestation, { commit: candidate.commit, tree: candidate.tree, publicKeyPem: jenkinsPublicKeyPem, required: REQUIRED_CHECKS, now, allowTreeMatch: false });
  if (!att.ok) reasons.push(...att.reasons.map((r) => `Jenkins attestation: ${r}`));

  if (!approval?.payload || typeof approval.signature !== "string") reasons.push("no admin approval");
  else {
    const p = approval.payload;
    let sigOk = false;
    try { sigOk = verifySignature(p, approval.signature, adminPublicKeyPem); } catch { sigOk = false; }
    if (!sigOk) reasons.push("admin approval: signature invalid (not signed by the admin key)");
    if (p.v !== APPROVAL_VERSION) reasons.push(`admin approval: unsupported version ${p.v}`);
    if (p.commit !== candidate.commit) reasons.push(`admin approval is for commit ${String(p.commit).slice(0, 12)}, not ${candidate.commit.slice(0, 12)}`);
    if (p.tree !== candidate.tree) reasons.push("admin approval is for different content (tree differs)");
    if (!(Date.parse(p.expiresAt) > now)) reasons.push("admin approval expired");
    if (!p.approvedBy) reasons.push("admin approval has no approver name");
    if (attestation && p.attestationDigest !== attestationDigest(attestation)) reasons.push("admin approval was given for a different Jenkins attestation");
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Deploys ONLY if verifyRelease passes AND deployment is explicitly enabled. Default is a dry run. `deploy` receives the
 * exact approved commit; nothing here chooses a branch, so a push to any branch (including main) cannot redirect it.
 */
export async function authorizeAndDeploy({ approval, attestation, candidate, jenkinsPublicKeyPem, adminPublicKeyPem, enabled = false, deploy, now = Date.now(), log = () => {} }) {
  const v = verifyRelease({ approval, attestation, candidate, jenkinsPublicKeyPem, adminPublicKeyPem, now });
  if (!v.ok) { log(`BLOCKED: ${v.reasons.join(" | ")}`); return { deployed: false, authorized: false, reasons: v.reasons }; }
  if (!enabled) { log("authorized, but production deployment is DISABLED (dry run)"); return { deployed: false, authorized: true, reasons: ["deployment disabled"] }; }
  await deploy({ commit: candidate.commit, tree: candidate.tree, approvedBy: approval.payload.approvedBy });
  return { deployed: true, authorized: true, reasons: [] };
}
