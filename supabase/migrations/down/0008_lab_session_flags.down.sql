-- Reversal of 0008_lab_session_flags.sql. Apply by hand.
alter table public.lab_sessions drop column if exists flags;
