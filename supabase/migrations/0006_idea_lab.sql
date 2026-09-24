-- ---------------------------------------------------------------------------
-- 0006 · Stryvia Idea Lab (brief §7)
--
-- Additive and idempotent. Every table has RLS enabled with NO policies: the
-- anon and authenticated roles can read nothing; all access goes through the
-- service role from server routes, where `lib/lab/session-auth.ts` enforces
-- that a visitor only touches their own sessions. Reversal: supabase/migrations/down/0006_idea_lab.down.sql
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- Visitors: one row per email. The signed cookie carries (id, cookie_generation);
-- bumping the generation revokes every cookie ever issued to that visitor.
create table if not exists public.lab_visitors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  cookie_generation integer not null default 1,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lab_visitors enable row level security;

create table if not exists public.lab_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.lab_visitors(id) on delete cascade,
  visitor_name text not null,
  email text not null,
  phone_e164 text not null,
  country text not null,
  company text,
  role text,
  language text not null default 'en' check (language in ('en','ar')),
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','reviewed','closed','deleted')),
  phase text not null default 'intro'
    check (phase in ('intro','understand','expand','commit','review','done')),
  consent_version text not null,
  consent_at timestamptz not null default now(),
  prompt_version text not null,
  rubric_version text,
  token_usage jsonb not null default '{"input":0,"output":0,"cache_read":0,"cache_write":0,"cost_usd":0}'::jsonb,
  turn_count integer not null default 0,
  turns_in_phase integer not null default 0,
  strikes integer not null default 0,
  finish_nudged boolean not null default false,
  pending_turn_id text,
  pending_started_at timestamptz,
  assessment_status text not null default 'none'
    check (assessment_status in ('none','pending','running','done','failed')),
  first_message_at timestamptz,
  last_active_at timestamptz not null default now(),
  submitted_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lab_sessions enable row level security;
create index if not exists lab_sessions_visitor_idx on public.lab_sessions (visitor_id);
create index if not exists lab_sessions_email_idx on public.lab_sessions (email);
create index if not exists lab_sessions_status_idx on public.lab_sessions (status, created_at desc);
create index if not exists lab_sessions_created_idx on public.lab_sessions (created_at desc);

drop trigger if exists lab_sessions_touch on public.lab_sessions;
create trigger lab_sessions_touch before update on public.lab_sessions
  for each row execute function public.touch_updated_at();
drop trigger if exists lab_visitors_touch on public.lab_visitors;
create trigger lab_visitors_touch before update on public.lab_visitors
  for each row execute function public.touch_updated_at();

create table if not exists public.lab_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  turn_index integer not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  input_mode text not null default 'text' check (input_mode in ('text','voice')),
  transcript_raw text,
  model text,
  usage jsonb,
  guardrail_hits jsonb,
  created_at timestamptz not null default now()
);
alter table public.lab_messages enable row level security;
create index if not exists lab_messages_session_idx on public.lab_messages (session_id, created_at);

create table if not exists public.lab_idea_state (
  session_id uuid primary key references public.lab_sessions(id) on delete cascade,
  slots jsonb not null default '{}'::jsonb,
  industry_lens jsonb,
  rolling_summary text,
  summarised_through_turn integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.lab_idea_state enable row level security;

create table if not exists public.lab_briefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  version integer not null,
  language text not null check (language in ('en','ar')),
  content jsonb not null,
  rendered_html text not null,
  visitor_edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, version)
);
alter table public.lab_briefs enable row level security;

-- Admin-only. No visitor route may ever select from this table (repo-guard test).
create table if not exists public.lab_assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  rubric_version text not null,
  prompt_version text not null,
  model text not null,
  scores jsonb not null,
  red_flags jsonb not null,
  verdict text not null check (verdict in ('productize','paid_build','priority_call','refer_or_pass')),
  model_verdict text,
  weighted_score numeric(4,2) not null,
  confidence numeric(3,2) not null,
  reasoning text not null,
  why_lines jsonb not null,
  proposed_plan jsonb,
  manipulation_detected boolean not null default false,
  actor text not null default 'system' check (actor in ('system','admin')),
  created_at timestamptz not null default now()
);
alter table public.lab_assessments enable row level security;
create index if not exists lab_assessments_session_idx on public.lab_assessments (session_id, created_at desc);

create table if not exists public.lab_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  decision text not null check (decision in ('book_call','request_quote','decline','hold')),
  notes text,
  decided_by text not null,
  decided_at timestamptz not null default now(),
  outbound_email_subject text,
  outbound_email_body text,
  outbound_email_sent_at timestamptz
);
alter table public.lab_decisions enable row level security;
create index if not exists lab_decisions_session_idx on public.lab_decisions (session_id, decided_at desc);

create table if not exists public.lab_admin_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.lab_admin_notes enable row level security;

create table if not exists public.lab_magic_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  purpose text not null check (purpose in ('resume','delete')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_ip_hash text,
  created_at timestamptz not null default now()
);
alter table public.lab_magic_links enable row level security;
create index if not exists lab_magic_links_email_idx on public.lab_magic_links (email, created_at desc);

create table if not exists public.lab_rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.lab_rate_limits enable row level security;

-- Atomic fixed-window counter. Returns true when the caller is over the limit.
create or replace function public.lab_rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.lab_rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count > p_max;
end;
$$;
revoke all on function public.lab_rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- Atomic token/cost accumulation on a session.
create or replace function public.lab_add_usage(
  p_session_id uuid, p_input integer, p_output integer, p_cache_read integer, p_cache_write integer, p_cost numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lab_sessions set token_usage = jsonb_build_object(
    'input', coalesce((token_usage->>'input')::bigint, 0) + p_input,
    'output', coalesce((token_usage->>'output')::bigint, 0) + p_output,
    'cache_read', coalesce((token_usage->>'cache_read')::bigint, 0) + p_cache_read,
    'cache_write', coalesce((token_usage->>'cache_write')::bigint, 0) + p_cache_write,
    'cost_usd', round(coalesce((token_usage->>'cost_usd')::numeric, 0) + p_cost, 6)
  ) where id = p_session_id;
$$;
revoke all on function public.lab_add_usage(uuid, integer, integer, integer, integer, numeric) from public, anon, authenticated;

-- Per-session turn lock: returns true when acquired.
create or replace function public.lab_acquire_turn(p_session_id uuid, p_turn_id text, p_ttl_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.lab_sessions
     set pending_turn_id = p_turn_id, pending_started_at = now()
   where id = p_session_id
     and (pending_turn_id is null
          or pending_turn_id = p_turn_id
          or pending_started_at < now() - make_interval(secs => p_ttl_seconds));
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.lab_acquire_turn(uuid, text, integer) from public, anon, authenticated;

-- Usage log: counts and latency only, never prompt or response text.
create table if not exists public.lab_ai_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.lab_sessions(id) on delete set null,
  purpose text not null,
  actor text not null default 'visitor',
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  latency_ms integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  ok boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);
alter table public.lab_ai_calls enable row level security;
create index if not exists lab_ai_calls_created_idx on public.lab_ai_calls (created_at desc);
create index if not exists lab_ai_calls_session_idx on public.lab_ai_calls (session_id);

-- Append-only audit/error log. Payloads are PII-free by construction (see lib/lab/events.ts).
create table if not exists public.lab_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.lab_sessions(id) on delete set null,
  kind text not null,
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  payload jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
alter table public.lab_events enable row level security;
create index if not exists lab_events_created_idx on public.lab_events (created_at desc);
create index if not exists lab_events_session_idx on public.lab_events (session_id, created_at desc);

create table if not exists public.lab_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  sessions_deleted integer
);
alter table public.lab_deletion_requests enable row level security;

-- Stats for the admin dashboard (§8).
create or replace function public.lab_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with s as (
    select * from public.lab_sessions
     where created_at >= p_from and created_at < p_to and status <> 'deleted'
  ),
  a as (
    select distinct on (session_id) session_id, verdict
      from public.lab_assessments order by session_id, created_at desc
  ),
  c as (
    select coalesce(sum(cost_usd),0) as cost, count(distinct session_id) as sessions
      from public.lab_ai_calls where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'sessions_started', (select count(*) from s),
    'sessions_submitted', (select count(*) from s where submitted_at is not null),
    'completion_rate', case when (select count(*) from s) = 0 then 0
        else round((select count(*) from s where submitted_at is not null)::numeric / (select count(*) from s), 3) end,
    'avg_session_minutes', (select round(coalesce(avg(extract(epoch from (coalesce(submitted_at, last_active_at) - coalesce(first_message_at, created_at))) / 60), 0), 1) from s),
    'avg_turns', (select round(coalesce(avg(turn_count),0),1) from s),
    'avg_cost_usd', case when (select sessions from c) = 0 then 0 else round((select cost from c) / (select sessions from c), 4) end,
    'total_cost_usd', (select round(cost, 2) from c),
    'per_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'started', n, 'submitted', m) order by w), '[]'::jsonb)
                   from (select date_trunc('week', created_at) as w, count(*) as n, count(submitted_at) as m from s group by 1) t),
    'verdicts', (select coalesce(jsonb_object_agg(verdict, n), '{}'::jsonb)
                   from (select a.verdict, count(*) as n from s join a on a.session_id = s.id group by 1) t),
    'languages', (select coalesce(jsonb_object_agg(language, n), '{}'::jsonb)
                   from (select language, count(*) as n from s group by 1) t)
  );
$$;
revoke all on function public.lab_stats(timestamptz, timestamptz) from public, anon, authenticated;

-- Visitors with no sessions left (used by the retention job).
create or replace function public.lab_orphan_visitors()
returns table (id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select v.id from public.lab_visitors v
   where not exists (select 1 from public.lab_sessions s where s.visitor_id = v.id)
     and v.created_at < now() - interval '1 day';
$$;
revoke all on function public.lab_orphan_visitors() from public, anon, authenticated;
