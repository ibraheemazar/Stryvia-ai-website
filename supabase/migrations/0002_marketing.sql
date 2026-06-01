-- Marketing dashboard data layer. Powers the admin marketing suite: the
-- command center, conversation intelligence, content studio, segments,
-- campaigns, automations, integrations, and AI insights. Real first-party data;
-- external ad/network metrics flow in once each integration is connected.

-- Attribution on conversations (first-touch UTM + referrer + landing path).
alter table public.conversations add column if not exists utm_source   text;
alter table public.conversations add column if not exists utm_medium   text;
alter table public.conversations add column if not exists utm_campaign text;
alter table public.conversations add column if not exists referrer     text;
alter table public.conversations add column if not exists landing_path text;

create index if not exists conversations_utm_source_idx on public.conversations (utm_source);

-- Connected channels / tools (Google Ads, Meta, TikTok, Snapchat, LinkedIn,
-- WhatsApp, SMS, GA4, Search Console, schedulers …). Config is stored as JSON;
-- secrets should be referenced from env, not stored in plaintext here.
create table if not exists public.marketing_integrations (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null unique,
  category     text not null default 'channel',
  status       text not null default 'disconnected'
                 check (status in ('disconnected','connected','error')),
  config       jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- Audience segments defined by rules over leads/conversations.
create table if not exists public.marketing_segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  rules       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Content library — AI-generated and saved marketing assets.
create table if not exists public.marketing_content (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,            -- ad_copy | social_post | email | blog | landing | sms | whatsapp
  channel    text,                      -- google | meta | tiktok | snapchat | linkedin | email | …
  locale     text not null default 'en',
  title      text,
  body       text not null,
  status     text not null default 'draft' check (status in ('draft','approved','published','archived')),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_content_type_idx on public.marketing_content (type, created_at desc);

-- Campaigns (email/lifecycle now; ad campaigns once channels are connected).
create table if not exists public.marketing_campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  channel      text not null default 'email',
  status       text not null default 'draft'
                 check (status in ('draft','scheduled','sending','sent','failed')),
  segment_id   uuid references public.marketing_segments (id) on delete set null,
  content_id   uuid references public.marketing_content (id) on delete set null,
  subject      text,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  stats        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Automations: trigger -> actions, the orchestration engine.
create table if not exists public.marketing_automations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trigger     jsonb not null,           -- { event, filters }
  actions     jsonb not null default '[]'::jsonb,  -- [ { type, params } ]
  enabled     boolean not null default false,
  last_run_at timestamptz,
  run_count   integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.marketing_automation_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid references public.marketing_automations (id) on delete cascade,
  lead_id       uuid references public.leads (id) on delete set null,
  status        text not null default 'ok',
  detail        text,
  created_at    timestamptz not null default now()
);

-- AI-generated insights / recommendations surfaced on the dashboard.
create table if not exists public.marketing_insights (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'recommendation',
  title      text not null,
  body       text not null,
  severity   text not null default 'info' check (severity in ('info','opportunity','warning')),
  data       jsonb not null default '{}'::jsonb,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.marketing_integrations  enable row level security;
alter table public.marketing_segments       enable row level security;
alter table public.marketing_content         enable row level security;
alter table public.marketing_campaigns       enable row level security;
alter table public.marketing_automations     enable row level security;
alter table public.marketing_automation_runs enable row level security;
alter table public.marketing_insights        enable row level security;
