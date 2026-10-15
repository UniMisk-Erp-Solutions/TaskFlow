-- Projects are archived, never deleted, so their history stays intact.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_org_active_idx ON public.projects (org_id) WHERE archived_at IS NULL;
