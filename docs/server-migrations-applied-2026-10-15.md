# Server Migrations Applied on 2026-10-15


- Access: `ssh olympus` to the Coolify host; only the TaskFlow Supabase stack (served at `taskflow-backend.unimisk.com`) and its database container were used.
- Checks: 45 tasks present, `task_timer_sessions` existing, realtime publication already containing task, meeting and timer tables, `tasks.work_ended_at` missing.
- Applied: `20261015120000_task_work_ended_at.sql` (column plus updated timer-closing trigger) as the table owner `supabase_admin`, in one transaction. Verified column and function body afterwards.
- Not applied/not run: realtime migration (not needed), demo seed data.
- Edge Function deployed (2026-10-15): the repo's `supabase/functions/api/index.ts` was copied into the TaskFlow stack's `supabase-edge-functions` container at `/home/deno/functions/api/index.ts` after backing up the previous file as `index.ts.bak-pre-files-20261015`. Rollback: copy that backup over `index.ts`. This enabled the Files (`/drive`), review end time, project edit/delete and employee project scoping features on the hosted API.
- Also applied: `20261015200000_file_explorer.sql` (private `taskflow-files` bucket, `drive_folders`, `drive_files`, RLS), verified bucket and table row-level security afterwards.
- Also applied (chat): `20261015140000_chat.sql`, `20261015160000_chat_attachments_edit.sql` (creates the `chat-files` bucket), `20261015180000_chat_replies_groups.sql`. Chat functions were verified with a rolled-back / cleaned-up SQL test (private chat visibility, history-hidden group member).
- Also applied (whiteboard): `20261015220000_whiteboards.sql` (creates the `whiteboard-files` bucket), `20261015230000_whiteboard_main.sql`, `20261015240000_whiteboard_screens.sql`. Visibility rules were verified with a cleaned-up SQL test.
- Also applied (projects): `20261015250000_projects_archive.sql`, run as `supabase_admin` because `postgres` does not own `projects`.
- Edge Function redeployed twice more with backups `index.ts.bak-pre-archive-20261015` (project archive) and `index.ts.bak-pre-signurl-20261015` (public signed storage URLs).
