// GitHub integration core: pure helpers + webhook processing.
//
// Kept free of Deno globals and npm imports so the same file runs in the Edge Function and in
// the Node test suite (supabase/tests/github-integration.test.mjs). Only erasable TypeScript
// syntax is used for that reason. The database client and side-effect hooks are injected.

// ─────────────────────────────────────────────────────────────────────────────
// Task references
// ─────────────────────────────────────────────────────────────────────────────

/** Human-friendly task reference used in branch names, commits and PRs, e.g. `TF-1a2b3c4d`. */
export function taskRefOf(taskId: string): string {
  return `TF-${String(taskId).replace(/-/g, "").slice(0, 8).toLowerCase()}`;
}

const SHORT_REF_RE = /(?<![A-Za-z0-9])TF-([0-9a-f]{8})(?![A-Za-z0-9])/gi;
const UUID_RE = /(?<![A-Za-z0-9])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![A-Za-z0-9])/gi;
const MAX_REFS_PER_EVENT = 25;

/** Finds task references (`TF-xxxxxxxx` or a full task UUID) in free text. */
export function extractTaskRefs(...texts: (string | null | undefined)[]): { prefixes: string[]; ids: string[] } {
  const prefixes = new Set<string>();
  const ids = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    const s = String(t).slice(0, 20_000);
    for (const m of s.matchAll(SHORT_REF_RE)) prefixes.add(m[1].toLowerCase());
    for (const m of s.matchAll(UUID_RE)) ids.add(m[1].toLowerCase());
  }
  return { prefixes: [...prefixes].slice(0, MAX_REFS_PER_EVENT), ids: [...ids].slice(0, MAX_REFS_PER_EVENT) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers (WebCrypto only)
// ─────────────────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? enc.encode(data) : data;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret: string, data: string | Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, toBytes(data)));
}

/** Constant-time string comparison (length is not secret). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Validates GitHub's `X-Hub-Signature-256` header over the exact raw request bytes. */
export async function verifyGithubSignature(
  secret: string,
  rawBody: string | Uint8Array,
  header: string | null | undefined,
): Promise<boolean> {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = `sha256=${await hmacSha256Hex(secret, rawBody)}`;
  return safeEqual(expected, header.trim().toLowerCase());
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Signed, expiring token used as the OAuth/installation `state` parameter. */
export async function signState(
  secret: string,
  payload: Record<string, unknown>,
  ttlSeconds = 900,
  nowMs = Date.now(),
): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(nowMs / 1000) + ttlSeconds })));
  return `${body}.${await hmacSha256Hex(secret, body)}`;
}

export async function verifyState(
  secret: string,
  token: string | null | undefined,
  nowMs = Date.now(),
): Promise<Record<string, any> | null> {
  if (!secret || !token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!safeEqual(await hmacSha256Hex(secret, body), sig.toLowerCase())) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Math.floor(nowMs / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function derLength(n: number): number[] {
  if (n < 128) return [n];
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

/** Accepts the PEM GitHub issues (PKCS#1 "RSA PRIVATE KEY") or PKCS#8 and returns PKCS#8 DER. */
export function pemToPkcs8(pemInput: string): Uint8Array {
  const pem = String(pemInput).replace(/\\n/g, "\n");
  const isPkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (!isPkcs1) return der;
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const version = [0x02, 0x01, 0x00];
  const octet = [0x04, ...derLength(der.length)];
  const inner = [...version, ...algId, ...octet];
  const total = inner.length + der.length;
  const out = new Uint8Array(1 + derLength(total).length + total);
  out.set([0x30, ...derLength(total)], 0);
  const headLen = 1 + derLength(total).length;
  out.set(inner, headLen);
  out.set(der, headLen + inner.length);
  return out;
}

/** RS256 JWT used to authenticate as the GitHub App itself (valid ≤10 minutes). */
export async function createAppJwt(appId: string, privateKeyPem: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const head = b64urlEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64urlEncode(enc.encode(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 540, iss: String(appId) })));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explicit links (user pastes a branch / PR / commit)
// ─────────────────────────────────────────────────────────────────────────────

export type LinkKind = "branch" | "commit" | "pull_request";
export type ParsedLink = { kind: LinkKind; repo: string; ref: string; url: string };

const REPO_RE = "[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}";

export function githubUrlFor(kind: LinkKind, repo: string, ref: string): string {
  if (kind === "pull_request") return `https://github.com/${repo}/pull/${ref}`;
  if (kind === "commit") return `https://github.com/${repo}/commit/${ref}`;
  return `https://github.com/${repo}/tree/${ref.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Accepts a GitHub PR/branch/commit URL, `owner/repo#12` (PR) or `owner/repo:branch`.
 * Repository names are lower-cased (GitHub treats them case-insensitively); branches are not.
 */
export function parseExplicitLink(input: unknown): ParsedLink | { error: string } {
  const raw = String(input ?? "").trim();
  if (!raw) return { error: "Paste a GitHub pull request, branch or commit link." };
  if (raw.length > 500) return { error: "That link is too long." };
  let m = raw.match(new RegExp(`^https?://(?:www\\.)?github\\.com/(${REPO_RE})/pull/(\\d{1,9})(?:[/?#].*)?$`, "i"));
  if (m) return build("pull_request", m[1], m[2]);
  m = raw.match(new RegExp(`^https?://(?:www\\.)?github\\.com/(${REPO_RE})/commit/([0-9a-f]{7,40})(?:[/?#].*)?$`, "i"));
  if (m) return build("commit", m[1], m[2].toLowerCase());
  m = raw.match(new RegExp(`^https?://(?:www\\.)?github\\.com/(${REPO_RE})/tree/([^?#]+)(?:[?#].*)?$`, "i"));
  if (m) {
    let branch = m[2];
    try { branch = decodeURIComponent(branch); } catch { /* keep as-is */ }
    return build("branch", m[1], branch.replace(/\/+$/, ""));
  }
  m = raw.match(new RegExp(`^(${REPO_RE})#(\\d{1,9})$`));
  if (m) return build("pull_request", m[1], m[2]);
  m = raw.match(new RegExp(`^(${REPO_RE})[:@]([^\\s]{1,250})$`));
  if (m) return build("branch", m[1], m[2]);
  return { error: "Use a GitHub pull request, branch or commit URL, owner/repo#123, or owner/repo:branch." };

  function build(kind: LinkKind, repoIn: string, ref: string): ParsedLink | { error: string } {
    if (!ref || /\.\.|[\s~^:?*[\\]/.test(ref) && kind === "branch") return { error: "That branch name is not valid." };
    const repo = repoIn.toLowerCase();
    return { kind, repo, ref, url: githubUrlFor(kind, repo, ref) };
  }
}

/**
 * Normalises the repository a task is tied to: `owner/repo`, a github.com URL, or an ssh remote.
 * Returns { repo: null } for an empty value (clears it) or { error } for something unusable.
 */
export function normalizeRepo(input: unknown): { repo: string | null } | { error: string } {
  const raw = String(input ?? "").trim();
  if (!raw) return { repo: null };
  if (raw.length > 300) return { error: "That repository name is too long." };
  const m = raw.match(new RegExp(`^https?://(?:www\\.)?github\\.com/(${REPO_RE})(?:\\.git)?(?:[/?#].*)?$`, "i"))
    || raw.match(new RegExp(`^(?:git@github\\.com:|ssh://git@github\\.com/)(${REPO_RE})(?:\\.git)?$`, "i"))
    || raw.match(new RegExp(`^(${REPO_RE})(?:\\.git)?$`));
  if (!m) return { error: "Enter the repository as owner/repo, e.g. UniMisk-Erp-Solutions/TaskFlow." };
  const repo = m[1].toLowerCase().replace(/\.git$/, "");
  const [owner, name] = repo.split("/");
  if (!owner || !name || owner === "." || name === "." || owner === ".." || name === "..") {
    return { error: "Enter the repository as owner/repo, e.g. UniMisk-Erp-Solutions/TaskFlow." };
  }
  return { repo };
}

/** Optional branch restriction for a task's repository. Empty clears it. */
export function normalizeBranch(input: unknown): { branch: string | null } | { error: string } {
  const raw = String(input ?? "").trim();
  if (!raw) return { branch: null };
  if (raw.length > 250 || /\.\.|[\s~^:?*[\\]/.test(raw)) return { error: "That branch name is not valid." };
  return { branch: raw };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook payload normalisation (pure)
// ─────────────────────────────────────────────────────────────────────────────

export type NormCommit = { sha: string; message: string; url: string; authorLogin: string | null };
export type NormPr = {
  number: number; url: string; title: string; body: string; state: string;
  draft: boolean; merged: boolean; headSha: string | null; headRef: string; headRepo: string | null;
};
export type NormActivity = {
  event: string;
  action: string | null;
  repo: string; // base repository, lower-cased
  actor: { id: number; login: string };
  branch: string | null;
  branchRepo: string; // repository that owns `branch`
  commits: NormCommit[];
  pr: NormPr | null;
  qualifying: boolean;
  summary: string;
};

const PR_ACTIONS = new Set(["opened", "reopened", "ready_for_review", "synchronize", "edited", "closed", "converted_to_draft"]);

/**
 * Reduces a webhook payload to what the integration cares about, or null when the event is
 * not relevant (tags, branch deletions, unrelated PR actions, ...).
 *
 * `qualifying` says whether this activity may move a task to Done (pending approval):
 *  - a push that carries at least one commit;
 *  - a non-draft PR being opened / reopened / marked ready / updated / edited, or merged.
 */
export function normalizeActivity(event: string, payload: any): NormActivity | null {
  const repo = String(payload?.repository?.full_name || "").toLowerCase();
  if (!repo) return null;

  if (event === "push") {
    const ref = String(payload.ref || "");
    if (!ref.startsWith("refs/heads/") || payload.deleted) return null;
    const sender = payload.sender;
    if (!sender?.id) return null;
    const branch = ref.slice("refs/heads/".length);
    const commits: NormCommit[] = (Array.isArray(payload.commits) ? payload.commits : []).slice(0, 50)
      .filter((c: any) => c?.id)
      .map((c: any) => ({
        sha: String(c.id).toLowerCase(),
        message: String(c.message || ""),
        url: String(c.url || githubUrlFor("commit", repo, String(c.id))),
        authorLogin: c.author?.username ?? null,
      }));
    return {
      event, action: null, repo, actor: { id: Number(sender.id), login: String(sender.login || "") },
      branch, branchRepo: repo, commits, pr: null, qualifying: commits.length > 0,
      summary: `${commits.length} commit${commits.length === 1 ? "" : "s"} pushed to ${repo}@${branch}`,
    };
  }

  if (event === "create") {
    if (payload.ref_type !== "branch" || !payload.ref || !payload.sender?.id) return null;
    return {
      event, action: null, repo, actor: { id: Number(payload.sender.id), login: String(payload.sender.login || "") },
      branch: String(payload.ref), branchRepo: repo, commits: [], pr: null, qualifying: false,
      summary: `branch ${payload.ref} created in ${repo}`,
    };
  }

  if (event === "pull_request") {
    const action = String(payload.action || "");
    const pr = payload.pull_request;
    if (!PR_ACTIONS.has(action) || !pr?.number || !pr.user?.id) return null;
    const merged = !!pr.merged;
    const draft = !!pr.draft;
    const open = pr.state === "open";
    const qualifying =
      (["opened", "reopened", "ready_for_review", "synchronize", "edited"].includes(action) && !draft && open) ||
      (action === "closed" && merged);
    const norm: NormPr = {
      number: Number(pr.number),
      url: String(pr.html_url || githubUrlFor("pull_request", repo, String(pr.number))),
      title: String(pr.title || ""),
      body: String(pr.body || ""),
      state: merged ? "merged" : pr.state === "closed" ? "closed" : draft ? "draft" : "open",
      draft,
      merged,
      headSha: pr.head?.sha ? String(pr.head.sha).toLowerCase() : null,
      headRef: String(pr.head?.ref || ""),
      headRepo: pr.head?.repo?.full_name ? String(pr.head.repo.full_name).toLowerCase() : null,
    };
    return {
      event, action,
      repo,
      actor: { id: Number(pr.user.id), login: String(pr.user.login || "") },
      branch: norm.headRef || null,
      branchRepo: norm.headRepo || repo,
      commits: [],
      pr: norm,
      qualifying,
      summary: `pull request #${norm.number} ${merged ? "merged" : action} in ${repo}`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook processing (database + side effects injected)
// ─────────────────────────────────────────────────────────────────────────────

export type GithubHooks = {
  now?: () => Date;
  closeTimers: (taskId: string, orgId: string, endedAtIso: string) => Promise<void>;
  logHistory: (
    taskId: string, actorId: string | null, orgId: string, action: string,
    changes: Record<string, unknown>, note: string | null,
  ) => Promise<void>;
  notifyReview: (info: {
    orgId: string; task: any; actorId: string; actorLogin: string; summary: string; url: string | null;
  }) => Promise<void>;
};

export type TaskOutcome = { task_id: string; linked: number; submitted: boolean; reason?: string };
export type DeliveryResult = { result: string; tasks?: TaskOutcome[] };

type Candidate = { viaBranch: boolean; viaPr: boolean; commitShas: Set<string> };

const IN_PROGRESS_STATUSES = ["in_progress", "rejected"];

async function resolveRefs(db: any, orgId: string, refs: { prefixes: string[]; ids: string[] }): Promise<string[]> {
  const out = new Set<string>();
  for (const p of refs.prefixes) {
    const { data, error } = await db.from("tasks").select("id").eq("org_id", orgId)
      .gte("id", `${p}-0000-0000-0000-000000000000`).lte("id", `${p}-ffff-ffff-ffff-ffffffffffff`).limit(2);
    if (error) throw new Error(error.message);
    if ((data || []).length === 1) out.add(data[0].id); // ambiguous prefixes are never guessed
  }
  for (const id of refs.ids) {
    const { data, error } = await db.from("tasks").select("id").eq("org_id", orgId).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) out.add(data.id);
  }
  return [...out];
}

function isAssignee(task: any, userId: string): boolean {
  if (task.assignee_id === userId) return true;
  return (task.task_assignees || []).some((a: any) => a.profile_id === userId);
}

function firstLine(s: string): string {
  return String(s || "").split("\n")[0].slice(0, 200);
}

export async function processGithubDelivery(
  db: any,
  hooks: GithubHooks,
  delivery: { id: string; event: string; payload: any },
): Promise<DeliveryResult> {
  const { id, event, payload } = delivery;
  if (event === "ping") return { result: "pong" };

  const { error: claimError } = await db.from("github_events").insert([{
    delivery_id: id,
    event,
    action: payload?.action ?? null,
    installation_id: payload?.installation?.id ?? null,
    repo_full_name: payload?.repository?.full_name?.toLowerCase?.() ?? null,
  }]);
  if (claimError) {
    if (claimError.code === "23505") return { result: "duplicate_delivery" };
    throw new Error(claimError.message);
  }

  try {
    const out = await routeEvent(db, hooks, event, payload);
    await db.from("github_events").update({ result: out.result.slice(0, 300) }).eq("delivery_id", id);
    return out;
  } catch (err) {
    // Let GitHub's redelivery run again instead of being swallowed by the idempotency row.
    await db.from("github_events").delete().eq("delivery_id", id);
    throw err;
  }
}

async function routeEvent(db: any, hooks: GithubHooks, event: string, payload: any): Promise<DeliveryResult> {
  if (event === "installation") return await handleInstallationEvent(db, payload);
  if (event === "github_app_authorization") {
    if (payload?.action === "revoked" && payload?.sender?.id) {
      await db.from("github_connections").delete().eq("github_user_id", Number(payload.sender.id));
      return { result: "connection_removed_after_revoke" };
    }
    return { result: "ignored:authorization_event" };
  }
  if (event === "push" || event === "create" || event === "pull_request") {
    return await handleActivity(db, hooks, event, payload);
  }
  return { result: `ignored:event_${event}` };
}

async function handleInstallationEvent(db: any, payload: any): Promise<DeliveryResult> {
  const installationId = payload?.installation?.id;
  if (!installationId) return { result: "ignored:no_installation" };
  const action = payload.action;
  if (action === "deleted") {
    await db.from("github_installations").delete().eq("installation_id", installationId);
    return { result: "installation_removed" };
  }
  if (action === "suspend") {
    await db.from("github_installations").update({ suspended_at: new Date().toISOString() }).eq("installation_id", installationId);
    return { result: "installation_suspended" };
  }
  if (action === "unsuspend") {
    await db.from("github_installations").update({ suspended_at: null }).eq("installation_id", installationId);
    return { result: "installation_unsuspended" };
  }
  return { result: `ignored:installation_${action}` };
}

async function handleActivity(db: any, hooks: GithubHooks, event: string, payload: any): Promise<DeliveryResult> {
  const act = normalizeActivity(event, payload);
  if (!act) return { result: "ignored:not_relevant" };

  // 1. The installation must be linked to a TaskFlow organization by an admin.
  const installationId = payload?.installation?.id;
  if (!installationId) return { result: "ignored:no_installation" };
  const { data: inst, error: instErr } = await db.from("github_installations")
    .select("org_id, suspended_at").eq("installation_id", installationId).maybeSingle();
  if (instErr) throw new Error(instErr.message);
  if (!inst) return { result: "ignored:unknown_installation" };
  if (inst.suspended_at) return { result: "ignored:installation_suspended" };
  const orgId: string = inst.org_id;

  // 2. The GitHub user must be a TaskFlow user (in this organization) who connected their account.
  const { data: conn, error: connErr } = await db.from("github_connections")
    .select("user_id, github_login").eq("github_user_id", act.actor.id).maybeSingle();
  if (connErr) throw new Error(connErr.message);
  if (!conn) return { result: "ignored:actor_not_connected" };
  const { data: prof, error: profErr } = await db.from("profiles").select("id, org_id").eq("id", conn.user_id).maybeSingle();
  if (profErr) throw new Error(profErr.message);
  if (!prof || prof.org_id !== orgId) return { result: "ignored:actor_not_in_organization" };
  const userId: string = conn.user_id;

  // 3. Which tasks does this activity refer to?
  const cands = new Map<string, Candidate>();
  const cand = (taskId: string): Candidate => {
    let c = cands.get(taskId);
    if (!c) cands.set(taskId, (c = { viaBranch: false, viaPr: false, commitShas: new Set() }));
    return c;
  };

  if (act.branch) {
    for (const t of await resolveRefs(db, orgId, extractTaskRefs(act.branch))) cand(t).viaBranch = true;
    const repos = [...new Set([act.repo, act.branchRepo])];
    const { data: manual, error } = await db.from("task_github_links").select("task_id")
      .eq("org_id", orgId).eq("kind", "branch").eq("ref", act.branch).in("repo_full_name", repos);
    if (error) throw new Error(error.message);
    for (const l of manual || []) cand(l.task_id).viaBranch = true;
  }
  for (const c of act.commits) {
    for (const t of await resolveRefs(db, orgId, extractTaskRefs(c.message))) cand(t).commitShas.add(c.sha);
  }
  if (act.pr) {
    for (const t of await resolveRefs(db, orgId, extractTaskRefs(act.pr.title, act.pr.body))) cand(t).viaPr = true;
    const { data: manual, error } = await db.from("task_github_links").select("task_id")
      .eq("org_id", orgId).eq("kind", "pull_request").eq("ref", String(act.pr.number)).eq("repo_full_name", act.repo);
    if (error) throw new Error(error.message);
    for (const l of manual || []) cand(l.task_id).viaPr = true;
  }

  // No task reference and no explicit link: fall back to the repository entered on the task.
  // Only the pusher's own In Progress tasks for that repo (and branch, if the task names one)
  // count, and only when exactly one does — several candidates are ambiguous and never guessed.
  if (!cands.size) {
    const { data: repoTasks, error: repoErr } = await db.from("tasks")
      .select("id, status, kanban_column, assignee_id, github_branch, task_assignees(profile_id)")
      .eq("org_id", orgId).eq("github_repo", act.repo).eq("kanban_column", "in_progress");
    if (repoErr) throw new Error(repoErr.message);
    const mine = (repoTasks || []).filter((t: any) =>
      isAssignee(t, userId) && IN_PROGRESS_STATUSES.includes(t.status) && (!t.github_branch || t.github_branch === act.branch));
    if (mine.length > 1) return { result: "ignored:ambiguous_repo_match" };
    if (mine.length === 1) {
      const c = cand(mine[0].id);
      c.viaBranch = true;
      c.viaPr = true;
    }
  }
  if (!cands.size) return { result: "ignored:no_matching_task" };

  const { data: tasks, error: taskErr } = await db.from("tasks")
    .select("id, title, status, kanban_column, assignee_id, task_assignees(profile_id)")
    .eq("org_id", orgId).in("id", [...cands.keys()]);
  if (taskErr) throw new Error(taskErr.message);

  const outcomes: TaskOutcome[] = [];
  for (const task of tasks || []) {
    const c = cands.get(task.id)!;
    // 4. Only an assignee may link activity to (and thereby submit) a task.
    if (!isAssignee(task, userId)) {
      outcomes.push({ task_id: task.id, linked: 0, submitted: false, reason: "not_assignee" });
      continue;
    }
    outcomes.push(await applyToTask(db, hooks, { act, orgId, userId, actorLogin: conn.github_login, task, cand: c }));
  }

  const submitted = outcomes.filter((o) => o.submitted).length;
  const linked = outcomes.reduce((n, o) => n + o.linked, 0);
  const denied = outcomes.filter((o) => o.reason === "not_assignee").length;
  const parts = [`submitted:${submitted}`, `linked:${linked}`];
  if (denied) parts.push(`not_assignee:${denied}`);
  return { result: parts.join(" "), tasks: outcomes };
}

async function applyToTask(
  db: any,
  hooks: GithubHooks,
  ctx: { act: NormActivity; orgId: string; userId: string; actorLogin: string; task: any; cand: Candidate },
): Promise<TaskOutcome> {
  const { act, orgId, userId, actorLogin, task, cand } = ctx;
  const nowIso = (hooks.now ? hooks.now() : new Date()).toISOString();
  const base = { org_id: orgId, task_id: task.id, author_login: act.actor.login || actorLogin, author_user_id: userId, source: "auto" };

  let evidence = 0; // genuinely new work: a new commit, a new/updated PR head, a newly merged PR
  let linked = 0;
  let firstUrl: string | null = null;

  // Commits: every commit on a task's branch, or the commits whose message mentions the task.
  const commits = act.commits.filter((c) => cand.viaBranch || cand.commitShas.has(c.sha));
  if (commits.length) {
    const rows = commits.map((c) => ({
      ...base, kind: "commit", repo_full_name: act.repo, ref: c.sha, url: c.url,
      title: firstLine(c.message), state: null, author_login: c.authorLogin || base.author_login,
      metadata: { branch: act.branch },
    }));
    const { data, error } = await db.from("task_github_links")
      .upsert(rows, { onConflict: "task_id,kind,repo_full_name,ref", ignoreDuplicates: true }).select("id, url");
    if (error) throw new Error(error.message);
    evidence += (data || []).length;
    linked += (data || []).length;
    firstUrl = firstUrl || commits[0].url;
  }

  // Branch.
  if (act.branch && cand.viaBranch) {
    const url = githubUrlFor("branch", act.branchRepo, act.branch);
    const { data, error } = await db.from("task_github_links").upsert([{
      ...base, kind: "branch", repo_full_name: act.branchRepo, ref: act.branch, url, title: act.branch, state: "active", metadata: {},
    }], { onConflict: "task_id,kind,repo_full_name,ref", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    linked += (data || []).length;
    firstUrl = firstUrl || url;
  }

  // Pull request (linked via PR text, its head branch, or an explicit link).
  if (act.pr && (cand.viaPr || cand.viaBranch)) {
    const pr = act.pr;
    firstUrl = pr.url;
    // "Credit" tracks which PR head commit (and merge) already counted as submission-worthy
    // work, independent of whether the link row existed. A draft PR is linked but not credited,
    // so marking it ready for review later still counts; edits/labels/re-deliveries never do.
    const credit = (prev: any) => ({
      head_sha: pr.headSha, head_ref: pr.headRef, draft: pr.draft, merged: pr.merged,
      credited_sha: act.qualifying ? pr.headSha : (prev?.credited_sha ?? null),
      credited_merged: act.qualifying && pr.merged ? true : (prev?.credited_merged ?? false),
    });
    const { data: inserted, error } = await db.from("task_github_links").upsert([{
      ...base, kind: "pull_request", repo_full_name: act.repo, ref: String(pr.number), url: pr.url,
      title: pr.title.slice(0, 300), state: pr.state, metadata: credit(null),
    }], { onConflict: "task_id,kind,repo_full_name,ref", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    if ((inserted || []).length) {
      linked += 1;
      if (act.qualifying) evidence += 1;
    } else {
      const { data: existing, error: exErr } = await db.from("task_github_links").select("id, state, metadata")
        .eq("task_id", task.id).eq("kind", "pull_request").eq("repo_full_name", act.repo).eq("ref", String(pr.number)).maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existing) {
        const prev = existing.metadata || {};
        if (act.qualifying && ((pr.headSha && pr.headSha !== prev.credited_sha) || (pr.merged && !prev.credited_merged))) evidence += 1;
        await db.from("task_github_links").update({
          title: pr.title.slice(0, 300), state: pr.state, url: pr.url, metadata: { ...prev, ...credit(prev) }, updated_at: nowIso,
        }).eq("id", existing.id);
      }
    }
  }

  const outcome: TaskOutcome = { task_id: task.id, linked, submitted: false };
  if (!act.qualifying) { outcome.reason = "non_qualifying_activity"; return outcome; }
  if (evidence === 0) { outcome.reason = "no_new_activity"; return outcome; }
  if (task.kanban_column !== "in_progress" || !IN_PROGRESS_STATUSES.includes(task.status)) {
    outcome.reason = "task_not_in_progress";
    return outcome;
  }

  // Atomic In Progress -> Done (pending admin approval). Concurrent deliveries race on this
  // conditional update; only the winner gets a row back and sends side effects.
  const note = `Submitted automatically from GitHub: ${act.summary} by @${act.actor.login || actorLogin}${firstUrl ? ` (${firstUrl})` : ""}`;
  const { data: moved, error: moveErr } = await db.from("tasks").update({
    status: "submitted", kanban_column: "done", work_ended_at: nowIso, submission_notes: note.slice(0, 1000),
    kanban_approved_at: null, updated_at: nowIso,
  }).eq("id", task.id).eq("org_id", orgId).eq("kanban_column", "in_progress").in("status", IN_PROGRESS_STATUSES)
    .select("id").maybeSingle();
  if (moveErr) throw new Error(moveErr.message);
  if (!moved) { outcome.reason = "already_moved"; return outcome; }

  outcome.submitted = true;
  await hooks.closeTimers(task.id, orgId, nowIso);
  await hooks.logHistory(task.id, userId, orgId, "submitted", {
    status: { from: task.status, to: "submitted" },
    kanban_column: { from: "in_progress", to: "done" },
  }, note);
  await hooks.notifyReview({ orgId, task, actorId: userId, actorLogin: act.actor.login || actorLogin, summary: act.summary, url: firstUrl });
  return outcome;
}
