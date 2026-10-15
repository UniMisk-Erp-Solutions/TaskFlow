-- When the assignee actually finished the work. Set when a task is sent to review
-- (employee may pick an earlier time; never in the future). NULL while work is ongoing.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS work_ended_at timestamptz;

COMMENT ON COLUMN public.tasks.work_ended_at IS
  'Time the work finished, as reported on submission (defaults to the submission time).';

-- Close running timers at the reported end time (never before they started).
CREATE OR REPLACE FUNCTION public.task_timer_close_when_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kanban_column = 'done' AND OLD.kanban_column IS DISTINCT FROM 'done' THEN
    UPDATE public.task_timer_sessions
    SET ended_at = GREATEST(started_at, LEAST(COALESCE(NEW.work_ended_at, now()), now()))
    WHERE task_id = NEW.id AND org_id = NEW.org_id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
