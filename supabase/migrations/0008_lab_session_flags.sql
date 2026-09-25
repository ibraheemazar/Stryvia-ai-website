-- Idea Lab: workflow flags kept OUTSIDE generated prose.
--
-- `flags` records facts about the session that must survive every
-- transformation of the brief (translation, revision, print, email) and that
-- the model must never be able to erase: the visitor said this is a test or
-- fictional, the visitor asked not to be contacted, the visitor asked the AI to
-- decide. They are set by code from extractor signals and deterministic
-- keyword checks, are never cleared automatically, and gate the admin's
-- "send" action. Additive and idempotent; reversal in down/.

alter table public.lab_sessions
  add column if not exists flags jsonb not null default '{}'::jsonb;
