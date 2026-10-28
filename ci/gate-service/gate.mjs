// The gate: watches Jenkins builds, verifies each one independently, signs the attestation and publishes the commit
// status. It runs in its own container with the only copy of the signing key and the GitHub token; the build agent that
// executes branch code can reach neither.
import fs from "node:fs";
import path from "node:path";
import { PINNED_PATHS, evaluateBuild, signAttestation } from "./evaluate.mjs";
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
    const key = `${b.folder ? b.folder + "/" : ""}${b.job}#${b.number}`; // folder-qualified: two Jenkins jobs can both have "feature/x#3"
    if (!mirrorReady.done) { await git.refresh().catch((e) => log(`[gate] mirror refresh failed: ${e.message}`)); mirrorReady.done = true; }
    const gi = await git.inspect(b.sha);
    // CENTRAL PIPELINE: the pipeline that judged this commit is the toolkit the build says it used. Git (not the agent) tells us what that
    // toolkit commit contains, and it must be the admin-approved pin. A path the branch does not carry is supplied by the toolkit; a path
    // the branch carries must equal the pin as well.
    const tk = await jenkins.artifactJson(b.path, ".ci/toolkit.json");
    const tgi = tk && /^[0-9a-f]{40}$/.test(tk.toolkitCommit || "") ? await git.inspect(tk.toolkitCommit) : null;
    // The approved pipeline is the pin baked into this image OR the pipeline at the tip of main: a change reaches main only through a
    // pull request an admin approved, so no manual re-pin is needed after such a merge.
    const mainTip = await git.inspectRef?.("main");
    const approvedPins = [pin, ...(mainTip?.pinned?.["ci/pipeline"] ? [mainTip.pinned] : [])];
    const effectiveFor = (P) => gi && { ...gi, pinned: Object.fromEntries(PINNED_PATHS.map((p) => {
      const own = gi.pinned?.[p] ?? null, central = tgi?.pinned?.[p] ?? null;
      return [p, central !== (P?.[p] ?? undefined) ? `toolkit:${central}` : (own ?? central)];
    })) };
    const results = {};
    for (const name of required) results[name] = await jenkins.artifactJson(b.path, `.ci/results/${name}.json`);
    const aborted = b.result !== "SUCCESS" && Object.values(results).every((r) => !r);
    let outcome;
    if (aborted) outcome = { verdict: "error", reasons: [`build ${b.result || "unknown"} before any stage result was produced`] };
    else for (const P of approvedPins) { outcome = evaluateBuild({ sha: b.sha, git: effectiveFor(P), results, required, pin: P }); if (outcome.verdict !== "pipeline-changed") break; }
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
        const key = `${b.folder ? b.folder + "/" : ""}${b.job}#${b.number}`; // folder-qualified: two Jenkins jobs can both have "feature/x#3"
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
