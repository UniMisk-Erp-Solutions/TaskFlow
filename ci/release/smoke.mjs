#!/usr/bin/env node
// Read-only health check of a deployed site: one GET, must answer 200 with HTML. Used after a promotion and by the
// scheduled Jenkins monitor idea in docs. It never writes anything.
//   node ci/release/smoke.mjs --url https://example.vercel.app [--expect "<div id=\"root\""]
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function smoke({ url, expect = "<html", fetchImpl = fetch, timeoutMs = 20000 }) {
  if (!/^https:\/\//.test(url || "")) return { ok: false, reason: "url must be https://" };
  try {
    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.text();
    if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
    if (!body.toLowerCase().includes(expect.toLowerCase())) return { ok: false, reason: `expected text "${expect}" not found` };
    return { ok: true, reason: "healthy" };
  } catch (e) { return { ok: false, reason: e.message }; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
  const r = await smoke({ url: opt("url"), expect: opt("expect", "<html") });
  console.log(r.ok ? `✔ ${opt("url")} ${r.reason}` : `✘ ${opt("url")} ${r.reason}`);
  process.exit(r.ok ? 0 : 1);
}
