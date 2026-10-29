// Static guarantees about the pipeline definition, Jenkins isolation and branch protection.
// These can run anywhere (no Docker, no Jenkins, no GitHub). Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, REQUIRED_CHECKS, STAGES } from "../pipeline/config.mjs";
import { STATUS_CONTEXT as GITHUB_CHECK_NAME } from "../lib/github-status.mjs";
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

test("the Jenkinsfile holds no credentials at all: the build runs on an agent without secrets, and signing is the gate's job", () => {
  const jf = code(read("Jenkinsfile"));
  assert.doesNotMatch(jf, /withCredentials|credentials\(|credentialsId|PRIVATE KEY|ghp_|github_pat_|attest/i);
  assert.match(jf, /agent \{ label 'untrusted' \}/);
  assert.doesNotMatch(jf, /agent any/);
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

test("Jenkins compose: hard resource limits, loopback-only admin port, own network + volume", () => {
  assert.match(compose, /mem_limit:\s*4g/);
  assert.match(compose, /cpus:\s*2\.0/);
  assert.match(compose, /"127\.0\.0\.1:8088:8080"/);
  // the developer dashboard port is loopback unless the admin sets JENKINS_LAN_BIND to the office LAN address; never 0.0.0.0
  assert.match(compose, /"\$\{JENKINS_LAN_BIND:-127\.0\.0\.1}:\$\{JENKINS_LAN_PORT:-8081}:8080"/);
  assert.match(compose, /pids_limit:\s*\d+/);
  assert.match(compose, /name:\s*taskflow_ci/);
  assert.match(compose, /name:\s*taskflow_jenkins_home/);
  assert.doesNotMatch(compose, /^\s*-\s*"?0\.0\.0\.0:/m);
});

test("Jenkins compose: every secret is required (':?'), none has a default value", () => {
  const env = [...compose.matchAll(/^\s+(\w+): "\$\{(\w+)(.*?)\}"/gm)];
  assert.ok(env.length >= 4);
  // These select files / mirrors (not secrets) and legitimately have defaults.
  const NOT_SECRETS = new Set(["CASC_JENKINS_CONFIG", "DEBIAN_MIRROR", "JENKINS_UC_DOWNLOAD", "GITHUB_READ_USER", "GATE_REPO", "GATE_JENKINS_FOLDER", "GATE_STATUS_MODE", "CI_TOOLKIT_REF", "MONITOR_URL"]);
  for (const [, key, , rest] of env.filter(([, k]) => !NOT_SECRETS.has(k))) assert.match(rest, /^:\?/, `${key} must fail when unset`);
});

test("Jenkins image pins versions and verifies checksums; JCasC has no literal secrets", () => {
  const df = read("ci", "jenkins", "Dockerfile");
  assert.doesNotMatch(df, /^FROM .*:(latest|lts)\s*$/m);
  assert.match(df, /sha256sum -c/g);
  assert.match(df, /NODE_SHA256=[0-9a-f]{64}/);
  assert.match(df, /COPY --from=aquasec\/trivy:[\d.]+@sha256:[0-9a-f]{64} /); // Trivy pinned by image digest
  assert.doesNotMatch(df, /github\.com\/aquasecurity/, "release downloads from GitHub are too slow on the target network");
  const casc = read("ci", "jenkins", "casc", "jenkins.yaml");
  for (const m of casc.matchAll(/(?:password|secret|secretBytes):\s*"([^"]*)"/g)) assert.match(m[1], /^\$\{/, `literal secret in JCasC: ${m[1].slice(0, 8)}`);
  assert.match(casc, /allowsSignup:\s*false/);
  assert.doesNotMatch(casc, /anonymous/i);
});

test("JCasC core: the controller runs no builds and holds no signing key or write token; the agent and gate user are least-privilege", () => {
  const core = read("ci", "jenkins", "casc", "jenkins.yaml");
  assert.match(core, /numExecutors: 0/);
  assert.doesNotMatch(core, /^credentials:/m, "no credentials live in the core config");
  assert.doesNotMatch(core, /attest|github-app|secretBytes|gitHubApp/i);
  assert.match(core, /labelString: "untrusted"/);
  assert.match(core, /webSocket: true/);
  const gateRole = core.split("          - name: \"gate\"")[1].split("          - name: ")[0];
  assert.ok(gateRole.includes('permissions: ["Job/Read", "Job/Discover", "Job/Build"]'), "the gate may read jobs and start builds, nothing else");
  assert.ok(gateRole.includes('- user: "gate"'));
  assert.doesNotMatch(core, /Administer:gate|Overall\/Manage:gate|Credentials/);
  const github = read("ci", "jenkins", "casc", "github.yaml");
  assert.match(github, /usernamePassword:/);
  assert.match(github, /scanCredentialsId\('taskflow-github-read'\)/);
  assert.match(github, /password:\s*"\$\{trim:\$\{readFile:/);
  assert.doesNotMatch(github, /gitHubApp:|periodicFolderTrigger/, "no App credential, and no polling timer (the gate drives scans)");
});

// ── isolation between controller, build agent and gate ───────────────────────────
const service = (name) => { const m = new RegExp("\\n  " + name + ":\\n([\\s\\S]*?)(?=\\n  [a-z]+:\\n|\\nvolumes:)").exec(compose); assert.ok(m, "service " + name); return m[1]; };
const listOf = (block, key) => { const m = new RegExp("\\n    " + key + ":\\n((?:      - .*\\n?)+)").exec(block + "\n") || new RegExp("\\n    " + key + ": \\[(.*?)\\]").exec(block); return m ? m[1].split(/[\n,]/).map((x) => x.replace(/^\s*-\s*/, "").replace(/["\s]/g, "")).filter(Boolean) : []; };

test("ISOLATION: the build agent has no secret but its own agent secret, no published port, and no route to the gate", () => {
  const agent = service("agent");
  assert.deepEqual(listOf(agent, "secrets"), ["agent_secret"]);
  assert.deepEqual(listOf(agent, "networks"), ["taskflow_agent"]);
  assert.doesNotMatch(agent, /\n    ports:/);
  assert.doesNotMatch(agent, /jenkins_home|gate_state|attest|webhook|github/i);
  assert.match(agent, /mem_limit: 4g/);
});

test("ISOLATION: the controller holds neither the signing key nor the webhook secret nor a GitHub write token", () => {
  const jenkins = service("jenkins");
  const secrets = listOf(jenkins, "secrets");
  assert.deepEqual(secrets.sort(), ["dev_users_password", "developer_password", "gate_jenkins_password", "github_read_token", "unimisk_admin_password"]);
  assert.deepEqual(listOf(jenkins, "networks").sort(), ["taskflow_agent", "taskflow_ci"]);
});

test("ISOLATION: the gate alone holds the signing key, the webhook secret and the status token; it is off the agent network, read-only and loopback-published", () => {
  const gate = service("gate");
  assert.deepEqual(listOf(gate, "secrets").sort(), ["attest_key", "gate_github_token", "gate_jenkins_password", "gate_webhook_secret"]);
  assert.deepEqual(listOf(gate, "networks"), ["taskflow_ci"]);
  assert.match(gate, /read_only: true/);
  for (const p of ["127.0.0.1:8089:8089", "127.0.0.1:8090:8090"]) assert.ok(gate.includes('"' + p + '"'), p);
  assert.doesNotMatch(gate, /"0\.0\.0\.0:|"8089:8089"|"8090:8090"/);
});

test("the gate image pins the pipeline files and the Dockerfile copies only ci/", () => {
  const df = read("ci", "gate-service", "Dockerfile");
  for (const p of ["JENKINSFILE", "CI_PIPELINE", "CI_LIB", "CI_GATE", "CI_VERIFY"]) assert.match(df, new RegExp("ARG GATE_PIN_" + p));
  assert.match(df, /COPY ci \.\/ci/);
  assert.match(read(".dockerignore"), /^\*\n!ci/m);
});

test("install script refuses to run without an approval on record", () => {
  if (process.platform === "win32") return; // bash script; exercised on Linux
  const r = spawnSync("bash", [path.join(REPO_ROOT, "ci/jenkins/install-on-15.sh")], { env: { PATH: process.env.PATH }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /APPROVED_BY/);
});

// ── branch protection ─────────────────────────────────────────────────────────
test("branch protection (for plans that can enforce it): verified status required, admins bound too, no force-push, no auto-merge", () => {
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

test("branch protection refuses a malformed App id or an empty admin list; the App id is optional", () => {
  assert.deepEqual(buildPayload({ admins: ["a"] }).required_status_checks.checks, [{ context: GITHUB_CHECK_NAME }]);
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

test("the committed attestation public key exists, is an Ed25519 public key, and is not hidden by .gitignore (*.pem is ignored in this repo)", async () => {
  const { createPublicKey } = await import("node:crypto");
  const rel = "ci/gate/attest-public-key.pub";
  assert.ok(fs.existsSync(path.join(REPO_ROOT, rel)), `${rel} is missing`);
  assert.equal(createPublicKey(fs.readFileSync(path.join(REPO_ROOT, rel))).asymmetricKeyType, "ed25519");
  assert.notEqual(spawnSync("git", ["check-ignore", "-q", rel], { cwd: REPO_ROOT }).status, 0, "ignored by .gitignore");
  assert.doesNotMatch(read(rel), /PRIVATE/);
});

test("GitHub App manifest asks for the minimum permissions: read code/PRs, write only checks and statuses, no webhook", () => {
  const m = JSON.parse(read("ci", "github", "github-app-manifest.json"));
  assert.deepEqual(m.default_permissions, { metadata: "read", contents: "read", pull_requests: "read", checks: "write", statuses: "write" });
  assert.equal(m.public, false);
  assert.equal(m.hook_attributes.active, false);
  assert.deepEqual(m.default_events, []);
  for (const [perm, level] of Object.entries(m.default_permissions)) if (level === "write") assert.ok(["checks", "statuses"].includes(perm), `${perm}: write is not needed`);
});

test("CENTRAL PIPELINE: the Jenkinsfile stored in Jenkins is byte-identical to the repository one, and the GitHub job uses it for branches without their own", () => {
  assert.equal(read("ci/jenkins/casc/Jenkinsfile.central"), read("Jenkinsfile"));
  assert.match(read("ci/jenkins/casc/jenkins.yaml"), /taskflow-central-jenkinsfile/);
  assert.match(read("ci/jenkins/casc/github.yaml"), /PipelineBranchDefaultsProjectFactory/);
  assert.match(read("ci/jenkins/plugins.txt"), /pipeline-multibranch-defaults/);
  assert.match(read("Jenkinsfile"), /overlay.mjs/);
});

test("every Jenkins configuration YAML file parses (a broken file puts Jenkins into a restart loop)", async () => {
  const { createRequire } = await import("node:module");
  let yaml;
  try { yaml = createRequire(path.join(REPO_ROOT, "frontend", "package.json"))("js-yaml"); } catch { return; } // parser not installed here
  for (const f of fs.readdirSync(path.join(REPO_ROOT, "ci/jenkins/casc")).filter((n) => n.endsWith(".yaml"))) {
    assert.doesNotThrow(() => yaml.load(read(`ci/jenkins/casc/${f}`)), f);
  }
});

test("ROLES: each branch developer sees only branches under their own name and can never build, configure or administer", () => {
  const core = read("ci", "jenkins", "casc", "jenkins.yaml");
  assert.match(core, /roleBased:/);
  assert.doesNotMatch(core, /globalMatrix/);
  const items = core.slice(core.indexOf("        items:"), core.indexOf("  crumbIssuer:"));
  const blocks = items.split("          - name: ").slice(1);
  const role = (n) => blocks.find((b) => b.startsWith('"' + n + '"'));
  const devs = ["naveena246", "salomi2810", "lakshyabyteo", "nikunjbyteo", "jacktechie", "unimisk-erp-solutions", "preet1249"];
  for (const d of devs) {
    const b = role("branches-" + d);
    assert.ok(b, "a branch role for " + d);
    assert.ok(b.includes('pattern: "(?i)^taskflow/(' + d), "pattern anchored to the TaskFlow folder and starting with the username: " + d);
    assert.ok(b.includes('(%2F|/).*$"'), "the prefix must be followed by the branch separator, so naveena never matches naveenaX");
    assert.ok(b.includes('permissions: ["Job/Read", "Job/Discover"]'), "read only: " + d);
    assert.equal((b.match(/- user:/g) || []).length, 1, "exactly one user per branch role: " + d);
    assert.ok(b.includes('- user: "' + d + '"'));
    assert.ok(core.includes('- id: "' + d + '"'), "a login exists for " + d);
  }
  // nobody but admin may administer, and only the gate may build
  assert.equal(core.split("Overall/Administer").length - 1, 1);
  assert.equal(core.split("Job/Build").length - 1, 1);
  assert.doesNotMatch(core, /ChaosInTheWake/i, "no password literal in the repository");
  // the organisation account is an admin, and because it is an admin it must NOT use the password every developer knows
  const adminRole = core.split('          - name: "admin"')[1].split("          - name: ")[0];
  assert.ok(adminRole.includes('- user: "unimisk-erp-solutions"'), "unimisk-erp-solutions is an admin");
  const adminUser = core.split('- id: "unimisk-erp-solutions"')[1].split("- id: ")[0];
  assert.ok(adminUser.includes("UNIMISK_ADMIN_PASSWORD_FILE") && !adminUser.includes("DEV_USERS_PASSWORD_FILE"), "admin account has its own password file");
  assert.match(read("ci", "jenkins", "plugins.txt"), /^role-strategy$/m);
  const github = read("ci", "jenkins", "casc", "github.yaml");
  assert.ok(github.includes("buildOriginBranchWithPR(true)"), "a branch with a PR is built as the branch, so the job name keeps the owner");
  assert.ok(github.includes("buildOriginPRHead(false)"), "no PR-N job (it carries no owner name)");
});
