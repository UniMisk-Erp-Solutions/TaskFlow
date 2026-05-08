-- Meeting attachments (mp3 + transcript files) using Supabase Storage

-- 1) Create private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-assets', 'meeting-assets', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Table for attachment metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_attachment_type') THEN
    CREATE TYPE public.meeting_attachment_type AS ENUM ('audio', 'transcript', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.meeting_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  assignee_id uuid REFERENCES public.profiles(id),
  type meeting_attachment_type NOT NULL DEFAULT 'other',
  bucket text NOT NULL DEFAULT 'meeting-assets',
  path text NOT NULL,
  original_name text,
  content_type text,
  size_bytes bigint,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_attachments_org_id_idx ON public.meeting_attachments(org_id);
CREATE INDEX IF NOT EXISTS meeting_attachments_meeting_id_idx ON public.meeting_attachments(meeting_id);

-- 3) RLS: anyone in meeting can read; only admin can write
ALTER TABLE public.meeting_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read meeting attachments in org" ON public.meeting_attachments;
CREATE POLICY "Read meeting attachments in org"
ON public.meeting_attachments
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR assignee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin insert meeting attachments" ON public.meeting_attachments;
CREATE POLICY "Admin insert meeting attachments"
ON public.meeting_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admin delete meeting attachments" ON public.meeting_attachments;
CREATE POLICY "Admin delete meeting attachments"
ON public.meeting_attachments
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

