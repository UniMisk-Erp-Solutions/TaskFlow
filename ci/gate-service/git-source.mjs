// A bare mirror of the repository, used to learn facts about a commit from Git itself (tree hash and the hashes of the
// pipeline files) instead of believing the build agent. The mirror is read-only data; no code from it is ever executed.
import { execFile } from "node:child_process";
import fs from "node:fs";
import { PINNED_PATHS } from "./evaluate.mjs";

const REFSPECS = ["+refs/heads/*:refs/heads/*", "+refs/pull/*/head:refs/pull/*/head"];

function defaultRunGit(args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 16e6, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (err, stdout, stderr) => {
      if (err) reject(new Error(`git ${args[0]} failed: ${String(stderr || err.message).split("\n")[0].replace(/(Bearer|Basic) \S+/g, "$1 ***")}`)); else resolve(stdout.trim());
    });
  });
}

export function createGitSource({ mirrorDir, sourceUrl, token, runGit = defaultRunGit }) {
  const auth = token && /^https:\/\//.test(sourceUrl) ? ["-c", `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`] : [];
  async function ensure() {
    if (!fs.existsSync(`${mirrorDir}/HEAD`)) { fs.mkdirSync(mirrorDir, { recursive: true }); await runGit(["init", "--bare", "-q", mirrorDir]); }
  }
  return {
    async refresh() { await ensure(); await runGit([...auth, "-C", mirrorDir, "fetch", "--prune", "--no-tags", "-q", sourceUrl, ...REFSPECS]).catch(async (e) => { if (/couldn't find remote ref refs\/pull/.test(e.message)) return runGit([...auth, "-C", mirrorDir, "fetch", "--prune", "--no-tags", "-q", sourceUrl, REFSPECS[0]]); throw e; }); },
    /** { tree, pinned: { path: objectHash|null } } for a commit, or null when the commit is unknown. */
    async inspect(sha) {
      if (!/^[0-9a-f]{40}$/.test(sha)) return null;
      let tree;
      try { tree = await runGit(["-C", mirrorDir, "rev-parse", "--verify", "--quiet", `${sha}^{tree}`]); } catch { return null; }
      const pinned = {};
      for (const p of PINNED_PATHS) { try { pinned[p] = await runGit(["-C", mirrorDir, "rev-parse", "--verify", "--quiet", `${sha}:${p}`]); } catch { pinned[p] = null; } }
      return { tree, pinned };
    },
  };
}
