-- Ledger for the 24-hour "due soon" WhatsApp reminders.
-- The cron job runs hourly, so this is what guarantees each item is announced
-- exactly once. Keyed by due_at as well, so rescheduling an item into the window
-- legitimately produces a fresh reminder (but editing anything else does not).
-- Service-role only (RLS on, no policies) — the Edge Function bypasses RLS.

create table if not exists public.reminders_sent (
  kind     text        not null,              -- 'task' | 'meeting'
  item_id  uuid        not null,
  due_at   timestamptz not null,              -- the due moment this reminder was for
  sent_at  timestamptz not null default now(),
  recipients integer   not null default 0,    -- how many WhatsApp messages went out
  primary key (kind, item_id, due_at)
);

alter table public.reminders_sent enable row level security;

comment on table public.reminders_sent is
  '24h due-soon reminders already sent (dedupe for the hourly cron). Service-role only.';

-- Owned by supabase_admin when applied as that role, so grant explicitly.
grant all on public.reminders_sent to service_role, postgres;

notify pgrst, 'reload schema';
