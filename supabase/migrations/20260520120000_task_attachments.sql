-- Task attachments (audio / document / other) — mirrors meeting_attachments
-- so tasks can carry files too. Reuses a private storage bucket.

-- 1) Private bucket for task files
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-assets', 'task-assets', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Attachment type enum (shared shape with meeting_attachment_type)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_attachment_type') THEN
    CREATE TYPE public.task_attachment_type AS ENUM ('audio', 'transcript', 'other');
  END IF;
END $$;

-- 3) Metadata table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  assignee_id uuid REFERENCES public.profiles(id),
  type public.task_attachment_type NOT NULL DEFAULT 'other',
  bucket text NOT NULL DEFAULT 'task-assets',
  path text NOT NULL,
  original_name text,
  content_type text,
  size_bytes bigint,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachments_org_id_idx  ON public.task_attachments(org_id);
CREATE INDEX IF NOT EXISTS task_attachments_task_id_idx ON public.task_attachments(task_id);

COMMENT ON TABLE public.task_attachments IS 'Files attached to tasks (audio/document/other). Writes via Edge service-role.';

-- 4) RLS — read for admins in org, or task assignees. Writes via Edge (service role).
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read task attachments in org" ON public.task_attachments;
CREATE POLICY "Read task attachments in org"
ON public.task_attachments FOR SELECT TO authenticated
USING (
  org_id IS NOT DISTINCT FROM public.current_user_org_id()
  AND (
    public.current_user_role() = 'admin'
    OR assignee_id = auth.uid()
    OR public.is_task_assignee(task_attachments.task_id)
  )
);
