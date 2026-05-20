-- Bulk-import audit log. Admin-only CSV imports of tasks and meetings drop a
-- row here so we can see what was imported, by whom, and which rows failed.
-- Designed to be append-only; never updated after the import finishes.

CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('task', 'meeting')),
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_logs_org_id_idx     ON public.import_logs(org_id);
CREATE INDEX IF NOT EXISTS import_logs_created_at_idx ON public.import_logs(created_at DESC);

COMMENT ON TABLE public.import_logs IS 'Append-only audit trail for admin CSV imports (kind = task | meeting).';

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Admins in the same org can read their own org's import history.
DROP POLICY IF EXISTS "Import logs admin read" ON public.import_logs;
CREATE POLICY "Import logs admin read"
ON public.import_logs FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'admin'
  AND org_id IS NOT DISTINCT FROM public.current_user_org_id()
);

-- Writes happen via the Edge Function (service role, bypasses RLS), so no
-- INSERT/UPDATE/DELETE policy needed for authenticated users.
