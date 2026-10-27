// Decides whether a finished Jenkins build proves that an exact commit passed every required check, and if so
// signs the attestation. Nothing here trusts the build agent's word for who/what was built:
//   * the commit comes from Jenkins' own record of what it checked out,
//   * the tree hash and the pinned pipeline files come from Git itself,
//   * stage results must name that same commit and tree,
//   * the pipeline definition (Jenkinsfile + ci scripts) must be byte-identical to the admin-approved pin.
import { createAttestation } from "../lib/attestation.mjs";

export const PINNED_PATHS = ["Jenkinsfile", "ci/pipeline", "ci/lib", "ci/gate", "ci/verify"];

export function evaluateBuild({ sha, git, results, required, pin }) {
  const reasons = [];
  if (!git || !git.tree) return { verdict: "error", reasons: ["commit not found in the repository mirror"] };

  const changed = PINNED_PATHS.filter((p) => (git.pinned?.[p] ?? null) !== (pin?.[p] ?? undefined));
  if (changed.length) {
    return { verdict: "pipeline-changed", reasons: [`pipeline definition differs from the admin-pinned version: ${changed.join(", ")} (needs admin review and re-pin)`] };
  }

  const checks = required.map((name) => {
    const r = results?.[name];
    if (!r) return { name, status: "MISSING" };
    if (r.commit !== sha || r.tree !== git.tree) return { name, status: "STALE" }; // produced for different code
    return { name, status: r.status === "PASS" ? "PASS" : "FAIL", durationMs: r.durationMs };
  });
  const bad = checks.filter((c) => c.status !== "PASS");
  if (bad.length) reasons.push(`not verified: ${bad.map((c) => `${c.name}=${c.status}`).join(", ")}`);
  return reasons.length ? { verdict: "failed", reasons, checks } : { verdict: "passed", reasons: [], checks };
}

export function signAttestation({ repo, branch, sha, tree, checks, required, privateKeyPem, buildUrl, now = Date.now() }) {
  return createAttestation({ repo, branch, commit: sha, tree, checks, required, privateKeyPem, buildUrl, now });
}
