// Independent production release authorization: what must be true before anything may be deployed, and every way a
// release can be refused. No network, no Vercel. Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAttestation } from "../lib/attestation.mjs";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { attestationDigest, authorizeAndDeploy, createApproval, verifyRelease } from "../release/lib.mjs";
import { candidateFromCheckout } from "../release/deploy-authorized.mjs";

const pair = () => { const k = generateKeyPairSync("ed25519"); return { priv: k.privateKey.export({ type: "pkcs8", format: "pem" }), pub: k.publicKey.export({ type: "spki", format: "pem" }) }; };
const jenkins = pair(), admin = pair(), attacker = pair();
const commit = "a".repeat(40), tree = "b".repeat(40);
const checks = REQUIRED_CHECKS.map((name) => ({ name, status: "PASS" }));
const att = (over = {}) => createAttestation({ repo: "o/r", branch: "main", commit, tree, checks, required: REQUIRED_CHECKS, privateKeyPem: jenkins.priv, ...over });
// one shared attestation: an approval is bound to the exact attestation (by digest), so separate instances differ
const ATT = att();
const approve = (over = {}) => createApproval({ repo: "o/r", commit, tree, attestation: ATT, approvedBy: "Admin A", adminPrivateKeyPem: admin.priv, jenkinsPublicKeyPem: jenkins.pub, ...over });
const verify = (over = {}) => verifyRelease({ approval: approve(), attestation: ATT, candidate: { commit, tree }, jenkinsPublicKeyPem: jenkins.pub, adminPublicKeyPem: admin.pub, ...over });
const reasons = (over) => verify(over).reasons.join(" | ");

test("a release with a valid Jenkins attestation AND a valid admin approval for the exact commit + tree is authorized", () => {
  const attestation = att();
  const approval = createApproval({ repo: "o/r", commit, tree, attestation, approvedBy: "Admin A", adminPrivateKeyPem: admin.priv, jenkinsPublicKeyPem: jenkins.pub });
  assert.deepEqual(verifyRelease({ approval, attestation, candidate: { commit, tree }, jenkinsPublicKeyPem: jenkins.pub, adminPublicKeyPem: admin.pub }), { ok: true, reasons: [] });
});

test("BLOCKED: no admin approval at all (a merge to main alone authorizes nothing)", () => {
  assert.match(reasons({ approval: null }), /no admin approval/);
  assert.match(reasons({ approval: {} }), /no admin approval/);
});

test("BLOCKED: no Jenkins attestation, or one signed by anyone but Jenkins", () => {
  assert.match(reasons({ attestation: null }), /Jenkins attestation: attestation is missing/);
  assert.match(reasons({ attestation: att({ privateKeyPem: attacker.priv }) }), /signature invalid/);
});

test("BLOCKED: approval not signed by the admin key (e.g. forged by a repository pusher)", () => {
  const forged = createApproval({ repo: "o/r", commit, tree, attestation: att(), approvedBy: "Admin A", adminPrivateKeyPem: attacker.priv, jenkinsPublicKeyPem: jenkins.pub });
  assert.match(reasons({ approval: forged }), /admin approval: signature invalid/);
});

test("BLOCKED: an approval edited after signing", () => {
  const a = approve(); a.payload.approvedBy = "Somebody Else";
  assert.match(reasons({ approval: a }), /signature invalid/);
});

test("BLOCKED: approval or attestation for a DIFFERENT commit or different content (changed code after approval)", () => {
  assert.match(reasons({ candidate: { commit: "c".repeat(40), tree } }), /not cccccccccccc|different commit|commit mismatch/i);
  assert.match(reasons({ candidate: { commit, tree: "d".repeat(40) } }), /tree differs|content changed/);
});

test("BLOCKED: expired approval (24 h) and expired Jenkins attestation (7 days)", () => {
  assert.match(reasons({ now: Date.now() + 25 * 3600_000, attestation: att({ ttlMs: 30 * 24 * 3600_000 }), approval: createApproval({ repo: "o/r", commit, tree, attestation: att({ ttlMs: 30 * 24 * 3600_000 }), approvedBy: "A", adminPrivateKeyPem: admin.priv, jenkinsPublicKeyPem: jenkins.pub }) }), /approval expired/);
  assert.match(reasons({ now: Date.now() + 8 * 24 * 3600_000, approval: approve({ ttlMs: 30 * 24 * 3600_000 }) }), /attestation: attestation expired/);
});

test("BLOCKED: approval granted for a different attestation (swapped evidence)", () => {
  const other = att({ now: Date.now() - 1000 });
  assert.notEqual(attestationDigest(other), attestationDigest(ATT));
  assert.match(reasons({ approval: approve({ attestation: other }), attestation: ATT }), /different Jenkins attestation/);
});

test("BLOCKED: failed or missing checks can never be approved (the admin tool refuses before signing)", () => {
  const bad = JSON.parse(JSON.stringify(att())); bad.payload.checks[0].status = "FAIL";
  assert.throws(() => approve({ attestation: bad }), /cannot approve/);
  assert.throws(() => approve({ approvedBy: " " }), /approvedBy/);
  assert.throws(() => createAttestation({ repo: "o/r", branch: "x", commit, tree, checks: checks.slice(1), required: REQUIRED_CHECKS, privateKeyPem: jenkins.priv }), /not PASS/);
});

test("BLOCKED: keys not configured on the gate host, or the same key used for both roles", () => {
  assert.match(reasons({ jenkinsPublicKeyPem: "" }), /both public keys/);
  assert.match(reasons({ adminPublicKeyPem: jenkins.pub }), /must be different keys/);
});

test("deployment: default is a DRY RUN, and an unauthorized release NEVER calls deploy even when enabled", async () => {
  const calls = [];
  const deploy = async (c) => calls.push(c);
  const good = { approval: approve(), attestation: ATT, candidate: { commit, tree }, jenkinsPublicKeyPem: jenkins.pub, adminPublicKeyPem: admin.pub, deploy };
  assert.deepEqual(await authorizeAndDeploy({ ...good }), { deployed: false, authorized: true, reasons: ["deployment disabled"] });
  for (const bad of [{ approval: null }, { attestation: null }, { candidate: { commit, tree: "d".repeat(40) } }, { adminPublicKeyPem: attacker.pub }]) {
    const r = await authorizeAndDeploy({ ...good, enabled: true, ...bad });
    assert.deepEqual([r.deployed, r.authorized], [false, false]);
  }
  assert.equal(calls.length, 0, "no unauthorized path reached deploy");
  const r = await authorizeAndDeploy({ ...good, enabled: true });
  assert.equal(r.deployed, true);
  assert.deepEqual(calls, [{ commit, tree, approvedBy: "Admin A" }]);
});

test("the candidate is computed from the checkout, and a dirty checkout is refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@example.test"); g("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "a.txt"), "1"); g("add", "-A"); g("commit", "-qm", "one");
  const c = candidateFromCheckout(dir);
  assert.deepEqual(c, { commit: g("rev-parse", "HEAD"), tree: g("rev-parse", "HEAD^{tree}") });
  fs.writeFileSync(path.join(dir, "a.txt"), "tampered");
  assert.throws(() => candidateFromCheckout(dir), /not clean/);
});
