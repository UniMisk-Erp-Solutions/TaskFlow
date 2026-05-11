-- Full RLS reset for tasks / meetings / task_assignees / meeting_assignees.
--
-- Every previous attempt left at least one cross-table EXISTS inside a policy
-- (e.g. tasks USING EXISTS(... task_assignees) and task_assignees USING
-- EXISTS(... tasks)). When Postgres evaluates the first, it triggers the
-- second policy, which triggers the first → infinite recursion.
--
-- Fix pattern (safe and idempotent):
--   All cross-table checks go through SECURITY DEFINER helpers. SECURITY
--   DEFINER (owned by postgres in Supabase) bypasses RLS inside the helper,
--   so policies become pure boolean expressions with no policy-evaluation
--   chain. Same intent, no cycle.

-- ---------------------------------------------------------------------------
-- 1) Helpers (drop+create to fix old broken bodies if migration is re-run)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.current_user_org_id() CASCADE;
CREATE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
CREATE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

DROP FUNCTION IF EXISTS public.is_task_assignee(uuid) CASCADE;
CREATE FUNCTION public.is_task_assignee(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_id = p_task_id AND profile_id = auth.uid()
  );
$$;

DROP FUNCTION IF EXISTS public.is_meeting_assignee(uuid) CASCADE;
CREATE FUNCTION public.is_meeting_assignee(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_assignees
    WHERE meeting_id = p_meeting_id AND profile_id = auth.uid()
  );
$$;

DROP FUNCTION IF EXISTS public.task_id_in_reader_org(uuid) CASCADE;
CREATE FUNCTION public.task_id_in_reader_org(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.org_id IS NOT DISTINCT FROM public.current_user_org_id()
  );
$$;

DROP FUNCTION IF EXISTS public.meeting_id_in_reader_org(uuid) CASCADE;
CREATE FUNCTION public.meeting_id_in_reader_org(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = p_meeting_id
      AND m.org_id IS NOT DISTINCT FROM public.current_user_org_id()
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_org_id()         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role()           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_task_assignee(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_meeting_assignee(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_id_in_reader_org(uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.meeting_id_in_reader_org(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_org_id()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_assignee(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_meeting_assignee(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_id_in_reader_org(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_id_in_reader_org(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) public.tasks — drop every legacy policy, recreate without recursion
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access"             ON public.tasks;
DROP POLICY IF EXISTS "Employee read own"             ON public.tasks;
DROP POLICY IF EXISTS "Employee update own"           ON public.tasks;
DROP POLICY IF EXISTS "Tasks admin full access"       ON public.tasks;
DROP POLICY IF EXISTS "Tasks employee read own"       ON public.tasks;
DROP POLICY IF EXISTS "Tasks employee update own"     ON public.tasks;
DROP POLICY IF EXISTS "Tasks employee read assignees"   ON public.tasks;
DROP POLICY IF EXISTS "Tasks employee update assignees" ON public.tasks;

CREATE POLICY "Tasks admin all"
ON public.tasks FOR ALL TO authenticated
USING (
  public.current_user_role() = 'admin'
  AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
)
WITH CHECK (
  public.current_user_role() = 'admin'
  AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
);

CREATE POLICY "Tasks employee read"
ON public.tasks FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    assignee_id = auth.uid()
    OR public.is_task_assignee(tasks.id)
  )
);

CREATE POLICY "Tasks employee update"
ON public.tasks FOR UPDATE TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    assignee_id = auth.uid()
    OR public.is_task_assignee(tasks.id)
  )
);

-- ---------------------------------------------------------------------------
-- 3) public.meetings — same pattern
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access meetings"      ON public.meetings;
DROP POLICY IF EXISTS "Employee read own meetings"      ON public.meetings;
DROP POLICY IF EXISTS "Employee update own meetings"    ON public.meetings;
DROP POLICY IF EXISTS "Meetings admin full access"      ON public.meetings;
DROP POLICY IF EXISTS "Meetings employee read own"      ON public.meetings;
DROP POLICY IF EXISTS "Meetings employee update own"    ON public.meetings;
DROP POLICY IF EXISTS "Meetings employee read assignees"   ON public.meetings;
DROP POLICY IF EXISTS "Meetings employee update assignees" ON public.meetings;

CREATE POLICY "Meetings admin all"
ON public.meetings FOR ALL TO authenticated
USING (
  public.current_user_role() = 'admin'
  AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
)
WITH CHECK (
  public.current_user_role() = 'admin'
  AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
);

CREATE POLICY "Meetings employee read"
ON public.meetings FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    assignee_id = auth.uid()
    OR public.is_meeting_assignee(meetings.id)
  )
);

CREATE POLICY "Meetings employee update"
ON public.meetings FOR UPDATE TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    assignee_id = auth.uid()
    OR public.is_meeting_assignee(meetings.id)
  )
);

-- ---------------------------------------------------------------------------
-- 4) public.task_assignees — no self-reference, no select-from-tasks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Task assignees select"      ON public.task_assignees;
DROP POLICY IF EXISTS "Task assignees admin write" ON public.task_assignees;

CREATE POLICY "Task assignees select"
ON public.task_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    public.current_user_role() = 'admin'
    AND public.task_id_in_reader_org(task_assignees.task_id)
  )
);

CREATE POLICY "Task assignees admin write"
ON public.task_assignees FOR ALL TO authenticated
USING (
  public.current_user_role() = 'admin'
  AND public.task_id_in_reader_org(task_assignees.task_id)
)
WITH CHECK (
  public.current_user_role() = 'admin'
  AND public.task_id_in_reader_org(task_assignees.task_id)
);

-- ---------------------------------------------------------------------------
-- 5) public.meeting_assignees — mirror
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Meeting assignees select"      ON public.meeting_assignees;
DROP POLICY IF EXISTS "Meeting assignees admin write" ON public.meeting_assignees;

CREATE POLICY "Meeting assignees select"
ON public.meeting_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    public.current_user_role() = 'admin'
    AND public.meeting_id_in_reader_org(meeting_assignees.meeting_id)
  )
);

CREATE POLICY "Meeting assignees admin write"
ON public.meeting_assignees FOR ALL TO authenticated
USING (
  public.current_user_role() = 'admin'
  AND public.meeting_id_in_reader_org(meeting_assignees.meeting_id)
)
WITH CHECK (
  public.current_user_role() = 'admin'
  AND public.meeting_id_in_reader_org(meeting_assignees.meeting_id)
);

-- ---------------------------------------------------------------------------
-- 6) meeting_attachments — same pattern, no junction SELECT inside policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Read meeting attachments in org" ON public.meeting_attachments;
CREATE POLICY "Read meeting attachments in org"
ON public.meeting_attachments FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    public.current_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR public.is_meeting_assignee(meeting_attachments.meeting_id)
  )
);
