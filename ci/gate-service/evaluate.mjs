// Decides whether a finished Jenkins build proves that an exact commit passed every required check, and if so
// signs the attestation. Nothing here trusts the build agent's word for who/what was built:
//   * the commit comes from Jenkins' own record of what it checked out,
//   * the tree hash and the pinned pipeline files come from Git itself,
//   * stage results must name that same commit and tree,
//   * the pipeline definition (Jenkinsfile + ci scripts) must be byte-identical to the admin-approved pin.
import { createAttestation } from "../lib/attestation.mjs";

export const PINNED_PATHS = ["Jenkinsfile", "ci/pipeline", "ci/lib", "ci/gate", "ci/verify"];

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
/** The most useful single line of a failed stage's output (what a developer needs to see on GitHub). */
export function firstErrorLine(tail = "") {
  const clean = (l) => l.replace(/^\[?\d{4}-\d\d-\d\dT[^\s\]]*\]?\s*/, "").trim();
  const lines = String(tail).replace(ANSI, "").split("\n").map(clean).filter(Boolean);
  // a failing test (node:test / TAP) names itself: that is the most useful line
  const failedTest = lines.find((l) => /^not ok \d+ - /.test(l));
  if (failedTest) return failedTest.replace(/^not ok \d+ - /, "test failed: ").slice(0, 110);
  const noise = /^\d+ problems?|errors? and \d+ warnings?|^npm (ERR|error) (code|path|command|A complete)|^# (tests|suites|pass|fail|cancelled|skipped|todo|duration)/i;
  const hit = lines.find((l) => /\berror\b|✘|\bFAIL(ED)?\b|Error:|not defined|failed/i.test(l) && !noise.test(l));
  return (hit || lines.filter((l) => !noise.test(l)).at(-1) || "").slice(0, 110);
}

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
    return r.status === "PASS" ? { name, status: "PASS", durationMs: r.durationMs } : { name, status: "FAIL", durationMs: r.durationMs, detail: firstErrorLine(r.tail) };
  });
  const bad = checks.filter((c) => c.status !== "PASS");
  if (bad.length) {
    // failing stages first, with their first error line: that is what GitHub shows (140 characters)
    const failed = bad.filter((c) => c.status === "FAIL"), other = bad.filter((c) => c.status !== "FAIL");
    reasons.push([...failed.map((c) => `${c.name} FAIL: ${c.detail || "see Jenkins"}`), ...other.map((c) => `${c.name}=${c.status}`)].join("; "));
  }
  return reasons.length ? { verdict: "failed", reasons, checks } : { verdict: "passed", reasons: [], checks };
}

export function signAttestation({ repo, branch, sha, tree, checks, required, privateKeyPem, buildUrl, now = Date.now() }) {
  return createAttestation({ repo, branch, commit: sha, tree, checks, required, privateKeyPem, buildUrl, now });
}
