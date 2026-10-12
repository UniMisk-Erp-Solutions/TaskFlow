-- A rejected task returns to active work. Keep this separate from the board
-- schema migration so existing installations can apply the review workflow.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_enum')
    AND NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'status_enum' AND e.enumlabel = 'rejected'
    ) THEN
    ALTER TYPE public.status_enum ADD VALUE 'rejected';
  END IF;
END $$;
