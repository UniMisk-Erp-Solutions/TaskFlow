# Timer Demo Seed Data


`supabase/seed_timer_demo_data.sql` inserts 2 to 5 closed sessions per assignee for tasks that are In Progress, Under review or Completed, spread over the previous 14 days with durations from 5 minutes to 2.5 hours. To do and Backlog tasks receive nothing.

- Deterministic: values derive from hashes of task, user and index.
- Removable: demo rows use `created_at = '2020-01-01 00:00:00+00'`; delete with `DELETE FROM public.task_timer_sessions WHERE created_at = '2020-01-01 00:00:00+00';`.
- Idempotent: it clears previous demo rows first and leaves real sessions untouched.
- The `task_timer_require_in_progress_before_insert` trigger is disabled and re-enabled inside the same transaction.

Run it in the Supabase SQL editor (or via psql as the table owner). It was not run against production.
