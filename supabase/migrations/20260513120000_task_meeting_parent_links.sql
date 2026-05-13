-- Optional parent links for sub-tasks and sub-meetings (same org enforced in API).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS parent_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS meetings_parent_meeting_id_idx ON public.meetings(parent_meeting_id);

COMMENT ON COLUMN public.tasks.parent_task_id IS 'Optional parent task (sub-task).';
COMMENT ON COLUMN public.meetings.parent_meeting_id IS 'Optional parent meeting (nested meeting).';
