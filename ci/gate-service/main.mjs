// Entry point of the gate container. Every secret is a mounted file; anything missing stops the start (no defaults).
import fs from "node:fs";
import { REQUIRED_CHECKS } from "../pipeline/config.mjs";
import { PINNED_PATHS } from "./evaluate.mjs";
import { createGate, createPublisher } from "./gate.mjs";
import { createGitSource } from "./git-source.mjs";
import { createJenkinsClient } from "./jenkins.mjs";
import { createServers } from "./server.mjs";
import { createRefWatcher } from "./ref-watcher.mjs";
import { createState } from "./state.mjs";

const env = process.env;
const need = (k) => { if (!env[k]) { console.error(`✘ ${k} is not set`); process.exit(1); } return env[k]; };
const secretFile = (k) => { const f = need(k); try { return fs.readFileSync(f, "utf8").trim(); } catch (e) { console.error(`✘ cannot read ${k}=${f}: ${e.code}`); process.exit(1); } };

const cfg = {
  repo: need("GATE_REPO"),
  allowedRepos: [need("GATE_REPO")],
  debounceMs: Number(env.GATE_DEBOUNCE_MS || 5000),
  maxRequestsPerMinute: Number(env.GATE_MAX_REQUESTS_PER_MINUTE || 60),
  tickSeconds: Number(env.GATE_TICK_SECONDS || 10),
  scanEverySeconds: Number(env.GATE_SCAN_EVERY_SECONDS || 120),
  watchSeconds: Number(env.GATE_WATCH_SECONDS ?? 10), // 0 disables push detection by polling
  statusMode: env.GATE_STATUS_MODE || "record",
};
if (!["record", "github-status"].includes(cfg.statusMode)) { console.error("✘ GATE_STATUS_MODE must be record or github-status"); process.exit(1); }

const webhookSecret = secretFile("GATE_WEBHOOK_SECRET_FILE");
const privateKeyPem = fs.readFileSync(need("GATE_ATTEST_KEY_FILE"), "utf8");
const jenkinsPassword = secretFile("GATE_JENKINS_PASSWORD_FILE");
const githubToken = cfg.statusMode === "github-status" ? secretFile("GATE_GITHUB_TOKEN_FILE") : (env.GATE_GITHUB_TOKEN_FILE && fs.existsSync(env.GATE_GITHUB_TOKEN_FILE) ? secretFile("GATE_GITHUB_TOKEN_FILE") : "");

// The pipeline files must hash to the values the admin pinned when this image was built.
const pin = {}; for (const p of PINNED_PATHS) { const v = env[`GATE_PIN_${p.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`]; if (!v) { console.error(`✘ pin for ${p} missing`); process.exit(1); } pin[p] = v; }

const stateDir = env.GATE_STATE_DIR || "/var/lib/gate";
const state = createState(`${stateDir}/state.json`);
const jenkins = createJenkinsClient({ baseUrl: need("GATE_JENKINS_URL"), user: env.GATE_JENKINS_USER || "gate", password: jenkinsPassword, folder: need("GATE_JENKINS_FOLDER") });
const git = createGitSource({ mirrorDir: `${stateDir}/mirror.git`, sourceUrl: need("GATE_GIT_SOURCE"), token: githubToken });
const publish = createPublisher({ mode: cfg.statusMode, repo: cfg.repo, token: githubToken, recordFile: `${stateDir}/statuses.jsonl` });
const gate = createGate({ cfg, jenkins, git, state, publish, required: REQUIRED_CHECKS, pin, privateKeyPem, attestDir: `${stateDir}/attestations` });
const { publicServer, adminServer } = createServers({ cfg, secret: webhookSecret, state, jenkins, attestDir: `${stateDir}/attestations` });

publicServer.listen(8089, "0.0.0.0", () => console.log(`[gate] public listener :8089 (POST /github, GET /healthz); status mode: ${cfg.statusMode}; repo: ${cfg.repo}`));
adminServer.listen(8090, "0.0.0.0", () => console.log("[gate] admin listener :8090 (publish on loopback only)"));

let busy = false;
const tick = async () => { if (busy) return; busy = true; try { const r = await gate.tick(); if (r.handled) console.log(`[gate] verified ${r.handled} finished build(s)`); } catch (e) { console.log(`[gate] tick failed: ${e.message}`); } finally { busy = false; } };
setInterval(tick, cfg.tickSeconds * 1000); tick();
// Recovery path: even if every webhook is lost, a periodic scan keeps Jenkins in step with the repository.
setInterval(() => jenkins.triggerScan().catch((e) => console.log(`[gate] periodic scan failed: ${e.message}`)), cfg.scanEverySeconds * 1000);
// Push detection: a branch tip moved on GitHub -> scan Jenkins now (no webhook, tunnel or open port needed).
if (cfg.watchSeconds > 0) {
  const watcher = createRefWatcher({ repo: cfg.repo, token: githubToken });
  let polling = false, lastErr = "";
  setInterval(async () => {
    if (polling) return; polling = true;
    try {
      const r = await watcher.poll(); lastErr = "";
      if (r.changed) { console.log("[gate] push detected on GitHub: scanning Jenkins"); await jenkins.triggerScan(); }
    } catch (e) { if (e.message !== lastErr) { lastErr = e.message; console.log(`[gate] push watch failed: ${e.message}`); } }
    finally { polling = false; }
  }, cfg.watchSeconds * 1000);
}
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { state.save(); process.exit(0); });
