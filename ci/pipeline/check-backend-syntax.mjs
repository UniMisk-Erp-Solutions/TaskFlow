#!/usr/bin/env node
// The Express backend has no test suite. Until it gets one, every backend source file must at least
// parse (`node --check`), which catches the broken-merge / typo class of failures.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./config.mjs";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (/\.(c|m)?js$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(path.join(REPO_ROOT, "backend"));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) { bad++; console.error(`✘ ${path.relative(REPO_ROOT, f)}\n${r.stderr}`); }
}
console.log(`backend syntax: ${files.length - bad}/${files.length} files OK`);
process.exit(bad ? 1 : 0);
