-- Fix invited users: profile row must get org_id (and optional admin role) from auth metadata
-- so they appear in the app and RLS policies work. Replaces handle_new_user with ON CONFLICT merge.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  meta_org text;
  meta_org_uuid uuid;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
  IF user_role NOT IN ('admin', 'employee') THEN
    user_role := 'employee';
  END IF;

  meta_org := NEW.raw_user_meta_data->>'org_id';
  meta_org_uuid := NULL;
  IF meta_org IS NOT NULL AND btrim(meta_org) <> '' THEN
    BEGIN
      meta_org_uuid := meta_org::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        meta_org_uuid := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), ''),
    user_role::public.role_enum,
    meta_org_uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    role = EXCLUDED.role,
    org_id = COALESCE(EXCLUDED.org_id, profiles.org_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
