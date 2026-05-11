-- Infinite recursion: "Task assignees select" referenced task_assignees inside its
-- own USING clause; evaluating RLS on those inner rows re-entered the same policy.
-- Same pattern on meeting_assignees. Break the cycle by not subquerying the
-- junction table from itself; admin/org checks only need public.tasks / public.meetings.

DROP POLICY IF EXISTS "Task assignees select" ON public.task_assignees;
CREATE POLICY "Task assignees select"
ON public.task_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Meeting assignees select" ON public.meeting_assignees;
CREATE POLICY "Meeting assignees select"
ON public.meeting_assignees FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_assignees.meeting_id
        AND m.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);
