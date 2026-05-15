-- Approval flow, due_time, optional meeting date/time, and history audit log
-- for tasks and meetings. Designed to be idempotent so it can be re-run safely
-- against an existing local DB.

-- ---------------------------------------------------------------------------
-- 1) Schema additions on tasks / meetings
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_time time NULL,
  ADD COLUMN IF NOT EXISTS submission_notes text NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text NULL;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS submission_notes text NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text NULL;

-- Make meeting date/time optional. Default on meeting_time stays for any
-- legacy callers but column becomes nullable.
ALTER TABLE public.meetings
  ALTER COLUMN meeting_date DROP NOT NULL;

ALTER TABLE public.meetings
  ALTER COLUMN meeting_time DROP NOT NULL;

-- Make sure created_at / updated_at exist and are timestamptz (some early
-- migrations used `timestamp` without time zone). We don't rewrite the column
-- type to avoid breaking existing rows; we only ensure defaults are present.
ALTER TABLE public.tasks
  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.tasks
  ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.meetings
  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.meetings
  ALTER COLUMN updated_at SET DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2) Extend status enums with the approval-flow values
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'status_enum' AND e.enumlabel = 'submitted'
  ) THEN
    ALTER TYPE public.status_enum ADD VALUE 'submitted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'status_enum' AND e.enumlabel = 'changes_requested'
  ) THEN
    ALTER TYPE public.status_enum ADD VALUE 'changes_requested';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'meeting_status_enum' AND e.enumlabel = 'submitted'
  ) THEN
    ALTER TYPE public.meeting_status_enum ADD VALUE 'submitted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'meeting_status_enum' AND e.enumlabel = 'changes_requested'
  ) THEN
    ALTER TYPE public.meeting_status_enum ADD VALUE 'changes_requested';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) History tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_history_task_id_idx ON public.task_history(task_id);
CREATE INDEX IF NOT EXISTS task_history_org_id_idx ON public.task_history(org_id);

CREATE TABLE IF NOT EXISTS public.meeting_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_history_meeting_id_idx ON public.meeting_history(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_history_org_id_idx ON public.meeting_history(org_id);

COMMENT ON TABLE public.task_history IS 'Append-only audit log of task lifecycle events (create/update/status/submit/approve/request_changes).';
COMMENT ON TABLE public.meeting_history IS 'Append-only audit log of meeting lifecycle events.';

-- ---------------------------------------------------------------------------
-- 4) RLS for history tables — read-only to org members who can see the parent
--    (admin in org, or assignee of the row). Writes happen via the Edge
--    Function which uses the service role and bypasses RLS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task history read in org" ON public.task_history;
CREATE POLICY "Task history read in org"
ON public.task_history FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    public.current_user_role() = 'admin'
    OR public.is_task_assignee(task_history.task_id)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_history.task_id AND t.assignee_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Meeting history read in org" ON public.meeting_history;
CREATE POLICY "Meeting history read in org"
ON public.meeting_history FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    public.current_user_role() = 'admin'
    OR public.is_meeting_assignee(meeting_history.meeting_id)
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_history.meeting_id AND m.assignee_id = auth.uid()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 5) Realtime — add history tables to the supabase_realtime publication so
--    clients can subscribe to live timeline updates. Guarded to be idempotent.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'task_history'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_history';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'meeting_history'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_history';
    END IF;
  END IF;
END $$;
