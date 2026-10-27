#!/usr/bin/env node
// Runs one pipeline stage and records PASS/FAIL to .ci/results/<stage>.json, bound to the exact commit
// and Git tree it ran against (the pre-PR gate only trusts results for the tree it is attesting).
//   node ci/pipeline/run-stage.mjs <stage>
// Exit code is non-zero when the stage fails, which fails the Jenkins stage.
import { spawnPortable } from "../lib/spawn.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, RESULTS_DIR, STAGES } from "./config.mjs";
import { currentFingerprint } from "../lib/attestation.mjs";

const TAIL_BYTES = 6000;

function runCommand({ cmd, args, env }) {
  return new Promise((resolve) => {
    const child = spawnPortable(cmd, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...(env || {}), CI: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let tail = "";
    const keep = (d) => { process.stdout.write(d); tail = (tail + d.toString()).slice(-TAIL_BYTES); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("error", (e) => resolve({ code: 127, tail: `${tail}\n${e.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, tail }));
  });
}

export async function runStage(name) {
  const stage = STAGES[name];
  if (!stage) throw new Error(`Unknown stage "${name}". Known: ${Object.keys(STAGES).join(", ")}`);
  const fp = currentFingerprint(REPO_ROOT);
  const started = Date.now();

  let status = "PASS";
  let tail = "";
  for (const c of stage.commands) {
    console.log(`\n▶ [${name}] ${c.cmd} ${c.args.join(" ")}`);
    const r = await runCommand(c);
    tail = r.tail;
    if (r.code !== 0) { status = "FAIL"; break; }
  }
  const result = { stage: name, status, durationMs: Date.now() - started, commit: fp.commit, tree: fp.tree, finishedAt: new Date().toISOString(), tail: status === "PASS" ? "" : tail };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, `${name}.json`), JSON.stringify(result, null, 2));
  console.log(`\n${status === "PASS" ? "✔" : "✘"} [${name}] ${status} in ${result.durationMs}ms`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await runStage(process.argv[2]);
  process.exit(result.status === "PASS" ? 0 : 1);
}
