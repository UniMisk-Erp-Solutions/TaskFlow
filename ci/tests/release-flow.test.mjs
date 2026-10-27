// Free production workflow: promotion by branch (no Vercel token), read-only health check, review files.
// Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { smoke } from "../release/smoke.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

test("promotion is a plain fast-forward push of the approved commit to `production`: no force, no Vercel token, default dry run", () => {
  const t = read("ci/release/deploy-authorized.mjs");
  assert.match(t, /refs\/heads\/production/);
  assert.doesNotMatch(t, /--force|-f\b|VERCEL_TOKEN|vercel@latest/);
  assert.match(t, /RELEASE_DEPLOY_ENABLED === "yes"/);
});

test("health check: healthy only on HTTP 200 containing the expected text over https", async () => {
  const ok = (status, body) => async () => ({ status, text: async () => body });
  assert.equal((await smoke({ url: "https://x.test", fetchImpl: ok(200, "<HTML>hi") })).ok, true);
  assert.equal((await smoke({ url: "https://x.test", fetchImpl: ok(500, "<html>") })).ok, false);
  assert.equal((await smoke({ url: "https://x.test", fetchImpl: ok(200, "oops"), expect: "<html" })).ok, false);
  assert.equal((await smoke({ url: "http://x.test", fetchImpl: ok(200, "<html>") })).ok, false);
  assert.equal((await smoke({ url: "https://x.test", fetchImpl: async () => { throw new Error("down"); } })).ok, false);
});

test("review files exist and the monitor job holds no credentials", () => {
  assert.match(read(".github/CODEOWNERS"), /\/ci\//);
  assert.match(read(".github/pull_request_template.md"), /unimisk\/verified/);
  const gh = read("ci/jenkins/casc/github.yaml");
  const monitor = gh.slice(gh.indexOf("taskflow-monitor"));
  assert.match(monitor, /MONITOR_URL/);
  assert.doesNotMatch(monitor, /credentials|token|password|\$\{/i);
});
