#!/usr/bin/env node
// Trivy wrapper.   node ci/pipeline/run-trivy.mjs deps|secrets
//   deps    — HIGH/CRITICAL vulnerabilities in frontend/ and backend/ npm lockfiles
//   secrets — Trivy's secret scanner over the tracked tree
// Findings fail the stage. A missing Trivy binary ALSO fails it: an unrun scan must never look like
// a clean one. Accepted, reviewed exceptions go in .trivyignore with a justification comment.
//
// Frontend/backend ship no container image (Vercel serves the static frontend; the API is a Supabase
// edge function), so there is no image scan in this repository. The Jenkins image itself is scanned
// by ci/jenkins/scan-image.sh.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./config.mjs";

const mode = process.argv[2];
if (!["deps", "secrets"].includes(mode)) { console.error("usage: run-trivy.mjs deps|secrets"); process.exit(2); }

const bin = process.env.TRIVY_BIN || "trivy";
const probe = spawnSync(bin, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
if (probe.status !== 0) {
  console.error(`✘ Trivy not found (TRIVY_BIN=${process.env.TRIVY_BIN || "unset"}). Install it on the Jenkins image; refusing to report a scan that never ran.`);
  process.exit(3);
}

const common = ["--exit-code", "1", "--no-progress", "--ignorefile", process.env.TRIVY_IGNOREFILE || path.join(REPO_ROOT, ".trivyignore")];
if (process.env.TRIVY_CACHE_DIR) common.push("--cache-dir", process.env.TRIVY_CACHE_DIR);
const run = (args) => spawnSync(bin, args, { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32" }).status ?? 1;

let status = 0;
if (mode === "deps") {
  for (const dir of ["frontend", "backend"]) {
    const lock = path.join(REPO_ROOT, dir, "package-lock.json");
    if (!fs.existsSync(lock)) { console.error(`✘ missing ${dir}/package-lock.json`); status = 1; continue; }
    console.log(`\n── trivy fs ${dir}/package-lock.json (HIGH,CRITICAL)`);
    status ||= run(["fs", "--scanners", "vuln", "--severity", "HIGH,CRITICAL", "--ignore-unfixed", ...common, lock]);
  }
} else {
  console.log("\n── trivy secret scan (tracked tree)");
  status = run(["fs", "--scanners", "secret", ...common, "--skip-dirs", "node_modules,dist,.git,.ci,mobile", "."]);
}
process.exit(status ? 1 : 0);
