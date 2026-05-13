-- Web Push subscriptions + per-user notification preferences (assignments, updates).

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT false,
  notify_task_assigned boolean NOT NULL DEFAULT true,
  notify_meeting_assigned boolean NOT NULL DEFAULT true,
  notify_task_updates boolean NOT NULL DEFAULT true,
  notify_meeting_updates boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'User toggles for browser push categories; push_enabled gates all sends.';

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_own"
ON public.notification_preferences FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_select"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_insert"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_delete"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Service role (Edge / backend) bypasses RLS for sends and server-side writes.
