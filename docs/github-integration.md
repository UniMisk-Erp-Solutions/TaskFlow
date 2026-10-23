# GitHub Integration

TaskFlow connects to GitHub through a **GitHub App**. Once the app is installed on the GitHub account or organization that owns the repository (any TaskFlow user can do this) and each employee connects their GitHub account, pushing code or opening a pull request in the task's repository, or one that references the task, links that activity to the task and automatically moves it from **In Progress** to **Done (pending admin approval)**. The admin is notified and approves the task or requests changes with the existing review actions. Everything runs from GitHub webhooks into the API, so it works while TaskFlow is closed.

```
User connects GitHub → pushes code / opens PR → webhook reaches the API → task identified
→ commits/branch/PR linked → In Progress → Done (status "submitted") → admin notified → approve / request changes
```

## Where it runs

The integration lives in the **Supabase Edge API** (`supabase/functions/api`), which is the API the hosted frontend uses. The legacy Express API in `backend/` does not implement the review endpoints either and has no GitHub routes.

| Piece | Location |
| --- | --- |
| Pure logic + webhook processing (task matching, authorization, dedupe, auto-submit) | `supabase/functions/api/github.ts` |
| HTTP routes, OAuth/installation callbacks, webhook endpoint, notifications wiring | `supabase/functions/api/index.ts` (section "GitHub integration", before `Deno.serve`) |
| Database schema | `supabase/migrations/20261022120000_github_integration.sql` |
| Settings → Integrations GitHub card | `frontend/src/components/GithubConnectCard.jsx` (rendered by `NotificationSettings.jsx`) |
| GitHub section inside a task | `frontend/src/components/TaskGithubSection.jsx` (rendered by `TaskDetailModal.jsx`) |
| History labels for link/unlink events | `frontend/src/components/HistoryTimeline.jsx` |
| Backend tests | `supabase/tests/github-integration.test.mjs` |
| Frontend tests | `frontend/src/components/__tests__/GithubIntegration.test.jsx` |
| Local webhook simulator | `scripts/github-webhook-simulate.mjs` |

## How it works

### Connecting accounts

- **Employee / admin:** Settings → Integrations → **Connect GitHub**. This uses the GitHub App's user authorization (OAuth) page. TaskFlow reads the GitHub numeric id and login, stores only those in `github_connections`, and immediately invalidates the OAuth token. No GitHub token is stored. **Disconnect** deletes the row. One GitHub account can belong to only one TaskFlow user.
- **Install the app (any user):** the same card shows **Install GitHub App** to every user who has connected their GitHub account; an admin is not required. After installing on a personal account or organization and choosing repositories on GitHub, GitHub redirects back and TaskFlow links the installation to the installer's organization (`github_installations`, with `installed_by`). Repositories are authorized on GitHub (the installation's repository selection); nothing is configured per repository in TaskFlow. **Choose repositories** opens the installation page on GitHub; **Unlink** stops TaskFlow processing that installation and is available to admins and to the person who linked it.
- Connecting your GitHub login does **not** grant repository access. GitHub only sends events for repositories where the app is installed. If you are a contributor to a repository owned by another person or organization, its owner or an organization owner must approve/install the TaskFlow GitHub App and grant it that repository. If an owner approves later, GitHub does not pass TaskFlow's signed state back, so the installation row has to be added manually (`insert into github_installations(installation_id, org_id, account_login) ...`, the id is in the installation's settings URL).
- The OAuth `state` is an HMAC-signed, 10-minute token bound to the user. Installation links are bound to the installing user and organization, require that user to have connected GitHub, and are verified with GitHub using the App's private key (the installation must exist and belong to this app). An installation on a **personal** GitHub account can only be linked by the owner of that account (their connected GitHub id must match); an installation already linked to another organization is refused. Residual trust: for an *organization* installation, any member of the TaskFlow organization who has connected GitHub can claim an unclaimed installation id of this app; pushes still only ever affect tasks assigned to connected users.

### Identifying the task

Every task has a reference: `TF-` plus the first 8 hex characters of its id (shown in the task's GitHub section with a copy button). Activity is matched to tasks by, in order of all that apply:

1. The reference (case-insensitive) in the **branch name**, any **commit message**, or the **PR title/body** — e.g. `feature/TF-1a2b3c4d-login-form`. The full task UUID also works.
2. An **explicitly linked** branch or pull request (task → GitHub → *Link*: a PR/branch/commit URL, `owner/repo#12`, or `owner/repo:branch`). After that, no reference is needed in names or messages.

3. The task's **repository** (see below), when there is no reference and no explicit link.

A reference is only resolved inside the installation's organization. A prefix that matches more than one task is never guessed.

### Task repository (no reference needed)

When creating a task you can enter **GitHub repository** (`owner/repo`, a github.com URL or an ssh remote; optionally a branch). Assignees and admins can also set, change or clear it later in the task's GitHub section. The migration `supabase/migrations/20261023120000_task_github_repo.sql` adds `tasks.github_repo` and `tasks.github_branch`.

With a repository set, a push (or pull request) by an assignee in that repository counts for the task without a `TF-` reference. To avoid completing the wrong task, repository matching is deliberately narrow:

- it is used only when the event has no reference and no explicit link (a reference always wins);
- only the pusher's (PR author's) own tasks that are **In Progress** in that repository count, and on the task's branch if one is set;
- if more than one such task matches, nothing happens (`ignored:ambiguous_repo_match`) — put the reference in the branch/commit/PR to pick one;
- tasks not In Progress are not matched by repository.

### What counts as qualifying activity

| Event | Linked | Moves the task |
| --- | --- | --- |
| Push to a branch with at least one commit | Commits (and the branch when it is the matching branch) | Yes |
| Branch created (`create`) | Branch | No |
| PR opened / reopened / marked ready for review / new commits pushed / merged | PR (state kept up to date) | Yes (non-draft only) |
| Draft PR, PR edits that add nothing new, PR closed without merging, tags, branch deletions | Draft/edit: PR; others ignored | No |

A task is moved only when it is **In Progress** (`kanban_column = in_progress`, status `in_progress` or `rejected`) **and** the delivery carries something new (a commit not linked before, a new PR head commit, or a newly merged PR). It then becomes status `submitted`, lane **Done**, with `work_ended_at` set, open timers closed, `submission_notes` explaining which GitHub activity triggered it, and a `submitted` entry in the task history attributed to the employee. This is the same state the employee "send for review" action produces, so the admin's **Review** queue and approve / request-changes actions work unchanged.

A task in To Do/Backlog still gets the links but is not moved; tasks already awaiting review or completed are never changed. After an admin rejects a task (it returns to In Progress), only genuinely new commits resubmit it — replaying old commits does not.

### Who is allowed

The person who pushed (or the PR author for pull request events) must:

1. have connected their GitHub account in TaskFlow,
2. belong to the same organization as the installation, and
3. be an **assignee** of the task.

Anyone else — an unconnected GitHub user, an assignee of a different task, even an admin who is not assigned — causes nothing: no link, no status change. (Their delivery is recorded in `github_events.result`, e.g. `not_assignee:1`.) Admins can still link/unlink manually and approve or reject as before.

### Notifications

On auto-submit, the existing web-push system sends **Task ready for review** to the organization's admins and the other assignees, and a confirmation to the employee. Delivery follows each user's existing push settings (Settings → Notifications). The task also appears in the admin pending-review count and Review queue, and the board updates through the existing realtime subscription.

### Duplicates and reliability

- `github_events.delivery_id` (`X-GitHub-Delivery`) makes redeliveries no-ops. If processing fails, the claim is released and the API returns 500, so GitHub's redelivery can succeed.
- Link rows are unique per `(task, kind, repository, ref)`; the In Progress → Done update is a single conditional write, so simultaneous deliveries submit once.
- Webhooks are processed synchronously before the response, because the edge runtime may stop background work after responding.

### Task detail view

Each task's detail dialog has a **GitHub** section: the task reference, the task's repository (editable by assignees and admins), linked pull requests (with state), branches and commits (author, repository, time, link to GitHub), and a field to link a PR/branch manually. Assignees and admins can remove manual links; links created automatically can be removed only by an admin. Link/unlink actions appear in the task history.

## API

All authenticated routes use the normal TaskFlow bearer token.

| Method and path | Who | Purpose |
| --- | --- | --- |
| `POST /github/webhook` | GitHub | Public; validated with `X-Hub-Signature-256` HMAC over the raw body. |
| `GET /github/oauth/callback` | Browser redirect | Public; validated by the signed `state`. |
| `GET /github/install/callback` | Browser redirect | Public; validated by the signed `state` and GitHub. |
| `GET /github/status` | Any user | Configuration flags, own connection, organization installations; admins also get the URLs to paste into GitHub. |
| `POST /github/connect` | Any user | Returns the GitHub authorization URL (`return_to` must be an allowed origin). |
| `DELETE /github/connection` | Any user | Disconnect own account. |
| `POST /github/install-url` | Any user with a connected GitHub account | Returns the GitHub App installation URL. |
| `DELETE /github/installations/:id` | Admin or the person who linked it | Unlink an installation from the organization. |
| `PUT /tasks/:id/github/repo` | Task assignee/admin | Set or clear the task's repository (`{ "repo": "owner/repo", "branch": "" }`). |
| `GET /tasks/:id/github` | Task assignee/admin | Task reference, repository and linked items. |
| `POST /tasks/:id/github/links` | Task assignee/admin | Link a PR/branch/commit (`{ "input": "..." }`). |
| `DELETE /tasks/:id/github/links/:linkId` | Task assignee/admin | Remove a link (automatic links: admin only). |

## Configuration

### 1. Apply the migrations

Run `supabase/migrations/20261022120000_github_integration.sql` and then `supabase/migrations/20261023120000_task_github_repo.sql` on the Supabase database (both are idempotent; the second adds the optional task repository columns). It creates `github_connections`, `github_installations`, `task_github_links` and `github_events` with RLS enabled and no browser policies (only the service-role API touches them).

### 2. Create the GitHub App

GitHub → Settings → Developer settings → **GitHub Apps → New GitHub App** (use the organization's settings if the app should belong to the organization).

| Field | Value |
| --- | --- |
| Homepage URL | Your TaskFlow URL |
| **Callback URL** | `<API>/github/oauth/callback` (the **Callback URL** shown to admins in Settings → Integrations while setup is incomplete) |
| Request user authorization (OAuth) during installation | Leave **off** |
| Expire user authorization tokens | Either (tokens are not stored) |
| **Setup URL** | `<API>/github/install/callback` — enable **Redirect on update** |
| Webhook → Active | On |
| **Webhook URL** | `<API>/github/webhook` |
| **Webhook secret** | A long random string (becomes `GITHUB_WEBHOOK_SECRET`) |
| Repository permissions | **Contents: Read-only**, **Pull requests: Read-only**, Metadata: Read-only (default) |
| Account permissions | None |
| Subscribe to events | **Push**, **Pull request**, **Create** (the app also receives installation and authorization-revoked events automatically) |
| Where can this app be installed | "Only on this account" is enough for one company; "Any account" if you install into several |

`<API>` is the public API base, e.g. `https://<host>/functions/v1/api` — the same value as `VITE_API_URL`. After creating the app: note the **App ID**, the **app slug** (the name in `github.com/apps/<slug>`), the **Client ID**, generate a **Client secret**, and **Generate a private key** (downloads a `.pem`).

### 3. Set the server secrets (Edge Function)

| Variable | Value |
| --- | --- |
| `GITHUB_APP_ID` | App ID |
| `GITHUB_APP_SLUG` | App slug |
| `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` | OAuth credentials of the app |
| `GITHUB_APP_PRIVATE_KEY` | Full PEM contents (PKCS#1 as downloaded, or PKCS#8; `\n` escapes are accepted) |
| `GITHUB_WEBHOOK_SECRET` | The webhook secret from step 2 |
| `GITHUB_API_PUBLIC_URL` | Recommended: the public API base (`https://<host>/functions/v1/api`) so callback URLs are exact behind a proxy/gateway |
| `GITHUB_STATE_SECRET` | Optional extra secret for signing `state` (defaults to the client secret) |
| `GITHUB_RETURN_ORIGINS` | Optional comma-separated extra frontend origins allowed as return targets (the request's own origin and `FRONTEND_URL` are always allowed) |

Set them the same way as the other Edge secrets (for example `supabase functions secrets set GITHUB_APP_ID=... GITHUB_WEBHOOK_SECRET=...`). Each can alternatively be stored in `public.app_settings` under the lower-cased name (for example `github_webhook_secret`), like the existing WhatsApp/Axynt settings. Never put these in `VITE_` variables or commit them.

### 4. Deploy the function without gateway JWT verification

GitHub cannot send a Supabase JWT, and the browser callbacks are plain redirects, so the function must be deployed/served with JWT verification off (as the existing WhatsApp webhook already requires):

```bash
npx supabase@latest functions deploy api --no-verify-jwt
```

The route handlers enforce authentication themselves: normal routes require the TaskFlow bearer token, the webhook requires a valid HMAC signature, and the callbacks require a valid signed `state`. Deploying the frontend is unchanged (`VITE_*` variables do not change).

### 5. Install the app and connect users

1. Any TaskFlow user who has connected GitHub (and who has permission on the GitHub owner account): Settings → Integrations → GitHub → **Install GitHub App**, pick the GitHub account/organization and repositories on GitHub. For repositories where you are only a contributor, ask their owner or an organization administrator to approve the app and grant access. You return to TaskFlow with "installation linked".
2. Every employee: Settings → Integrations → GitHub → **Connect GitHub**.
3. Employees name branches/commits/PRs with the task reference and push.

Add repositories later through **Choose repositories** — nothing changes in TaskFlow.

## Testing

### Automated

```bash
node --test supabase/tests/github-integration.test.mjs   # Node 22.18+ / 24 (runs the .ts file directly)
cd frontend && npm test
```

The backend suite covers signature validation, state tokens, App-JWT signing from a PKCS#1 key, reference extraction, explicit link parsing, repository/branch normalisation, and the full webhook pipeline against an in-memory database: matching by branch/commit/PR/UUID/explicit links, assignee-only authorization, organization scoping, unrelated activity, ambiguous references, duplicate and concurrent deliveries, draft PRs, rejection/rework, installation lifecycle, failure retry, and repository-only matching (single match, ambiguity, branch restriction, other users/repos, reference precedence).

### End to end on your machine (no GitHub needed)

1. Apply the migration; serve the function with `supabase functions serve api --no-verify-jwt --env-file <file>` (see `supabase/functions/README.md`) with at least `GITHUB_WEBHOOK_SECRET`.
2. Seed the link tables for a test user in SQL: insert an organization installation `github_installations(installation_id, org_id, account_login)` and `github_connections(user_id, org_id, github_user_id, github_login)` for an assigned employee.
3. Put a task In Progress, assigned to that employee, and note its reference (task detail → GitHub).
4. Send signed webhooks:

```bash
node scripts/github-webhook-simulate.mjs push --url http://127.0.0.1:54321/functions/v1/api/github/webhook --secret <GITHUB_WEBHOOK_SECRET> --installation <installation_id> --github-id <github_user_id> --login <login> --repo acme/web --task TF-xxxxxxxx
```

   Other events: `pr-opened` (add `--draft`), `pr-ready`, `pr-merged`, `create`, `ping`; `--bad-signature` must return 401; repeating a `--delivery <id>` must return `duplicate_delivery`.
5. Check the task: Done lane with "Under review", GitHub section lists the commit/branch, history shows "submitted for review", an admin gets the push notification and can Approve / Request changes.

### With real GitHub

Expose the API publicly (a tunnel such as `cloudflared tunnel --url ...` or smee.io), use that URL as the webhook/callback/setup URL (and `GITHUB_API_PUBLIC_URL`), then run the connect and install flows from Settings and push to a branch named `feature/TF-xxxxxxxx-test`. **GitHub App → Advanced → Recent Deliveries** shows each webhook with its response and allows redelivery.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Deliveries show 401 | Webhook secret mismatch, or JWT verification is still enabled on the function (the gateway rejects it before our check — response is not ours). |
| Delivery 200 but nothing happens | Read `github_events.result`: `ignored:unknown_installation` (nobody has linked the install), `ignored:actor_not_connected` (pusher has not connected), `ignored:no_matching_task`, `ignored:ambiguous_repo_match`, `not_assignee`, `task_not_in_progress`, `no_new_activity`. |
| "Connect GitHub" returns 503 | `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` missing. |
| GitHub account is connected but no repositories appear | A user connection only identifies the pusher. The GitHub App must be installed on the repository's owner account (by its owner, or approved by one) and linked in TaskFlow. Contributor access alone is not enough. |
| After connecting you land on TaskFlow with an error banner | The banner shows the reason (for example the GitHub account is linked to another TaskFlow user). |
| GitHub says redirect_uri mismatch | Callback URL in the app does not equal `<API>/github/oauth/callback`; set `GITHUB_API_PUBLIC_URL` to the exact public base. |
| Installation not verified | App ID/private key mismatch, or the installation belongs to a different GitHub App. |

## Limitations

- Express API (`backend/`) is not extended; use the Edge API.
- Draft PRs and tasks outside In Progress are linked but never moved.
- Task status is only changed forward (to review). GitHub-side outcomes such as closing a PR without merging never reopen or reject a task.
- Repository access is whatever the GitHub installation grants; TaskFlow does not call the GitHub API for repository contents.
- Automated tests ran against an in-memory database; the SQL migration, the Edge Function routes and the live GitHub flows should be exercised once on a staging Supabase project before production.
