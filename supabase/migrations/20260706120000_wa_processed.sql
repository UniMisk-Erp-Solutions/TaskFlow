-- Idempotency ledger for the inbound WhatsApp bot. OpenWA re-delivers a webhook when our
-- synchronous reply is slow (e.g. a ~12s AI "create task"), which would process the same
-- message twice. The bot claims each message id here first; a retry hits the primary-key
-- conflict and is skipped. Service-role only (RLS on, no policies) — the Edge Function
-- bypasses RLS.

create table if not exists public.wa_processed (
  msg_id     text primary key,
  created_at timestamptz not null default now()
);

comment on table public.wa_processed is
  'Inbound WhatsApp message ids already handled (dedupe OpenWA webhook retries). Service-role only.';

alter table public.wa_processed enable row level security;
