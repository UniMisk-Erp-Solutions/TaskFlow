-- Meeting status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status_enum') THEN
    CREATE TYPE meeting_status_enum AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
END $$;

-- Meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.profiles(id),
  priority priority_enum DEFAULT 'medium',
  status meeting_status_enum DEFAULT 'scheduled',
  meeting_date date NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "Admin full access meetings" ON public.meetings;
CREATE POLICY "Admin full access meetings"
ON public.meetings FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

-- Employees can read/update only assigned meetings
DROP POLICY IF EXISTS "Employee read own meetings" ON public.meetings;
CREATE POLICY "Employee read own meetings"
ON public.meetings FOR SELECT
TO authenticated
USING (assignee_id = auth.uid());

DROP POLICY IF EXISTS "Employee update own meetings" ON public.meetings;
CREATE POLICY "Employee update own meetings"
ON public.meetings FOR UPDATE
TO authenticated
USING (assignee_id = auth.uid());
