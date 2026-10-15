-- File explorer ("Files"): multi-tenant folders and files with per-item private/public visibility.
--
-- Storage layout (dedicated private bucket, never shared with task/meeting assets):
--   taskflow-files / <org_id> / <owner_user_id> / <file_id>-<safe file name>
-- Every object lives under its organization's prefix and then its owner's prefix, so
-- tenants and people never mix. Objects are only reachable through short-lived signed
-- URLs issued by the API after a visibility check.
--
-- Visibility:
--   private : only the owner can see or open the item (not even admins)
--   public  : every member of the same organization can see and open it

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('taskflow-files', 'taskflow-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

CREATE TABLE IF NOT EXISTS public.drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A person cannot have two folders with the same name in the same place.
CREATE UNIQUE INDEX IF NOT EXISTS drive_folders_unique_name_idx
  ON public.drive_folders (org_id, owner_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX IF NOT EXISTS drive_folders_org_parent_idx ON public.drive_folders (org_id, parent_id);

CREATE TABLE IF NOT EXISTS public.drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 255),
  bucket text NOT NULL DEFAULT 'taskflow-files',
  path text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drive_files_org_folder_idx ON public.drive_files (org_id, folder_id);
CREATE INDEX IF NOT EXISTS drive_files_owner_idx ON public.drive_files (owner_id);

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

-- Defense in depth: even a direct database client only ever sees own items or public items of its own org.
DROP POLICY IF EXISTS drive_folders_read ON public.drive_folders;
CREATE POLICY drive_folders_read ON public.drive_folders
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (visibility = 'public' AND org_id = public.current_user_org_id()));

DROP POLICY IF EXISTS drive_files_read ON public.drive_files;
CREATE POLICY drive_files_read ON public.drive_files
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (visibility = 'public' AND org_id = public.current_user_org_id()));

REVOKE ALL ON public.drive_folders, public.drive_files FROM anon, authenticated;
GRANT SELECT ON public.drive_folders, public.drive_files TO authenticated;
GRANT ALL ON public.drive_folders, public.drive_files TO service_role;

COMMENT ON TABLE public.drive_folders IS 'File explorer folders (multi-tenant, private/public). Writes via the Edge API service role.';
COMMENT ON TABLE public.drive_files IS 'File explorer files stored in the taskflow-files bucket under <org>/<owner>/.';
