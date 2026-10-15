-- One shared, always-live whiteboard per organization.
ALTER TABLE public.whiteboards ADD COLUMN IF NOT EXISTS is_main boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS whiteboards_one_main_per_org_uidx
  ON public.whiteboards (org_id) WHERE is_main;

CREATE OR REPLACE FUNCTION public.wb_ensure_main()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid := public.current_user_org_id();
  me uuid := auth.uid();
  b uuid;
BEGIN
  IF me IS NULL OR org IS NULL THEN
    RAISE EXCEPTION 'Not signed in to an organization';
  END IF;
  SELECT id INTO b FROM public.whiteboards WHERE org_id = org AND is_main;
  IF b IS NULL THEN
    INSERT INTO public.whiteboards (org_id, owner_id, name, visibility, is_main)
    VALUES (org, me, 'Whiteboard', 'public', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO b;
    IF b IS NULL THEN
      SELECT id INTO b FROM public.whiteboards WHERE org_id = org AND is_main;
    END IF;
  END IF;
  RETURN b;
END;
$$;
REVOKE ALL ON FUNCTION public.wb_ensure_main() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wb_ensure_main() TO authenticated;
