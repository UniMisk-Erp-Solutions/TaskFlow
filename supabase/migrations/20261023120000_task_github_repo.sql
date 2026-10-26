-- Optional GitHub repository (and branch) a task's work lives in. With it, a push or pull
-- request by an assignee to that repository can complete the task without a TF-xxxxxxxx
-- reference. Additive and idempotent.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS github_repo text NULL,
  ADD COLUMN IF NOT EXISTS github_branch text NULL;

COMMENT ON COLUMN public.tasks.github_repo IS 'Lower-cased owner/repo this task is worked on in (GitHub integration).';
COMMENT ON COLUMN public.tasks.github_branch IS 'Optional branch restriction for github_repo.';

CREATE INDEX IF NOT EXISTS tasks_github_repo_idx ON public.tasks (org_id, github_repo)
  WHERE github_repo IS NOT NULL;
