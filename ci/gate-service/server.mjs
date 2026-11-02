// Two listeners, deliberately separate:
//   public  (what a tunnel / reverse proxy may expose):  POST /github    POST /github/<project>    GET /healthz
//   admin   (loopback only, never expose):               GET /status[/<project>]   GET /attestation[/<project>]/<sha>
// Everything else is 404, so exposing the public port reveals nothing about Jenkins or the gate.
// One gate serves several projects: every project has its own webhook secret, state, Jenkins folder and attestations,
// so a delivery for one project can never trigger, read or change another. `/github` belongs to the first (default) project.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { MAX_BODY_BYTES, createDebouncer, createRateLimiter, handleDelivery } from "./webhook.mjs";

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("too large"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(b), "cache-control": "no-store" }).end(b); };
const PROJECT_PATH = /^\/github\/([a-z][a-z0-9-]{1,30})$/;

/**
 * `projects`: [{ id, secret, allowedRepos, state, jenkins, attestDir }], the first one is the default.
 * The legacy single-project arguments (secret, state, jenkins, attestDir) still work and describe exactly one project.
 */
export function createServers({ cfg, secret, state, jenkins, attestDir, projects, log = console.log }) {
  const list = projects ?? [{ id: "default", secret, allowedRepos: cfg.allowedRepos, state, jenkins, attestDir }];
  const limiter = createRateLimiter(cfg.maxRequestsPerMinute);
  const stats = { received: 0, accepted: 0, rejected: 0, duplicates: 0, scans: 0, scanErrors: 0 };
  const byId = new Map(list.map((p) => [p.id, {
    ...p,
    scan: createDebouncer(async (n) => {
      try { await p.jenkins.triggerScan(); stats.scans += 1; p.state.data.scans = { count: (p.state.data.scans?.count || 0) + 1, last: new Date().toISOString() }; p.state.save(); log(`[gate] ${p.id}: scan triggered (${n} event(s) coalesced)`); }
      catch (e) { stats.scanErrors += 1; log(`[gate] ${p.id}: scan failed: ${e.message}`); }
    }, cfg.debounceMs),
  }]));
  const dflt = byId.get(list[0].id);

  const publicServer = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/healthz") return send(res, 200, { ok: true });
      const target = req.url === "/github" ? dflt : (PROJECT_PATH.exec(req.url || "") ? byId.get(PROJECT_PATH.exec(req.url)[1]) : null);
      if (req.method !== "POST" || !target) return send(res, 404, { error: "not found" });
      stats.received += 1;
      if (!limiter()) { stats.rejected += 1; return send(res, 429, { error: "rate limit" }); }
      const raw = await readBody(req, MAX_BODY_BYTES).catch((e) => (e.code === 413 ? null : Promise.reject(e)));
      if (raw === null) { stats.rejected += 1; return send(res, 413, { error: "payload too large; the periodic scan will pick the change up" }); }
      const out = handleDelivery({ headers: req.headers, raw, secret: target.secret, allowedRepos: target.allowedRepos, seen: (id) => target.state.seenDelivery(id) });
      if (out.code === 401 || out.code === 400 || out.code === 413) stats.rejected += 1; else if (out.body.duplicate) stats.duplicates += 1; else stats.accepted += 1;
      if (out.scan) target.scan.request();
      log(`[gate] ${target.id}: delivery ${req.headers["x-github-delivery"] || "-"} ${req.headers["x-github-event"] || "-"} -> ${out.code}${out.body.duplicate ? " duplicate" : ""}${out.body.ignored ? " ignored: " + out.body.ignored : ""}${out.scan ? " scan" : ""}`);
      send(res, out.code, out.body);
    } catch (e) { log(`[gate] error: ${e.message}`); send(res, 500, { error: "internal error" }); }
  });

  const view = (p) => ({ stats, statuses: p.state.data.statuses, scans: p.state.data.scans });
  const adminServer = http.createServer((req, res) => {
    const url = req.url || "";
    const sp = /^\/status\/([a-z][a-z0-9-]{1,30})$/.exec(url);
    const ap = /^\/attestation\/(?:([a-z][a-z0-9-]{1,30})\/)?([0-9a-f]{40})$/.exec(url);
    if (req.method === "GET" && url === "/status") return send(res, 200, { ...view(dflt), projects: Object.fromEntries([...byId].map(([id, p]) => [id, { builds: Object.keys(p.state.data.builds || {}).length, statuses: Object.keys(p.state.data.statuses || {}).length, scans: p.state.data.scans }])) });
    if (req.method === "GET" && sp && byId.has(sp[1])) return send(res, 200, view(byId.get(sp[1])));
    if (req.method === "GET" && ap) {
      const p = ap[1] ? byId.get(ap[1]) : dflt;
      if (!p) return send(res, 404, { error: "not found" });
      const f = path.join(p.attestDir, `${ap[2]}.json`);
      return fs.existsSync(f) ? (res.writeHead(200, { "content-type": "application/json" }), res.end(fs.readFileSync(f))) : send(res, 404, { error: "no attestation for that commit" });
    }
    send(res, 404, { error: "not found" });
  });

  return { publicServer, adminServer, stats, scan: dflt.scan };
}
