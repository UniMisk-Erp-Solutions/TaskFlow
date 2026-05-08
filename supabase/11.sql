-- Add meeting time support for calendar and dashboard
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_time time;

-- Backfill missing values for existing rows
UPDATE public.meetings
SET meeting_time = '09:00:00'
WHERE meeting_time IS NULL;

-- Enforce time for all future meetings
ALTER TABLE public.meetings
  ALTER COLUMN meeting_time SET DEFAULT '09:00:00',
  ALTER COLUMN meeting_time SET NOT NULL;
