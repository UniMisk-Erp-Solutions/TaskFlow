-- GitHub polling fallback: lets TaskFlow notice pushes in a task's repository without the GitHub
-- App being installed there, using the user's own (encrypted) GitHub token. Additive, idempotent.

-- One token per user. `token_enc` is AES-256-GCM ciphertext (key = GITHUB_TOKEN_ENC_KEY on the server);
-- the plaintext token never reaches the browser or the database.
CREATE TABLE IF NOT EXISTS public.github_user_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  github_user_id bigint NOT NULL,
  github_login text NOT NULL,
  token_enc text NOT NULL,
  token_hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_error text
);

-- Last commit seen per (user, repository, branch), so each poll only looks at new commits.
CREATE TABLE IF NOT EXISTS public.github_poll_state (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,
  branch text NOT NULL,
  head_sha text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, repo_full_name, branch)
);

-- When the repository was attached to the task: commits made after this moment count.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS github_repo_set_at timestamptz NULL;

ALTER TABLE public.github_user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_poll_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.github_user_tokens IS 'Encrypted per-user GitHub token used to poll repositories named on tasks.';
COMMENT ON TABLE public.github_poll_state IS 'Polling cursor: last seen head commit per user, repository and branch.';
