# Supabase Edge API (Local)

## Local stack vs cloud deploy

- **`supabase functions deploy`** (and `./scripts/deploy-edge-api.sh`) upload to your **hosted** Supabase project after `login` + `link`. There is **no** CLI flag to “deploy” into the local Docker stack.
- With **`supabase start`**, the Edge runtime reads **`supabase/functions/`** from your machine. Your `config.toml` uses **`[edge_runtime] policy = "per_worker"`**, which enables **hot reload** while developing — saving `index.ts` is usually enough.
- If the runtime looks stale, restart its container: **`./scripts/reload-local-edge-api.sh`** (or `docker restart supabase_edge_runtime_<project_id>`; `project_id` is in `supabase/config.toml`).

## CLI: `command not found`

If `supabase` is not installed globally, use **`npx`** (no install needed):

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest functions deploy api
```

Or from the repo root: **`./scripts/deploy-edge-api.sh`** (same as the last line, forwards extra args to the CLI).

---

This repo now includes an Edge Function API at:

- `supabase/functions/api/index.ts`

It mirrors the core backend routes used by the app:

- `/auth/signup`, `/auth/login`, `/auth/me`, `/auth/profiles`
- `/tasks` CRUD/status
- `/meetings` CRUD/status
- `/meetings/:id/attachments` list/upload
- `/meetings/attachments/:attachmentId/download`
- `/admin/dashboard`, `/admin/users`

## 1) Set local function secrets

From project root:

```bash
supabase functions secrets set \
  SUPABASE_URL="http://<SUPABASE_HOST_PC_IP>:54321" \
  SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
```

If Edge Runtime runs on the same machine as Supabase, you can use:

- `SUPABASE_URL=http://127.0.0.1:54321`

## 2) Serve function locally

```bash
supabase functions serve api --no-verify-jwt
```

Default local endpoint:

- `http://127.0.0.1:54321/functions/v1/api`

## 3) Point frontend to Edge API

In `frontend/.env`:

```env
VITE_API_URL=http://<SUPABASE_HOST_PC_IP>:54321/functions/v1/api
```

Restart frontend dev server after env change.

## 4) Frontend Supabase client values

Still keep:

- `VITE_SUPABASE_URL=http://<SUPABASE_HOST_PC_IP>:54321`
- `VITE_SUPABASE_ANON_KEY=<ANON_KEY>`

## 5) DB/storage migrations

Run these SQL files before testing:

- `supabase/10.sql`
- `supabase/11.sql`
- `supabase/13_meeting_attachments.sql`

## Notes

- `POST /admin/send-reminders` is currently `501 Not implemented` in edge function.
- Existing Node backend can be stopped once frontend is using `/functions/v1/api`.
