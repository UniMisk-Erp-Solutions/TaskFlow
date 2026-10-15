-- Admin "Properties" data for Files: when a file was last opened/downloaded, by whom, and how often.
ALTER TABLE public.drive_files
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_accessed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0;
