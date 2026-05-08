-- Organizations and multi-tenant org_id wiring

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamp with time zone DEFAULT now()
);

-- Add org_id to profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- Add org_id to tasks if not present
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- Add org_id to meetings if not present
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- For existing rows without org_id, create a default org and attach.
-- This is a simple single-tenant fallback; for real multi-tenant
-- migrations you would customize this step.
DO $$
DECLARE
  default_org uuid;
BEGIN
  SELECT id INTO default_org
  FROM public.organizations
  ORDER BY created_at
  LIMIT 1;

  IF default_org IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Default Org')
    RETURNING id INTO default_org;
  END IF;

  UPDATE public.profiles
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.tasks
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.meetings
  SET org_id = default_org
  WHERE org_id IS NULL;
END $$;

-- RLS: ensure org_id matches caller's org (via profile)

-- Tasks policies
DROP POLICY IF EXISTS "Admin full access" ON public.tasks;
DROP POLICY IF EXISTS "Employee read own" ON public.tasks;
DROP POLICY IF EXISTS "Employee update own" ON public.tasks;

CREATE POLICY "Tasks admin full access"
ON public.tasks
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin' AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Tasks employee read own"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Tasks employee update own"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

-- Meetings policies (mirror tasks)
DROP POLICY IF EXISTS "Admin full access meetings" ON public.meetings;
DROP POLICY IF EXISTS "Employee read own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Employee update own meetings" ON public.meetings;

CREATE POLICY "Meetings admin full access"
ON public.meetings
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin' AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Meetings employee read own"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Meetings employee update own"
ON public.meetings
FOR UPDATE
TO authenticated
USING (
  assignee_id = auth.uid()
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

