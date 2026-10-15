-- Extra "screens" (blank boards) next to the main whiteboard, shared with the whole org.
CREATE OR REPLACE FUNCTION public.wb_create_screen()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid := public.current_user_org_id();
  me uuid := auth.uid();
  n int;
  b uuid;
BEGIN
  IF me IS NULL OR org IS NULL THEN
    RAISE EXCEPTION 'Not signed in to an organization';
  END IF;
  SELECT count(*) + 1 INTO n FROM public.whiteboards WHERE org_id = org AND visibility = 'public';
  INSERT INTO public.whiteboards (org_id, owner_id, name, visibility, is_main)
  VALUES (org, me, 'Screen ' || n, 'public', false)
  RETURNING id INTO b;
  RETURN b;
END;
$$;
REVOKE ALL ON FUNCTION public.wb_create_screen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wb_create_screen() TO authenticated;
