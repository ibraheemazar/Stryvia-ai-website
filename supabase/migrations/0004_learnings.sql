-- AI learnings layer. Two surfaces:
--   1. Per-conversation deep analysis, cached on the conversation row.
--   2. Unified cross-conversation learnings briefs, kept as a versioned history
--      so the admin can see how the market's asks change over time.

-- Per-conversation structured analysis (intent, requests, objections, sentiment,
-- outcome reason, follow-up). Computed once on demand, then re-displayed cheaply.
alter table public.conversations add column if not exists analysis jsonb;

-- Unified learnings briefs synthesized from the conversation corpus.
create table if not exists public.marketing_learnings (
  id                    uuid primary key default gen_random_uuid(),
  scope                 text not null default 'all',
  window_days           integer,
  conversations_analyzed integer not null default 0,
  payload               jsonb not null default '{}'::jsonb,
  model                 text,
  created_at            timestamptz not null default now()
);
create index if not exists marketing_learnings_created_idx
  on public.marketing_learnings (created_at desc);

alter table public.marketing_learnings enable row level security;
