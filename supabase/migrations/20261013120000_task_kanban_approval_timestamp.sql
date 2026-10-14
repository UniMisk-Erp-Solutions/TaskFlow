-- Record when an administrator approves submitted work so the employee Kanban
-- board can show a one-minute completion countdown across refreshes/devices.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kanban_approved_at timestamptz;

COMMENT ON COLUMN public.tasks.kanban_approved_at IS
  'Timestamp when submitted task work was approved; used for the employee Kanban Done-lane countdown.';
