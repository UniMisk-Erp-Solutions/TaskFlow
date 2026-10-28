#!/usr/bin/env node
// Sends a SIGNED, GitHub-shaped webhook delivery to a gate, for testing. THIS IS NOT GITHUB: it proves the gate and
// Jenkins behave correctly for such deliveries, not that GitHub can reach the gate. Run it where the secret is mounted:
//   docker exec taskflow-gate node ci/gate-service/simulate-delivery.mjs push --ref refs/heads/feature/x --sha <40-hex>
// Cases: push | pr | ping | bad-signature | no-signature | replay | wrong-repo | fork-pr | big
import { sign } from "./webhook.mjs";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const [kind = "push", ...rest] = process.argv.slice(2);
const opt = (k, d) => (rest.includes(`--${k}`) ? rest[rest.indexOf(`--${k}`) + 1] : d);
const repo = opt("repo", process.env.GATE_REPO || "UniMisk-Erp-Solutions/TaskFlow");
const url = opt("url", "http://127.0.0.1:8089/github");
const secret = fs.readFileSync(process.env.GATE_WEBHOOK_SECRET_FILE, "utf8").trim();
const sha = opt("sha", "0".repeat(40));
const delivery = opt("delivery", randomUUID());

let event = "push", payload = { ref: opt("ref", "refs/heads/feature/x"), after: sha, repository: { full_name: repo } }, signWith = secret, withSig = true;
if (kind === "pr") { event = "pull_request"; payload = { action: "synchronize", number: 1, repository: { full_name: repo }, pull_request: { head: { sha, repo: { full_name: repo } } } }; }
if (kind === "fork-pr") { event = "pull_request"; payload = { action: "synchronize", number: 2, repository: { full_name: repo }, pull_request: { head: { sha, repo: { full_name: "stranger/TaskFlow" } } } }; }
if (kind === "ping") { event = "ping"; payload = { zen: "test", repository: { full_name: repo } }; }
if (kind === "wrong-repo") payload.repository.full_name = "someone/else";
if (kind === "bad-signature") signWith = "not-the-secret";
if (kind === "no-signature") withSig = false;
if (kind === "big") payload.padding = "x".repeat(1_100_000);

const raw = Buffer.from(JSON.stringify(payload));
const headers = { "content-type": "application/json", "x-github-event": event, "x-github-delivery": delivery };
if (withSig) headers["x-hub-signature-256"] = sign(signWith, raw);
const res = await fetch(url, { method: "POST", headers, body: raw });
console.log(`${kind}: HTTP ${res.status} ${await res.text()}`);
