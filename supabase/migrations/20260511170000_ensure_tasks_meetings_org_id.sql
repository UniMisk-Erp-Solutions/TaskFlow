-- Edge API and admin stats filter by org_id. Older databases may lack this column
-- (PostgREST then returns errors on .eq("org_id", ...)).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
