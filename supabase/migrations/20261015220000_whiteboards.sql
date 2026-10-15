-- Collaborative whiteboards (Excalidraw scenes), public to the org or private to invited members.
CREATE TABLE IF NOT EXISTS public.whiteboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  scene jsonb NOT NULL DEFAULT '{"elements": []}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whiteboards_org_idx ON public.whiteboards (org_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whiteboard_members (
  board_id uuid NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
CREATE INDEX IF NOT EXISTS whiteboard_members_user_idx ON public.whiteboard_members (user_id);

-- Public boards: everyone in the org. Private boards: owner + invited members.
CREATE OR REPLACE FUNCTION public.wb_can_access(b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboards w
    WHERE w.id = b
      AND w.org_id IS NOT DISTINCT FROM public.current_user_org_id()
      AND (
        w.visibility = 'public'
        OR w.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.whiteboard_members m WHERE m.board_id = w.id AND m.user_id = auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.wb_is_owner(b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = b AND w.owner_id = auth.uid());
$$;

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whiteboards_select ON public.whiteboards;
CREATE POLICY whiteboards_select ON public.whiteboards
  FOR SELECT TO authenticated USING (public.wb_can_access(id));
DROP POLICY IF EXISTS whiteboards_insert ON public.whiteboards;
CREATE POLICY whiteboards_insert ON public.whiteboards
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND org_id IS NOT DISTINCT FROM public.current_user_org_id());
DROP POLICY IF EXISTS whiteboards_update ON public.whiteboards;
CREATE POLICY whiteboards_update ON public.whiteboards
  FOR UPDATE TO authenticated
  USING (public.wb_can_access(id)) WITH CHECK (public.wb_can_access(id));
DROP POLICY IF EXISTS whiteboards_delete ON public.whiteboards;
CREATE POLICY whiteboards_delete ON public.whiteboards
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS whiteboard_members_select ON public.whiteboard_members;
CREATE POLICY whiteboard_members_select ON public.whiteboard_members
  FOR SELECT TO authenticated USING (public.wb_can_access(board_id));
DROP POLICY IF EXISTS whiteboard_members_insert ON public.whiteboard_members;
CREATE POLICY whiteboard_members_insert ON public.whiteboard_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.wb_is_owner(board_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.org_id IS NOT DISTINCT FROM public.current_user_org_id())
  );
DROP POLICY IF EXISTS whiteboard_members_delete ON public.whiteboard_members;
CREATE POLICY whiteboard_members_delete ON public.whiteboard_members
  FOR DELETE TO authenticated USING (public.wb_is_owner(board_id));

REVOKE ALL ON public.whiteboards, public.whiteboard_members FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.whiteboards, public.whiteboard_members TO authenticated;
-- Members may update the scene; only the owner changes name/visibility (enforced by trigger below).
GRANT UPDATE (scene, name, visibility, updated_at) ON public.whiteboards TO authenticated;
GRANT ALL ON public.whiteboards, public.whiteboard_members TO service_role;
REVOKE ALL ON FUNCTION public.wb_can_access(uuid), public.wb_is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wb_can_access(uuid), public.wb_is_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.wb_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.name IS DISTINCT FROM OLD.name OR NEW.visibility IS DISTINCT FROM OLD.visibility)
     AND OLD.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the board owner can rename it or change its visibility';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS whiteboards_guard_update ON public.whiteboards;
CREATE TRIGGER whiteboards_guard_update BEFORE UPDATE ON public.whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.wb_guard_update();

-- Image files used on boards (stored in the S3-backed Supabase storage); path = <board_id>/<file_id>.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whiteboard-files', 'whiteboard-files', false, 20971520)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS whiteboard_files_select ON storage.objects;
CREATE POLICY whiteboard_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'whiteboard-files' AND public.wb_can_access(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS whiteboard_files_insert ON storage.objects;
CREATE POLICY whiteboard_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whiteboard-files' AND public.wb_can_access(((storage.foldername(name))[1])::uuid));
