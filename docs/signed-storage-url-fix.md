# Fix: Files and Attachments Would Not Open or Download

## Symptom

Clicking a file in **Files**, or an attachment on a task or meeting, opened a browser page "can't reach this page ... supabase-kong's server IP address could not be found" (`ERR_NAME_NOT_RESOLVED`). Open and download were both affected, in both portals.

## Cause

The Edge Function creates signed storage URLs through its Supabase client, which talks to the internal address `http://supabase-kong:8000`. The signed URL therefore pointed at that internal hostname, which browsers cannot resolve.

## Fix

- **Edge Function** (`supabase/functions/api/index.ts`): `publicStorageUrl()` rewrites the origin of every signed URL to the public origin the request came in on (`PUBLIC_API_ORIGIN` env if set, otherwise `X-Forwarded-Host`/`Host`, otherwise `SUPABASE_PUBLIC_URL`). Applied to `/drive/files/:id/url`, `/tasks/attachments/:id/download` and `/meetings/attachments/:id/download`.
- Attachment download endpoints return `{ url }` as JSON when the request sends `Accept: application/json` (used by the app so it never follows a redirect to an unreachable host); plain navigations still receive a 302.
- **Frontend** (`frontend/src/lib/storageUrl.js`): `toPublicStorageUrl()` rewrites any internal-looking host to the configured `VITE_SUPABASE_URL` origin. Used in `FileExplorer.jsx` and `AttachmentsSection.jsx`.

## Deployment

The Edge Function was copied into the TaskFlow stack's `supabase-edge-functions` container at `/home/deno/functions/api/index.ts`, with a backup `index.ts.bak-pre-signurl-20261015`. Rollback: copy the backup over `index.ts`. No database migration is involved.
