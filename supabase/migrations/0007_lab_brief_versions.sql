-- Idea Lab: brief version lineage and explicit current / submitted pointers.
--
-- Every brief version now records how it was made (generated | edited |
-- translated | revised) and which version it was made from. A session points
-- at the version the visitor is working on (`current_brief_version`) and, once
-- submitted, at the exact version that was submitted (`submitted_brief_version`).
-- Translations and AI revisions are saved as proposals (never current until the
-- visitor accepts them), so a stale result can never overwrite a newer edit.
-- Additive and idempotent; reversal in down/0007_lab_brief_versions.down.sql.

alter table public.lab_briefs
  add column if not exists kind text not null default 'generated'
    check (kind in ('generated','edited','translated','revised')),
  add column if not exists source_version integer;

alter table public.lab_sessions
  add column if not exists current_brief_version integer,
  add column if not exists submitted_brief_version integer;

-- Backfill: the highest version is the one the visitor last saw; visitor edits
-- are marked as such; submitted sessions submitted their latest version.
update public.lab_briefs set kind = 'edited' where visitor_edited and kind = 'generated';

update public.lab_sessions s
   set current_brief_version = b.max_version
  from (select session_id, max(version) as max_version from public.lab_briefs group by session_id) b
 where b.session_id = s.id and s.current_brief_version is null;

update public.lab_sessions
   set submitted_brief_version = current_brief_version
 where status in ('submitted','reviewed','closed') and submitted_brief_version is null;
