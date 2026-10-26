#!/usr/bin/env node
// Sends a correctly signed GitHub webhook to a running TaskFlow API so the integration can be
// tested locally without GitHub. See docs/github-integration.md ("Testing locally").
//
//   node scripts/github-webhook-simulate.mjs push \
//     --url http://127.0.0.1:54321/functions/v1/api/github/webhook --secret <GITHUB_WEBHOOK_SECRET> \
//     --installation 123 --github-id 4567 --login octocat --repo acme/web --task TF-1a2b3c4d
//
// Events: push | pr-opened | pr-ready | pr-merged | create | ping.   Add --bad-signature to
// confirm the endpoint rejects a forged request, and --delivery <id> to replay a delivery.
import { createHmac, randomUUID } from 'node:crypto';

const [, , event = 'push', ...rest] = process.argv;
const o = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith('--')) continue;
  const key = rest[i].slice(2);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) o[key] = true; else { o[key] = next; i++; }
}
const need = ['url', 'secret'];
if (event !== 'ping') need.push('installation', 'github-id', 'login', 'repo');
const missing = need.filter((k) => !o[k]);
if (missing.length) { console.error(`Missing: ${missing.map((m) => '--' + m).join(' ')}`); process.exit(2); }

const task = o.task || 'TF-00000000';
const repo = o.repo;
const sender = { id: Number(o['github-id']), login: o.login };
const common = { installation: { id: Number(o.installation) }, repository: { full_name: repo }, sender };
const sha = () => randomUUID().replace(/-/g, '') + 'abcdef01';
const prBase = (extra = {}) => ({
  number: Number(o.pr || 1), html_url: `https://github.com/${repo}/pull/${o.pr || 1}`, title: `Work on ${task}`, body: '',
  state: 'open', draft: false, merged: false, user: sender,
  head: { ref: o.branch || `feature/${task}-demo`, sha: o.sha || sha(), repo: { full_name: repo } }, ...extra,
});

const payloads = {
  ping: { zen: 'Keep it logically awesome.' },
  push: {
    ...common, ref: `refs/heads/${o.branch || `feature/${task}-demo`}`,
    commits: [{ id: o.sha || sha(), message: o.message || `${task} implement the feature`, url: `https://github.com/${repo}/commit/${o.sha || 'abc'}`, author: { username: o.login } }],
  },
  create: { ...common, ref_type: 'branch', ref: o.branch || `feature/${task}-demo` },
  'pr-opened': { ...common, action: 'opened', pull_request: prBase({ draft: !!o.draft }) },
  'pr-ready': { ...common, action: 'ready_for_review', pull_request: prBase() },
  'pr-merged': { ...common, action: 'closed', pull_request: prBase({ state: 'closed', merged: true }) },
};
const payload = payloads[event];
if (!payload) { console.error(`Unknown event "${event}". Use: ${Object.keys(payloads).join(', ')}`); process.exit(2); }
const ghEvent = event === 'ping' ? 'ping' : event.startsWith('pr-') ? 'pull_request' : event;

const body = JSON.stringify(payload);
const signature = 'sha256=' + createHmac('sha256', o['bad-signature'] ? 'wrong-secret' : o.secret).update(body).digest('hex');
const headers = {
  'Content-Type': 'application/json',
  'X-GitHub-Event': ghEvent,
  'X-GitHub-Delivery': o.delivery || randomUUID(),
  'X-Hub-Signature-256': signature,
  'User-Agent': 'GitHub-Hookshot/simulator',
};
if (o.apikey) { headers.apikey = o.apikey; headers.Authorization = `Bearer ${o.apikey}`; } // Supabase gateway, if JWT verification is on

const res = await fetch(o.url, { method: 'POST', headers, body });
console.log(`${ghEvent} -> HTTP ${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
