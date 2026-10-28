// Push detection by conditional polling: no inbound connection, no webhook. Run: node --test ci/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRefWatcher } from "../gate-service/ref-watcher.mjs";

const ref = (name, sha) => ({ ref: `refs/heads/${name}`, object: { sha } });
const reply = (status, body, etag) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => etag ?? null }, json: async () => body });

test("push watcher: the first poll is only a baseline, an unchanged repo answers 304, and a moved tip or new branch is a change", async () => {
  const seen = [];
  const script = [
    reply(200, [ref("main", "a"), ref("x", "b")], "e1"),
    reply(304),
    reply(200, [ref("main", "a"), ref("x", "c")], "e2"),   // a push to x
    reply(200, [ref("main", "a"), ref("x", "c"), ref("y", "d")], "e3"), // a new branch
    reply(200, [ref("main", "a"), ref("x", "c")], "e4"),   // a branch deleted: nothing to build
  ];
  const w = createRefWatcher({ repo: "o/r", token: "t", fetchImpl: async (url, init) => { seen.push({ url, h: init.headers }); return script.shift(); } });
  assert.deepEqual(await w.poll(), { changed: false });
  assert.deepEqual(await w.poll(), { changed: false });
  assert.deepEqual(await w.poll(), { changed: true });
  assert.deepEqual(await w.poll(), { changed: true });
  assert.deepEqual(await w.poll(), { changed: false });
  assert.match(seen[0].url, /repos\/o\/r\/git\/matching-refs\/heads$/);
  assert.equal(seen[0].h["if-none-match"], undefined);
  assert.equal(seen[1].h["if-none-match"], "e1", "conditional request: unchanged answers are free");
  assert.equal(seen[0].h.authorization, "Bearer t");
});

test("push watcher: GitHub errors are reported (not silently treated as no change) and a bad repo name is refused", async () => {
  const w = createRefWatcher({ repo: "o/r", fetchImpl: async () => reply(403) });
  await assert.rejects(() => w.poll(), /HTTP 403/);
  assert.throws(() => createRefWatcher({ repo: "not a repo" }), /owner\/name/);
});
