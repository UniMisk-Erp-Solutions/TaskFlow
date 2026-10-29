// One Jenkins and one gate must serve several projects without ever mixing them up: separate webhook secrets, state,
// attestations and statuses, and a project with no baked-in pin is judged against the tip of ITS OWN main.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PINNED_PATHS } from "../gate-service/evaluate.mjs";
import { createGate } from "../gate-service/gate.mjs";
import { createServers } from "../gate-service/server.mjs";
import { createState } from "../gate-service/state.mjs";
import { legacyRegistry, parseRegistry } from "../gate-service/projects.mjs";
import { sign } from "../gate-service/webhook.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "multi-"));
const sha = (c) => c.repeat(40);
const TK = sha("c");

const REG = { defaultProject: "alpha", admins: ["boss"], projects: [
  { id: "alpha", repo: "Org/Alpha", jenkinsFolder: "alpha", developers: [{ user: "ann", prefixes: ["ann"] }] },
  { id: "beta", repo: "Org/Beta", jenkinsFolder: "beta", requiredChecks: ["lint", "build"], developers: [{ user: "bob", prefixes: ["bob", "robert"] }] },
] };

test("REGISTRY: a valid registry parses; every kind of mistake is refused", () => {
  const r = parseRegistry(REG);
  assert.equal(r.projects.length, 2);
  assert.equal(r.defaultProject, "alpha");
  const bad = (mut, re) => { const j = JSON.parse(JSON.stringify(REG)); mut(j); assert.throws(() => parseRegistry(j), re); };
  bad((j) => { j.projects[1].id = "alpha"; }, /duplicate id/);
  bad((j) => { j.projects[1].repo = "org/alpha"; }, /duplicate repo/);
  bad((j) => { j.projects[1].jenkinsFolder = "alpha"; }, /duplicate folder/);
  bad((j) => { delete j.projects[1].requiredChecks; }, /requiredChecks is required/);
  bad((j) => { j.projects[0].developers[0].prefixes = ["a.*"]; }, /prefixes must be/);
  bad((j) => { j.projects[0].developers.push({ user: "ann", prefixes: ["x"] }); }, /listed twice/);
  bad((j) => { j.projects[0].developers.push({ user: "boss", prefixes: ["b"] }); }, /admin cannot also be/);
  bad((j) => { j.projects[0].centralJenkinsfile = "../../etc/passwd"; }, /plain relative path/);
  bad((j) => { j.defaultProject = "nope"; }, /not in the list/);
  assert.equal(legacyRegistry({ GATE_REPO: "o/r", GATE_JENKINS_FOLDER: "taskflow" }).projects[0].id, "taskflow");
  const real = parseRegistry(JSON.parse(fs.readFileSync(path.join(HERE, "..", "projects.json"), "utf8")));
  assert.equal(real.defaultProject, "taskflow");
});

// ── a second project's gate ──────────────────────────────────────────────────
function betaGate({ branchPinned, mainPinned, results }) {
  const dir = tmp();
  const { privateKey } = generateKeyPairSync("ed25519");
  const published = [];
  const build = { job: "bob/x", number: 1, building: false, result: "SUCCESS", timestamp: 1, path: "/job/beta/job/bob/1/", sha: sha("a"), folder: "beta" };
  const jenkins = {
    listBuilds: async () => [build],
    artifactJson: async (p, rel) => (rel === ".ci/toolkit.json" ? { toolkitCommit: TK } : results[rel.replace(".ci/results/", "").replace(".json", "")] ?? null),
  };
  const git = {
    refresh: async () => {},
    inspectRef: async () => (mainPinned ? { tree: "MT", pinned: mainPinned } : null),
    inspect: async (s) => (s === TK ? { tree: "TKT", pinned: mainPinned || branchPinned } : { tree: "T1", pinned: branchPinned }),
  };
  const gate = createGate({ cfg: { repo: "Org/Beta", dashboardUrl: "" }, jenkins, git, state: createState(path.join(dir, "s.json")), publish: async (s) => { published.push(s); }, required: ["lint", "build"], pin: null, privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), attestDir: path.join(dir, "att"), log: () => {} });
  return { gate, published, dir };
}
const pins = (v) => Object.fromEntries(PINNED_PATHS.map((p) => [p, `${v}-${p}`]));
const pass = { lint: { status: "PASS", commit: sha("a"), tree: "T1" }, build: { status: "PASS", commit: sha("a"), tree: "T1" } };

test("SECOND PROJECT: with no baked-in pin, a pipeline equal to the tip of its main is signed; a different one is refused", async () => {
  const ok = betaGate({ branchPinned: pins("m"), mainPinned: pins("m"), results: pass });
  await ok.gate.tick();
  assert.equal(ok.published.at(-1).state, "success");
  assert.ok(fs.existsSync(path.join(ok.dir, "att", `${sha("a")}.json`)));

  const tampered = betaGate({ branchPinned: { ...pins("m"), Jenkinsfile: "evil" }, mainPinned: pins("m"), results: pass });
  await tampered.gate.tick();
  assert.equal(tampered.published.at(-1).state, "failure");
  assert.match(tampered.published.at(-1).description, /pipeline definition differs from the admin-pinned version: Jenkinsfile/);
  assert.equal(fs.existsSync(path.join(tampered.dir, "att", `${sha("a")}.json`)), false, "a tampered pipeline is never signed");
});

test("SECOND PROJECT: if its main cannot be read there is nothing to compare against, so nothing is signed", async () => {
  const none = betaGate({ branchPinned: pins("m"), mainPinned: null, results: pass });
  await none.gate.tick();
  assert.notEqual(none.published.at(-1).state, "success");
  assert.equal(fs.existsSync(path.join(none.dir, "att", `${sha("a")}.json`)), false);
});

test("SECOND PROJECT: only ITS required checks count (a missing one fails it, a TaskFlow-only stage name is irrelevant)", async () => {
  const missing = betaGate({ branchPinned: pins("m"), mainPinned: pins("m"), results: { lint: pass.lint } });
  await missing.gate.tick();
  assert.equal(missing.published.at(-1).state, "failure");
  assert.match(missing.published.at(-1).description, /build=MISSING/);
});

// ── webhook routing ──────────────────────────────────────────────────────────
const payload = (repo) => Buffer.from(JSON.stringify({ ref: "refs/heads/x", after: sha("b"), repository: { full_name: repo } }));
const post = (server, pathname, body, secret, id = "11111111-1111-1111-1111-111111111111") => new Promise((resolve) => {
  const req = http.request({ port: server.address().port, host: "127.0.0.1", path: pathname, method: "POST", headers: { "content-type": "application/json", "x-github-event": "push", "x-github-delivery": id, "x-hub-signature-256": sign(secret, body) } }, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ code: res.statusCode, body: d })); });
  req.end(body);
});
const listen = (srv) => new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));

test("WEBHOOKS: each project has its own endpoint, secret and allowed repository; nothing leaks across", async () => {
  const dir = tmp();
  const scans = { alpha: 0, beta: 0 };
  const mk = (id, repo, secret) => ({ id, secret, allowedRepos: [repo], state: createState(path.join(dir, `${id}.json`)), jenkins: { triggerScan: async () => { scans[id] += 1; } }, attestDir: path.join(dir, id) });
  const { publicServer, adminServer } = createServers({ cfg: { debounceMs: 20, maxRequestsPerMinute: 100 }, projects: [mk("alpha", "Org/Alpha", "sa"), mk("beta", "Org/Beta", "sb")], log: () => {} });
  await listen(publicServer); await listen(adminServer);
  try {
    assert.equal((await post(publicServer, "/github", payload("Org/Alpha"), "sa", "aaaaaaaa-1111-1111-1111-111111111111")).code, 202);
    assert.equal((await post(publicServer, "/github/alpha", payload("Org/Alpha"), "sa", "aaaaaaaa-2222-1111-1111-111111111111")).code, 202);
    assert.equal((await post(publicServer, "/github/beta", payload("Org/Beta"), "sb", "bbbbbbbb-1111-1111-1111-111111111111")).code, 202);
    assert.equal((await post(publicServer, "/github/beta", payload("Org/Beta"), "sa", "bbbbbbbb-2222-1111-1111-111111111111")).code, 401, "alpha's secret does not open beta's endpoint");
    assert.equal((await post(publicServer, "/github", payload("Org/Alpha"), "sb", "aaaaaaaa-3333-1111-1111-111111111111")).code, 401, "beta's secret does not open alpha's endpoint");
    const wrongRepo = await post(publicServer, "/github/beta", payload("Org/Alpha"), "sb", "bbbbbbbb-3333-1111-1111-111111111111");
    assert.match(wrongRepo.body, /repository not allowed/);
    assert.equal((await post(publicServer, "/github/nobody", payload("Org/Beta"), "sb")).code, 404);
    await new Promise((r) => setTimeout(r, 120));
    assert.deepEqual(scans, { alpha: 1, beta: 1 }, "each project scans only its own Jenkins folder, bursts coalesced");
    const status = await new Promise((r) => http.get({ port: adminServer.address().port, host: "127.0.0.1", path: "/status" }, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => r(JSON.parse(d))); }));
    assert.deepEqual(Object.keys(status.projects).sort(), ["alpha", "beta"]);
  } finally { publicServer.close(); adminServer.close(); }
});

// ── the real entry point, with two projects ──────────────────────────────────
test("MAIN: the gate process starts with a registry of two projects and routes each webhook to its own Jenkins folder", async () => {
  const dir = tmp();
  const calls = [];
  const jenkins = await listen(http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url.split("?")[0]}`);
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/crumbIssuer")) return res.end(JSON.stringify({ crumbRequestField: "Jenkins-Crumb", crumb: "c" }));
    if (req.method === "POST") { res.statusCode = 201; return res.end("{}"); }
    res.end(JSON.stringify({ jobs: [] }));
  }));
  const free = async () => { const s = await listen(http.createServer()); const p = s.address().port; await new Promise((r) => s.close(r)); return p; };
  const [pub, adm] = [await free(), await free()];
  const w = (rel, text) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  const { privateKey } = generateKeyPairSync("ed25519");
  const env = {
    PATH: process.env.PATH, GATE_PROJECTS_FILE: w("projects.json", JSON.stringify(REG)),
    GATE_ATTEST_KEY_FILE: w("key.pem", privateKey.export({ type: "pkcs8", format: "pem" })), GATE_JENKINS_PASSWORD_FILE: w("jp", "pw"),
    GATE_WEBHOOK_SECRET_FILE: w("ws", "sa"), GATE_PROJECT_SECRETS_DIR: path.join(dir, "ps"), GATE_JENKINS_URL: `http://127.0.0.1:${jenkins.address().port}`,
    GATE_STATE_DIR: path.join(dir, "state"), GATE_PUBLIC_PORT: String(pub), GATE_ADMIN_PORT: String(adm), GATE_LISTEN_HOST: "127.0.0.1",
    GATE_DEBOUNCE_MS: "30", GATE_WATCH_SECONDS: "0", GATE_TICK_SECONDS: "3600", GATE_SCAN_EVERY_SECONDS: "3600",
    ...Object.fromEntries(PINNED_PATHS.map((p) => [`GATE_PIN_${p.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`, "pin"])),
  };
  w("ps/beta/webhook-secret", "sb");
  const child = spawn(process.execPath, [path.join(HERE, "..", "gate-service", "main.mjs")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  try {
    for (let i = 0; i < 100 && !/public listener/.test(out); i++) await new Promise((r) => setTimeout(r, 50));
    assert.match(out, /projects: alpha=Org\/Alpha, beta=Org\/Beta/);
    const from = (p, repo, secret, id) => new Promise((resolve) => { const body = payload(repo); const req = http.request({ port: pub, host: "127.0.0.1", path: p, method: "POST", headers: { "x-github-event": "push", "x-github-delivery": id, "x-hub-signature-256": sign(secret, body) } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); }); req.end(body); });
    assert.equal(await from("/github", "Org/Alpha", "sa", "aaaaaaaa-9999-1111-1111-111111111111"), 202);
    assert.equal(await from("/github/beta", "Org/Beta", "sb", "bbbbbbbb-9999-1111-1111-111111111111"), 202);
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(calls.includes("POST /job/alpha/build"), `alpha scan missing: ${calls.join(", ")}`);
    assert.ok(calls.includes("POST /job/beta/build"), `beta scan missing: ${calls.join(", ")}`);
  } finally { child.kill(); jenkins.close(); }
});

test("MAIN: a second project without its webhook secret stops the gate from starting (no silent default)", async () => {
  const dir = tmp();
  const w = (rel, text) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  const { privateKey } = generateKeyPairSync("ed25519");
  const env = { PATH: process.env.PATH, GATE_PROJECTS_FILE: w("projects.json", JSON.stringify(REG)), GATE_ATTEST_KEY_FILE: w("key.pem", privateKey.export({ type: "pkcs8", format: "pem" })), GATE_JENKINS_PASSWORD_FILE: w("jp", "pw"), GATE_WEBHOOK_SECRET_FILE: w("ws", "sa"), GATE_PROJECT_SECRETS_DIR: path.join(dir, "ps"), GATE_JENKINS_URL: "http://127.0.0.1:1", GATE_STATE_DIR: path.join(dir, "state"), GATE_WATCH_SECONDS: "0", ...Object.fromEntries(PINNED_PATHS.map((p) => [`GATE_PIN_${p.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`, "pin"])) };
  const child = spawn(process.execPath, [path.join(HERE, "..", "gate-service", "main.mjs")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stderr.on("data", (d) => (out += d)); child.stdout.on("data", (d) => (out += d));
  const code = await new Promise((r) => child.on("exit", r));
  assert.equal(code, 1);
  assert.match(out, /beta webhook-secret/);
});

// ── the Jenkins configuration is generated from the registry ─────────────────
import { generateAll, renderGithubYaml, renderJenkinsYaml } from "../jenkins/generate.mjs";

test("GENERATOR: the committed Jenkins configuration is exactly what the registry produces (no drift)", () => {
  const res = generateAll({ write: false });
  assert.deepEqual(res.filter((r) => r.changed), [], "run: node ci/jenkins/generate.mjs");
});

test("GENERATOR: a second project gets its own job, folder role, branch roles, logins and central Jenkinsfile; the first is untouched", () => {
  const reg = parseRegistry(REG);
  const j = renderJenkinsYaml(fs.readFileSync(path.join(HERE, "..", "jenkins", "casc", "jenkins.yaml"), "utf8").replace(/\r\n/g, "\n"), reg);
  const g = renderGithubYaml(fs.readFileSync(path.join(HERE, "..", "jenkins", "casc", "github.yaml"), "utf8").replace(/\r\n/g, "\n"), reg);
  assert.match(j, /name: "folder-beta"/);
  assert.match(j, /pattern: "\^beta\$"/);
  assert.match(j, /name: "branches-beta-bob"[\s\S]*?pattern: "\(\?i\)\^beta\/\(bob\|robert\)\(%2F\|\/\)\.\*\$"/);
  assert.match(j, /id: "beta-central-jenkinsfile"[\s\S]*?projects\/beta\/Jenkinsfile/);
  assert.match(j, /- id: "bob"/);
  assert.match(j, /- user: "boss"/, "admins come from the registry");
  assert.ok(!j.includes("naveena246"), "the registry replaces the developer list entirely");
  assert.match(g, /\[id: 'beta', folder: 'beta', display: 'beta', owner: 'Org', repo: 'Beta'\]/);
  assert.match(g, /production health check|Production health check/i, "the hand-written monitor job is kept");
});

test("GENERATOR: a developer's prefix is matched literally, never as a pattern", () => {
  const reg = parseRegistry({ ...REG, projects: [{ ...REG.projects[0], developers: [{ user: "dot", prefixes: ["a.b"] }] }, REG.projects[1]] });
  const j = renderJenkinsYaml(fs.readFileSync(path.join(HERE, "..", "jenkins", "casc", "jenkins.yaml"), "utf8").replace(/\r\n/g, "\n"), reg);
  assert.ok(j.includes("(a" + String.fromCharCode(92) + String.fromCharCode(92) + ".b)"), "a dot in a prefix is escaped for the YAML string");
});
