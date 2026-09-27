-- Idea Lab: every file a visitor sends is kept.
--
-- `lab_attachments` records each file (document, image, spreadsheet, audio,
-- video) a visitor attaches in the conversation, and each voice recording that
-- reaches Stryvia's transcription service. The bytes live in the PRIVATE
-- storage bucket `lab-attachments` under `<session_id>/<attachment_id>/<name>`;
-- only the service role can read or write it (no storage policies), and the
-- owner downloads through short-lived signed links from the admin.
--
-- Rows cascade with the session. Storage objects do not cascade, so every
-- deletion path in code (visitor "delete my data", admin delete, retention)
-- removes the objects first. Additive and idempotent; reversal in down/.

create table if not exists public.lab_attachments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  -- The visitor message the file was sent with (null until the message is sent).
  message_id uuid references public.lab_messages(id) on delete set null,
  kind text not null default 'file' check (kind in ('file', 'voice')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null unique,
  -- pending: upload URL issued; stored: bytes verified in the bucket.
  status text not null default 'pending' check (status in ('pending', 'stored')),
  created_at timestamptz not null default now(),
  stored_at timestamptz
);

create index if not exists lab_attachments_session_idx on public.lab_attachments (session_id, created_at);
create index if not exists lab_attachments_message_idx on public.lab_attachments (message_id);

alter table public.lab_attachments enable row level security;

-- Private bucket; 50 MB per object (the platform's per-file ceiling on this plan).
insert into storage.buckets (id, name, public, file_size_limit)
values ('lab-attachments', 'lab-attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
