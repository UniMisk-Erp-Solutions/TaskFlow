# TaskFlow Project Setup and Architecture

## Purpose

TaskFlow brings task assignment, project organization, team coordination, and completion review into a shared workspace. Its admin and employee portals are role-specific views over the same organization data. Employees work on assigned tasks and submit completed work; administrators review the submission and retain the final approval decision.

This guide explains the repository structure, how browser requests reach the API and Supabase, the supported local run modes, configuration, database prerequisites, and common setup problems. The root [README](../README.md) is the quick-start guide.

## Application shape

```text
Browser
  ├─ React/Vite app (`frontend/`)
  ├─ Supabase Auth client (project URL + anon key)
  └─ API client (`VITE_API_URL`)
       ├─ Supabase Edge Function (`supabase/functions/api/`)
       └─ Express API (`backend/server.js`)
             └─ Supabase service client (server-only service-role key)

Supabase provides Postgres data, Auth, Realtime subscriptions, and Storage.
```

The app can use either API implementation. Point `VITE_API_URL` at the selected API and make the frontend Supabase URL/key refer to the same project. Express is mounted under `/api`; the Edge Function API is mounted under `/functions/v1/api`.

## Main source areas

| Path | Responsibility |
| --- | --- |
| `frontend/src/` | React entry points, admin/employee dashboards, routing, shared components, API client, auth context, and state hooks. |
| `frontend/src/AdminDashboard.jsx`, `EmployeeDashboard.jsx` | Role-specific application shells and navigation. |
| `frontend/src/useTasks.js` | Shared task loading and updates used by task and board views. |
| `frontend/src/components/KanbanBoard.jsx` | Four-column task board and board interactions. |
| `backend/server.js` | Express initialization, CORS, route mounts, static serving, and port setup. |
| `backend/src/routes/` | HTTP route definitions and middleware wiring. |
| `backend/src/controllers/` | Task, project, meeting, auth, admin, and notification request handling. |
| `backend/src/services/` | Integration helpers such as AI, email, and web push. |
| `supabase/functions/api/index.ts` | Edge Function implementation of the application API. |
| `supabase/migrations/` | Incremental Postgres schema and policy updates. |
| `supabase/*.sql` | Numbered SQL setup/update scripts and optional seed data. |

## Request and data flow

1. The React app reads its public Supabase URL and anon key, then initializes Supabase Auth.
2. After sign-in, the API client adds the current user access token to protected requests.
3. `VITE_API_URL` directs each request to either the Edge Function or Express API.
4. API middleware validates the session and enforces role and task access rules. Server-side Supabase operations use the service-role key only on the server.
5. The API returns task/project/meeting data. React views render the response and update shared state, with Supabase Realtime used where enabled.

For Kanban, the task's board lane and order are persisted alongside its business status. Employee submissions transition to a review state; administrators approve into completed work or reject back to active work. The detailed lifecycle and migration names are in [kanban-board-review-workflow.md](kanban-board-review-workflow.md).

GitHub webhooks are a second input to that review flow: the Edge API validates the webhook signature, matches the pushed commits or pull request to an assigned task, and moves an In Progress task to the same `submitted` review state. See [github-integration.md](github-integration.md).

## Local development modes

### Frontend + hosted Edge API

Use this when the hosted Supabase Edge Function and project are already provisioned:

1. Install frontend dependencies with `npm ci` from `frontend/`.
2. Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` to the hosted function URL, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for that project.
3. Run `npm run dev` in `frontend/` and open Vite's local URL.

### Frontend + local Express API

Use this when you want API code running on your machine:

1. In `backend/`, install dependencies with `npm ci` and copy `.env.example` to `.env`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, and optionally `PORT` in `backend/.env`.
3. Run `npm run dev` in `backend/`.
4. Set frontend `VITE_API_URL=http://localhost:5000/api`; configure its Supabase browser variables for the same project.
5. In a second terminal, run `npm ci` and `npm run dev` from `frontend/`.

Do not use a service-role key in the frontend. The Express API is not self-contained without a configured Supabase project.

### Local Supabase stack

`supabase/config.toml` configures the local Supabase CLI stack. Running it requires the Supabase CLI (or `npx supabase`). This repository's SQL files and migrations include incremental changes for a pre-existing schema; they do not form a single guaranteed blank-database bootstrap. Review prerequisites before applying SQL to a local database. The Edge API's local serve instructions are in [supabase/functions/README.md](../supabase/functions/README.md).

## Environment variables

| Variable | Consumer | Required? | Notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | Frontend | Yes | API root, including `/api` or `/functions/v1/api`. |
| `VITE_SUPABASE_URL` | Frontend | Yes | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Yes | Public anon key; it is bundled into the browser. |
| `SUPABASE_URL` | Express / Edge Function | Yes | The same Supabase project used by the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Express / Edge Function | Yes | Server-side secret; keep out of the frontend and Git. |
| `FRONTEND_URL` | Express | Recommended | Allowed frontend origin(s), comma-separated if needed. |
| `PORT` | Express | Optional | Defaults to port 5000. |
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Optional | Enables Google Calendar OAuth UI. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Express | Optional | Browser push notification configuration. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Express | Optional | AI-related API features. |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Express | Optional | Email integration settings. |
| `VITE_STATUS_URL`, `VITE_STATUS_KEY` | Frontend | Optional | Separate status/maintenance project configuration. |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | Edge Function | Optional (required for GitHub integration) | GitHub App credentials and webhook secret; also `GITHUB_API_PUBLIC_URL`, `GITHUB_STATE_SECRET`, `GITHUB_RETURN_ORIGINS`. See [github-integration.md](github-integration.md). |

See `frontend/.env.example` and `backend/.env.example` for templates. Do not commit local environment files.

## Database and migrations

TaskFlow requires a Supabase schema containing Auth profiles, tasks, projects, meetings, organization membership, policies, and related objects. Numbered scripts under `supabase/` provide setup and incremental changes; `supabase/migrations/` contains timestamped migrations used for later schema updates.

Apply database changes to a development/staging project first, then deploy the matching API and frontend version. The Kanban feature adds columns and status support in `20261012120000_task_kanban_board.sql` and `20261012130000_task_review_rejected_status.sql`. The optional `12_seed_org_data.sql` creates predictable test accounts and bulk sample records; never run it against production data.

## Deployment

- `render.yaml` declares the Render backend container and static frontend services.
- `frontend/vercel.json` supplies SPA route fallback rewrites for Vercel hosting.
- `scripts/deploy-edge-api.sh` deploys the Edge API to the linked hosted Supabase project. Read `supabase/functions/README.md` before using it.

Keep frontend/API versions compatible and deploy required migrations before traffic uses code that depends on the new schema.

## Troubleshooting

- **Frontend throws a missing Supabase/API config error:** Fill the three required `VITE_` values and restart Vite.
- **CORS errors against local Express:** Ensure `FRONTEND_URL` exactly matches the origin, including scheme and port.
- **Profile or task fetch fails after login:** Check the browser's `VITE_API_URL`, API health/logs, Supabase URL consistency, and whether required migrations are installed.
- **Supabase client errors:** Confirm the project URL and anon key belong together and that Auth is enabled.
- **Kanban update fails:** Confirm the server or Edge Function version includes the board routes and both Kanban migrations have run.
- **Optional integration is unavailable:** Check that its credential is configured for the environment where the frontend was built or backend is running.
