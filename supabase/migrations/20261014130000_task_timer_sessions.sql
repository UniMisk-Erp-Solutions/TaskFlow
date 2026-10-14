-- Store resumable per-user work sessions for task timers.
CREATE TABLE IF NOT EXISTS public.task_timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_timer_sessions_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS task_timer_one_active_session_per_user_task
  ON public.task_timer_sessions (task_id, user_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS task_timer_sessions_org_task_idx
  ON public.task_timer_sessions (org_id, task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS task_timer_sessions_user_idx
  ON public.task_timer_sessions (user_id, started_at DESC);

ALTER TABLE public.task_timer_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_timer_sessions_read_visible ON public.task_timer_sessions;
CREATE POLICY task_timer_sessions_read_visible ON public.task_timer_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.current_user_role() = 'admin'
      AND task_timer_sessions.org_id = public.current_user_org_id()
    )
  );

REVOKE ALL ON public.task_timer_sessions FROM anon, authenticated;
GRANT SELECT ON public.task_timer_sessions TO authenticated;
GRANT ALL ON public.task_timer_sessions TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_timer_sessions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.task_timer_sessions IS
  'Timer intervals for task work. An open interval has ended_at IS NULL; pauses and task completion close intervals.';

CREATE OR REPLACE FUNCTION public.task_timer_require_in_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_column text;
BEGIN
  SELECT kanban_column INTO current_column
  FROM public.tasks
  WHERE id = NEW.task_id
  FOR UPDATE;
  IF current_column IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'A timer can only start while its task is In Progress.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_timer_require_in_progress_before_insert ON public.task_timer_sessions;
CREATE TRIGGER task_timer_require_in_progress_before_insert
  BEFORE INSERT ON public.task_timer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.task_timer_require_in_progress();

CREATE OR REPLACE FUNCTION public.task_timer_close_when_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kanban_column = 'done' AND OLD.kanban_column IS DISTINCT FROM 'done' THEN
    UPDATE public.task_timer_sessions
    SET ended_at = COALESCE(ended_at, now())
    WHERE task_id = NEW.id AND org_id = NEW.org_id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_timer_close_on_task_done ON public.tasks;
CREATE TRIGGER task_timer_close_on_task_done
  AFTER UPDATE OF kanban_column ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.task_timer_close_when_done();