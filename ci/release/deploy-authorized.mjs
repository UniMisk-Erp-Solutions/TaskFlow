#!/usr/bin/env node
// GATE HOST: the ONLY supported way to put a TaskFlow frontend into production. Run it in a clean checkout of the
// approved commit. Default is a dry run; it deploys only with RELEASE_DEPLOY_ENABLED=yes AND a valid chain of
// Jenkins attestation + admin approval for exactly this commit and tree.
//   node ci/release/deploy-authorized.mjs --repo-dir <checkout> --approval <json> --attestation <json> \
//        --jenkins-pub <pem> --admin-pub <pem>
// Public keys must be files that live on this host (not taken from the repository).
// NOTE: the real deployment step (Vercel CLI) is NOT enabled or tested yet: see docs/ci-cd-pipeline.md, "Vercel audit".
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { authorizeAndDeploy } from "./lib.mjs";

const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();

/** Facts about the checkout, computed from Git: the candidate can never claim to be something it is not. */
export function candidateFromCheckout(dir) {
  const dirty = git(dir, "status", "--porcelain", "--untracked-files=normal");
  if (dirty) throw new Error("checkout is not clean; refusing");
  return { commit: git(dir, "rev-parse", "HEAD"), tree: git(dir, "rev-parse", "HEAD^{tree}") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const opt = (k) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : undefined);
  const need = (k) => { const v = opt(k); if (!v) { console.error(`✘ --${k} is required`); process.exit(2); } return v; };
  const dir = need("repo-dir");
  const enabled = process.env.RELEASE_DEPLOY_ENABLED === "yes";
  let result;
  try {
    result = await authorizeAndDeploy({
      approval: JSON.parse(fs.readFileSync(need("approval"), "utf8")),
      attestation: JSON.parse(fs.readFileSync(need("attestation"), "utf8")),
      candidate: candidateFromCheckout(dir),
      jenkinsPublicKeyPem: fs.readFileSync(need("jenkins-pub"), "utf8"),
      adminPublicKeyPem: fs.readFileSync(need("admin-pub"), "utf8"),
      enabled, log: (m) => console.log(m),
      deploy: async ({ commit }) => {
        const tokenFile = process.env.VERCEL_TOKEN_FILE;
        if (!tokenFile || !fs.existsSync(tokenFile)) throw new Error("VERCEL_TOKEN_FILE is not set: refusing to deploy");
        console.log(`deploying exactly ${commit.slice(0, 12)} to production`);
        const r = spawnSync("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes", "--token", fs.readFileSync(tokenFile, "utf8").trim()], { cwd: path.join(dir, "frontend"), stdio: "inherit", shell: process.platform === "win32" });
        if (r.status !== 0) throw new Error("vercel deploy failed");
      },
    });
  } catch (e) { console.error(`✘ ${e.message}`); process.exit(1); }
  process.exit(result.authorized && (result.deployed || !enabled) ? 0 : 1);
}
