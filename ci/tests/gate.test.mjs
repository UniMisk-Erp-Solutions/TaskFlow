// Pre-PR gate: attestation signing/verification, tree binding, invalidation on change, forged
// attestations, stale results, dirty trees. Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAttestation, currentFingerprint, evaluateAttestation } from "../lib/attestation.mjs";
import { collectChecks } from "../gate/attest.mjs";
import { checkPrReady } from "../gate/pr-ready.mjs";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";

const pem = (kp) => ({
  privateKeyPem: kp.privateKey.export({ type: "pkcs8", format: "pem" }),
  publicKeyPem: kp.publicKey.export({ type: "spki", format: "pem" }),
});
const jenkins = pem(generateKeyPairSync("ed25519"));
const attacker = pem(generateKeyPairSync("ed25519"));
const allPass = REQUIRED_CHECKS.map((name) => ({ name, status: "PASS", durationMs: 1 }));
const base = { repo: "o/r", branch: "feature/TF-1a2b3c4d-x", commit: "c".repeat(40), tree: "t".repeat(40), required: REQUIRED_CHECKS };
const make = (over = {}) => createAttestation({ ...base, checks: allPass, privateKeyPem: jenkins.privateKeyPem, ...over });
const ev = (att, over = {}) => evaluateAttestation(att, { commit: base.commit, tree: base.tree, publicKeyPem: jenkins.publicKeyPem, required: REQUIRED_CHECKS, ...over });

test("a complete, untouched attestation is accepted", () => {
  assert.deepEqual(ev(make()), { ok: true, reasons: [] });
});

test("cannot attest while any required check is not PASS (FAIL / MISSING / STALE)", () => {
  for (const status of ["FAIL", "MISSING", "STALE"]) {
    const checks = allPass.map((c, i) => (i === 3 ? { ...c, status } : c));
    assert.throws(() => make({ checks }), /required checks not PASS/);
  }
});

test("any content change invalidates the attestation (different tree)", () => {
  const r = ev(make(), { tree: "d".repeat(40), commit: "e".repeat(40) });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /content changed/);
});

test("same tree under a new commit (amend/rebase, no code change) stays valid", () => {
  assert.equal(ev(make(), { commit: "f".repeat(40) }).ok, true);
  assert.equal(ev(make(), { commit: "f".repeat(40), allowTreeMatch: false }).ok, false);
});

test("an attestation signed by anyone but Jenkins is rejected", () => {
  const forged = make({ privateKeyPem: attacker.privateKeyPem });
  assert.match(ev(forged).reasons.join("\n"), /signature invalid/);
});

test("editing the payload after signing (e.g. flipping a check to PASS) is rejected", () => {
  const att = make();
  att.payload.checks[0].status = "PASS";
  att.payload.tree = "d".repeat(40);
  assert.equal(ev(att, { tree: "d".repeat(40) }).ok, false);
  const att2 = make();
  att2.payload.checks[0].durationMs = 99999;
  assert.match(ev(att2).reasons.join("\n"), /signature invalid/);
});

test("expired attestations are rejected", () => {
  const att = make({ now: Date.now() - 10 * 86_400_000 });
  assert.match(ev(att).reasons.join("\n"), /expired/);
});

test("missing / malformed attestations are rejected, not crashed on", () => {
  assert.equal(ev(null).ok, false);
  assert.equal(ev({ payload: {} }).ok, false);
  assert.equal(ev({ payload: make().payload, signature: "!!!notbase64" }).ok, false);
});

test("signing without a private key fails loudly (no silent default)", () => {
  assert.throws(() => make({ privateKeyPem: "" }), /CI_ATTEST_PRIVATE_KEY is not set/);
});

// ── stage results bound to the exact tree ─────────────────────────────────────

test("collectChecks marks results from different code STALE and absent ones MISSING", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-res-"));
  const fp = { commit: "a".repeat(40), tree: "b".repeat(40) };
  fs.writeFileSync(path.join(dir, "lint.json"), JSON.stringify({ status: "PASS", commit: fp.commit, tree: fp.tree, durationMs: 5 }));
  fs.writeFileSync(path.join(dir, "build.json"), JSON.stringify({ status: "PASS", commit: "x".repeat(40), tree: "y".repeat(40), durationMs: 5 }));
  const out = Object.fromEntries(collectChecks(fp, dir, ["lint", "build", "e2e"]).map((c) => [c.name, c.status]));
  assert.deepEqual(out, { lint: "PASS", build: "STALE", e2e: "MISSING" });
});

// ── end-to-end against a real temporary git repository ────────────────────────

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-gate-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  g("init", "-q"); g("config", "user.email", "t@example.test"); g("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "app.js"), "export const v = 1;\n");
  g("add", "."); g("commit", "-q", "-m", "init");
  const keyFile = path.join(dir, "key.pem");
  fs.writeFileSync(keyFile, jenkins.publicKeyPem);
  return { dir, g, keyFile };
}

test("pr-ready: READY for the attested tree, NOT READY after any code change or uncommitted edit", async () => {
  const { dir, g, keyFile } = repo();
  g("add", "key.pem"); g("commit", "-q", "-m", "key"); // key.pem tracked -> tree is clean
  const fp = currentFingerprint(dir);
  const att = createAttestation({ ...base, commit: fp.commit, tree: fp.tree, checks: allPass, privateKeyPem: jenkins.privateKeyPem });
  fs.mkdirSync(path.join(dir, ".ci"));
  fs.writeFileSync(path.join(dir, ".ci", "attestation.json"), JSON.stringify(att));
  fs.writeFileSync(path.join(dir, ".gitignore"), ".ci/\n"); g("add", ".gitignore"); g("commit", "-q", "-m", "ignore .ci");
  // .gitignore changed the tree => the attestation made one commit ago no longer matches.
  let r = await checkPrReady({ cwd: dir, publicKeyFile: keyFile });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /content changed/);

  // Re-attest the new tree: READY.
  const fp2 = currentFingerprint(dir);
  fs.writeFileSync(path.join(dir, ".ci", "attestation.json"), JSON.stringify(createAttestation({ ...base, commit: fp2.commit, tree: fp2.tree, checks: allPass, privateKeyPem: jenkins.privateKeyPem })));
  r = await checkPrReady({ cwd: dir, publicKeyFile: keyFile });
  assert.deepEqual(r.reasons, []);
  assert.equal(r.ok, true);

  // Uncommitted edit -> not ready, even though the committed tree is attested.
  fs.writeFileSync(path.join(dir, "app.js"), "export const v = 2;\n");
  r = await checkPrReady({ cwd: dir, publicKeyFile: keyFile });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /uncommitted changes/);

  // Commit the edit -> new tree -> attestation invalid until Jenkins verifies again.
  g("commit", "-qam", "change code");
  r = await checkPrReady({ cwd: dir, publicKeyFile: keyFile });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /content changed/);
});

test("pr-ready: missing public key or missing attestation fails closed", async () => {
  const { dir } = repo();
  let r = await checkPrReady({ cwd: dir, publicKeyFile: path.join(dir, "nope.pem") });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /not been provisioned/);
  const keyFile = path.join(dir, "k.pem"); fs.writeFileSync(keyFile, jenkins.publicKeyPem);
  r = await checkPrReady({ cwd: dir, publicKeyFile: keyFile });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join("\n"), /no attestation/);
});
