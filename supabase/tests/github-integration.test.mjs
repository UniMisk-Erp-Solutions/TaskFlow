// Run: node --test supabase/tests/github-integration.test.mjs   (Node 22.18+ / 24 — runs the .ts directly)
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify, createHmac } from "node:crypto";
import {
  extractTaskRefs, taskRefOf, verifyGithubSignature, signState, verifyState, createAppJwt,
  parseExplicitLink, normalizeActivity, processGithubDelivery, normalizeRepo, normalizeBranch, pollGithubTasks, encryptToken, decryptToken,
} from "../functions/api/github.ts";

// ── minimal in-memory stand-in for the supabase-js query builder ────────────
const UNIQUE = {
  github_events: ["delivery_id"],
  github_poll_state: ["user_id", "repo_full_name", "branch"],
  task_github_links: ["task_id", "kind", "repo_full_name", "ref"],
};
class FakeDb {
  constructor() { this.tables = {}; this.seq = 0; }
  seed(name, rows) { this.tables[name] = rows.map((r) => ({ ...r })); return this; }
  rows(name) { return (this.tables[name] ||= []); }
  from(name) { return new Query(this, name); }
  conflict(name, row) {
    const keys = UNIQUE[name];
    if (!keys) return null;
    return this.rows(name).find((r) => keys.every((k) => r[k] === row[k])) || null;
  }
}
class Query {
  constructor(db, name) { this.db = db; this.name = name; this.filters = []; this.mode = "select"; this.wantRows = false; this.max = Infinity; }
  select() { if (this.mode !== "select") this.wantRows = true; return this; }
  insert(rows) { this.mode = "insert"; this.payload = [].concat(rows); return this; }
  upsert(rows, opts) { this.mode = "upsert"; this.payload = [].concat(rows); this.opts = opts || {}; return this; }
  update(p) { this.mode = "update"; this.patch = p; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c, v) { this.filters.push((r) => String(r[c]) >= v); return this; }
  lte(c, v) { this.filters.push((r) => String(r[c]) <= v); return this; }
  is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  limit(n) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this.then((r) => r); }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const rows = this.db.rows(this.name);
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "select") {
      const out = match().slice(0, this.max).map((r) => structuredClone(r));
      return this.single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
    }
    if (this.mode === "insert") {
      for (const p of this.payload) if (this.db.conflict(this.name, p)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      const made = this.payload.map((p) => ({ id: `row-${++this.db.seq}`, ...structuredClone(p) }));
      rows.push(...made);
      return { data: this.wantRows ? made : null, error: null };
    }
    if (this.mode === "upsert") {
      const made = [];
      for (const p of this.payload) {
        const hit = this.db.conflict(this.name, p);
        if (hit) { if (!this.opts.ignoreDuplicates) Object.assign(hit, p); continue; }
        const row = { id: `row-${++this.db.seq}`, ...structuredClone(p) };
        rows.push(row); made.push(row);
      }
      return { data: made, error: null };
    }
    if (this.mode === "update") {
      const hit = match();
      hit.forEach((r) => Object.assign(r, this.patch));
      const data = this.wantRows ? hit.map((r) => structuredClone(r)) : null;
      return { data: this.single ? (data?.[0] ?? null) : data, error: null };
    }
    if (this.mode === "delete") {
      const hit = new Set(match());
      this.db.tables[this.name] = rows.filter((r) => !hit.has(r));
      return { data: null, error: null };
    }
    throw new Error("unsupported");
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const ORG = "00000000-0000-0000-0000-0000000000a1";
const OTHER_ORG = "00000000-0000-0000-0000-0000000000b2";
const ALICE = "aaaaaaaa-0000-0000-0000-000000000001";
const BOB = "bbbbbbbb-0000-0000-0000-000000000002";
const ADMIN = "cccccccc-0000-0000-0000-000000000003";
const T1 = "1a2b3c4d-0000-4000-8000-000000000001";
const T2 = "9f8e7d6c-0000-4000-8000-000000000002";
const T_OTHER_ORG = "1a2b3c4d-ffff-4000-8000-0000000000ff"; // same short ref as T1, different org

function world(overrides = {}) {
  const db = new FakeDb()
    .seed("profiles", [{ id: ALICE, org_id: ORG, role: "employee" }, { id: BOB, org_id: ORG, role: "employee" }, { id: ADMIN, org_id: ORG, role: "admin" }])
    .seed("github_installations", [{ installation_id: 555, org_id: ORG, suspended_at: null }])
    .seed("github_connections", [
      { user_id: ALICE, org_id: ORG, github_user_id: 100, github_login: "alice-gh" },
      { user_id: BOB, org_id: ORG, github_user_id: 200, github_login: "bob-gh" },
    ])
    .seed("tasks", [
      { id: T1, org_id: ORG, title: "Build login", status: "in_progress", kanban_column: "in_progress", assignee_id: ALICE, task_assignees: [{ profile_id: ALICE }], ...overrides.t1 },
      { id: T2, org_id: ORG, title: "Other work", status: "in_progress", kanban_column: "in_progress", assignee_id: BOB, task_assignees: [{ profile_id: BOB }] },
      { id: T_OTHER_ORG, org_id: OTHER_ORG, title: "Foreign", status: "in_progress", kanban_column: "in_progress", assignee_id: null, task_assignees: [] },
    ]);
  const calls = { timers: [], history: [], notify: [] };
  const hooks = {
    now: () => new Date("2026-10-22T10:00:00Z"),
    closeTimers: async (...a) => { calls.timers.push(a); },
    logHistory: async (...a) => { calls.history.push(a); },
    notifyReview: async (i) => { calls.notify.push(i); },
  };
  let n = 0;
  const send = (event, payload, id) => processGithubDelivery(db, hooks, { id: id || `d-${++n}`, event, payload });
  const task = (id) => db.rows("tasks").find((t) => t.id === id);
  return { db, hooks, calls, send, task };
}

const repo = { full_name: "Acme/Web" };
const push = (over = {}) => ({
  ref: "refs/heads/feature/TF-1a2b3c4d-login", installation: { id: 555 }, repository: repo,
  sender: { id: 100, login: "alice-gh" },
  commits: [{ id: "ABC1234", message: "add login form", url: "https://github.com/acme/web/commit/abc1234", author: { username: "alice-gh" } }],
  ...over,
});
const pr = (over = {}, prOver = {}) => ({
  action: "opened", installation: { id: 555 }, repository: repo, sender: { id: 100, login: "alice-gh" },
  pull_request: {
    number: 7, html_url: "https://github.com/acme/web/pull/7", title: "Login (TF-1a2b3c4d)", body: "", state: "open", draft: false, merged: false,
    user: { id: 100, login: "alice-gh" }, head: { ref: "login", sha: "SHA1", repo: { full_name: "Acme/Web" } }, ...prOver,
  },
  ...over,
});

// ── pure helpers ────────────────────────────────────────────────────────────
test("task refs: short ref, full uuid, case, and boundaries", () => {
  assert.equal(taskRefOf(T1), "TF-1a2b3c4d");
  assert.deepEqual(extractTaskRefs("feature/TF-1a2b3c4d-login").prefixes, ["1a2b3c4d"]);
  assert.deepEqual(extractTaskRefs("fix_tf-1A2B3C4D: thing").prefixes, ["1a2b3c4d"]);
  assert.deepEqual(extractTaskRefs(`closes ${T1}`).ids, [T1]);
  assert.equal(extractTaskRefs("TF-1a2b3c4dd").prefixes.length, 0, "longer hex run is not a ref");
  assert.equal(extractTaskRefs("xTF-1a2b3c4d").prefixes.length, 0, "must not be glued to a word");
  assert.equal(extractTaskRefs("TF-1a2b3c4").prefixes.length, 0, "too short");
  assert.equal(extractTaskRefs("hello world", null, undefined).prefixes.length, 0);
});

test("webhook signature validation", async () => {
  const body = JSON.stringify({ a: 1 });
  const good = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(await verifyGithubSignature("s3cret", body, good), true);
  assert.equal(await verifyGithubSignature("s3cret", new TextEncoder().encode(body), good), true);
  assert.equal(await verifyGithubSignature("wrong", body, good), false);
  assert.equal(await verifyGithubSignature("s3cret", body + " ", good), false);
  assert.equal(await verifyGithubSignature("s3cret", body, null), false);
  assert.equal(await verifyGithubSignature("s3cret", body, "sha1=abc"), false);
  assert.equal(await verifyGithubSignature("", body, good), false);
});

test("state tokens: roundtrip, tamper, expiry, wrong secret", async () => {
  const t = await signState("k", { p: "connect", uid: "u1" }, 60, 1_000_000);
  assert.equal((await verifyState("k", t, 1_000_000 + 30_000)).uid, "u1");
  assert.equal(await verifyState("k", t, 1_000_000 + 61_000), null);
  assert.equal(await verifyState("other", t, 1_000_000), null);
  const [b, s] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ p: "connect", uid: "admin", exp: 9e9 })).toString("base64url");
  assert.equal(await verifyState("k", `${forged}.${s}`, 1_000_000), null);
  assert.equal(await verifyState("k", b, 1_000_000), null);
  assert.equal(await verifyState("k", "", 1_000_000), null);
});

test("GitHub App JWT from a PKCS#1 key (as downloaded from GitHub) verifies as RS256", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  for (const pem of [privateKey, privateKey.replace(/\n/g, "\\n")]) {
    const jwt = await createAppJwt("12345", pem, 2_000_000);
    const [h, p, s] = jwt.split(".");
    assert.equal(JSON.parse(Buffer.from(h, "base64url")).alg, "RS256");
    const claims = JSON.parse(Buffer.from(p, "base64url"));
    assert.equal(claims.iss, "12345");
    assert.ok(claims.exp - claims.iat <= 600);
    assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
  }
  const pkcs8 = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  await createAppJwt("1", pkcs8.privateKey);
});

test("explicit link parsing", () => {
  assert.deepEqual(parseExplicitLink("https://github.com/Acme/Web/pull/42/files"), { kind: "pull_request", repo: "acme/web", ref: "42", url: "https://github.com/acme/web/pull/42" });
  assert.equal(parseExplicitLink("acme/web#9").ref, "9");
  const b = parseExplicitLink("https://github.com/acme/web/tree/feature/login-form");
  assert.equal(b.kind, "branch"); assert.equal(b.ref, "feature/login-form");
  assert.equal(parseExplicitLink("acme/web:hotfix/x").ref, "hotfix/x");
  assert.equal(parseExplicitLink("https://github.com/acme/web/commit/ABCDEF1").ref, "abcdef1");
  for (const bad of ["", "not a link", "https://gitlab.com/a/b/pull/1", "acme/web:bad branch", "acme/web:a..b"]) {
    assert.ok("error" in parseExplicitLink(bad), `rejects ${bad}`);
  }
});

test("normalizeActivity ignores irrelevant events", () => {
  assert.equal(normalizeActivity("push", push({ ref: "refs/tags/v1" })), null);
  assert.equal(normalizeActivity("push", push({ deleted: true })), null);
  assert.equal(normalizeActivity("pull_request", pr({ action: "labeled" })), null);
  assert.equal(normalizeActivity("create", { ref_type: "tag", ref: "v1", repository: repo, sender: { id: 1 } }), null);
  assert.equal(normalizeActivity("issues", {}), null);
  assert.equal(normalizeActivity("push", push({ commits: [] })).qualifying, false);
});

// ── end-to-end webhook behaviour ────────────────────────────────────────────
test("push on a task branch by the assignee: links + auto-submits for approval", async () => {
  const w = world();
  const out = await w.send("push", push());
  assert.equal(out.tasks[0].submitted, true);
  const t = w.task(T1);
  assert.equal(t.status, "submitted");
  assert.equal(t.kanban_column, "done");
  assert.match(t.submission_notes, /Submitted automatically from GitHub/);
  assert.equal(t.work_ended_at, "2026-10-22T10:00:00.000Z");
  const links = w.db.rows("task_github_links");
  assert.deepEqual(links.map((l) => l.kind).sort(), ["branch", "commit"]);
  assert.equal(links.find((l) => l.kind === "commit").ref, "abc1234");
  assert.equal(links.find((l) => l.kind === "branch").repo_full_name, "acme/web");
  assert.equal(w.calls.timers.length, 1);
  assert.equal(w.calls.history.length, 1);
  assert.equal(w.calls.history[0][2], ORG);
  assert.equal(w.calls.history[0][3], "submitted");
  assert.equal(w.calls.notify.length, 1);
  assert.equal(w.calls.notify[0].actorId, ALICE);
  assert.equal(w.task(T2).status, "in_progress", "unrelated task untouched");
});

test("task reference in the commit message (not the branch) also matches, without a branch link", async () => {
  const w = world();
  const out = await w.send("push", push({ ref: "refs/heads/main", commits: [{ id: "c0ffee1", message: "TF-1a2b3c4d fix validation", url: "u" }] }));
  assert.equal(out.tasks[0].submitted, true);
  assert.deepEqual(w.db.rows("task_github_links").map((l) => l.kind), ["commit"]);
});

test("a full task UUID in a commit message matches", async () => {
  const w = world();
  const out = await w.send("push", push({ ref: "refs/heads/main", commits: [{ id: "c0ffee2", message: `work on ${T1}`, url: "u" }] }));
  assert.equal(out.tasks[0].submitted, true);
});

test("duplicate delivery id is a no-op; replayed commits under a new delivery do not re-submit", async () => {
  const w = world();
  await w.send("push", push(), "same-delivery");
  assert.equal((await w.send("push", push(), "same-delivery")).result, "duplicate_delivery");
  // admin rejects, task goes back to work; GitHub re-sends the same (old) commit
  Object.assign(w.task(T1), { status: "rejected", kanban_column: "in_progress" });
  const again = await w.send("push", push());
  assert.equal(again.tasks[0].submitted, false);
  assert.equal(again.tasks[0].reason, "no_new_activity");
  assert.equal(w.task(T1).status, "rejected");
  assert.equal(w.calls.notify.length, 1);
  // genuinely new rework commit after the rejection is accepted
  const rework = await w.send("push", push({ commits: [{ id: "def5678", message: "address review", url: "u" }] }));
  assert.equal(rework.tasks[0].submitted, true);
  assert.equal(w.task(T1).status, "submitted");
  assert.equal(w.calls.notify.length, 2);
});

test("a non-assignee cannot complete someone else's task", async () => {
  const w = world();
  const out = await w.send("push", push({ sender: { id: 200, login: "bob-gh" } }));
  assert.equal(out.tasks[0].reason, "not_assignee");
  assert.equal(w.task(T1).status, "in_progress");
  assert.equal(w.db.rows("task_github_links").length, 0);
  assert.equal(w.calls.notify.length, 0);
});

test("an admin who is not assigned cannot complete a task through GitHub either", async () => {
  const w = world();
  w.db.rows("github_connections").push({ user_id: ADMIN, org_id: ORG, github_user_id: 300, github_login: "boss" });
  const out = await w.send("push", push({ sender: { id: 300, login: "boss" } }));
  assert.equal(out.tasks[0].reason, "not_assignee");
  assert.equal(w.task(T1).status, "in_progress");
});

test("unconnected GitHub users, unknown installations and suspended installations are ignored", async () => {
  const w = world();
  assert.equal((await w.send("push", push({ sender: { id: 999, login: "stranger" } }))).result, "ignored:actor_not_connected");
  assert.equal((await w.send("push", push({ installation: { id: 1 } }))).result, "ignored:unknown_installation");
  w.db.rows("github_installations")[0].suspended_at = "2026-01-01";
  assert.equal((await w.send("push", push())).result, "ignored:installation_suspended");
  assert.equal(w.task(T1).status, "in_progress");
});

test("a user who moved to another organization cannot act on this organization's tasks", async () => {
  const w = world();
  w.db.rows("profiles").find((p) => p.id === ALICE).org_id = OTHER_ORG;
  assert.equal((await w.send("push", push())).result, "ignored:actor_not_in_organization");
  assert.equal(w.task(T1).status, "in_progress");
});

test("unrelated activity does nothing", async () => {
  const w = world();
  assert.equal((await w.send("push", push({ ref: "refs/heads/main", commits: [{ id: "a1", message: "refactor", url: "u" }] }))).result, "ignored:no_matching_task");
  assert.equal((await w.send("push", push({ ref: "refs/tags/TF-1a2b3c4d" }))).result, "ignored:not_relevant");
  assert.equal((await w.send("push", push({ deleted: true }))).result, "ignored:not_relevant");
  assert.equal((await w.send("push", push({ ref: "refs/heads/TF-deadbeef", commits: [{ id: "a2", message: "x", url: "u" }] }))).result, "ignored:no_matching_task");
  assert.equal(w.task(T1).status, "in_progress");
});

test("references are scoped to the installation's organization", async () => {
  const w = world();
  const out = await w.send("push", push({ ref: "refs/heads/TF-1a2b3c4d" }));
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].task_id, T1);
  assert.equal(w.task(T_OTHER_ORG).status, "in_progress");
});

test("ambiguous short references are never guessed", async () => {
  const w = world();
  w.db.rows("tasks").push({ id: "1a2b3c4d-1111-4000-8000-000000000009", org_id: ORG, title: "Twin", status: "in_progress", kanban_column: "in_progress", assignee_id: ALICE, task_assignees: [] });
  assert.equal((await w.send("push", push())).result, "ignored:no_matching_task");
  assert.equal(w.task(T1).status, "in_progress");
});

test("linking happens but the task is not moved unless it is In Progress", async () => {
  const w = world({ t1: { status: "pending", kanban_column: "to_do" } });
  const out = await w.send("push", push());
  assert.equal(out.tasks[0].submitted, false);
  assert.equal(out.tasks[0].reason, "task_not_in_progress");
  assert.equal(w.db.rows("task_github_links").length, 2);
  assert.equal(w.task(T1).status, "pending");
  for (const done of [{ status: "submitted", kanban_column: "done" }, { status: "completed", kanban_column: "done" }]) {
    const x = world({ t1: done });
    const r = await x.send("push", push());
    assert.equal(r.tasks[0].submitted, false);
    assert.equal(x.task(T1).status, done.status);
    assert.equal(x.calls.notify.length, 0);
  }
});

test("simultaneous deliveries submit the task exactly once", async () => {
  const w = world();
  const results = await Promise.all([w.send("push", push(), "p1"), w.send("push", push(), "p2"), w.send("push", push(), "p3")]);
  assert.equal(results.filter((r) => r.tasks?.[0]?.submitted).length, 1);
  assert.equal(w.calls.notify.length, 1);
  assert.equal(w.calls.history.length, 1);
});

test("pull requests: draft links only, ready-for-review submits, merge afterwards is a no-op", async () => {
  const w = world();
  const draft = await w.send("pull_request", pr({}, { draft: true }));
  assert.equal(draft.tasks[0].submitted, false);
  assert.equal(draft.tasks[0].reason, "non_qualifying_activity");
  assert.equal(w.db.rows("task_github_links")[0].state, "draft");
  assert.equal(w.task(T1).status, "in_progress");

  const ready = await w.send("pull_request", pr({ action: "ready_for_review" }));
  assert.equal(ready.tasks[0].submitted, true);
  assert.equal(w.task(T1).status, "submitted");
  assert.equal(w.db.rows("task_github_links").filter((l) => l.kind === "pull_request").length, 1, "one PR row, updated in place");
  assert.equal(w.db.rows("task_github_links")[0].state, "open");

  const merged = await w.send("pull_request", pr({ action: "closed" }, { state: "closed", merged: true }));
  assert.equal(merged.tasks[0].submitted, false);
  assert.equal(w.db.rows("task_github_links")[0].state, "merged");
  assert.equal(w.calls.notify.length, 1);
});

test("a PR matched through its head branch name, opened by the assignee", async () => {
  const w = world();
  const out = await w.send("pull_request", pr({}, { title: "Login", head: { ref: "feature/TF-1a2b3c4d-login", sha: "S", repo: { full_name: "Acme/Web" } } }));
  assert.equal(out.tasks[0].submitted, true);
  assert.deepEqual(w.db.rows("task_github_links").map((l) => l.kind).sort(), ["branch", "pull_request"]);
});

test("PR edits and closing without merge never submit; a new head commit on an open PR does", async () => {
  const w = world({ t1: { status: "rejected", kanban_column: "in_progress" } });
  w.db.rows("task_github_links").push({ id: "pre", org_id: ORG, task_id: T1, kind: "pull_request", repo_full_name: "acme/web", ref: "7", state: "open", source: "auto", metadata: { credited_sha: "sha1" } });
  const edited = await w.send("pull_request", pr({ action: "edited" }));
  assert.equal(edited.tasks[0].reason, "no_new_activity");
  const closed = await w.send("pull_request", pr({ action: "closed" }, { state: "closed" }));
  assert.equal(closed.tasks[0].submitted, false);
  const synced = await w.send("pull_request", pr({ action: "synchronize" }, { head: { ref: "login", sha: "NEWSHA", repo: { full_name: "Acme/Web" } } }));
  assert.equal(synced.tasks[0].submitted, true);
});

test("PR by someone else (not the task assignee) is rejected even if a reviewer/admin triggers it", async () => {
  const w = world();
  const out = await w.send("pull_request", pr({ sender: { id: 200, login: "bob-gh" } }, { user: { id: 200, login: "bob-gh" } }));
  assert.equal(out.tasks[0].reason, "not_assignee");
  assert.equal(w.task(T1).status, "in_progress");
});

test("explicitly linked branch: no task id in names or messages needed", async () => {
  const w = world();
  w.db.rows("task_github_links").push({ id: "m1", org_id: ORG, task_id: T1, kind: "branch", repo_full_name: "acme/web", ref: "my-branch", source: "manual" });
  const out = await w.send("push", push({ ref: "refs/heads/my-branch", commits: [{ id: "e1", message: "wip", url: "u" }] }));
  assert.equal(out.tasks[0].submitted, true);
});

test("explicitly linked PR number is matched without any task id in the PR", async () => {
  const w = world();
  w.db.rows("task_github_links").push({ id: "m2", org_id: ORG, task_id: T1, kind: "pull_request", repo_full_name: "acme/web", ref: "7", source: "manual", state: null, metadata: {} });
  const out = await w.send("pull_request", pr({}, { title: "Totally unrelated title" }));
  assert.equal(out.tasks[0].submitted, true);
  assert.equal(w.db.rows("task_github_links").length, 1, "existing manual link updated, not duplicated");
});

test("a failure mid-processing releases the delivery so GitHub's retry can succeed", async () => {
  const w = world();
  let fail = true;
  const hooks = { ...w.hooks, notifyReview: async () => { if (fail) throw new Error("push service down"); } };
  await assert.rejects(processGithubDelivery(w.db, hooks, { id: "retry-me", event: "push", payload: push() }), /push service down/);
  assert.equal(w.db.rows("github_events").length, 0);
  fail = false;
  Object.assign(w.task(T1), { status: "in_progress", kanban_column: "in_progress" });
  w.db.tables.task_github_links = [];
  const ok = await processGithubDelivery(w.db, hooks, { id: "retry-me", event: "push", payload: push() });
  assert.equal(ok.tasks[0].submitted, true);
});

test("installation lifecycle and OAuth revocation events", async () => {
  const w = world();
  await w.send("installation", { action: "suspend", installation: { id: 555 } });
  assert.ok(w.db.rows("github_installations")[0].suspended_at);
  await w.send("installation", { action: "unsuspend", installation: { id: 555 } });
  assert.equal(w.db.rows("github_installations")[0].suspended_at, null);
  await w.send("github_app_authorization", { action: "revoked", sender: { id: 100 } });
  assert.equal(w.db.rows("github_connections").length, 1);
  await w.send("installation", { action: "deleted", installation: { id: 555 } });
  assert.equal(w.db.rows("github_installations").length, 0);
  assert.equal((await w.send("ping", { zen: "x" })).result, "pong");
  assert.equal((await w.send("star", {})).result, "ignored:event_star");
});

test("branch creation links the branch but does not submit", async () => {
  const w = world();
  const out = await w.send("create", { ref_type: "branch", ref: "TF-1a2b3c4d-start", installation: { id: 555 }, repository: repo, sender: { id: 100, login: "alice-gh" } });
  assert.equal(out.tasks[0].submitted, false);
  assert.equal(w.db.rows("task_github_links")[0].kind, "branch");
  assert.equal(w.task(T1).status, "in_progress");
});

// ── per-task repository ─────────────────────────────────────────────────────
const plainPush = (over = {}) => push({ ref: "refs/heads/main", commits: [{ id: "f00d001", message: "ship it", url: "u" }], ...over });

test("repository normalisation accepts names, urls and ssh remotes; rejects junk", () => {
  for (const ok of ["UniMisk-Erp-Solutions/TaskFlow", "https://github.com/UniMisk-Erp-Solutions/TaskFlow", "https://github.com/UniMisk-Erp-Solutions/TaskFlow.git",
    "https://github.com/UniMisk-Erp-Solutions/TaskFlow/tree/main", "git@github.com:UniMisk-Erp-Solutions/TaskFlow.git", " unimisk-erp-solutions/taskflow "]) {
    assert.deepEqual(normalizeRepo(ok), { repo: "unimisk-erp-solutions/taskflow" }, ok);
  }
  assert.deepEqual(normalizeRepo(""), { repo: null });
  assert.deepEqual(normalizeRepo(null), { repo: null });
  for (const bad of ["taskflow", "a/b/c/d e", "https://gitlab.com/a/b", "../x", "a/..", "x".repeat(400)]) assert.ok("error" in normalizeRepo(bad), bad);
  assert.deepEqual(normalizeBranch("naveena/features/responsive"), { branch: "naveena/features/responsive" });
  assert.deepEqual(normalizeBranch(" "), { branch: null });
  assert.ok("error" in normalizeBranch("a..b"));
});

test("repo-only match: the assignee's single In Progress task for that repo is submitted without any task id", async () => {
  const w = world({ t1: { github_repo: "acme/web" } });
  const out = await w.send("push", plainPush());
  assert.equal(out.tasks[0].submitted, true);
  assert.equal(w.task(T1).status, "submitted");
  assert.ok(w.db.rows("task_github_links").some((l) => l.kind === "commit"));
});

test("repo-only match works for pull requests too", async () => {
  const w = world({ t1: { github_repo: "acme/web" } });
  const out = await w.send("pull_request", pr({}, { title: "Totally unrelated", head: { ref: "x", sha: "S9", repo: { full_name: "Acme/Web" } } }));
  assert.equal(out.tasks[0].submitted, true);
});

test("repo-only match is ambiguous (and ignored) when the assignee has several In Progress tasks on the repo", async () => {
  const w = world({ t1: { github_repo: "acme/web" } });
  w.db.rows("tasks").push({ id: "5e5e5e5e-0000-4000-8000-000000000005", org_id: ORG, title: "Second", status: "in_progress", kanban_column: "in_progress", assignee_id: ALICE, github_repo: "acme/web", task_assignees: [{ profile_id: ALICE }] });
  assert.equal((await w.send("push", plainPush())).result, "ignored:ambiguous_repo_match");
  assert.equal(w.task(T1).status, "in_progress");
  assert.equal(w.db.rows("task_github_links").length, 0);
});

test("a task branch restriction narrows repo-only matching", async () => {
  const w = world({ t1: { github_repo: "acme/web", github_branch: "naveena/features/responsive" } });
  assert.equal((await w.send("push", plainPush())).result, "ignored:no_matching_task");
  const hit = await w.send("push", plainPush({ ref: "refs/heads/naveena/features/responsive", commits: [{ id: "b4d0001", message: "wip", url: "u" }] }));
  assert.equal(hit.tasks[0].submitted, true);
});

test("repo-only match never lets someone else, another repo, or a not-started task complete a task", async () => {
  const w = world({ t1: { github_repo: "acme/web" } });
  assert.equal((await w.send("push", plainPush({ sender: { id: 200, login: "bob-gh" } }))).result, "ignored:no_matching_task");
  assert.equal((await w.send("push", plainPush({ repository: { full_name: "Acme/Other" } }))).result, "ignored:no_matching_task");
  const todo = world({ t1: { github_repo: "acme/web", status: "pending", kanban_column: "to_do" } });
  assert.equal((await todo.send("push", plainPush())).result, "ignored:no_matching_task");
  assert.equal(w.task(T1).status, "in_progress");
  assert.equal(todo.task(T1).status, "pending");
});

test("an explicit task reference wins over the repository fallback", async () => {
  const w = world({ t1: { github_repo: "acme/web" } });
  w.db.rows("tasks").push({ id: "7a7a7a7a-0000-4000-8000-000000000007", org_id: ORG, title: "Other", status: "in_progress", kanban_column: "in_progress", assignee_id: ALICE, github_repo: "acme/web", task_assignees: [{ profile_id: ALICE }] });
  const out = await w.send("push", plainPush({ commits: [{ id: "c0de002", message: "TF-7a7a7a7a refactor", url: "u" }] }));
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].task_id, "7a7a7a7a-0000-4000-8000-000000000007");
  assert.equal(w.task(T1).status, "in_progress");
});

// ── polling fallback (no GitHub App on the repository) ──────────────────────
const NOW = "2026-10-23T12:00:00.000Z";
const SET_AT = "2026-10-23T10:00:00.000Z";

function pollWorld(taskOver = {}, extraTasks = []) {
  const w = world();
  Object.assign(w.task(T1), { github_repo: "acme/web", github_repo_set_at: SET_AT, ...taskOver });
  for (const t of extraTasks) w.db.rows("tasks").push(t);
  w.db.seed("github_user_tokens", [{ user_id: ALICE, org_id: ORG, github_user_id: 100, github_login: "Alice-GH", token_enc: "enc", last_error: null }]);
  w.db.seed("github_poll_state", []);
  w.db.seed("github_events", []);
  const gh = { calls: [], branches: [{ name: "main", commit: { sha: "h1" } }], commits: {}, status: {} };
  const ghFetch = async (p) => {
    gh.calls.push(p);
    const key = Object.keys(gh.status).find((k) => p.startsWith(k));
    if (key) return { status: gh.status[key], json: null };
    if (p.startsWith("/repos/acme/web/branches?")) return { status: 200, json: gh.branches };
    const one = p.match(/^\/repos\/acme\/web\/branches\/([^?]+)/);
    if (one) { const b = gh.branches.find((x) => x.name === decodeURIComponent(one[1])); return b ? { status: 200, json: b } : { status: 404, json: null }; }
    const cm = p.match(/^\/repos\/acme\/web\/commits\?sha=([^&]+)/);
    if (cm) return { status: 200, json: gh.commits[decodeURIComponent(cm[1])] || [] };
    return { status: 404, json: null };
  };
  const decrypt = async () => "ghp_token";
  const hooks = { ...w.hooks, now: () => new Date(NOW) };
  const poll = (o) => pollGithubTasks(w.db, hooks, ghFetch, decrypt, o);
  return { ...w, gh, poll };
}
const ghCommit = (sha, login, message = "work") => ({ sha, html_url: `https://github.com/acme/web/commit/${sha}`, commit: { message }, author: login ? { login } : null });

test("token encryption round-trips and rejects tampering and bad keys", async () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const blob = await encryptToken(key, "ghp_secret_value");
  assert.ok(!blob.includes("ghp_secret_value"));
  assert.equal(await decryptToken(key, blob), "ghp_secret_value");
  assert.notEqual(blob, await encryptToken(key, "ghp_secret_value"), "fresh IV each time");
  await assert.rejects(decryptToken(Buffer.alloc(32, 8).toString("base64"), blob));
  await assert.rejects(decryptToken(key, blob.slice(0, -4) + "AAAA"));
  await assert.rejects(encryptToken("short", "x"));
});

test("polling: a new commit by the assignee in the task's repository submits the task (no app, no reference)", async () => {
  const p = pollWorld();
  p.gh.commits.main = [ghCommit("c3", "alice-gh", "make layout responsive"), ghCommit("c2", "someone-else")];
  const s = await p.poll();
  assert.equal(s.submitted, 1);
  assert.equal(p.task(T1).status, "submitted");
  assert.equal(p.task(T1).kanban_column, "done");
  assert.match(p.task(T1).submission_notes, /Submitted automatically from GitHub/);
  const kinds = p.db.rows("task_github_links").map((l) => `${l.kind}:${l.ref}`).sort();
  assert.deepEqual(kinds, ["branch:main", "commit:c3"], "only the assignee's own commit is linked");
  assert.equal(p.calls.notify.length, 1);
  assert.equal(p.db.rows("github_poll_state")[0].head_sha, "h1");
  assert.equal(p.db.rows("github_user_tokens")[0].last_error, null);
});

test("polling: someone else's commits, or no change, do nothing; a second poll never repeats", async () => {
  const p = pollWorld();
  p.gh.commits.main = [ghCommit("c9", "stranger"), ghCommit("c8", null)];
  assert.equal((await p.poll()).submitted, 0);
  assert.equal(p.task(T1).status, "in_progress");
  p.gh.commits.main = [ghCommit("c3", "alice-gh")];
  assert.equal((await p.poll()).submitted, 0, "head unchanged since the last poll: nothing fetched or counted");
  p.gh.branches[0].commit.sha = "h2";
  const s = await p.poll();
  assert.equal(s.submitted, 1);
  assert.equal((await p.poll()).submitted, 0);
  assert.equal(p.calls.notify.length, 1);
});

test("polling: a repository first seen without a start time is only snapshotted; later commits count", async () => {
  const p = pollWorld({ github_repo_set_at: null });
  p.gh.commits.main = [ghCommit("old", "alice-gh")];
  assert.equal((await p.poll()).submitted, 0);
  assert.equal(p.db.rows("github_poll_state")[0].head_sha, "h1");
  p.gh.branches[0].commit.sha = "h2";
  p.gh.commits.main = [ghCommit("new1", "alice-gh"), ghCommit("h1", "alice-gh")];
  assert.equal((await p.poll()).submitted, 1);
  assert.deepEqual(p.db.rows("task_github_links").filter((l) => l.kind === "commit").map((l) => l.ref), ["new1"], "stops at the previously seen head");
});

test("polling honours the task's branch and ignores other branches", async () => {
  const p = pollWorld({ github_branch: "naveena/features/responsive" });
  p.gh.branches = [{ name: "main", commit: { sha: "m1" } }, { name: "naveena/features/responsive", commit: { sha: "r1" } }];
  p.gh.commits.main = [ghCommit("onmain", "alice-gh")];
  p.gh.commits["naveena/features/responsive"] = [];
  assert.equal((await p.poll()).submitted, 0);
  p.gh.branches[1].commit.sha = "r2";
  p.gh.commits["naveena/features/responsive"] = [ghCommit("onbranch", "alice-gh")];
  assert.equal((await p.poll()).submitted, 1);
  assert.ok(p.gh.calls.every((c) => !c.includes("sha=main")), "main is never read when the task names a branch");
});

test("polling: several In Progress tasks on the same repo/branch are ambiguous and left alone", async () => {
  const p = pollWorld({}, [{ id: "6b6b6b6b-0000-4000-8000-000000000006", org_id: ORG, title: "Second", status: "in_progress", kanban_column: "in_progress", assignee_id: ALICE, github_repo: "acme/web", github_repo_set_at: SET_AT, task_assignees: [{ profile_id: ALICE }] }]);
  p.gh.commits.main = [ghCommit("c3", "alice-gh")];
  const s = await p.poll();
  assert.equal(s.submitted, 0);
  assert.ok(s.notes.some((n) => /put a TF- reference/.test(n)));
  assert.equal(p.task(T1).status, "in_progress");
});

test("polling only touches tasks the token owner is assigned to, In Progress, in their organization", async () => {
  const p = pollWorld({ assignee_id: BOB, task_assignees: [{ profile_id: BOB }] });
  p.gh.commits.main = [ghCommit("c3", "alice-gh")];
  assert.equal((await p.poll()).submitted, 0, "alice is not an assignee");
  const q = pollWorld({ status: "pending", kanban_column: "to_do" });
  q.gh.commits.main = [ghCommit("c3", "alice-gh")];
  assert.equal((await q.poll()).submitted, 0, "not In Progress");
  const o = pollWorld();
  o.db.rows("github_user_tokens")[0].org_id = OTHER_ORG;
  o.gh.commits.main = [ghCommit("c3", "alice-gh")];
  assert.equal((await o.poll()).submitted, 0, "token belongs to another organization");
});

test("polling dedupes with the webhook path: commits already linked do not submit again", async () => {
  const p = pollWorld();
  p.db.rows("task_github_links").push({ id: "x", org_id: ORG, task_id: T1, kind: "commit", repo_full_name: "acme/web", ref: "c3", source: "auto" });
  p.gh.commits.main = [ghCommit("c3", "alice-gh")];
  const s = await p.poll();
  assert.equal(s.submitted, 0);
  assert.equal(p.task(T1).status, "in_progress");
});

test("polling records token and access problems per user without failing the run", async () => {
  const bad = pollWorld();
  bad.gh.status["/repos/acme/web/branches?"] = 401;
  const s = await bad.poll();
  assert.equal(s.submitted, 0);
  assert.match(bad.db.rows("github_user_tokens")[0].last_error, /rejected the saved token/);
  const noAccess = pollWorld();
  noAccess.gh.status["/repos/acme/web/branches?"] = 404;
  await noAccess.poll();
  assert.match(noAccess.db.rows("github_user_tokens")[0].last_error, /No access to acme\/web/);
  const ok = pollWorld();
  await ok.poll();
  assert.equal(ok.db.rows("github_user_tokens")[0].last_error, null);
  assert.ok(ok.db.rows("github_user_tokens")[0].last_checked_at);
});
