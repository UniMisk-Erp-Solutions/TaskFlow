-- Per-sender conversation state for the inbound WhatsApp "/taskflow" bot.
-- The bot only ever talks to numbers that map to a public.profiles row; this
-- table just remembers where each such sender is in the create flow.
-- Service-role only (RLS on, no policies) — the Edge Function bypasses RLS.

create table if not exists public.wa_conversations (
  phone      text primary key,                                   -- sender digits (E.164 without +)
  profile_id uuid references public.profiles(id) on delete cascade,
  state      text not null default 'idle',
  draft      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.wa_conversations is
  'Inbound WhatsApp bot conversation state (per sender). Service-role only.';

alter table public.wa_conversations enable row level security;
