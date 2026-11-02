#!/usr/bin/env node
// Manage the ONE team list in ci/projects.json (every project takes the whole team unless it names a subset).
//   node ci/tools/team.mjs list
//   node ci/tools/team.mjs add <github-user> [prefix[,prefix...]]   (the user name is always a prefix; "naveena246 naveena" => naveena246/ and naveena/)
//   node ci/tools/team.mjs remove <github-user>
//   add --deploy / remove --deploy   also commits, pushes, bundles and rolls the change out on the CI server
// The deploy step reads its target from the environment (nothing about the server is stored in the repository):
//   CI_SERVER=user@host   CI_SSH_KEY=path-to-private-key   CI_PLATFORM_REMOTE=git-url   CI_SERVER_DIR=taskflow-ci (optional)   CI_DEPLOY_PROJECT=<project id> (optional)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseRegistry } from "../gate-service/projects.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const REGISTRY = path.join(ROOT, "ci", "projects.json");

/** Pure: returns the new registry JSON, or throws with a plain message. Validation is the registry's own (a mistake can never reach the server). */
export function applyChange(json, op, user, prefixes = []) {
  const next = JSON.parse(JSON.stringify(json));
  next.developers = next.developers ?? [];
  const at = next.developers.findIndex((d) => d.user.toLowerCase() === String(user).toLowerCase());
  if (op === "add") {
    if (at >= 0) throw new Error(`${user} is already in the team list`);
    next.developers.push({ user, prefixes: [...new Set([user, ...prefixes])] });
  } else if (op === "remove") {
    if (at < 0) throw new Error(`${user} is not in the team list`);
    next.developers.splice(at, 1);
    for (const p of next.projects) if (Array.isArray(p.developers) && p.developers.every((d) => typeof d === "string")) p.developers = p.developers.filter((u) => u.toLowerCase() !== String(user).toLowerCase());
  } else throw new Error(`unknown operation: ${op}`);
  parseRegistry(next);
  return next;
}

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 2).join(" ")} failed (exit ${r.status})`);
};

function deploy(registry, summary) {
  const need = (k) => process.env[k] || (() => { throw new Error(`set ${k} (see the header of ci/tools/team.mjs)`); })();
  const server = need("CI_SERVER"), key = need("CI_SSH_KEY"), remote = need("CI_PLATFORM_REMOTE");
  const dir = process.env.CI_SERVER_DIR || "taskflow-ci";
  const reg = parseRegistry(registry);
  const via = reg.projects.find((p) => p.id === (process.env.CI_DEPLOY_PROJECT || reg.projects[reg.projects.length - 1].id));
  if (!via) throw new Error("CI_DEPLOY_PROJECT is not a registered project");
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  sh("git", ["add", "ci/projects.json", "ci/jenkins/casc"]);
  sh("git", ["commit", "-m", `chore(ci): team list: ${summary}`]);
  sh("git", ["push", remote, `HEAD:refs/heads/${branch}`]);
  const bundle = path.join(process.env.TEMP || "/tmp", "taskflow-addproj.bundle");
  sh("git", ["bundle", "create", bundle, `refs/heads/${branch}`]);
  const ssh = ["-i", key, "-o", "BatchMode=yes"];
  sh("scp", [...ssh, bundle, `${server}:${dir}/`]);
  const remoteCmd = `rm -f ~/${dir}/add-project.log; cd ~/${dir} && (setsid nohup bash add-project.sh ${via.id} ${via.repo} ~/${dir}/taskflow-addproj.bundle > add-project.log 2>&1 < /dev/null &); sleep 2; echo started`;
  sh("ssh", [...ssh, server, remoteCmd]);
  console.log(`\nRolling out on the server (about 10 minutes). Watch: ssh ${ssh.join(" ")} ${server} 'tail -f ~/${dir}/add-project.log'  (finished when it prints ADDPROJECT-DONE)`);
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const [cmd, user, pre] = argv.filter((a) => !a.startsWith("--"));
  const json = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  if (cmd === "list") {
    for (const d of parseRegistry(json).projects[0].developers) console.log(`${d.user}\t${d.prefixes.join(", ")}`);
    return;
  }
  if (!["add", "remove"].includes(cmd) || !user) { console.error("usage: team.mjs list | add <github-user> [prefixes,comma-separated] | remove <github-user>   [--deploy]"); process.exit(2); }
  const next = applyChange(json, cmd, user, pre ? pre.split(",").filter(Boolean) : []);
  fs.writeFileSync(REGISTRY, JSON.stringify(next, null, 2) + "\n");
  sh("node", ["ci/jenkins/generate.mjs"]);
  console.log(`${cmd === "add" ? "Added" : "Removed"} ${user}. Registry validated and Jenkins config regenerated.`);
  if (flags.includes("--deploy")) deploy(next, `${cmd} ${user}`);
  else console.log("Not rolled out yet: re-run with --deploy, or commit and deploy as usual.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
}
