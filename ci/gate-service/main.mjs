// Entry point of the gate container. Every secret is a mounted file; anything missing stops the start (no defaults).
// One gate serves every project in the registry (GATE_PROJECTS_FILE, ci/projects.json). Without it the gate serves the
// single repository named by GATE_REPO exactly as before. The first project is the default: it keeps the original
// state paths, webhook secret and baked-in pipeline pin; every other project has its own state directory, webhook
// secret (<GATE_PROJECT_SECRETS_DIR>/<id>/webhook-secret) and is judged against the tip of its own main.
import fs from "node:fs";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { PINNED_PATHS } from "./evaluate.mjs";
import { createGate, createPublisher } from "./gate.mjs";
import { createGitSource } from "./git-source.mjs";
import { createJenkinsClient } from "./jenkins.mjs";
import { legacyRegistry, loadRegistry } from "./projects.mjs";
import { createServers } from "./server.mjs";
import { createRefWatcher } from "./ref-watcher.mjs";
import { createState } from "./state.mjs";

const env = process.env;
const die = (m) => { console.error(`✘ ${m}`); process.exit(1); };
const need = (k) => { if (!env[k]) die(`${k} is not set`); return env[k]; };
const readSecret = (file, label) => { try { return fs.readFileSync(file, "utf8").trim(); } catch (e) { return die(`cannot read ${label}=${file}: ${e.code}`); } };
const secretFile = (k) => readSecret(need(k), k);

let registry;
try { registry = env.GATE_PROJECTS_FILE ? loadRegistry(env.GATE_PROJECTS_FILE) : legacyRegistry({ GATE_REPO: need("GATE_REPO"), GATE_JENKINS_FOLDER: need("GATE_JENKINS_FOLDER") }); }
catch (e) { die(e.message); }
const projectsList = [registry.projects.find((p) => p.id === registry.defaultProject), ...registry.projects.filter((p) => p.id !== registry.defaultProject)];

const base = {
  debounceMs: Number(env.GATE_DEBOUNCE_MS || 5000),
  maxRequestsPerMinute: Number(env.GATE_MAX_REQUESTS_PER_MINUTE || 60),
  tickSeconds: Number(env.GATE_TICK_SECONDS || 10),
  scanEverySeconds: Number(env.GATE_SCAN_EVERY_SECONDS || 120),
  watchSeconds: Number(env.GATE_WATCH_SECONDS ?? 10), // 0 disables push detection by polling
  statusMode: env.GATE_STATUS_MODE || "record",
  dashboardUrl: env.GATE_DASHBOARD_URL || "", // where developers open Jenkins (office network); empty = no link on the GitHub status
};
if (!["record", "github-status"].includes(base.statusMode)) die("GATE_STATUS_MODE must be record or github-status");

const privateKeyPem = fs.readFileSync(need("GATE_ATTEST_KEY_FILE"), "utf8");
const jenkinsPassword = secretFile("GATE_JENKINS_PASSWORD_FILE");
const defaultToken = base.statusMode === "github-status" ? secretFile("GATE_GITHUB_TOKEN_FILE") : (env.GATE_GITHUB_TOKEN_FILE && fs.existsSync(env.GATE_GITHUB_TOKEN_FILE) ? secretFile("GATE_GITHUB_TOKEN_FILE") : "");
const stateDir = env.GATE_STATE_DIR || "/var/lib/gate";
const projectSecrets = env.GATE_PROJECT_SECRETS_DIR || "/run/project-secrets";

// The default project's pipeline files must hash to the values the admin pinned when this image was built.
const defaultPin = {}; for (const p of PINNED_PATHS) { const v = env[`GATE_PIN_${p.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`]; if (!v) die(`pin for ${p} missing`); defaultPin[p] = v; }

const runtimes = projectsList.map((p, i) => {
  const isDefault = i === 0;
  const dir = isDefault ? stateDir : `${stateDir}/projects/${p.id}`;
  const own = (name) => `${projectSecrets}/${p.id}/${name}`;
  const token = !isDefault && fs.existsSync(own("github-token")) ? readSecret(own("github-token"), `${p.id} github-token`) : defaultToken;
  const required = p.requiredChecks ?? (isDefault ? REQUIRED_CHECKS : die(`${p.id}: requiredChecks missing`));
  const cfg = { ...base, repo: p.repo, allowedRepos: [p.repo] };
  const state = createState(`${dir}/state.json`);
  const jenkins = createJenkinsClient({ baseUrl: need("GATE_JENKINS_URL"), user: env.GATE_JENKINS_USER || "gate", password: jenkinsPassword, folder: p.jenkinsFolder });
  const git = createGitSource({ mirrorDir: `${dir}/mirror.git`, sourceUrl: isDefault && env.GATE_GIT_SOURCE ? env.GATE_GIT_SOURCE : `https://github.com/${p.repo}.git`, token });
  const publish = createPublisher({ mode: base.statusMode, repo: p.repo, token, recordFile: `${dir}/statuses.jsonl` });
  const attestDir = `${dir}/attestations`;
  const gate = createGate({ cfg, jenkins, git, state, publish, required, pin: isDefault ? defaultPin : null, privateKeyPem, attestDir });
  const secret = isDefault ? secretFile("GATE_WEBHOOK_SECRET_FILE") : readSecret(own("webhook-secret"), `${p.id} webhook-secret`);
  return { id: p.id, repo: p.repo, cfg, state, jenkins, gate, token, secret, attestDir, busy: false };
});

const { publicServer, adminServer } = createServers({ cfg: base, projects: runtimes.map((r) => ({ id: r.id, secret: r.secret, allowedRepos: [r.repo], state: r.state, jenkins: r.jenkins, attestDir: r.attestDir })) });
const publicPort = Number(env.GATE_PUBLIC_PORT || 8089), adminPort = Number(env.GATE_ADMIN_PORT || 8090);
publicServer.listen(publicPort, env.GATE_LISTEN_HOST || "0.0.0.0", () => console.log(`[gate] public listener :${publicPort} (POST /github, POST /github/<project>, GET /healthz); status mode: ${base.statusMode}; projects: ${runtimes.map((r) => `${r.id}=${r.repo}`).join(", ")}`));
adminServer.listen(adminPort, env.GATE_LISTEN_HOST || "0.0.0.0", () => console.log(`[gate] admin listener :${adminPort} (publish on loopback only)`));

for (const r of runtimes) {
  const tag = runtimes.length > 1 ? `${r.id}: ` : "";
  const tick = async () => { if (r.busy) return; r.busy = true; try { const x = await r.gate.tick(); if (x.handled) console.log(`[gate] ${tag}verified ${x.handled} finished build(s)`); } catch (e) { console.log(`[gate] ${tag}tick failed: ${e.message}`); } finally { r.busy = false; } };
  setInterval(tick, base.tickSeconds * 1000); tick();
  // Recovery path: even if every webhook is lost, a periodic scan keeps Jenkins in step with the repository.
  setInterval(() => r.jenkins.triggerScan().catch((e) => console.log(`[gate] ${tag}periodic scan failed: ${e.message}`)), base.scanEverySeconds * 1000);
  // Push detection: a branch tip moved on GitHub -> scan Jenkins now (no webhook, tunnel or open port needed).
  if (base.watchSeconds > 0) {
    const watcher = createRefWatcher({ repo: r.repo, token: r.token });
    let polling = false, lastErr = "";
    setInterval(async () => {
      if (polling) return; polling = true;
      try {
        const x = await watcher.poll(); lastErr = "";
        if (x.changed) { console.log(`[gate] ${tag}push detected on GitHub: scanning Jenkins`); await r.jenkins.triggerScan(); }
      } catch (e) { if (e.message !== lastErr) { lastErr = e.message; console.log(`[gate] ${tag}push watch failed: ${e.message}`); } }
      finally { polling = false; }
    }, base.watchSeconds * 1000);
  }
}
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { for (const r of runtimes) r.state.save(); process.exit(0); });
