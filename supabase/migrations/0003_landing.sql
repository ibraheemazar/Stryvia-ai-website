-- Landing pages with A/B variants, and the experiment event stream that powers
-- variant assignment and results (views, conversions, uplift).

create table if not exists public.landing_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  locale     text not null default 'en',
  status     text not null default 'draft' check (status in ('draft','published','archived')),
  goal       text,
  variants   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_events (
  id         uuid primary key default gen_random_uuid(),
  page_slug  text not null,
  variant_id text not null,
  kind       text not null check (kind in ('view','conversion')),
  created_at timestamptz not null default now()
);
create index if not exists experiment_events_slug_idx on public.experiment_events (page_slug, variant_id, kind);

alter table public.landing_pages enable row level security;
alter table public.experiment_events enable row level security;
