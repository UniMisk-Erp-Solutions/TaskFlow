// Commit statuses for the exact commit that was verified: the simplest GitHub integration that works with a
// personal fine-grained token (Commit statuses: read & write on ONE repository). No GitHub App is needed.
//   state: pending | success | failure | error      context: unimisk/verified
// A status belongs to a commit SHA, so a new push (new SHA) starts with no status and is re-verified.
export const STATUS_CONTEXT = "unimisk/verified";
const API = "https://api.github.com";
const STATES = new Set(["pending", "success", "failure", "error"]);

export function buildStatusBody({ state, description, targetUrl, context = STATUS_CONTEXT }) {
  if (!STATES.has(state)) throw new Error(`invalid status state "${state}"`);
  const body = { state, context, description: String(description || "").replace(/\s+/g, " ").slice(0, 140) };
  if (targetUrl && /^https?:\/\//.test(targetUrl)) body.target_url = targetUrl; // the link opens the Jenkins build page for people on the office network
  return body;
}

export async function publishStatus({ repo, sha, state, description, targetUrl, token, fetchImpl = fetch }) {
  if (!token) return { ok: false, skipped: true, reason: "no GitHub token configured" };
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error("status needs a full 40-character commit SHA");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("repo must look like owner/name");
  const res = await fetchImpl(`${API}/repos/${repo}/statuses/${sha}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "unimisk-ci-gate" },
    body: JSON.stringify(buildStatusBody({ state, description, targetUrl })),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(`GitHub status ${res.status} ${j.message || ""}`.trim()); }
  return { ok: true };
}
