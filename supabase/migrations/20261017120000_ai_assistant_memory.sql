-- AI assistant: conversation memory (short-term, per user + channel) and long-term memory
-- (explicit user preferences / standing context). Service-role only: RLS is enabled with NO
-- policies, so only the Edge Function (service role) can read/write. Users manage their own
-- notes through /ai/memory, which always filters by the authenticated user's id.

create table if not exists public.ai_conversations (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  channel    text not null default 'web',                 -- 'web' | 'wa'
  messages   jsonb not null default '[]'::jsonb,          -- last few turns [{role, content}]
  pending    jsonb,                                       -- draft awaiting an assignee / confirmation
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

create table if not exists public.ai_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'preference' check (kind in ('preference', 'context')),
  content    text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists ai_memories_user_idx on public.ai_memories (user_id, created_at desc);

comment on table public.ai_conversations is 'AI assistant short-term conversation + pending draft. Service-role only.';
comment on table public.ai_memories is 'AI assistant long-term memory (explicit user preferences/context). Service-role only.';

alter table public.ai_conversations enable row level security;
alter table public.ai_memories enable row level security;
