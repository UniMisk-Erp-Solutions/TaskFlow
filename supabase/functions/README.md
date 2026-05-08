# Supabase Edge API (Local)

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
