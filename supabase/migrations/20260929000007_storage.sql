-- Attachments bucket and policies. Auth spec §8, main spec §11.
-- Path: {wedding_id}/{correspondence_id}/{uuid}-{filename} — the first segment is the tenant key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', false, 20 * 1024 * 1024,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
    'text/plain', 'text/csv', 'text/markdown', 'text/html', 'application/json',
    'message/rfc822', 'application/vnd.ms-outlook',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- a malformed first segment must fail closed, not error the whole query
create or replace function app.path_wedding(p text)
returns uuid
language plpgsql immutable
as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;
grant execute on function app.path_wedding(text) to authenticated;

create policy "attachments read" on storage.objects for select to authenticated
using (bucket_id = 'attachments' and app.has(app.path_wedding(name), 'files:read'));

create policy "attachments insert" on storage.objects for insert to authenticated
with check (bucket_id = 'attachments' and app.has(app.path_wedding(name), 'files:write'));

create policy "attachments delete" on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and app.has(app.path_wedding(name), 'files:write'));

-- ─── orphan cleanup ──────────────────────────────────────────────────────────
-- Postgres cascades don't reach storage. When an attachment row goes (directly, or via a
-- deleted correspondence entry), queue its object; the purge-attachments Edge Function
-- (or the pg_cron sweep in the next migration) empties the queue.
create table app.storage_purge_queue (
  storage_path text primary key,
  queued_at    timestamptz not null default now()
);

create or replace function app.queue_attachment_purge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app.storage_purge_queue (storage_path) values (old.storage_path)
  on conflict do nothing;
  return null;
end $$;

create trigger attachments_purge
  after delete on public.attachments
  for each row execute function app.queue_attachment_purge();
