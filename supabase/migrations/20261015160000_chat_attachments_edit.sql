-- Chat: file/voice attachments, message editing.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE public.chat_messages ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_content_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_content_check CHECK (
  char_length(body) <= 4000 AND (char_length(btrim(body)) > 0 OR attachment_path IS NOT NULL)
);

-- Only the sender may edit, and only the text.
DROP POLICY IF EXISTS chat_messages_update_own ON public.chat_messages;
CREATE POLICY chat_messages_update_own ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
GRANT UPDATE (body, edited_at) ON public.chat_messages TO authenticated;

-- Private bucket; first path segment is the conversation id.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_files_select ON storage.objects;
CREATE POLICY chat_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files'
    AND public.chat_can_access(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS chat_files_insert ON storage.objects;
CREATE POLICY chat_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files'
    AND public.chat_can_access(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS chat_files_delete ON storage.objects;
CREATE POLICY chat_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND owner = auth.uid());
