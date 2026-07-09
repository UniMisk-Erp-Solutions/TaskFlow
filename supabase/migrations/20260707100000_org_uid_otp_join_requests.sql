-- Signup overhaul: permanent 6-digit org UID, WhatsApp OTP phone verification (signup only),
-- and join-an-org approval requests. Purely additive — existing email/password login,
-- admin-created users, and the WhatsApp bot are unaffected.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Every organization gets a permanent, unique 6-digit UID (100000-999999).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations add column if not exists org_uid text;

create or replace function public.gen_org_uid() returns text
language plpgsql as $$
declare candidate text;
begin
  loop
    candidate := (floor(random() * 900000) + 100000)::int::text;   -- always 6 digits
    exit when not exists (select 1 from public.organizations where org_uid = candidate);
  end loop;
  return candidate;
end $$;

-- Backfill existing orgs, then lock the column down.
update public.organizations set org_uid = public.gen_org_uid() where org_uid is null;

alter table public.organizations alter column org_uid set default public.gen_org_uid();
alter table public.organizations alter column org_uid set not null;

do $$ begin
  alter table public.organizations add constraint organizations_org_uid_key unique (org_uid);
exception when duplicate_table or duplicate_object then null; end $$;

comment on column public.organizations.org_uid is
  'Permanent public 6-digit join code. Users enter this to request access to the org.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) One phone number per person (the WhatsApp bot maps phone -> profile).
--    Also track whether that phone was OTP-verified at signup.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists phone_verified boolean not null default false;

create unique index if not exists profiles_phone_unique
  on public.profiles (phone) where phone is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) 4-digit OTP codes, delivered to WhatsApp via OpenWA. Signup only.
--    One active code per phone (upserted on resend). Service-role only.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.phone_otps (
  phone       text primary key,                 -- E.164 digits, no '+'
  code        text not null,                    -- 4 digits
  expires_at  timestamptz not null,
  attempts    integer not null default 0,       -- wrong-code attempts (lock out at 5)
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.phone_otps enable row level security;   -- no policies: service role only

comment on table public.phone_otps is
  'Short-lived 4-digit WhatsApp OTPs for signup phone verification. Service-role only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) "Join an existing org" approval requests. A pending user has profiles.org_id
--    NULL until an admin of that org approves.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.org_join_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending',  -- pending | approved | rejected
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references public.profiles(id) on delete set null,
  unique (org_id, profile_id)
);
alter table public.org_join_requests enable row level security;  -- service role only (Edge Fn)

create index if not exists idx_join_requests_org_status
  on public.org_join_requests (org_id, status);

comment on table public.org_join_requests is
  'Pending/approved/rejected requests to join an organization via its 6-digit org_uid.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Grants. These tables are owned by supabase_admin, so default privileges for
--    other roles don't apply — the Edge Function (service_role) needs them explicitly.
--    RLS stays ON with no policies, so anon/authenticated can never read them.
-- ─────────────────────────────────────────────────────────────────────────────
grant all on public.phone_otps        to service_role, postgres;
grant all on public.org_join_requests to service_role, postgres;
grant execute on function public.gen_org_uid() to service_role, postgres, authenticated;

notify pgrst, 'reload schema';
