-- Leave portal: employees request leave (sick / exam / emergency / trip / a custom type), an admin of the same
-- organisation approves or rejects it. Access is only through the Edge Function (service role), which enforces
-- who can see and change what: RLS is on with no policies, so anon/authenticated clients can never read this table.

create table if not exists public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  leave_type   text not null check (char_length(leave_type) between 1 and 60),  -- sick | exam | emergency | trip | custom text
  is_custom    boolean not null default false,
  duration     text not null check (duration in ('single', 'multi')),
  start_date   date not null,
  end_date     date not null,
  reason       text check (reason is null or char_length(reason) <= 1000),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text check (review_note is null or char_length(review_note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint leave_dates_ordered check (end_date >= start_date),
  constraint leave_single_day check (duration <> 'single' or end_date = start_date)
);

create index if not exists leave_requests_org_start_idx on public.leave_requests (org_id, start_date desc);
create index if not exists leave_requests_user_idx on public.leave_requests (user_id, start_date desc);

comment on table public.leave_requests is 'Employee leave requests and their admin decisions. Service-role only (Edge Function).';

alter table public.leave_requests enable row level security;
