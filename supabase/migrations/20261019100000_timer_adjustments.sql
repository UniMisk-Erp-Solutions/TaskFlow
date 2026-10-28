-- Let people correct a timer they forgot to stop; keep the original value for admins.
ALTER TABLE public.task_timer_sessions
  ADD COLUMN IF NOT EXISTS adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjusted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjust_reason text;
