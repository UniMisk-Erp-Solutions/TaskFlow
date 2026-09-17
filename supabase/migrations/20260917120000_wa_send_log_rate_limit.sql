-- Defense-in-depth circuit breaker for outbound WhatsApp sends.
--
-- The 2026-09-17 "loop reply" incident was root-caused and fixed in application code
-- (processWhatsAppMessage: idle+unrecognized text is now silent, and any stale
-- wa_conversations state auto-expires after 30 minutes instead of hijacking later
-- messages). This table is an independent, structural safety net on top of that fix:
-- even if some *future* bug caused rapid repeat sends to the same person, this hard
-- caps how many WhatsApp messages TaskFlow can send to any one number in a rolling
-- window, so a bug can degrade at worst to "a few extra messages", never an
-- uncontrolled loop. It logs every send *attempt* (not just successes), because a
-- runaway loop is defined by attempt frequency, not delivery outcome.
--
-- Read/write only via the edge function's service-role client (openwaSendText).
create table if not exists public.wa_send_log (
  id bigint generated always as identity primary key,
  chat_id text not null,          -- e.g. "918160500203@c.us" -- the openwa chatId, already a stable per-recipient key
  sent_at timestamptz not null default now()
);

-- Only ever queried as "count rows for this chat_id in the last N minutes", and
-- pruned by age -- this index serves both.
create index if not exists wa_send_log_chat_time_idx on public.wa_send_log (chat_id, sent_at desc);

grant select, insert, delete on public.wa_send_log to service_role;

comment on table public.wa_send_log is
  'Rolling log of outbound WhatsApp send attempts per chat_id, used only as a rate-limit circuit breaker in openwaSendText(). Old rows are pruned opportunistically on write; nothing else reads this table.';
