-- Chat: replies, user-created groups (type 'team') with per-member history visibility.
ALTER TABLE public.chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_type_check;
ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_type_check CHECK (type IN ('group', 'direct', 'team'));

ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  ADD COLUMN IF NOT EXISTS history_from timestamptz,   -- NULL = can see the full history
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system'));

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
        OR (c.type IN ('direct', 'team') AND EXISTS (
          SELECT 1 FROM public.chat_participants p
          WHERE p.conversation_id = c.id AND p.user_id = auth.uid()
        ))
      )
  );
$$;

-- Can the caller read a message of this conversation created at ts?
-- Members added with "hide previous history" only see messages from when they joined.
CREATE OR REPLACE FUNCTION public.chat_can_read_message(conv uuid, ts timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.chat_can_access(conv) AND (
    NOT EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conv AND c.type = 'team')
    OR EXISTS (
      SELECT 1 FROM public.chat_participants p
      WHERE p.conversation_id = conv AND p.user_id = auth.uid()
        AND (p.history_from IS NULL OR ts >= p.history_from)
    )
  );
$$;

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.chat_can_read_message(conversation_id, created_at));

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND kind = 'user'
    AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
    AND public.chat_can_access(conversation_id)
    AND (reply_to_id IS NULL OR EXISTS (
      SELECT 1 FROM public.chat_messages r
      WHERE r.id = chat_messages.reply_to_id AND r.conversation_id = chat_messages.conversation_id
    ))
  );

CREATE OR REPLACE FUNCTION public.chat_insert_system(conv uuid, actor uuid, txt text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.chat_messages (conversation_id, org_id, sender_id, body, kind)
  SELECT id, org_id, actor, txt, 'system' FROM public.chat_conversations WHERE id = conv;
$$;
REVOKE ALL ON FUNCTION public.chat_insert_system(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_is_team_admin(conv uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants p
    JOIN public.chat_conversations c ON c.id = p.conversation_id
    WHERE p.conversation_id = conv AND p.user_id = auth.uid()
      AND p.role = 'admin' AND c.type = 'team'
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_create_group(p_name text, p_members uuid[])
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  org uuid := public.current_user_org_id();
  conv uuid;
  nm text := btrim(coalesce(p_name, ''));
  m uuid;
BEGIN
  IF me IS NULL OR org IS NULL THEN RAISE EXCEPTION 'Not signed in to an organization'; END IF;
  IF nm = '' OR char_length(nm) > 80 THEN RAISE EXCEPTION 'Group name must be 1-80 characters'; END IF;
  INSERT INTO public.chat_conversations (org_id, type, name, created_by)
  VALUES (org, 'team', nm, me) RETURNING id INTO conv;
  INSERT INTO public.chat_participants (conversation_id, user_id, role, added_by)
  VALUES (conv, me, 'admin', me);
  FOREACH m IN ARRAY coalesce(p_members, ARRAY[]::uuid[]) LOOP
    IF m <> me AND EXISTS (SELECT 1 FROM public.profiles WHERE id = m AND org_id = org) THEN
      INSERT INTO public.chat_participants (conversation_id, user_id, added_by)
      VALUES (conv, m, me) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  PERFORM public.chat_insert_system(conv, me, 'created the group "' || nm || '"');
  RETURN conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_add_members(conv uuid, p_members uuid[], p_show_history boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  org uuid := public.current_user_org_id();
  m uuid;
  added text[] := ARRAY[]::text[];
  nm text;
BEGIN
  IF NOT public.chat_is_team_admin(conv) THEN RAISE EXCEPTION 'Only group admins can add members'; END IF;
  FOREACH m IN ARRAY coalesce(p_members, ARRAY[]::uuid[]) LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = m AND org_id = org)
       AND NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = conv AND user_id = m) THEN
      INSERT INTO public.chat_participants (conversation_id, user_id, added_by, history_from, last_read_at)
      VALUES (conv, m, me, CASE WHEN p_show_history THEN NULL ELSE now() END, now());
      SELECT coalesce(full_name, email) INTO nm FROM public.profiles WHERE id = m;
      added := added || nm;
    END IF;
  END LOOP;
  IF array_length(added, 1) > 0 THEN
    PERFORM public.chat_insert_system(conv, me,
      'added ' || array_to_string(added, ', ') ||
      CASE WHEN p_show_history THEN ' (can see previous messages)' ELSE ' (previous messages hidden)' END);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_remove_member(conv uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  nm text;
  next_admin uuid;
BEGIN
  IF p_user <> me AND NOT public.chat_is_team_admin(conv) THEN
    RAISE EXCEPTION 'Only group admins can remove members';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_participants p JOIN public.chat_conversations c ON c.id = p.conversation_id
                 WHERE p.conversation_id = conv AND p.user_id = p_user AND c.type = 'team') THEN
    RETURN;
  END IF;
  SELECT coalesce(full_name, email) INTO nm FROM public.profiles WHERE id = p_user;
  IF p_user = me THEN
    PERFORM public.chat_insert_system(conv, me, 'left the group');
  ELSE
    PERFORM public.chat_insert_system(conv, me, 'removed ' || coalesce(nm, 'a member'));
  END IF;
  DELETE FROM public.chat_participants WHERE conversation_id = conv AND user_id = p_user;
  IF NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = conv AND role = 'admin') THEN
    SELECT user_id INTO next_admin FROM public.chat_participants
      WHERE conversation_id = conv ORDER BY last_read_at LIMIT 1;
    IF next_admin IS NOT NULL THEN
      UPDATE public.chat_participants SET role = 'admin' WHERE conversation_id = conv AND user_id = next_admin;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_rename_group(conv uuid, p_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.chat_is_team_admin(conv) THEN RAISE EXCEPTION 'Only group admins can rename the group'; END IF;
  IF btrim(coalesce(p_name, '')) = '' OR char_length(p_name) > 80 THEN RAISE EXCEPTION 'Group name must be 1-80 characters'; END IF;
  UPDATE public.chat_conversations SET name = btrim(p_name) WHERE id = conv;
  PERFORM public.chat_insert_system(conv, auth.uid(), 'renamed the group to "' || btrim(p_name) || '"');
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_unread_counts()
RETURNS TABLE (conversation_id uuid, unread bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, count(m.id)
  FROM public.chat_conversations c
  LEFT JOIN public.chat_participants p ON p.conversation_id = c.id AND p.user_id = auth.uid()
  LEFT JOIN public.chat_messages m
    ON m.conversation_id = c.id AND m.sender_id <> auth.uid() AND m.kind = 'user'
   AND m.created_at > COALESCE(p.last_read_at, '-infinity'::timestamptz)
   AND (p.history_from IS NULL OR m.created_at >= p.history_from)
  WHERE public.chat_can_access(c.id)
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.chat_can_read_message(uuid, timestamptz), public.chat_is_team_admin(uuid),
  public.chat_create_group(text, uuid[]), public.chat_add_members(uuid, uuid[], boolean),
  public.chat_remove_member(uuid, uuid), public.chat_rename_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_can_read_message(uuid, timestamptz), public.chat_is_team_admin(uuid),
  public.chat_create_group(text, uuid[]), public.chat_add_members(uuid, uuid[], boolean),
  public.chat_remove_member(uuid, uuid), public.chat_rename_group(uuid, text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END $$;
