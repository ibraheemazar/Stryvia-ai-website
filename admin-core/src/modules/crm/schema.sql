-- CRM module schema. Run against the site's Supabase project. Every chat
-- conversation is stored, converted or not, with its transcript, the page it
-- started on, a short summary, and a problem category. Converted visitors
-- create a lead row.

create extension if not exists "pgcrypto";

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  locale           text not null default 'en',
  page_context     text,
  status           text not null default 'active'
                     check (status in ('active','scoped','converted','escalated','abandoned')),
  problem_category text,
  summary          text,
  converted        boolean not null default false,
  -- first-touch attribution
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  referrer         text,
  landing_path     text,
  -- cached per-conversation AI analysis
  analysis         jsonb
);

create index if not exists conversations_created_idx on public.conversations (created_at desc);
create index if not exists conversations_status_idx on public.conversations (status);
create index if not exists conversations_category_idx on public.conversations (problem_category);
create index if not exists conversations_converted_idx on public.conversations (converted);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- Full-text search over conversation content for the admin transcript search.
alter table public.messages
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists messages_tsv_idx on public.messages using gin (content_tsv);

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  name            text not null,
  email           text not null,
  company         text,
  phone           text,
  created_at      timestamptz not null default now(),
  status          text not null default 'new'
                     check (status in ('new','contacted','closed','lost')),
  notes           text
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- RLS on. All writes/reads happen through the service role in server routes
-- gated by verifyAdmin(); no anonymous policies are granted.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;
