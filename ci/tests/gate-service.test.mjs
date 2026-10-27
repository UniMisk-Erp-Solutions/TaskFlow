// The push-triggered gate: webhook authentication / de-duplication / debounce, independent build verification,
// pipeline pinning, signing, status reporting, retry and changed-commit behaviour. No network, no Jenkins:
// fakes stand in for Jenkins and GitHub. Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { evaluateAttestation } from "../lib/attestation.mjs";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { buildStatusBody, publishStatus } from "../lib/github-status.mjs";
import { MAX_BODY_BYTES, createDebouncer, createRateLimiter, handleDelivery, sign, verifySignature } from "../gate-service/webhook.mjs";
import { PINNED_PATHS, evaluateBuild } from "../gate-service/evaluate.mjs";
import { createGate, createPublisher } from "../gate-service/gate.mjs";
import { createGitSource } from "../gate-service/git-source.mjs";
import { createJenkinsClient } from "../gate-service/jenkins.mjs";
import { createServers } from "../gate-service/server.mjs";
import { createState } from "../gate-service/state.mjs";

const SECRET = "ci-gate-test-secret";
const REPO = "UniMisk-Erp-Solutions/TaskFlow";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA1 = "1".repeat(40), SHA2 = "2".repeat(40), SHA3 = "3".repeat(40);
const delivery = (event, payload, { n = 1, secret = SECRET, extra = {} } = {}) => {
  const raw = Buffer.from(JSON.stringify(payload));
  return { raw, headers: { "x-github-event": event, "x-github-delivery": uuid(n), "x-hub-signature-256": sign(secret, raw), ...extra } };
};
const mk = (d, seenSet = new Set()) => handleDelivery({ ...d, secret: SECRET, allowedRepos: [REPO], seen: (id) => (seenSet.has(id) ? true : (seenSet.add(id), false)) });
const push = (over = {}) => ({ ref: "refs/heads/feature/x", after: SHA1, repository: { full_name: REPO }, ...over });

// ── webhook authentication and filtering ──────────────────────────────────────
test("valid signed push is accepted and asks for ONE scan; the payload never decides what is built", () => {
  const r = mk(delivery("push", push()));
  assert.equal(r.code, 202);
  assert.equal(r.scan, true);
});

test("WEBHOOK AUTH: missing, wrong-secret, tampered-body and malformed signatures are rejected with 401", () => {
  const good = delivery("push", push());
  assert.equal(mk({ raw: good.raw, headers: { ...good.headers, "x-hub-signature-256": undefined } }).code, 401);
  assert.equal(mk({ raw: good.raw, headers: { ...good.headers, "x-hub-signature-256": "sha256=" + "0".repeat(64) } }).code, 401);
  assert.equal(mk(delivery("push", push(), { secret: "not-the-secret" })).code, 401);
  assert.equal(mk({ raw: Buffer.concat([good.raw, Buffer.from(" ")]), headers: good.headers }).code, 401);
  assert.equal(mk({ raw: good.raw, headers: { ...good.headers, "x-hub-signature-256": "md5=abc" } }).code, 401);
  assert.equal(verifySignature("", good.raw, good.headers["x-hub-signature-256"]), false); // unconfigured secret never validates
});

test("an unauthenticated request learns nothing and triggers nothing", () => {
  const r = mk({ raw: Buffer.from("{}"), headers: {} });
  assert.deepEqual([r.code, r.scan], [401, false]);
});

test("filters: ping, other repositories, deletions, tags, non-actionable PR actions, FORK pull requests, unknown events", () => {
  assert.deepEqual(mk(delivery("ping", { zen: "x" }, { n: 2 })).body, { ok: true, pong: true });
  assert.match(mk(delivery("push", push({ repository: { full_name: "evil/other" } }), { n: 3 })).body.ignored, /not allowed/);
  assert.match(mk(delivery("push", push({ deleted: true }), { n: 4 })).body.ignored, /deletion/);
  assert.match(mk(delivery("push", push({ ref: "refs/tags/v1" }), { n: 5 })).body.ignored, /not a branch/);
  const pr = (action, headRepo) => ({ action, number: 7, repository: { full_name: REPO }, pull_request: { head: { sha: SHA2, repo: { full_name: headRepo } } } });
  assert.equal(mk(delivery("pull_request", pr("synchronize", REPO), { n: 6 })).scan, true);
  assert.equal(mk(delivery("pull_request", pr("opened", REPO), { n: 7 })).scan, true);
  assert.equal(mk(delivery("pull_request", pr("closed", REPO), { n: 8 })).scan, false);
  const fork = mk(delivery("pull_request", pr("synchronize", "stranger/TaskFlow"), { n: 9 }));
  assert.equal(fork.scan, false);
  assert.match(fork.body.ignored, /fork/);
  assert.match(mk(delivery("issues", { action: "opened" }, { n: 10 })).body.ignored, /event issues/);
});

test("DUPLICATE events: the same delivery id is processed once; a redelivery is acknowledged without a second scan", () => {
  const seen = new Set();
  const d = delivery("push", push(), { n: 11 });
  const a = mk(d, seen), b = mk(d, seen);
  assert.deepEqual([a.scan, b.scan, b.code, b.body.duplicate], [true, false, 200, uuid(11)]);
});

test("bad input: oversized, non-JSON and malformed delivery ids", () => {
  assert.equal(handleDelivery({ headers: {}, raw: Buffer.alloc(MAX_BODY_BYTES + 1), secret: SECRET, allowedRepos: [REPO], seen: () => false }).code, 413);
  const notJson = Buffer.from("not json");
  assert.equal(mk({ raw: notJson, headers: { "x-github-event": "push", "x-github-delivery": uuid(12), "x-hub-signature-256": sign(SECRET, notJson) } }).code, 400);
  assert.equal(mk(delivery("push", push(), { extra: { "x-github-delivery": "../../etc/passwd" } })).code, 400);
});

test("debouncer coalesces a burst of events into a single scan; rate limiter caps a flood", async () => {
  let calls = [];
  const timers = [];
  const d = createDebouncer(async (n) => calls.push(n), 5000, { setTimeoutImpl: (fn) => { timers.push(fn); return timers.length; }, clearTimeoutImpl: () => {} });
  d.request(); d.request(); d.request();
  assert.equal(timers.length, 1);
  await timers[0]();
  assert.deepEqual(calls, [3]);
  d.request(); assert.equal(timers.length, 2); // a later burst schedules a new scan
  let t = 0; const lim = createRateLimiter(3, () => t);
  assert.deepEqual([lim(), lim(), lim(), lim()], [true, true, true, false]);
  t = 61_000; assert.equal(lim(), true);
});

// ── independent verification of a build ───────────────────────────────────────
const PIN = Object.fromEntries(PINNED_PATHS.map((p) => [p, `pin-${p}`]));
const gitFor = (tree, pinned = PIN) => ({ tree, pinned });
const passAll = (sha, tree) => Object.fromEntries(REQUIRED_CHECKS.map((n) => [n, { status: "PASS", commit: sha, tree, durationMs: 5 }]));

test("evaluateBuild: PASS only when every stage is PASS for THIS commit and tree and the pipeline matches the pin", () => {
  assert.equal(evaluateBuild({ sha: SHA1, git: gitFor("T1"), results: passAll(SHA1, "T1"), required: REQUIRED_CHECKS, pin: PIN }).verdict, "passed");
});

test("evaluateBuild: FAIL / MISSING / STALE stage results block; a lying tree is detected", () => {
  const base = passAll(SHA1, "T1");
  const run = (results) => evaluateBuild({ sha: SHA1, git: gitFor("T1"), results, required: REQUIRED_CHECKS, pin: PIN });
  assert.match(run({ ...base, lint: { ...base.lint, status: "FAIL" } }).reasons[0], /lint=FAIL/);
  const { e2e, ...noE2e } = base; void e2e;
  assert.match(run(noE2e).reasons[0], /e2e=MISSING/);
  assert.match(run({ ...base, build: { ...base.build, tree: "OTHER" } }).reasons[0], /build=STALE/);
  assert.match(run({ ...base, build: { ...base.build, commit: SHA2 } }).reasons[0], /build=STALE/);
  assert.equal(evaluateBuild({ sha: SHA1, git: null, results: base, required: REQUIRED_CHECKS, pin: PIN }).verdict, "error");
});

test("PIPELINE PIN: a branch that changes the Jenkinsfile or ci scripts can never be signed, whatever its results claim", () => {
  for (const p of PINNED_PATHS) {
    const r = evaluateBuild({ sha: SHA1, git: gitFor("T1", { ...PIN, [p]: "different" }), results: passAll(SHA1, "T1"), required: REQUIRED_CHECKS, pin: PIN });
    assert.equal(r.verdict, "pipeline-changed", p);
    assert.match(r.reasons[0], new RegExp(p.replace("/", "\\/")));
  }
  assert.equal(evaluateBuild({ sha: SHA1, git: gitFor("T1", { ...PIN, "ci/lib": null }), results: passAll(SHA1, "T1"), required: REQUIRED_CHECKS, pin: PIN }).verdict, "pipeline-changed"); // deleted
});

// ── the gate over fake Jenkins / Git / GitHub ─────────────────────────────────
function harness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const world = { builds: [], artifacts: {}, trees: { [SHA1]: "T1", [SHA2]: "T2", [SHA3]: "T3" }, pinned: { ...PIN }, published: [], failPublish: false, refreshes: 0 };
  const jenkins = {
    listBuilds: async () => world.builds.map((b) => ({ ...b })),
    artifactJson: async (p, rel) => world.artifacts[`${p}|${rel.replace(".ci/results/", "").replace(".json", "")}`] ?? null,
  };
  const git = { refresh: async () => { world.refreshes += 1; }, inspect: async (sha) => (world.trees[sha] ? { tree: world.trees[sha], pinned: world.pinned } : null) };
  const state = createState(path.join(dir, "state.json"));
  const publish = async (s) => { if (world.failPublish) throw new Error("GitHub down"); world.published.push(s); };
  const gate = createGate({ cfg: { repo: REPO }, jenkins, git, state, publish, required: REQUIRED_CHECKS, pin: PIN, privateKeyPem, attestDir: path.join(dir, "att"), log: () => {} });
  const addBuild = (b, results) => { world.builds.push(b); if (results) for (const [n, r] of Object.entries(results)) world.artifacts[`${b.path}|${n}`] = r; };
  return { dir, world, gate, state, publicKeyPem, addBuild };
}
const build = (n, sha, over = {}) => ({ job: "feature/x", number: n, building: false, result: "SUCCESS", timestamp: n * 1000, path: `/job/f/job/x/${n}/`, sha, ...over });

test("GATE: running build shows pending once; finished green build is signed, verifies, and publishes SUCCESS for that exact SHA", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1, { building: true, result: null }));
  await h.gate.tick(); await h.gate.tick();
  assert.deepEqual(h.world.published.map((p) => [p.sha, p.state]), [[SHA1, "pending"]]); // no duplicate pending
  h.world.builds = [];
  h.addBuild(build(1, SHA1), passAll(SHA1, "T1"));
  await h.gate.tick();
  assert.deepEqual(h.world.published.at(-1).state, "success");
  assert.equal(h.world.published.at(-1).sha, SHA1);
  const att = JSON.parse(fs.readFileSync(path.join(h.dir, "att", `${SHA1}.json`), "utf8"));
  assert.equal(evaluateAttestation(att, { commit: SHA1, tree: "T1", publicKeyPem: h.publicKeyPem, required: REQUIRED_CHECKS }).ok, true);
  const before = h.world.published.length;
  await h.gate.tick(); await h.gate.tick();
  assert.equal(h.world.published.length, before, "a finished build is verified exactly once");
});

test("GATE: a failing stage publishes FAILURE naming the stage and writes NO attestation", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1, { result: "FAILURE" }), { ...passAll(SHA1, "T1"), "unit-tests": { status: "FAIL", commit: SHA1, tree: "T1" } });
  await h.gate.tick();
  const last = h.world.published.at(-1);
  assert.equal(last.state, "failure");
  assert.match(last.description, /unit-tests=FAIL/);
  assert.equal(fs.existsSync(path.join(h.dir, "att", `${SHA1}.json`)), false);
});

test("GATE: a green Jenkins build whose results were produced for different code is not trusted", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1), passAll(SHA1, "SOME-OTHER-TREE"));
  await h.gate.tick();
  assert.equal(h.world.published.at(-1).state, "failure");
  assert.match(h.world.published.at(-1).description, /STALE/);
});

test("GATE: RETRY after a fix — failed build then a green rebuild of the same commit ends with SUCCESS", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1, { result: "FAILURE" }), { ...passAll(SHA1, "T1"), lint: { status: "FAIL", commit: SHA1, tree: "T1" } });
  await h.gate.tick();
  assert.equal(h.world.published.at(-1).state, "failure");
  h.addBuild(build(2, SHA1), passAll(SHA1, "T1"));
  await h.gate.tick();
  assert.equal(h.world.published.at(-1).state, "success");
});

test("GATE: CHANGED COMMIT — a new push (new SHA) is verified independently; the old SHA's status is untouched", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1), passAll(SHA1, "T1"));
  await h.gate.tick();
  h.addBuild(build(2, SHA2, { result: "FAILURE" }), { ...passAll(SHA2, "T2"), e2e: { status: "FAIL", commit: SHA2, tree: "T2" } });
  await h.gate.tick();
  const bySha = Object.fromEntries(h.world.published.map((p) => [p.sha, p.state]));
  assert.deepEqual(bySha, { [SHA1]: "success", [SHA2]: "failure" });
  assert.equal(fs.existsSync(path.join(h.dir, "att", `${SHA2}.json`)), false);
});

test("GATE: DUPLICATE builds of one commit do not produce duplicate statuses; an older green build cannot overwrite a newer fact", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1), passAll(SHA1, "T1"));
  h.addBuild(build(2, SHA1), passAll(SHA1, "T1"));
  await h.gate.tick();
  assert.equal(h.world.published.filter((p) => p.sha === SHA1 && p.state === "success").length, 1);
});

test("GATE: aborted build before any result -> ERROR status; pipeline change -> FAILURE with the reason and no attestation", async () => {
  const h = harness();
  h.addBuild(build(1, SHA1, { result: "ABORTED" }), null);
  await h.gate.tick();
  assert.equal(h.world.published.at(-1).state, "error");
  h.world.pinned = { ...PIN, Jenkinsfile: "tampered" };
  h.addBuild(build(2, SHA2), passAll(SHA2, "T2"));
  await h.gate.tick();
  const last = h.world.published.at(-1);
  assert.deepEqual([last.sha, last.state], [SHA2, "failure"]);
  assert.match(last.description, /pinned version: Jenkinsfile/);
  assert.equal(fs.existsSync(path.join(h.dir, "att", `${SHA2}.json`)), false);
});

test("GATE: if GitHub is down the status is retried on a later tick instead of being lost", async () => {
  const h = harness();
  h.world.failPublish = true;
  h.addBuild(build(1, SHA1), passAll(SHA1, "T1"));
  await h.gate.tick();
  assert.equal(h.world.published.length, 0);
  h.world.failPublish = false;
  await h.gate.tick();
  assert.equal(h.world.published.at(-1)?.state, "success");
});

// ── real HTTP: the public listener only exposes /github and /healthz ─────────
const listen = (srv) => new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv.address().port)));
const post = (port, d, p = "/github") => new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, path: p, method: "POST", headers: { ...d.headers, "content-length": d.raw.length } }, (res) => { let s = ""; res.on("data", (c) => (s += c)); res.on("end", () => resolve({ code: res.statusCode, body: s ? JSON.parse(s) : null })); });
  req.on("error", reject); req.end(d.raw);
});
const get = (port, p) => new Promise((resolve, reject) => http.get({ host: "127.0.0.1", port, path: p }, (res) => { let s = ""; res.on("data", (c) => (s += c)); res.on("end", () => resolve({ code: res.statusCode, body: s })); }).on("error", reject));

test("HTTP: three events for one push cause exactly one Jenkins scan; forged and replayed deliveries are refused", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-http-"));
  const scans = [];
  const jenkins = { triggerScan: async () => { scans.push(Date.now()); } };
  const { publicServer, adminServer, stats } = createServers({ cfg: { allowedRepos: [REPO], debounceMs: 80, maxRequestsPerMinute: 100 }, secret: SECRET, state: createState(path.join(dir, "s.json")), jenkins, attestDir: dir, log: () => {} });
  const pp = await listen(publicServer), ap = await listen(adminServer);
  try {
    const prPayload = { action: "synchronize", number: 3, repository: { full_name: REPO }, pull_request: { head: { sha: SHA1, repo: { full_name: REPO } } } };
    const r1 = await post(pp, delivery("push", push(), { n: 21 }));
    const r2 = await post(pp, delivery("pull_request", prPayload, { n: 22 }));
    const r3 = await post(pp, delivery("push", push(), { n: 21 })); // replay of delivery 21
    assert.deepEqual([r1.code, r2.code, r3.code, r3.body.duplicate], [202, 202, 200, uuid(21)]);
    assert.equal((await post(pp, delivery("push", push(), { n: 23, secret: "wrong" }))).code, 401);
    assert.equal((await post(pp, { raw: Buffer.from("{}"), headers: {} })).code, 401);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(scans.length, 1, "burst of events -> one scan");
    assert.equal(stats.duplicates, 1);
    // exposure: the public port serves nothing but /github and /healthz
    assert.equal((await get(pp, "/healthz")).code, 200);
    for (const p of ["/status", `/attestation/${SHA1}`, "/", "/job/taskflow/", "/api/json"]) assert.equal((await get(pp, p)).code, 404, p);
    assert.equal((await get(ap, "/status")).code, 200);
    assert.equal((await get(ap, `/attestation/${SHA1}`)).code, 404);
  } finally { publicServer.close(); adminServer.close(); }
});

// ── state, git facts, GitHub statuses, Jenkins client ─────────────────────────
test("state: delivery ids survive a restart (replays after a restart are still duplicates)", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gate-state-")), "s.json");
  assert.equal(createState(f).seenDelivery("a"), false);
  assert.equal(createState(f).seenDelivery("a"), true);
});

test("git source: tree and pinned-path hashes come from Git and change when pipeline files change", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-git-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@example.test"); g("config", "user.name", "t");
  for (const p of PINNED_PATHS) { const f = path.join(dir, p === "Jenkinsfile" ? p : `${p}/f.txt`); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, p); }
  fs.writeFileSync(path.join(dir, "app.js"), "1"); g("add", "-A"); g("commit", "-qm", "one"); const one = g("rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "app.js"), "2"); g("commit", "-qam", "app only"); const two = g("rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "ci/lib/f.txt"), "evil"); g("commit", "-qam", "touch pipeline"); const three = g("rev-parse", "HEAD");
  const src = createGitSource({ mirrorDir: path.join(dir, "..", path.basename(dir) + "-mirror.git"), sourceUrl: dir });
  await src.refresh();
  const a = await src.inspect(one), b = await src.inspect(two), c = await src.inspect(three);
  assert.notEqual(a.tree, b.tree);
  assert.deepEqual(a.pinned, b.pinned, "app-only change keeps the pipeline pin");
  assert.notEqual(b.pinned["ci/lib"], c.pinned["ci/lib"], "pipeline change is visible");
  assert.equal(await src.inspect("f".repeat(40)), null);
  assert.equal(await src.inspect("not-a-sha"), null);
});

test("GitHub status: only valid states, 140-char description, https-only link, SHA required, token never required to be logged", async () => {
  assert.throws(() => buildStatusBody({ state: "great" }), /invalid status state/);
  assert.equal(buildStatusBody({ state: "success", description: "x".repeat(300) }).description.length, 140);
  assert.equal(buildStatusBody({ state: "success", targetUrl: "http://127.0.0.1:8088/" }).target_url, undefined);
  assert.equal((await publishStatus({ repo: REPO, sha: SHA1, state: "success", token: "" })).skipped, true);
  await assert.rejects(() => publishStatus({ repo: REPO, sha: "abc", state: "success", token: "t" }), /40-character/);
  let seen;
  const r = await publishStatus({ repo: REPO, sha: SHA1, state: "failure", description: "lint=FAIL", token: "tok", fetchImpl: async (url, init) => { seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization }; return { ok: true }; } });
  assert.equal(r.ok, true);
  assert.equal(seen.url, `https://api.github.com/repos/${REPO}/statuses/${SHA1}`);
  assert.deepEqual([seen.body.state, seen.body.context], ["failure", "unimisk/verified"]);
  await assert.rejects(() => publishStatus({ repo: REPO, sha: SHA1, state: "success", token: "t", fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: "Resource not accessible" }) }) }), /403/);
});

test("record mode never contacts GitHub", async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gate-rec-")), "s.jsonl");
  const pub = createPublisher({ mode: "record", repo: REPO, recordFile: f, fetchImpl: async () => { throw new Error("network used"); } });
  await pub({ sha: SHA1, state: "success", description: "d" });
  assert.equal(JSON.parse(fs.readFileSync(f, "utf8")).state, "success");
});

test("Jenkins client: parses builds with the checked-out commit, keeps only paths, handles crumb + scan", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([init.method || "GET", url]);
    if (url.endsWith("/crumbIssuer/api/json")) return { ok: true, json: async () => ({ crumbRequestField: "Jenkins-Crumb", crumb: "abc" }), headers: { get: () => "JSESSIONID=1; Path=/" } };
    if (url.includes("/api/json?tree=")) return { ok: true, json: async () => ({ jobs: [{ name: "feature%2Fx", builds: [{ number: 4, url: "http://127.0.0.1:8088/job/f/job/feature%252Fx/4/", building: false, result: "SUCCESS", timestamp: 9, actions: [{}, { lastBuiltRevision: { SHA1: SHA1 } }] }] }] }) };
    if (url.endsWith("/build?delay=0")) return { status: 302 };
    if (url.includes("/artifact/")) return { ok: true, json: async () => ({ status: "PASS" }) };
    return { ok: false, status: 404 };
  };
  const j = createJenkinsClient({ baseUrl: "http://taskflow-jenkins:8080/", user: "gate", password: "pw", folder: "taskflow-local", fetchImpl });
  const [b] = await j.listBuilds();
  assert.deepEqual([b.job, b.number, b.sha, b.path], ["feature/x", 4, SHA1, "/job/f/job/feature%252Fx/4/"]);
  await j.triggerScan();
  assert.ok(calls.some(([m, u]) => m === "POST" && u === "http://taskflow-jenkins:8080/job/taskflow-local/build?delay=0"));
  assert.deepEqual(await j.artifactJson(b.path, ".ci/results/lint.json"), { status: "PASS" });
});
