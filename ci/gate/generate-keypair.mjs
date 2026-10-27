#!/usr/bin/env node
// One-time, run ON THE JENKINS HOST (never on a laptop, never in CI logs):
//   node ci/gate/generate-keypair.mjs <private-key-output-path>
// Writes the Ed25519 PRIVATE key to the given path (mode 0600) — store it as the Jenkins secret-file
// credential `taskflow-attest-private-key` and delete the file. Prints the PUBLIC key, which is
// committed as ci/gate/attest-public-key.pub so anyone can verify (but nobody can forge) attestations.
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";

const out = process.argv[2];
if (!out) { console.error("usage: generate-keypair.mjs <private-key-output-path>"); process.exit(2); }
if (fs.existsSync(out)) { console.error(`refusing to overwrite ${out}`); process.exit(1); }
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
fs.writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
console.log(publicKey.export({ type: "spki", format: "pem" }));
console.error(`private key written to ${out} (0600). Store it in Jenkins credentials, then delete the file.`);
