-- Reversal of 0006_idea_lab.sql. Destroys all Idea Lab data — take a backup
-- first. The Supabase CLI does not run this folder automatically; apply by hand.

drop function if exists public.lab_orphan_visitors();
drop function if exists public.lab_stats(timestamptz, timestamptz);
drop function if exists public.lab_acquire_turn(uuid, text, integer);
drop function if exists public.lab_add_usage(uuid, integer, integer, integer, integer, numeric);
drop function if exists public.lab_rate_limit_hit(text, integer, integer);

drop table if exists public.lab_deletion_requests;
drop table if exists public.lab_events;
drop table if exists public.lab_ai_calls;
drop table if exists public.lab_rate_limits;
drop table if exists public.lab_magic_links;
drop table if exists public.lab_admin_notes;
drop table if exists public.lab_decisions;
drop table if exists public.lab_assessments;
drop table if exists public.lab_briefs;
drop table if exists public.lab_idea_state;
drop table if exists public.lab_messages;
drop table if exists public.lab_sessions;
drop table if exists public.lab_visitors;
