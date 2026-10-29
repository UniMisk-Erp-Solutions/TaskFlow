// Two listeners, deliberately separate:
//   public  (what a tunnel / reverse proxy may expose):  POST /github    GET /healthz
//   admin   (loopback only, never expose):               GET /status     GET /attestation/<sha>
// Everything else is 404, so exposing the public port reveals nothing about Jenkins or the gate.
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

export function createServers({ cfg, secret, state, jenkins, attestDir, log = console.log }) {
  const limiter = createRateLimiter(cfg.maxRequestsPerMinute);
  const stats = { received: 0, accepted: 0, rejected: 0, duplicates: 0, scans: 0, scanErrors: 0 };
  const scan = createDebouncer(async (n) => {
    try { await jenkins.triggerScan(); stats.scans += 1; state.data.scans = { count: stats.scans, last: new Date().toISOString() }; state.save(); log(`[gate] scan triggered (${n} event(s) coalesced)`); }
    catch (e) { stats.scanErrors += 1; log(`[gate] scan failed: ${e.message}`); }
  }, cfg.debounceMs);

  const publicServer = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/healthz") return send(res, 200, { ok: true });
      if (req.method !== "POST" || req.url !== "/github") return send(res, 404, { error: "not found" });
      stats.received += 1;
      if (!limiter()) { stats.rejected += 1; return send(res, 429, { error: "rate limit" }); }
      const raw = await readBody(req, MAX_BODY_BYTES).catch((e) => (e.code === 413 ? null : Promise.reject(e)));
      if (raw === null) { stats.rejected += 1; return send(res, 413, { error: "payload too large; the periodic scan will pick the change up" }); }
      const out = handleDelivery({ headers: req.headers, raw, secret, allowedRepos: cfg.allowedRepos, seen: (id) => state.seenDelivery(id) });
      if (out.code === 401 || out.code === 400 || out.code === 413) stats.rejected += 1; else if (out.body.duplicate) stats.duplicates += 1; else stats.accepted += 1;
      if (out.scan) scan.request();
      log(`[gate] delivery ${req.headers["x-github-delivery"] || "-"} ${req.headers["x-github-event"] || "-"} -> ${out.code}${out.body.duplicate ? " duplicate" : ""}${out.body.ignored ? " ignored: " + out.body.ignored : ""}${out.scan ? " scan" : ""}`);
      send(res, out.code, out.body);
    } catch (e) { log(`[gate] error: ${e.message}`); send(res, 500, { error: "internal error" }); }
  });

  const adminServer = http.createServer((req, res) => {
    const m = /^\/attestation\/([0-9a-f]{40})$/.exec(req.url || "");
    if (req.method === "GET" && req.url === "/status") return send(res, 200, { stats, statuses: state.data.statuses, scans: state.data.scans });
    if (req.method === "GET" && m) { const f = path.join(attestDir, `${m[1]}.json`); return fs.existsSync(f) ? (res.writeHead(200, { "content-type": "application/json" }), res.end(fs.readFileSync(f))) : send(res, 404, { error: "no attestation for that commit" }); }
    send(res, 404, { error: "not found" });
  });

  return { publicServer, adminServer, stats, scan };
}
