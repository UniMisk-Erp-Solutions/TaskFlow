// Static guarantees about the pipeline definition, Jenkins isolation and branch protection.
// These can run anywhere (no Docker, no Jenkins, no GitHub). Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, REQUIRED_CHECKS, STAGES, GITHUB_CHECK_NAME } from "../pipeline/config.mjs";
import { buildPayload, REPO_SETTINGS } from "../github/branch-protection.mjs";

// Normalise line endings: a Windows checkout (core.autocrlf) has CRLF, which would defeat the comment-stripping regexes below.
const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), "utf8").replace(/\r\n/g, "\n");
const here = path.dirname(fileURLToPath(import.meta.url));
/** Drops // and # comment text so assertions look at configuration, not explanations. */
const code = (s) => s.split("\n").map((l) => l.replace(/^\s*(\/\/|#).*$/, "").replace(/\s+(\/\/|#)\s.*$/, "")).join("\n");

// ── pipeline definition ───────────────────────────────────────────────────────
test("every required check has a stage, and the Jenkinsfile runs every stage", () => {
  const jf = read("Jenkinsfile");
  for (const name of REQUIRED_CHECKS) {
    assert.ok(STAGES[name], `${name} has no stage`);
    assert.ok(jf.includes(`run-stage.mjs ${name}`), `Jenkinsfile never runs "${name}", so the gate could never be satisfied`);
  }
  for (const m of jf.matchAll(/run-stage\.mjs (\S+?)'/g)) assert.ok(STAGES[m[1]], `Jenkinsfile runs unknown stage ${m[1]}`);
});

test("the required checks cover BUILD (lint, typecheck, build) and TEST (unit, backend, e2e, trivy)", () => {
  for (const n of ["lint", "typecheck", "build", "unit-tests", "backend-tests", "e2e", "trivy-deps", "trivy-secrets"]) assert.ok(REQUIRED_CHECKS.includes(n), n);
});

test("the Jenkinsfile never deploys, merges or pushes", () => {
  const jf = code(read("Jenkinsfile"));
  for (const bad of [/git\s+push/i, /git\s+merge/i, /gh\s+pr\s+merge/i, /vercel\s+(deploy|--prod|promote)/i, /--auto/i, /docker\s+(run|stop|rm|compose)/i]) assert.doesNotMatch(jf, bad);
});

test("the Jenkinsfile only binds secrets through the credential store (no literals)", () => {
  const jf = read("Jenkinsfile");
  assert.doesNotMatch(jf, /(ghp_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|password\s*=)/i);
  for (const id of ["taskflow-attest-private-key", "taskflow-github-app-key", "taskflow-github-app-id"]) assert.ok(jf.includes(id), id);
});

test("sources that may run on production-adjacent hosts never default to a production URL", () => {
  for (const f of ["ci/pipeline/config.mjs", "frontend/playwright.config.js", "frontend/e2e/fixtures.js"]) {
    const t = read(f).replace(/PRODUCTION_HOSTS\s*=\s*\[[^\]]*\]/s, "");
    assert.doesNotMatch(t, /https?:\/\/taskflow-(backend|api)\.unimisk\.com/i, f);
  }
});

// ── Jenkins isolation ─────────────────────────────────────────────────────────
const compose = code(read("ci", "jenkins", "docker-compose.yml"));
test("Jenkins compose: no docker.sock, not privileged, no host network/pid", () => {
  assert.doesNotMatch(compose, /docker\.sock/);
  assert.doesNotMatch(compose, /privileged:\s*true/);
  assert.doesNotMatch(compose, /network_mode:\s*host/);
  assert.doesNotMatch(compose, /pid:\s*host/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\[ALL\]/);
});

test("Jenkins compose: hard resource limits, loopback-only port, own network + volume", () => {
  assert.match(compose, /mem_limit:\s*4g/);
  assert.match(compose, /cpus:\s*2\.0/);
  assert.match(compose, /pids_limit:\s*\d+/);
  assert.match(compose, /"127\.0\.0\.1:8088:8080"/);
  assert.match(compose, /name:\s*taskflow_ci/);
  assert.match(compose, /name:\s*taskflow_jenkins_home/);
  assert.doesNotMatch(compose, /^\s*-\s*"?0\.0\.0\.0:/m);
});

test("Jenkins compose: every secret is required (':?'), none has a default value", () => {
  const env = [...compose.matchAll(/^\s+(\w+): "\$\{(\w+)(.*?)\}"/gm)];
  assert.ok(env.length >= 4);
  // CASC_JENKINS_CONFIG selects config files (a path, not a secret) and legitimately has a default.
  for (const [, key, , rest] of env.filter(([, k]) => k !== "CASC_JENKINS_CONFIG")) assert.match(rest, /^:\?/, `${key} must fail when unset`);
});

test("Jenkins image pins versions and verifies checksums; JCasC has no literal secrets", () => {
  const df = read("ci", "jenkins", "Dockerfile");
  assert.doesNotMatch(df, /^FROM .*:(latest|lts)\s*$/m);
  assert.match(df, /sha256sum -c/g);
  assert.match(df, /NODE_SHA256=[0-9a-f]{64}/);
  assert.match(df, /TRIVY_SHA256=[0-9a-f]{64}/);
  const casc = read("ci", "jenkins", "casc", "jenkins.yaml");
  for (const m of casc.matchAll(/(?:password|secret|secretBytes):\s*"([^"]*)"/g)) assert.match(m[1], /^\$\{/, `literal secret in JCasC: ${m[1].slice(0, 8)}`);
  assert.match(casc, /allowsSignup:\s*false/);
  assert.doesNotMatch(casc, /anonymous/i);
});

test("JCasC loads the key FILES' contents (not the path text) and the job can read the private repository", () => {
  const casc = read("ci", "jenkins", "casc", "jenkins.yaml");
  // ${base64:${SOME_FILE_VAR}} would encode the path string; the documented form is readFileBase64.
  assert.doesNotMatch(casc, /secretBytes:\s*"\$\{base64:/);
  assert.equal([...casc.matchAll(/secretBytes:\s*"\$\{readFileBase64:\$\{\w+\}\}"/g)].length, 2);
  const github = read("ci", "jenkins", "casc", "github.yaml");
  assert.match(github, /gitHubApp:/);
  assert.match(github, /scanCredentialsId\('taskflow-github-app'\)/);
  assert.match(github, /privateKey:\s*"\$\{readFile:/);
  assert.doesNotMatch(casc, /gitHubApp:|jobs:/, "core config must not require the GitHub App");
});

test("install script refuses to run without an approval on record", () => {
  if (process.platform === "win32") return; // bash script; exercised on Linux
  const r = spawnSync("bash", [path.join(REPO_ROOT, "ci/jenkins/install-on-15.sh")], { env: { PATH: process.env.PATH }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /APPROVED_BY/);
});

// ── branch protection ─────────────────────────────────────────────────────────
test("branch protection: verified check bound to the Jenkins App, admins bound too, no force-push, no auto-merge", () => {
  const p = buildPayload({ appId: "12345", admins: ["alice"] });
  assert.deepEqual(p.required_status_checks.checks, [{ context: GITHUB_CHECK_NAME, app_id: 12345 }]);
  assert.equal(p.required_status_checks.strict, true);
  assert.equal(p.enforce_admins, true);
  assert.equal(p.required_pull_request_reviews.require_code_owner_reviews, true);
  assert.equal(p.required_pull_request_reviews.dismiss_stale_reviews, true);
  assert.equal(p.required_pull_request_reviews.required_approving_review_count, 1);
  assert.equal(p.allow_force_pushes, false);
  assert.equal(p.allow_deletions, false);
  assert.deepEqual(p.restrictions.users, ["alice"]);
  assert.equal(REPO_SETTINGS.allow_auto_merge, false);
});

test("branch protection refuses to build without the App id or an admin list", () => {
  assert.throws(() => buildPayload({ appId: "", admins: ["a"] }), /GITHUB_APP_ID/);
  assert.throws(() => buildPayload({ appId: "abc", admins: ["a"] }), /GITHUB_APP_ID/);
  assert.throws(() => buildPayload({ appId: "1", admins: [] }), /ADMIN_LOGINS/);
});

test("branch protection CLI is a dry run by default and refuses --apply without approval/token", () => {
  const run = (args, env) => spawnSync(process.execPath, [path.join(here, "../github/branch-protection.mjs"), ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
  const dry = run([], { GITHUB_APP_ID: "1", ADMIN_LOGINS: "a" });
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /DRY RUN/);
  const noApproval = run(["--apply"], { GITHUB_APP_ID: "1", ADMIN_LOGINS: "a", GITHUB_ADMIN_TOKEN: "x" });
  assert.notEqual(noApproval.status, 0);
  assert.match(noApproval.stderr, /APPROVED_BY/);
  const noToken = run(["--apply"], { GITHUB_APP_ID: "1", ADMIN_LOGINS: "a", APPROVED_BY: "x" });
  assert.notEqual(noToken.status, 0);
  assert.match(noToken.stderr, /GITHUB_ADMIN_TOKEN/);
});

// ── packaging guards (both bugs below were found only when the branch was checked out fresh) ─────
test("no file the pipeline needs is swallowed by .gitignore (e.g. the repo's '**/*secret*' rule)", () => {
  const files = ["Jenkinsfile"];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) { if (!["node_modules", "dist", "test-results", "playwright-report"].includes(e.name)) walk(rel); } else files.push(rel); } };
  walk("ci"); walk("frontend/e2e");
  const ignored = files.filter((f) => spawnSync("git", ["check-ignore", "-q", f], { cwd: REPO_ROOT }).status === 0);
  assert.deepEqual(ignored, [], `ignored by .gitignore, so they would be missing from a fresh checkout: ${ignored.join(", ")}`);
  for (const s of Object.values(STAGES)) for (const c of s.commands) for (const a of c.args) if (/^ci\/[^*]+\.mjs$/.test(a)) assert.ok(fs.existsSync(path.join(REPO_ROOT, a)), `${a} does not exist`);
});

test("process spawning keeps arguments containing spaces intact (Windows shell quoting)", async () => {
  const { spawnSyncPortable } = await import("../lib/spawn.mjs");
  const r = spawnSyncPortable("node", ["-e", "console.log(process.argv[1] + '|' + process.argv.length)", "C:/a folder/with space/file.txt"], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "C:/a folder/with space/file.txt|2");
});

// ── optional JCasC files, local-verification overlay, scan fallback ─────────────────────────────
test("the optional JCasC files hold no literal secrets and the local job cannot push, merge or deploy", () => {
  for (const f of ["github.yaml", "local-verify.yaml"]) {
    const y = read("ci", "jenkins", "casc", f);
    for (const m of y.matchAll(/(?:password|secret|secretBytes|privateKey):\s*"([^"]*)"/g)) assert.match(m[1], /^\$\{/, `literal secret in ${f}`);
    assert.doesNotMatch(y, /\b(push|merge|deploy)\b\s*\(/i, `${f} must not call push/merge/deploy`);
  }
  assert.match(read("ci", "jenkins", "casc", "local-verify.yaml"), /file:\/\/\/srv\/taskflow-repo/);
});

test("compose: JCasC files are selected per phase, Chromium gets /dev/shm, local overlay is read-only and adds nothing else", () => {
  const base = code(read("ci", "jenkins", "docker-compose.yml"));
  assert.match(base, /CASC_JENKINS_CONFIG:\s*"\$\{CASC_FILES:-\/usr\/share\/jenkins\/ref\/casc\/jenkins\.yaml\}"/);
  assert.match(base, /shm_size:\s*"1gb"/);
  const local = code(read("ci", "jenkins", "docker-compose.local.yml"));
  assert.match(local, /:\/srv\/taskflow-repo:ro"/);
  assert.match(local, /ALLOW_LOCAL_CHECKOUT=true/);
  for (const bad of [/ports:/, /docker\.sock/, /privileged/, /cap_add/, /network_mode/, /secrets:/]) assert.doesNotMatch(local, bad);
});

test("scan-image falls back to the Trivy inside the image without mounting docker.sock", () => {
  const sh = code(read("ci", "jenkins", "scan-image.sh"));
  assert.match(sh, /docker save/);
  assert.match(sh, /--entrypoint trivy/);
  assert.doesNotMatch(sh, /docker\.sock/);
});

test("shell scripts are executable in git (a fresh clone on Linux must be able to run them)", () => {
  const out = spawnSync("git", ["ls-files", "-s", "ci/jenkins/install-on-15.sh", "ci/jenkins/scan-image.sh"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout;
  for (const l of out.trim().split("\n")) assert.match(l, /^100755 /, l);
});
