// The team-list tool: adding/removing a developer is validated by the registry itself, so a typo cannot reach the server.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyChange } from "../tools/team.mjs";
import { parseRegistry } from "../gate-service/projects.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REG = JSON.parse(fs.readFileSync(path.join(HERE, "..", "projects.json"), "utf8"));

test("TEAM TOOL: add puts the user name in as a prefix, applies to every project, and does not touch the input", () => {
  const before = JSON.stringify(REG);
  const next = applyChange(REG, "add", "newdev", ["nd"]);
  assert.equal(JSON.stringify(REG), before, "the original registry is not mutated");
  const r = parseRegistry(next);
  for (const p of r.projects) {
    const d = p.developers.find((x) => x.user === "newdev");
    assert.ok(d, "every project takes the new developer: " + p.id);
    assert.deepEqual(d.prefixes, ["newdev", "nd"]);
  }
});

test("TEAM TOOL: remove takes the person out of every project; unknown or duplicate names and bad input are refused", () => {
  const some = REG.developers[0].user;
  const next = applyChange(REG, "remove", some);
  for (const p of parseRegistry(next).projects) assert.ok(!p.developers.some((d) => d.user === some), some + " is gone from " + p.id);
  assert.throws(() => applyChange(REG, "remove", "nobody-here"), /not in the team list/);
  assert.throws(() => applyChange(REG, "add", some), /already in the team list/);
  assert.throws(() => applyChange(REG, "add", "bad user!", []), /invalid developer user/);
  assert.throws(() => applyChange(REG, "add", "x", ["a.*"]), /prefixes must be/);
  assert.throws(() => applyChange(REG, "add", REG.admins[0], []), /admin cannot also be/);
});

test("TEAM TOOL: nothing about the CI server is stored in the tool (it comes from the environment)", () => {
  const src = fs.readFileSync(path.join(HERE, "..", "tools", "team.mjs"), "utf8");
  assert.doesNotMatch(src, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, "no IP address in the tool");
  assert.match(src, /process\.env\.CI_SERVER|need\("CI_SERVER"\)/);
});
