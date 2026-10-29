-- Teams (a manager's group of employees) and the two-step review of submitted tasks:
--   employee submits -> manager approves -> admin approves.
-- Access is only through the Edge Function (service role), which enforces who sees and changes what:
-- RLS is on with no policies, so anon/authenticated clients can never read these tables directly.

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  manager_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  created_at  timestamptz not null default now(),
  unique (org_id, manager_id, name)
);

create table if not exists public.team_members (
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists teams_manager_idx on public.teams (manager_id);
create index if not exists teams_org_idx on public.teams (org_id);
create index if not exists team_members_user_idx on public.team_members (user_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Which stage a submitted task is waiting at. NULL on a submitted task (older rows) means it waits for an admin.
alter table public.tasks
  add column if not exists review_stage text check (review_stage is null or review_stage in ('manager', 'admin')),
  add column if not exists manager_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists manager_approved_at timestamptz;
