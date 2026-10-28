#!/usr/bin/env node
// Branch protection for `main`: an unverified PR cannot be merged, and only an admin merges.
// DRY RUN by default — prints exactly what would be sent. Nothing is changed unless you pass --apply
// AND set APPROVED_BY (the admin who approved) AND GITHUB_ADMIN_TOKEN (a repo-admin token).
//
//   GITHUB_APP_ID=<id> ADMIN_LOGINS=alice,bob node ci/github/branch-protection.mjs            # dry run
//   ... APPROVED_BY="Alice" GITHUB_ADMIN_TOKEN=... node ci/github/branch-protection.mjs --apply
//
// Rules applied to `main`
//   * the `unimisk/verified` status must pass (optionally pinned to a GitHub App id) and the branch must be up to date (strict)
//   NOTE: GitHub Free does NOT enforce branch protection on PRIVATE repositories (it needs Team/Enterprise, or a public
//   repository). On Free this script is inert; deployment is protected by the release gate in ci/release instead.
//   * a pull request is required, with 1 approving review from a CODEOWNER (admin), stale approvals
//     dismissed on new commits, and the most recent pusher cannot approve their own push
//   * enforce_admins: admins are bound by the same rules (no silent bypass)
//   * direct pushes are restricted to the admin list, force-push and deletion are blocked
//   * repository auto-merge is switched OFF so nothing merges without a human clicking merge
import { STATUS_CONTEXT as GITHUB_CHECK_NAME } from "../lib/github-status.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REPO = "UniMisk-Erp-Solutions/TaskFlow";
export const BRANCH = "main";

export function buildPayload({ appId, admins }) {
  if (appId && !/^\d+$/.test(String(appId))) throw new Error("GITHUB_APP_ID must be the numeric id of the GitHub App");
  if (!admins?.length) throw new Error("ADMIN_LOGINS must list at least one admin (they are the only ones allowed to push/merge)");
  return {
    required_status_checks: { strict: true, checks: [appId ? { context: GITHUB_CHECK_NAME, app_id: Number(appId) } : { context: GITHUB_CHECK_NAME }] },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
      require_last_push_approval: true,
    },
    restrictions: { users: admins, teams: [], apps: [] },
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
  };
}

export const REPO_SETTINGS = { allow_auto_merge: false, delete_branch_on_merge: true };

async function call(method, url, body, token) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json", "user-agent": "unimisk-ci" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json.message || ""}`);
  return json;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const apply = process.argv.includes("--apply");
  const payload = buildPayload({ appId: process.env.GITHUB_APP_ID, admins: (process.env.ADMIN_LOGINS || "").split(",").map((s) => s.trim()).filter(Boolean) });
  console.log(`${apply ? "APPLYING" : "DRY RUN — nothing will be changed"}: ${REPO} branch ${BRANCH}\n`);
  console.log(`PUT   /repos/${REPO}/branches/${BRANCH}/protection\n${JSON.stringify(payload, null, 2)}\n`);
  console.log(`PATCH /repos/${REPO}\n${JSON.stringify(REPO_SETTINGS, null, 2)}\n`);
  if (!apply) { console.log("Re-run with --apply, APPROVED_BY and GITHUB_ADMIN_TOKEN to enforce."); process.exit(0); }
  if (!process.env.APPROVED_BY) { console.error("✘ refusing: set APPROVED_BY to the approving admin's name"); process.exit(1); }
  if (!process.env.GITHUB_ADMIN_TOKEN) { console.error("✘ refusing: GITHUB_ADMIN_TOKEN is not set"); process.exit(1); }
  await call("PUT", `/repos/${REPO}/branches/${BRANCH}/protection`, payload, process.env.GITHUB_ADMIN_TOKEN);
  await call("PATCH", `/repos/${REPO}`, REPO_SETTINGS, process.env.GITHUB_ADMIN_TOKEN);
  console.log(`✔ applied (approved by ${process.env.APPROVED_BY})`);
}
