-- Audit trail for the file explorer.
--
-- Every event stores `public_at_event`: whether the item was visible to the organization
-- when the event happened. Administrators only ever see events that were public at the time
-- AND whose item is currently public (or was public when it was deleted). Private activity is
-- visible to the item's owner only.
CREATE TABLE IF NOT EXISTS public.drive_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  item_kind text NOT NULL CHECK (item_kind IN ('file', 'folder')),
  item_id uuid NOT NULL,
  item_name text NOT NULL,
  item_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_at_event boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drive_activity_org_created_idx ON public.drive_activity (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS drive_activity_item_idx ON public.drive_activity (item_id, created_at DESC);

ALTER TABLE public.drive_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drive_activity_owner_read ON public.drive_activity;
CREATE POLICY drive_activity_owner_read ON public.drive_activity
  FOR SELECT TO authenticated
  USING (item_owner_id = auth.uid());

REVOKE ALL ON public.drive_activity FROM anon, authenticated;
GRANT SELECT ON public.drive_activity TO authenticated;
GRANT ALL ON public.drive_activity TO service_role;
