-- Adapta-Type: Initial schema
-- Run this in the Supabase SQL Editor for your project.

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  duration       integer not null check (duration in (15, 30, 60, 120)),
  wpm            numeric(6,2) not null check (wpm >= 0 and wpm <= 300),
  raw_wpm        numeric(6,2) not null check (raw_wpm >= 0 and raw_wpm <= 300),
  accuracy       numeric(5,2) not null check (accuracy >= 0 and accuracy <= 100),
  wpm_history    jsonb not null default '[]',
  ngram_mistakes jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- Enable RLS — no direct client access at all.
-- The FastAPI backend uses the service role key which bypasses RLS.
-- This means no browser client can read or write rows directly.
alter table public.sessions enable row level security;

-- Index for time-range queries (future analytics)
create index sessions_created_at_idx on public.sessions (created_at desc);
