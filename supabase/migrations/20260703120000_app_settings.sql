-- Key/value config table read by the Edge Function (e.g. the OpenWA WhatsApp API key),
-- so config/secrets can be set and rotated purely via SQL — no redeploy or SSH needed.
-- Service-role only: RLS is enabled with NO policies, so anon/authenticated can never
-- read it; the Edge Function uses the service role (which bypasses RLS).

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Edge Function config (key/value). Secrets live here; readable only by the service role.';

alter table public.app_settings enable row level security;
-- Intentionally NO policies — only the service role (bypasses RLS) can read/write.
