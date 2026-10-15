# Server Migrations Applied on 2026-10-15


- Access: `ssh olympus` to the Coolify host; only the TaskFlow Supabase stack (served at `taskflow-backend.unimisk.com`) and its database container were used.
- Checks: 45 tasks present, `task_timer_sessions` existing, realtime publication already containing task, meeting and timer tables, `tasks.work_ended_at` missing.
- Applied: `20261015120000_task_work_ended_at.sql` (column plus updated timer-closing trigger) as the table owner `supabase_admin`, in one transaction. Verified column and function body afterwards.
- Not applied/not run: realtime migration (not needed), demo seed data.
- Pending: deploy the updated `api` Edge Function for the end-time, project edit/delete and employee project scoping features.
