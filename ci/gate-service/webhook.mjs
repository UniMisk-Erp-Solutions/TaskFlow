// GitHub webhook intake. The payload is only a HINT ("something changed, go look"): Jenkins decides what to build by
// asking GitHub itself, so a forged or replayed delivery can at worst cause one extra scan.
// Even so, every delivery is authenticated (HMAC-SHA256 over the raw body), size-limited, filtered and de-duplicated.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_BODY_BYTES = 1_000_000;          // larger pushes are skipped on purpose; the periodic scan catches them
export const ACCEPTED_EVENTS = new Set(["ping", "push", "pull_request"]);
const PR_ACTIONS = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);
const DELIVERY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sign(secret, raw) {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

export function verifySignature(secret, raw, header) {
  if (!secret || typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const a = Buffer.from(sign(secret, raw));
  const b = Buffer.from(header.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Decides what to do with one delivery. Pure: the caller supplies the secret, the allowed repositories and a
 * `seen(deliveryId)` function that records the id and reports whether it was already processed.
 * Returns { code, body, scan } — `scan` is true when Jenkins should re-index the repository.
 */
export function handleDelivery({ headers, raw, secret, allowedRepos, seen }) {
  const h = (k) => headers[k] ?? headers[k.toLowerCase()];
  if (raw.length > MAX_BODY_BYTES) return { code: 413, body: { error: "payload too large; the periodic scan will pick the change up" }, scan: false };
  if (!verifySignature(secret, raw, h("x-hub-signature-256"))) return { code: 401, body: { error: "invalid or missing signature" }, scan: false };

  const event = String(h("x-github-event") || "");
  const delivery = String(h("x-github-delivery") || "");
  if (!ACCEPTED_EVENTS.has(event)) return { code: 202, body: { ok: true, ignored: `event ${event || "(none)"}` }, scan: false };
  if (!DELIVERY_RE.test(delivery)) return { code: 400, body: { error: "missing or malformed X-GitHub-Delivery" }, scan: false };

  let p;
  try { p = JSON.parse(raw.toString("utf8")); } catch { return { code: 400, body: { error: "body is not JSON" }, scan: false }; }
  if (!p || typeof p !== "object") return { code: 400, body: { error: "body is not a JSON object" }, scan: false };

  if (seen(delivery)) return { code: 200, body: { ok: true, duplicate: delivery }, scan: false };

  const repo = p.repository?.full_name;
  if (event !== "ping" || repo) {
    if (!allowedRepos.includes(repo)) return { code: 202, body: { ok: true, ignored: "repository not allowed" }, scan: false };
  }
  if (event === "ping") return { code: 200, body: { ok: true, pong: true }, scan: false };

  if (event === "push") {
    if (p.deleted) return { code: 202, body: { ok: true, ignored: "branch deletion" }, scan: false };
    if (typeof p.ref !== "string" || !p.ref.startsWith("refs/heads/")) return { code: 202, body: { ok: true, ignored: "not a branch push" }, scan: false };
    return { code: 202, body: { ok: true, accepted: "push", ref: p.ref, sha: String(p.after || "").slice(0, 40) }, scan: true };
  }

  // pull_request
  if (!PR_ACTIONS.has(p.action)) return { code: 202, body: { ok: true, ignored: `pull_request action ${p.action}` }, scan: false };
  const headRepo = p.pull_request?.head?.repo?.full_name;
  if (headRepo !== repo) return { code: 202, body: { ok: true, ignored: "pull request from a fork: forks are never built" }, scan: false };
  return { code: 202, body: { ok: true, accepted: "pull_request", number: p.number, sha: String(p.pull_request?.head?.sha || "").slice(0, 40) }, scan: true };
}

/** Collapses bursts of scan requests (several events for the same push) into a single scan. */
export function createDebouncer(fn, waitMs, { setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  let timer = null;
  let pending = 0;
  return {
    request() { pending += 1; if (timer) return; timer = setTimeoutImpl(async () => { const n = pending; pending = 0; timer = null; await fn(n); }, waitMs); },
    cancel() { if (timer) clearTimeoutImpl(timer); timer = null; pending = 0; },
  };
}

/** Per-minute request budget so a flood cannot keep Jenkins busy. */
export function createRateLimiter(maxPerMinute, now = () => Date.now()) {
  let windowStart = now();
  let count = 0;
  return () => { const t = now(); if (t - windowStart >= 60_000) { windowStart = t; count = 0; } count += 1; return count <= maxPerMinute; };
}
