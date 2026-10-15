# Server Migrations Applied on 2026-10-15


- Access: `ssh olympus` to the Coolify host; only the TaskFlow Supabase stack (served at `taskflow-backend.unimisk.com`) and its database container were used.
- Checks: 45 tasks present, `task_timer_sessions` existing, realtime publication already containing task, meeting and timer tables, `tasks.work_ended_at` missing.
- Applied: `20261015120000_task_work_ended_at.sql` (column plus updated timer-closing trigger) as the table owner `supabase_admin`, in one transaction. Verified column and function body afterwards.
- Not applied/not run: realtime migration (not needed), demo seed data.
- Edge Function deployed (2026-10-15): the repo's `supabase/functions/api/index.ts` was copied into the TaskFlow stack's `supabase-edge-functions` container at `/home/deno/functions/api/index.ts` after backing up the previous file as `index.ts.bak-pre-files-20261015`. Rollback: copy that backup over `index.ts`. This enabled the Files (`/drive`), review end time, project edit/delete and employee project scoping features on the hosted API.
- Also applied: `20261015200000_file_explorer.sql` (private `taskflow-files` bucket, `drive_folders`, `drive_files`, RLS), verified bucket and table row-level security afterwards.
