-- After 20260511180000, task_assignees SELECT still did EXISTS(SELECT … FROM tasks …).
-- Policies on public.tasks include EXISTS(task_assignees …), so Postgres detected
-- infinite recursion on relation "tasks". Read parent rows in SECURITY DEFINER helpers
-- (RLS bypassed inside) and only expose org match — same intent, no cycle.

CREATE OR REPLACE FUNCTION public.task_id_in_reader_org(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.org_id IS NOT DISTINCT FROM (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.meeting_id_in_reader_org(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings m
    WHERE m.id = p_meeting_id
      AND m.org_id IS NOT DISTINCT FROM (
        SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.task_id_in_reader_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_id_in_reader_org(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.meeting_id_in_reader_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meeting_id_in_reader_org(uuid) TO authenticated;

DROP POLICY IF EXISTS "Task assignees select" ON public.task_assignees;
CREATE POLICY "Task assignees select"
ON public.task_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND public.task_id_in_reader_org(task_assignees.task_id)
  )
);

DROP POLICY IF EXISTS "Meeting assignees select" ON public.meeting_assignees;
CREATE POLICY "Meeting assignees select"
ON public.meeting_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND public.meeting_id_in_reader_org(meeting_assignees.meeting_id)
  )
);
