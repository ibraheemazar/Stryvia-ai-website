-- Reverse 0009_lab_attachments. Empty the bucket from the dashboard (or the
-- storage API) first: Postgres cannot delete storage objects' bytes.
drop table if exists public.lab_attachments;
delete from storage.buckets where id = 'lab-attachments';
