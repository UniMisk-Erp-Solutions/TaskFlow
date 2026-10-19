# TaskFlow

TaskFlow is a web application for teams to plan, assign, and track work in one shared workspace. Administrators manage people, projects, tasks, meetings, and review decisions; employees work from their assigned tasks and submit completed work for approval.

## What it does

- Task creation, assignment, priority, due dates, status, and project organization.
- A shared Kanban Board with Backlog, To Do, In Progress, and Done lanes. Board moves update the same tasks used by the task list and dashboards.
- Per-user timers on In Progress tasks, with Start/Pause controls, realtime session tracking, and role-specific Timer analytics pages.
- Employee work submission and administrator approval or rejection, with task history and notifications.
- Separate administrator and employee experiences with role-based API access.
- Direct, bookmarkable pages for each dashboard feature under `/admin/...` and `/dashboard/...` routes.
- Projects, meetings and calendar views, meeting attachments, notifications, and dashboard summaries.
- Optional Google Calendar, AI, email, and browser push integrations when their credentials are configured.

For the architecture, database model, feature flow, and deployment notes, see [docs/project-setup-and-architecture.md](docs/project-setup-and-architecture.md). The Kanban-specific behavior is in [docs/kanban-board-review-workflow.md](docs/kanban-board-review-workflow.md).

Timer behavior, analytics, access rules, and its required migration are in [docs/task-timer-tracking-and-analytics.md](docs/task-timer-tracking-and-analytics.md).

The employee submission confirmation and admin review lifecycle are documented in [docs/employee-kanban-review-submission.md](docs/employee-kanban-review-submission.md).

Dashboard route and priority color details are in [docs/portal-routes-and-priority-colors.md](docs/portal-routes-and-priority-colors.md).

## Technology

- **Frontend:** React 18, Vite, React Router, Tailwind CSS.
- **API:** Supabase Edge Function (`supabase/functions/api`) or the Express API in `backend/`.
- **Data and identity:** Supabase Postgres, Auth, Realtime, and Storage.
- **Deployment:** Render configuration is in `render.yaml`; the frontend can also be served with Vercel using `frontend/vercel.json`.

The repository has no root npm workspace. Install and run the frontend and backend from their own directories.

## Requirements

- Node.js 18 or newer and npm.
- A Supabase project with the TaskFlow schema, Auth, and Storage configured.
- A Supabase project URL and **anon/public** key for the browser app.
- For the Express API: the Supabase URL and **service-role** key. Keep the service-role key on the server; never put it in a `VITE_` variable or commit it.

The Supabase CLI is only needed if you want to run the Supabase stack locally. Optional integrations require their own provider credentials.

## Quick start

### 1. Get the source and install frontend packages

```bash
git clone https://github.com/UniMisk-Erp-Solutions/TaskFlow.git
cd TaskFlow
cd frontend
npm ci
```

From a second terminal opened at the repository root, create the local frontend config if it does not already exist:

```powershell
if (-not (Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

In Bash, use `cp -n frontend/.env.example frontend/.env.local` from the repository root.

Edit `frontend/.env.local` and set:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | The API base URL. For the local Express API, use `http://localhost:5000/api`; for Edge API use `https://<project-ref>.supabase.co/functions/v1/api`. |
| `VITE_SUPABASE_URL` | The Supabase project URL, such as `https://<project-ref>.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | The Supabase anon/public key for that project. |

### 2. Choose the API

The frontend needs an API and Supabase configuration. Choose one API mode:

#### Use the hosted Supabase Edge API

Set `VITE_API_URL` to your deployed Edge Function URL. Set both Supabase browser variables to that same Supabase project. The API function also needs server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets configured in Supabase. Follow [supabase/functions/README.md](supabase/functions/README.md) to serve or deploy it.

#### Run the Express API locally

In a second terminal, from the repository root:

```bash
cd backend
npm ci
```

Create the backend environment file if it does not already exist, then edit it:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

In Bash, use `cp -n .env.example .env` from `backend/`.

Set these required values in `backend/.env`:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
FRONTEND_URL=http://localhost:5173
PORT=5000
```

Start the API:

```bash
npm run dev
```

Set the frontend `VITE_API_URL` to `http://localhost:5000/api`. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pointed at the matching Supabase project. `npm start` runs the Express server without nodemon.

The Express API mounts routes under `/api` (for example `/api/tasks`). The Edge Function uses `/functions/v1/api` as its base. The frontend's `VITE_API_URL` must include the appropriate base path.

### 3. Start the frontend

After choosing the API and setting `VITE_API_URL`, run this in `frontend/`:

```bash
npm run dev
```

Open the URL Vite prints (normally <http://localhost:5173>). If you change frontend environment values while Vite is running, restart it. The public landing page is `/`; sign-in is available at `/login`.

## Database setup

TaskFlow expects Supabase Auth and the existing TaskFlow schema (profiles, tasks, projects, meetings, and related tables, enums, policies, and triggers). Schema SQL and incremental migrations live under `supabase/` and `supabase/migrations/`.

- For an existing TaskFlow Supabase project, apply only the migrations needed for the code version you are running. The Kanban Board and review workflow add migrations; task timers require `supabase/migrations/20261014130000_task_timer_sessions.sql`. See [the Kanban guide](docs/kanban-board-review-workflow.md) and [timer guide](docs/task-timer-tracking-and-analytics.md).
- For a new or local Supabase project, the repo includes numbered SQL setup files and additional incremental migrations. Review their prerequisites and apply them in order in a disposable development database before using the app; the repository does not provide a one-command empty-database bootstrap.
- `supabase/12_seed_org_data.sql` creates sample users and data. Use it only in a disposable development project, never in production.
- Local Edge Function setup, secrets, and serving steps are documented in [supabase/functions/README.md](supabase/functions/README.md).

## Useful commands

Run from the indicated directory:

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend/` | `npm run dev` | Start the Vite development server. |
| `frontend/` | `npm run build` | Build static frontend assets into `frontend/dist/`. |
| `frontend/` | `npm run preview` | Preview the most recent production build locally. |
| `backend/` | `npm run dev` | Start Express with nodemon; the predev hook frees the configured port. |
| `backend/` | `npm start` | Start Express without nodemon. |


## Optional integrations

- **Google Calendar:** Set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local` after configuring a Google Cloud OAuth web client. See [docs/GOOGLE_CALENDAR.md](docs/GOOGLE_CALENDAR.md).
- **Maintenance gate:** `VITE_STATUS_URL` and `VITE_STATUS_KEY` configure the optional status project; leave them unset to disable the gate.
- **Browser push:** Configure the VAPID values in `backend/.env` and enable push subscriptions in the app.
- **AI and email:** Configure the optional `OPENROUTER_*` or `BREVO_*` variables described in [the architecture guide](docs/project-setup-and-architecture.md) when those integrations are needed.

## Troubleshooting

- **Blank page or missing-config error:** Check that `frontend/.env.local` contains `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`, then restart Vite.
- **Sign-in succeeds but the profile or tasks do not load:** Confirm `VITE_API_URL` points to the correct API and that the API uses the same Supabase project as the frontend.
- **Browser CORS error with Express:** Add the frontend origin to `FRONTEND_URL` in `backend/.env` and restart the backend.
- **Database column or table errors:** Apply the migrations required by this version to the target Supabase project.
- **Remote Edge API is unavailable:** Check the function deployment and its Supabase secrets. You can run the Express API locally instead if its environment is configured.

## Repository map

```text
backend/                 Express API, auth middleware, controllers, and services
frontend/                React/Vite application, pages, components, and client state
supabase/functions/api/  Supabase Edge Function API
supabase/migrations/     Incremental database migrations
supabase/*.sql           Numbered schema changes and optional development seed data
docs/                    Feature and integration documentation
render.yaml              Render service definitions
```

## Security notes

- Never commit `.env`, `.env.local`, service-role keys, VAPID private keys, or provider secrets.
- Only Supabase's anon/public key belongs in `VITE_SUPABASE_ANON_KEY`; all `VITE_` variables are included in browser code.
- Use test accounts and a disposable database for development seed data.
- Keep production service-role and provider keys in the hosting provider's secret settings.
