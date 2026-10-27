#!/usr/bin/env node
// ADMIN, on the admin's own machine: sign the approval of one exact commit after reviewing the PR.
//   node ci/release/approve.mjs --commit <sha> --attestation <gate attestation json> --admin-key <private key pem> \
//        --jenkins-pub <ci/gate/attest-public-key.pub> --approved-by "Name" [--repo O/R] [--ttl-hours 24] [--out release-approval.json]
// Generate the admin key ONCE, on the admin's machine only:  openssl genpkey -algorithm ed25519 -out admin-release.pem
// and give the gate host only the public half:               openssl pkey -in admin-release.pem -pubout
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createApproval } from "./lib.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
  const need = (k) => { const v = opt(k); if (!v) { console.error(`✘ --${k} is required`); process.exit(2); } return v; };
  const commit = need("commit");
  const tree = execFileSync("git", ["rev-parse", `${commit}^{tree}`], { encoding: "utf8" }).trim();
  try {
    const approval = createApproval({
      repo: opt("repo", "UniMisk-Erp-Solutions/TaskFlow"), commit, tree, approvedBy: need("approved-by"),
      attestation: JSON.parse(fs.readFileSync(need("attestation"), "utf8")),
      adminPrivateKeyPem: fs.readFileSync(need("admin-key"), "utf8"),
      jenkinsPublicKeyPem: fs.readFileSync(need("jenkins-pub"), "utf8"),
      ttlMs: Number(opt("ttl-hours", 24)) * 3600_000,
    });
    const out = opt("out", "release-approval.json");
    fs.writeFileSync(out, JSON.stringify(approval, null, 2));
    console.log(`✔ approval for ${commit.slice(0, 12)} (tree ${tree.slice(0, 12)}) written to ${out}, valid until ${approval.payload.expiresAt}`);
  } catch (e) { console.error(`✘ ${e.message}`); process.exit(1); }
}
