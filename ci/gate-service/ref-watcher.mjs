// Push detection without any inbound connection: ask GitHub every few seconds whether any branch tip moved.
// The request is conditional (If-None-Match), so while nothing changes GitHub answers 304, which is free and does not
// count against the rate limit. Works for a public repository with or without a token. When a tip moves (a push,
// a new branch, a PR branch update) the gate asks Jenkins to scan at once, so a build starts seconds after a push
// instead of waiting for the periodic scan. A webhook (POST /github) triggers the same scan and is still supported.
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function createRefWatcher({ repo, token = "", fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!REPO_RE.test(repo || "")) throw new Error("repo must be owner/name");
  let etag = null;
  let tips = null;
  return {
    /** { changed } : true only when a branch tip differs from the previous poll (the first poll is the baseline). */
    async poll() {
      const headers = { accept: "application/vnd.github+json", "user-agent": "taskflow-gate", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(etag ? { "if-none-match": etag } : {}) };
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/git/matching-refs/heads`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 304) return { changed: false };
      if (!res.ok) throw new Error(`GitHub refs: HTTP ${res.status}`);
      const list = await res.json();
      const next = Object.fromEntries((Array.isArray(list) ? list : []).map((r) => [r.ref, r.object?.sha]));
      etag = res.headers.get("etag");
      const changed = tips !== null && Object.entries(next).some(([ref, sha]) => tips[ref] !== sha);
      tips = next;
      return { changed };
    },
  };
}
