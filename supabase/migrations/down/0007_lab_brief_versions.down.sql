-- Reversal of 0007_lab_brief_versions.sql. Drops the version lineage columns;
-- brief rows themselves are kept. Apply by hand (the CLI ignores this folder).

alter table public.lab_sessions
  drop column if exists submitted_brief_version,
  drop column if exists current_brief_version;

alter table public.lab_briefs
  drop column if exists source_version,
  drop column if exists kind;
