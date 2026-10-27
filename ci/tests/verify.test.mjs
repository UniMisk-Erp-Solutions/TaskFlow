// Tests for: secret scanner, production/preview separation, GitHub check publishing. Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppJwt, publishCheck } from "../lib/github-check.mjs";
import { scanText } from "../pipeline/scan-credentials.mjs";
import { checkDist, checkVercelEnv, scanForProductionHosts } from "../verify/env-separation.mjs";

// ── secret scanner ────────────────────────────────────────────────────────────
test("secret scanner flags real-looking secrets and ignores placeholders", () => {
  const bad = [
    "-----BEGIN RSA " + "PRIVATE KEY-----", // assembled so this file itself stays clean for the secret scanner
    "const t = 'ghp_" + "a".repeat(36) + "'",
    "AKIA" + "A".repeat(16),
    "postgres://admin:" + "hunter2hunter2" + "@db.prod.internal/app",
    "api_key = \"" + "Ab1".repeat(10) + "\"",
  ];
  for (const line of bad) assert.ok(scanText(line).length > 0, `should flag: ${line.slice(0, 30)}`);
  const good = [
    "VITE_API_URL=http://localhost:3001/api",
    "const password = process.env.PASSWORD;",
    "api_key: 'your-api-key-here-please-change'",
    "postgres://user:pass@localhost:5432/db",
    "secret = ''",
    'git push "https://oauth2:${TOKEN}@github.com/o/r.git" HEAD:main',
    "await put('/github/token', { token: 'fake-token-for-tests-1234567890' })",
  ];
  for (const line of good) assert.deepEqual(scanText(line), [], `should not flag: ${line}`);
});

test("secret scanner reports file:line + rule but never the value", () => {
  const hits = scanText("x\nconst k = 'ghp_" + "z".repeat(36) + "'");
  assert.deepEqual(hits, [{ line: 2, rule: "github-token" }]);
  assert.equal(JSON.stringify(hits).includes("zzzz"), false);
});

// ── preview / production separation ───────────────────────────────────────────
test("dist that bakes in the production backend is rejected", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-dist-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<div id=root></div>");
  fs.writeFileSync(path.join(dir, "app.js"), 'fetch("https://taskflow-backend.unimisk.com/api")');
  assert.match(checkDist(dir).join("\n"), /taskflow-backend\.unimisk\.com/);
  fs.writeFileSync(path.join(dir, "app.js"), 'fetch("http://127.0.0.1:4010/api")');
  assert.deepEqual(checkDist(dir), []);
  assert.match(checkDist(path.join(dir, "missing"))[0], /not found/);
});

test("scanForProductionHosts is case-insensitive", () => {
  assert.deepEqual(scanForProductionHosts("https://TaskFlow-Backend.UniMisk.com/x"), ["taskflow-backend.unimisk.com"]);
});

test("Vercel env audit: shared prod+preview values, missing preview values and prod hosts in preview are all caught", () => {
  const keys = ["VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const good = keys.flatMap((key) => [{ key, target: ["production"] }, { key, target: ["preview"], value: "https://staging.example.test" }]);
  assert.deepEqual(checkVercelEnv(good), []);

  const shared = keys.map((key) => ({ key, target: ["production", "preview"] }));
  assert.match(checkVercelEnv(shared).join("\n"), /shared between production and preview/);

  const noPreview = keys.map((key) => ({ key, target: ["production"] }));
  assert.match(checkVercelEnv(noPreview).join("\n"), /no Preview-specific value/);

  const leak = good.map((e) => (e.key === "VITE_API_URL" && e.target[0] === "preview" ? { ...e, value: "https://taskflow-backend.unimisk.com/api" } : e));
  assert.match(checkVercelEnv(leak).join("\n"), /preview\/development\) points at a production host/);

  assert.match(checkVercelEnv([]).join("\n"), /not defined/);
});

// ── GitHub check run ──────────────────────────────────────────────────────────
test("publishCheck: skipped without App credentials, only success|failure, correct API calls", async () => {
  assert.equal((await publishCheck({ repo: "o/r", sha: "a", name: "unimisk/verified", conclusion: "success", title: "t", summary: "s", env: {} })).skipped, true);

  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = { GITHUB_APP_ID: "123", GITHUB_APP_INSTALLATION_ID: "456", GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }) };
  await assert.rejects(() => publishCheck({ repo: "o/r", sha: "a", name: "n", conclusion: "neutral", title: "t", summary: "s", env, fetchImpl: async () => ({}) }), /success" or "failure/);

  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.authorization });
    return { ok: true, status: 201, json: async () => (url.includes("access_tokens") ? { token: "inst-token" } : { id: 99 }) };
  };
  const r = await publishCheck({ repo: "UniMisk-Erp-Solutions/TaskFlow", sha: "abc", name: "unimisk/verified", conclusion: "failure", title: "Not verified", summary: "lint=FAIL", env, fetchImpl });
  assert.deepEqual(r, { ok: true, id: 99 });
  assert.match(calls[0].url, /\/app\/installations\/456\/access_tokens$/);
  assert.equal(calls[0].body.permissions.checks, "write");
  assert.equal(calls[1].auth, "Bearer inst-token");
  assert.equal(calls[1].body.conclusion, "failure");
  assert.equal(calls[1].body.head_sha, "abc");
  assert.equal(createAppJwt("1", env.GITHUB_APP_PRIVATE_KEY).split(".").length, 3);
});

