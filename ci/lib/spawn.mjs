// Spawn helpers that behave the same on Linux (Jenkins) and Windows (developer machines).
// On Windows npm/npx are .cmd files and need a shell, which splits unquoted arguments at spaces, so a
// checkout under a folder with a space in its name would break every stage. Quote once, here.
import { spawn, spawnSync } from "node:child_process";

const WIN = process.platform === "win32";
export const quoteArg = (a) => (WIN && /[\s"&|<>^()%!]/.test(String(a)) ? `"${String(a).replace(/"/g, '\\"')}"` : String(a));

function prepare(cmd, args, opts) {
  return WIN ? [quoteArg(cmd), args.map(quoteArg), { ...opts, shell: true }] : [cmd, args, opts];
}
export const spawnPortable = (cmd, args, opts = {}) => spawn(...prepare(cmd, args, opts));
export const spawnSyncPortable = (cmd, args, opts = {}) => spawnSync(...prepare(cmd, args, opts));
