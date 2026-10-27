// Signed "verification attestation": proof that an exact Git tree passed every required check.
//
// The attestation is bound to the commit AND to the Git tree hash (the content hash of the whole
// checked-in tree). Any code change produces a different tree, so an old attestation can never vouch
// for new code.
//
// Signatures are Ed25519. Only the Jenkins host holds the PRIVATE key (ci/gate/generate-keypair.mjs);
// the PUBLIC key is committed (ci/gate/attest-public-key.pem), so developers, Jenkins and the API can
// all verify an attestation but none of them can forge one without Jenkins' key.
//
// Pure Node (no dependencies) so it runs identically in Jenkins, locally and in tests.
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from "node:crypto";
import { execFileSync } from "node:child_process";

export const ATTESTATION_VERSION = 1;
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Deterministic JSON: object keys sorted recursively so the signature is stable. */
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sign(payload, privateKeyPem) {
  if (!privateKeyPem) throw new Error("CI_ATTEST_PRIVATE_KEY is not set; refusing to sign an attestation.");
  return edSign(null, Buffer.from(canonicalize(payload)), createPrivateKey(privateKeyPem)).toString("base64");
}

export function verifySignature(payload, signature, publicKeyPem) {
  if (!publicKeyPem) throw new Error("attestation public key is not configured");
  try {
    return edVerify(null, Buffer.from(canonicalize(payload)), createPublicKey(publicKeyPem), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/** Builds and signs an attestation. Throws unless EVERY required check is PASS. */
export function createAttestation({ repo, branch, commit, tree, checks, required, privateKeyPem, buildUrl = null, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) {
  const byName = new Map(checks.map((c) => [c.name, c]));
  const bad = required.filter((n) => byName.get(n)?.status !== "PASS");
  if (bad.length) throw new Error(`Cannot attest: required checks not PASS: ${bad.join(", ")}`);
  const payload = {
    v: ATTESTATION_VERSION,
    repo, branch, commit, tree,
    required: [...required].sort(),
    checks: checks.map((c) => ({ name: c.name, status: c.status, durationMs: c.durationMs ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
    buildUrl,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  return { payload, signature: sign(payload, privateKeyPem) };
}

/**
 * Decides whether an attestation still vouches for the code at `current`.
 * `allowTreeMatch` lets an amended message / rebase with an IDENTICAL tree keep its attestation;
 * any difference in content (tree) always invalidates it.
 */
export function evaluateAttestation(att, { commit, tree, publicKeyPem, required, now = Date.now(), allowTreeMatch = true }) {
  const reasons = [];
  if (!att || typeof att !== "object" || !att.payload || typeof att.signature !== "string") {
    return { ok: false, reasons: ["attestation is missing or malformed"] };
  }
  const p = att.payload;
  let validSig;
  try { validSig = verifySignature(p, att.signature, publicKeyPem); } catch (e) { return { ok: false, reasons: [e.message] }; }
  if (!validSig) reasons.push("signature invalid (forged or edited attestation)");
  if (p.v !== ATTESTATION_VERSION) reasons.push(`unsupported attestation version ${p.v}`);
  if (p.tree !== tree) reasons.push(`content changed: attested tree ${String(p.tree).slice(0, 12)} != current ${String(tree).slice(0, 12)}`);
  if (p.commit !== commit && !(allowTreeMatch && p.tree === tree)) reasons.push(`commit mismatch: attested ${String(p.commit).slice(0, 12)} != ${String(commit).slice(0, 12)}`);
  if (Date.parse(p.expiresAt) <= now) reasons.push("attestation expired");
  const names = new Map((p.checks || []).map((c) => [c.name, c.status]));
  for (const r of required) if (names.get(r) !== "PASS") reasons.push(`required check "${r}" is ${names.get(r) ?? "missing"}`);
  return { ok: reasons.length === 0, reasons };
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Commit + tree of HEAD, plus whether the working tree is exactly HEAD (no edits, no stray files). */
export function currentFingerprint(cwd = process.cwd()) {
  const commit = git(["rev-parse", "HEAD"], cwd);
  const tree = git(["rev-parse", "HEAD^{tree}"], cwd);
  const dirty = git(["status", "--porcelain", "--untracked-files=normal"], cwd)
    .split("\n").filter(Boolean);
  let branch = "";
  try { branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd); } catch { /* detached */ }
  return { commit, tree, branch, clean: dirty.length === 0, dirty };
}
