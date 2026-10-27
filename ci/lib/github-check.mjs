// Publishes the `unimisk/verified` GitHub *check run* as the Jenkins GitHub App.
//
// A check run (unlike a plain commit status) can be required in branch protection together with the
// App's id, so no human, PAT or other integration can satisfy the requirement — only this App.
import { createSign } from "node:crypto";

const API = "https://api.github.com";
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function createAppJwt(appId, privateKeyPem, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: nowSec - 30, exp: nowSec + 540, iss: String(appId) }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKeyPem);
  return `${head}.${body}.${b64url(sig)}`;
}

async function gh(fetchImpl, token, method, path, body) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "unimisk-ci" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${method} ${path} -> ${res.status} ${json.message || ""}`.trim());
  return json;
}

/**
 * conclusion: "success" only when the attestation is valid for `sha`; anything else must be
 * "failure" (never "neutral"/"skipped", which GitHub treats as passing for required checks).
 */
export async function publishCheck({ repo, sha, name, conclusion, title, summary, detailsUrl, env = process.env, fetchImpl = fetch }) {
  const { GITHUB_APP_ID: appId, GITHUB_APP_INSTALLATION_ID: inst, GITHUB_APP_PRIVATE_KEY: key } = env;
  if (!appId || !inst || !key) return { ok: false, skipped: true, reason: "GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY not set" };
  if (!["success", "failure"].includes(conclusion)) throw new Error('conclusion must be "success" or "failure"');
  const jwt = createAppJwt(appId, key);
  const { token } = await gh(fetchImpl, jwt, "POST", `/app/installations/${inst}/access_tokens`, {
    repositories: [repo.split("/")[1]], permissions: { checks: "write" },
  });
  const run = await gh(fetchImpl, token, "POST", `/repos/${repo}/check-runs`, {
    name, head_sha: sha, status: "completed", conclusion, completed_at: new Date().toISOString(),
    details_url: detailsUrl || undefined,
    output: { title: String(title).slice(0, 120), summary: String(summary).slice(0, 60000) },
  });
  return { ok: true, id: run.id };
}
