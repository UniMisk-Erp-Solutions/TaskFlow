-- Projects, optional project on tasks/meetings, multi-assignee junction tables.

-- 1) Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_org_id_idx ON public.projects(org_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Projects org read" ON public.projects;
CREATE POLICY "Projects org read"
ON public.projects FOR SELECT TO authenticated
USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Projects admin insert" ON public.projects;
CREATE POLICY "Projects admin insert"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Projects admin update" ON public.projects;
CREATE POLICY "Projects admin update"
ON public.projects FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Projects admin delete" ON public.projects;
CREATE POLICY "Projects admin delete"
ON public.projects FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

-- 2) Optional project on tasks / meetings
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS meetings_project_id_idx ON public.meetings(project_id);

-- 3) Junction tables
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.meeting_assignees (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, profile_id)
);

CREATE INDEX IF NOT EXISTS task_assignees_profile_idx ON public.task_assignees(profile_id);
CREATE INDEX IF NOT EXISTS meeting_assignees_profile_idx ON public.meeting_assignees(profile_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_assignees ENABLE ROW LEVEL SECURITY;

-- Task assignees: visible if you can see the task (same org + admin or assigned)
DROP POLICY IF EXISTS "Task assignees select" ON public.task_assignees;
CREATE POLICY "Task assignees select"
ON public.task_assignees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta2
          WHERE ta2.task_id = t.id AND ta2.profile_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Task assignees admin write" ON public.task_assignees;
CREATE POLICY "Task assignees admin write"
ON public.task_assignees FOR ALL TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_assignees.task_id
      AND t.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Meeting assignees
DROP POLICY IF EXISTS "Meeting assignees select" ON public.meeting_assignees;
CREATE POLICY "Meeting assignees select"
ON public.meeting_assignees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_assignees.meeting_id
      AND m.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR m.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.meeting_assignees ma2
          WHERE ma2.meeting_id = m.id AND ma2.profile_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Meeting assignees admin write" ON public.meeting_assignees;
CREATE POLICY "Meeting assignees admin write"
ON public.meeting_assignees FOR ALL TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_assignees.meeting_id
      AND m.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_assignees.meeting_id
      AND m.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- 4) Backfill junction from legacy assignee_id
INSERT INTO public.task_assignees (task_id, profile_id)
SELECT id, assignee_id FROM public.tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.meeting_assignees (meeting_id, profile_id)
SELECT id, assignee_id FROM public.meetings
WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5) Replace task RLS employee policies (from org-scoped migration) to include junction
DROP POLICY IF EXISTS "Tasks employee read own" ON public.tasks;
CREATE POLICY "Tasks employee read own"
ON public.tasks FOR SELECT TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Tasks employee update own" ON public.tasks;
CREATE POLICY "Tasks employee update own"
ON public.tasks FOR UPDATE TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

-- Add junction-based employee access (read/update own row when listed as assignee)
CREATE POLICY "Tasks employee read assignees"
ON public.tasks FOR SELECT TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.profile_id = auth.uid()
  )
);

CREATE POLICY "Tasks employee update assignees"
ON public.tasks FOR UPDATE TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id AND ta.profile_id = auth.uid()
  )
);

-- 6) Meetings employee policies: add assignee junction
DROP POLICY IF EXISTS "Meetings employee read own" ON public.meetings;
CREATE POLICY "Meetings employee read own"
ON public.meetings FOR SELECT TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Meetings employee update own" ON public.meetings;
CREATE POLICY "Meetings employee update own"
ON public.meetings FOR UPDATE TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Meetings employee read assignees"
ON public.meetings FOR SELECT TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.meeting_assignees ma
    WHERE ma.meeting_id = meetings.id AND ma.profile_id = auth.uid()
  )
);

CREATE POLICY "Meetings employee update assignees"
ON public.meetings FOR UPDATE TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.meeting_assignees ma
    WHERE ma.meeting_id = meetings.id AND ma.profile_id = auth.uid()
  )
);

-- 7) meeting_attachments: allow any meeting assignee to read
DROP POLICY IF EXISTS "Read meeting attachments in org" ON public.meeting_attachments;
CREATE POLICY "Read meeting attachments in org"
ON public.meeting_attachments FOR SELECT TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.meeting_assignees ma
      WHERE ma.meeting_id = meeting_attachments.meeting_id
        AND ma.profile_id = auth.uid()
    )
  )
);
