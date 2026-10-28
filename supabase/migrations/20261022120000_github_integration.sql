-- GitHub integration: per-user GitHub identity, GitHub App installations linked to an
-- organization, commits/branches/PRs linked to tasks, and webhook delivery idempotency.
-- Idempotent. All writes happen in the Edge Function with the service role; browsers never
-- read these tables directly (RLS is enabled with no client policies).

-- One GitHub account <-> one TaskFlow user. Only the public GitHub identity is stored;
-- no OAuth access/refresh token is kept.
CREATE TABLE IF NOT EXISTS public.github_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  github_user_id bigint NOT NULL UNIQUE,
  github_login text NOT NULL,
  avatar_url text,
  connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS github_connections_org_idx ON public.github_connections(org_id);

-- GitHub App installations that an admin has linked to this organization.
CREATE TABLE IF NOT EXISTS public.github_installations (
  installation_id bigint PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_login text NOT NULL,
  account_type text,
  repository_selection text,
  installed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS github_installations_org_idx ON public.github_installations(org_id);

-- Commits, branches and pull requests linked to a task (automatically or explicitly).
-- `ref` is the commit SHA, the branch name, or the PR number depending on `kind`.
CREATE TABLE IF NOT EXISTS public.task_github_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('branch', 'commit', 'pull_request')),
  repo_full_name text NOT NULL,
  ref text NOT NULL,
  url text,
  title text,
  state text,
  author_login text,
  author_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_github_links_unique UNIQUE (task_id, kind, repo_full_name, ref)
);
CREATE INDEX IF NOT EXISTS task_github_links_task_idx ON public.task_github_links(task_id);
CREATE INDEX IF NOT EXISTS task_github_links_lookup_idx
  ON public.task_github_links(org_id, repo_full_name, kind, ref);

-- One row per processed webhook delivery (X-GitHub-Delivery) so redeliveries are no-ops.
CREATE TABLE IF NOT EXISTS public.github_events (
  delivery_id text PRIMARY KEY,
  event text NOT NULL,
  action text,
  installation_id bigint,
  repo_full_name text,
  result text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS github_events_received_idx ON public.github_events(received_at);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_github_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.github_connections IS 'TaskFlow user <-> GitHub account (identity only, no tokens).';
COMMENT ON TABLE public.github_installations IS 'GitHub App installations linked to a TaskFlow organization by an admin.';
COMMENT ON TABLE public.task_github_links IS 'GitHub commits, branches and pull requests linked to tasks.';
COMMENT ON TABLE public.github_events IS 'Processed GitHub webhook deliveries (idempotency + audit).';
