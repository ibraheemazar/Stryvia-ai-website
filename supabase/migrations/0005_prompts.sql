-- Prompt library. A personal store for reusable prompts: save, edit, search,
-- and one-click copy. Prompts can carry {{variables}} so a near-identical
-- prompt is written once and only the blanks change on copy. Category and tags
-- are assigned by AI on save (Spec §7 — claude-opus-4-8), but remain editable.

create table if not exists public.prompts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  category   text,
  tags       text[] not null default '{}',
  -- {{placeholders}} detected in the body, surfaced as fill-in fields on copy.
  variables  text[] not null default '{}',
  favorite   boolean not null default false,
  use_count  integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_category_idx on public.prompts (category);
create index if not exists prompts_updated_idx on public.prompts (updated_at desc);
create index if not exists prompts_favorite_idx on public.prompts (favorite, updated_at desc);
-- Keyword / phrase search across title + body.
create index if not exists prompts_search_idx on public.prompts
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')));

alter table public.prompts enable row level security;
