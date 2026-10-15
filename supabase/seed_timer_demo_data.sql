-- Demo timer data for verifying Timer Analytics. Run in the Supabase SQL editor.
--
-- For every task that is In Progress, Under review or Completed, each assignee
-- gets 2-5 CLOSED work sessions spread over the last 14 days (5 min - 2.5 h each).
-- To Do / Backlog tasks get nothing, matching the "no timer for to-do" rule.
-- Every demo row has created_at = 2020-01-01 so it can be removed cleanly:
--
--   DELETE FROM public.task_timer_sessions WHERE created_at = '2020-01-01 00:00:00+00';
--
-- Safe to run more than once: demo rows are cleared first, real sessions are untouched.

BEGIN;

-- The "must be In Progress" insert trigger would reject sessions for review/completed tasks.
ALTER TABLE public.task_timer_sessions DISABLE TRIGGER task_timer_require_in_progress_before_insert;

DELETE FROM public.task_timer_sessions WHERE created_at = '2020-01-01 00:00:00+00';

WITH assignees AS (
  SELECT t.id AS task_id, t.org_id, t.assignee_id AS user_id, t.status, t.kanban_column
  FROM public.tasks t
  WHERE t.assignee_id IS NOT NULL
  UNION
  SELECT t.id, t.org_id, ta.profile_id, t.status, t.kanban_column
  FROM public.tasks t
  JOIN public.task_assignees ta ON ta.task_id = t.id
),
eligible AS (
  SELECT a.* FROM assignees a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.org_id IS NOT NULL
    AND (a.status IN ('completed', 'submitted', 'in_progress') OR a.kanban_column IN ('in_progress', 'done'))
),
sessions AS (
  SELECT
    e.org_id, e.task_id, e.user_id, n,
    -- deterministic pseudo-random values per (task, user, session)
    abs(hashtext(e.task_id::text || e.user_id::text || n::text))            AS h1,
    abs(hashtext(n::text || e.user_id::text || e.task_id::text || 'len'))   AS h2
  FROM eligible e
  CROSS JOIN LATERAL generate_series(1, 2 + abs(hashtext(e.task_id::text || e.user_id::text)) % 4) AS n
)
INSERT INTO public.task_timer_sessions (org_id, task_id, user_id, started_at, ended_at, created_at)
SELECT
  org_id, task_id, user_id,
  s.start_at,
  s.start_at + make_interval(mins => 5 + h2 % 146),
  '2020-01-01 00:00:00+00'
FROM (
  SELECT *, date_trunc('hour', now())
            - make_interval(days => h1 % 14, hours => (h1 / 14) % 9 + 1)
            - make_interval(mins => (n * 7) % 60) AS start_at
  FROM sessions
) s;

ALTER TABLE public.task_timer_sessions ENABLE TRIGGER task_timer_require_in_progress_before_insert;

COMMIT;

-- Quick check
SELECT count(*) AS demo_sessions,
       count(DISTINCT task_id) AS tasks,
       count(DISTINCT user_id) AS people,
       round(sum(extract(epoch FROM ended_at - started_at)) / 3600, 1) AS total_hours
FROM public.task_timer_sessions
WHERE created_at = '2020-01-01 00:00:00+00';
