// The gate: watches Jenkins builds, verifies each one independently, signs the attestation and publishes the commit
// status. It runs in its own container with the only copy of the signing key and the GitHub token; the build agent that
// executes branch code can reach neither.
import fs from "node:fs";
import path from "node:path";
import { evaluateBuild, signAttestation } from "./evaluate.mjs";
import { publishStatus } from "../lib/github-status.mjs";

export function createPublisher({ mode, repo, token, recordFile, fetchImpl = fetch }) {
  return async function publish({ sha, state, description }) {
    if (mode === "record") {
      // Test / dry-run mode: GitHub is never contacted. Clearly separate from a live integration.
      fs.mkdirSync(path.dirname(recordFile), { recursive: true });
      fs.appendFileSync(recordFile, JSON.stringify({ at: new Date().toISOString(), repo, sha, state, description }) + "\n");
      return { ok: true, recorded: true };
    }
    return publishStatus({ repo, sha, state, description, token, fetchImpl });
  };
}

export function createGate({ cfg, jenkins, git, state, publish, required, pin, privateKeyPem, attestDir, log = console.log, now = Date.now }) {
  const published = () => state.data.statuses;

  // Returns "published", "same" (that fact is already shown for this SHA: never publish it twice) or "failed".
  async function publishOnce(sha, st, description, extra = {}) {
    const cur = published()[sha];
    if (cur && cur.state === st && (st === "success" || cur.description === description)) return "same";
    try { await publish({ sha, state: st, description }); } catch (e) { log(`[gate] status publish failed for ${sha.slice(0, 7)}: ${e.message}`); return "failed"; }
    published()[sha] = { state: st, description, at: now(), ...extra };
    state.save();
    return "published";
  }

  async function processBuild(b, mirrorReady) {
    const key = `${b.job}#${b.number}`;
    if (!mirrorReady.done) { await git.refresh().catch((e) => log(`[gate] mirror refresh failed: ${e.message}`)); mirrorReady.done = true; }
    const gi = await git.inspect(b.sha);
    const results = {};
    for (const name of required) results[name] = await jenkins.artifactJson(b.path, `.ci/results/${name}.json`);
    const aborted = b.result !== "SUCCESS" && Object.values(results).every((r) => !r);
    let outcome;
    if (aborted) outcome = { verdict: "error", reasons: [`build ${b.result || "unknown"} before any stage result was produced`] };
    else outcome = evaluateBuild({ sha: b.sha, git: gi, results, required, pin });
    if (outcome.verdict === "passed" && b.result !== "SUCCESS") outcome = { verdict: "failed", reasons: [`Jenkins result ${b.result}`] };

    const prev = published()[b.sha];
    if (prev && prev.state === "success" && prev.build > b.number && prev.job === b.job) { state.data.builds[key] = { sha: b.sha, verdict: "superseded" }; return true; }

    if (outcome.verdict === "passed") {
      const att = signAttestation({ repo: cfg.repo, branch: b.job, sha: b.sha, tree: gi.tree, checks: outcome.checks, required, privateKeyPem, buildUrl: null, now: now() });
      fs.mkdirSync(attestDir, { recursive: true });
      fs.writeFileSync(path.join(attestDir, `${b.sha}.json`), JSON.stringify(att, null, 2));
      var shown = await publishOnce(b.sha, "success", `All ${required.length} required checks passed (build #${b.number})`, { job: b.job, build: b.number });
    } else {
      const st = outcome.verdict === "error" ? "error" : "failure";
      var shown = await publishOnce(b.sha, st, outcome.reasons.join("; "), { job: b.job, build: b.number });
    }
    if (shown === "failed") return false; // GitHub unreachable: leave the build unprocessed so the next tick retries
    state.data.builds[key] = { sha: b.sha, verdict: outcome.verdict, at: now() };
    state.save();
    return true;
  }

  return {
    /** One pass over Jenkins: show "pending" for running builds, verify + publish finished ones exactly once. */
    async tick() {
      const builds = await jenkins.listBuilds();
      const mirrorReady = { done: false };
      let handled = 0;
      for (const b of builds.sort((x, y) => x.timestamp - y.timestamp)) {
        if (!b.sha) continue;
        const key = `${b.job}#${b.number}`;
        if (b.building) {
          const cur = published()[b.sha];
          if (!cur) await publishOnce(b.sha, "pending", `Verification running (build #${b.number})`, { job: b.job, build: b.number });
          continue;
        }
        if (state.data.builds[key]) continue;
        if (await processBuild(b, mirrorReady)) handled += 1;
      }
      return { builds: builds.length, handled };
    },
  };
}
