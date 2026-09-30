-- Team chat as a hub: reactions, files and images, a shared note per channel,
-- saved-for-later, starred channels.

-- ─── messages can be just a file ─────────────────────────────────────────────
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check check (length(body) <= 4000);

-- ─── reactions ───────────────────────────────────────────────────────────────
create table public.chat_reactions (
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  message_id  uuid not null,
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  foreign key (wedding_id, message_id) references public.chat_messages (wedding_id, id) on delete cascade
);
create index chat_reactions_wedding_idx on public.chat_reactions (wedding_id);

alter table public.chat_reactions enable row level security;
create policy chat_reactions_select on public.chat_reactions for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_reactions_insert on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and app.has(wedding_id, 'chat:write'));
create policy chat_reactions_delete on public.chat_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ─── files ───────────────────────────────────────────────────────────────────
-- Stored in the private attachments bucket under {wedding}/chat/{channel}/…, so the
-- bucket's size and type limits, signed URLs and purge job all apply.
create table public.chat_files (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  channel_id    uuid not null,
  message_id    uuid not null,
  storage_path  text not null unique,
  name          text not null check (length(name) between 1 and 255),
  size          bigint not null check (size >= 0),
  mime          text not null default 'application/octet-stream',
  width         integer,
  height        integer,
  uploaded_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  -- a row can only point at this wedding's chat folder for this channel
  check (storage_path like wedding_id::text || '/chat/' || channel_id::text || '/%'),
  foreign key (wedding_id, channel_id) references public.chat_channels (wedding_id, id) on delete cascade,
  foreign key (wedding_id, message_id) references public.chat_messages (wedding_id, id) on delete cascade
);
create index chat_files_channel_idx on public.chat_files (channel_id, created_at desc);
create index chat_files_wedding_idx on public.chat_files (wedding_id);
create index chat_files_message_idx on public.chat_files (message_id);

alter table public.chat_files enable row level security;
create policy chat_files_select on public.chat_files for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_files_insert on public.chat_files for insert to authenticated
  with check (app.has(wedding_id, 'chat:write') and uploaded_by = auth.uid());
create policy chat_files_delete on public.chat_files for delete to authenticated
  using (app.has(wedding_id, 'chat:read') and (uploaded_by = auth.uid() or app.has(wedding_id, 'chat:manage')));

create or replace function app.queue_chat_file_purge()
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

create trigger chat_files_purge
  after delete on public.chat_files
  for each row execute function app.queue_chat_file_purge();

-- storage: chat/ paths follow the chat permissions, everything else stays on files:*
create or replace function app.path_is_chat(p text)
returns boolean
language sql immutable set search_path = ''
as $$
  select split_part(p, '/', 2) = 'chat';
$$;
grant execute on function app.path_is_chat(text) to authenticated;

drop policy if exists "attachments read" on storage.objects;
drop policy if exists "attachments insert" on storage.objects;
drop policy if exists "attachments delete" on storage.objects;

create policy "attachments read" on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and app.has(app.path_wedding(name), case when app.path_is_chat(name) then 'chat:read' else 'files:read' end)
);
create policy "attachments insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments'
  and app.has(app.path_wedding(name), case when app.path_is_chat(name) then 'chat:write' else 'files:write' end)
);
create policy "attachments delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'attachments'
  and app.has(app.path_wedding(name), case when app.path_is_chat(name) then 'chat:write' else 'files:write' end)
);

update storage.buckets
   set allowed_mime_types = (
     select array_agg(distinct m) from unnest(allowed_mime_types || array['video/mp4', 'video/quicktime']) as m
   )
 where id = 'attachments';

-- ─── a shared note per channel ───────────────────────────────────────────────
create table public.chat_channel_notes (
  channel_id  uuid primary key,
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  body        text not null default '' check (length(body) <= 50000),
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  foreign key (wedding_id, channel_id) references public.chat_channels (wedding_id, id) on delete cascade
);
create index chat_channel_notes_wedding_idx on public.chat_channel_notes (wedding_id);

create or replace function app.chat_notes_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.wedding_id is distinct from old.wedding_id then
    raise exception 'wedding_id cannot be changed' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

create trigger chat_channel_notes_stamp before insert or update on public.chat_channel_notes
  for each row execute function app.chat_notes_stamp();

alter table public.chat_channel_notes enable row level security;
create policy chat_channel_notes_select on public.chat_channel_notes for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_channel_notes_insert on public.chat_channel_notes for insert to authenticated
  with check (app.has(wedding_id, 'chat:write'));
create policy chat_channel_notes_update on public.chat_channel_notes for update to authenticated
  using (app.has(wedding_id, 'chat:write')) with check (app.has(wedding_id, 'chat:write'));

-- ─── saved for later, starred channels ───────────────────────────────────────
create table public.chat_saved (
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  message_id  uuid not null,
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id),
  foreign key (wedding_id, message_id) references public.chat_messages (wedding_id, id) on delete cascade
);
create index chat_saved_wedding_idx on public.chat_saved (wedding_id, user_id);

alter table public.chat_saved enable row level security;
create policy chat_saved_select on public.chat_saved for select to authenticated
  using (user_id = auth.uid());
create policy chat_saved_insert on public.chat_saved for insert to authenticated
  with check (user_id = auth.uid() and app.has(wedding_id, 'chat:read'));
create policy chat_saved_delete on public.chat_saved for delete to authenticated
  using (user_id = auth.uid());

alter table public.chat_reads add column starred boolean not null default false;

-- ─── realtime ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_reactions', 'chat_files', 'chat_channel_notes', 'chat_saved'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

revoke all on public.chat_reactions, public.chat_files, public.chat_channel_notes, public.chat_saved from anon;
