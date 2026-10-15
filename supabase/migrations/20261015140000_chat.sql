-- Real-time chat: one org-wide group ("General", visible to everyone in the org) plus
-- private 1:1 conversations that only the two participants can read.
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('group', 'direct')),
  name text,
  dm_key text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_direct_has_key CHECK (type <> 'direct' OR dm_key IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_dm_key_uidx
  ON public.chat_conversations (org_id, dm_key) WHERE type = 'direct';
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_one_group_per_org_uidx
  ON public.chat_conversations (org_id) WHERE type = 'group';

CREATE TABLE IF NOT EXISTS public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_participants_user_idx ON public.chat_participants (user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_conv_created_idx
  ON public.chat_messages (conversation_id, created_at DESC);

-- Access helper (SECURITY DEFINER so policies never recurse into themselves).
CREATE OR REPLACE FUNCTION public.chat_can_access(conv uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conv
      AND (
        (c.type = 'group' AND c.org_id IS NOT DISTINCT FROM public.current_user_org_id())
        OR (c.type = 'direct' AND EXISTS (
          SELECT 1 FROM public.chat_participants p
          WHERE p.conversation_id = c.id AND p.user_id = auth.uid()
        ))
      )
  );
$$;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conversations_select ON public.chat_conversations;
CREATE POLICY chat_conversations_select ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.chat_can_access(id));

DROP POLICY IF EXISTS chat_participants_select ON public.chat_participants;
CREATE POLICY chat_participants_select ON public.chat_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.chat_can_access(conversation_id));

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated USING (public.chat_can_access(conversation_id));

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
    AND public.chat_can_access(conversation_id)
  );

DROP POLICY IF EXISTS chat_messages_delete_own ON public.chat_messages;
CREATE POLICY chat_messages_delete_own ON public.chat_messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

REVOKE ALL ON public.chat_conversations, public.chat_participants, public.chat_messages FROM anon, authenticated;
GRANT SELECT ON public.chat_conversations, public.chat_participants TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_conversations, public.chat_participants, public.chat_messages TO service_role;

-- Keep conversations sorted by latest activity.
CREATE OR REPLACE FUNCTION public.chat_touch_conversation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_messages_touch_conversation ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_touch_conversation();

-- The org-wide group: created on first use, everyone in the org can see it.
CREATE OR REPLACE FUNCTION public.chat_ensure_general()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid := public.current_user_org_id();
  conv uuid;
BEGIN
  IF auth.uid() IS NULL OR org IS NULL THEN
    RAISE EXCEPTION 'Not signed in to an organization';
  END IF;
  SELECT id INTO conv FROM public.chat_conversations WHERE org_id = org AND type = 'group';
  IF conv IS NULL THEN
    INSERT INTO public.chat_conversations (org_id, type, name, created_by)
    VALUES (org, 'group', 'General', auth.uid())
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv;
    IF conv IS NULL THEN
      SELECT id INTO conv FROM public.chat_conversations WHERE org_id = org AND type = 'group';
    END IF;
  END IF;
  RETURN conv;
END;
$$;

-- Private 1:1 conversation with another member of the same org (created on demand).
CREATE OR REPLACE FUNCTION public.chat_get_or_create_dm(other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  org uuid := public.current_user_org_id();
  key text;
  conv uuid;
BEGIN
  IF me IS NULL OR org IS NULL THEN
    RAISE EXCEPTION 'Not signed in to an organization';
  END IF;
  IF other IS NULL OR other = me THEN
    RAISE EXCEPTION 'Pick another user to chat with';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other AND org_id = org) THEN
    RAISE EXCEPTION 'User is not in your organization';
  END IF;
  key := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  SELECT id INTO conv FROM public.chat_conversations
   WHERE org_id = org AND type = 'direct' AND dm_key = key;
  IF conv IS NULL THEN
    INSERT INTO public.chat_conversations (org_id, type, dm_key, created_by)
    VALUES (org, 'direct', key, me)
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv;
    IF conv IS NULL THEN
      SELECT id INTO conv FROM public.chat_conversations
       WHERE org_id = org AND type = 'direct' AND dm_key = key;
    END IF;
    INSERT INTO public.chat_participants (conversation_id, user_id)
    VALUES (conv, me), (conv, other)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN conv;
END;
$$;

-- Marks a conversation as read for the caller (also tracks unread for the group).
CREATE OR REPLACE FUNCTION public.chat_mark_read(conv uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.chat_can_access(conv) THEN
    RETURN;
  END IF;
  INSERT INTO public.chat_participants (conversation_id, user_id, last_read_at)
  VALUES (conv, auth.uid(), now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now();
END;
$$;

-- Unread counts per conversation for the caller (group counts only after first open).
CREATE OR REPLACE FUNCTION public.chat_unread_counts()
RETURNS TABLE (conversation_id uuid, unread bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, count(m.id)
  FROM public.chat_conversations c
  LEFT JOIN public.chat_participants p ON p.conversation_id = c.id AND p.user_id = auth.uid()
  LEFT JOIN public.chat_messages m
    ON m.conversation_id = c.id AND m.sender_id <> auth.uid()
   AND m.created_at > COALESCE(p.last_read_at, '-infinity'::timestamptz)
  WHERE public.chat_can_access(c.id)
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.chat_can_access(uuid), public.chat_ensure_general(),
  public.chat_get_or_create_dm(uuid), public.chat_mark_read(uuid), public.chat_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_can_access(uuid), public.chat_ensure_general(),
  public.chat_get_or_create_dm(uuid), public.chat_mark_read(uuid), public.chat_unread_counts() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['chat_messages', 'chat_conversations'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
