-- Chat as a hub: reactions, files (and their storage paths), notes, saved items, stars.
begin;
select plan(20);

select tests.act_as_postgres();
create temp table ctx as
select tests.wedding('Rylee & Laurel') as w, tests.wedding('Sam & Alex') as w2,
       (select id from public.chat_channels where wedding_id = tests.wedding('Rylee & Laurel') and name = 'general') as ch,
       (select id from auth.users where email = 'owner@example.test') as owner,
       (select id from auth.users where email = 'viewer@example.test') as viewer;
grant select on ctx to authenticated;

-- a message from the planner to react to, save and attach to
select tests.act_as('planner@example.test');
insert into public.chat_messages (wedding_id, channel_id, body) select w, ch, 'Menu tasting on Friday' from ctx;
select tests.act_as_postgres();
alter table ctx add column msg uuid;
update ctx set msg = (select id from public.chat_messages where body = 'Menu tasting on Friday');

-- ─── reactions ───────────────────────────────────────────────────────────────
select tests.act_as('viewer@example.test');
select is(tests.try(format($$insert into public.chat_reactions (wedding_id, message_id, emoji) values (%L, %L, '🎉')$$, (select w from ctx), (select msg from ctx))),
  'ok:1', 'viewer: can react');
select is(tests.try(format($$insert into public.chat_reactions (wedding_id, message_id, user_id, emoji) values (%L, %L, %L, '👍')$$,
  (select w from ctx), (select msg from ctx), (select owner from ctx))),
  '42501', 'viewer: cannot react as someone else');
select is(tests.try(format($$insert into public.chat_reactions (wedding_id, message_id, emoji) values (%L, %L, '')$$, (select w from ctx), (select msg from ctx))),
  '23514', 'an empty reaction is rejected');

select tests.act_as('owner@example.test');
insert into public.chat_reactions (wedding_id, message_id, emoji) select w, msg, '🎉' from ctx;
select is((select count(*) from public.chat_reactions where message_id = (select msg from ctx)), 2::bigint, 'owner: sees both reactions');
select is(tests.try($$delete from public.chat_reactions where emoji = '🎉' and user_id <> auth.uid()$$), 'ok:0',
  'owner: cannot remove someone else''s reaction');

select tests.act_as('outsider@example.test');
select is((select count(*) from public.chat_reactions where wedding_id = (select w from ctx)), 0::bigint, 'outsider: sees no reactions');

-- ─── files ───────────────────────────────────────────────────────────────────
-- the viewer has chat:write but not files:write: chat uploads work, other uploads don't
select tests.act_as('viewer@example.test');
select is(tests.try(format($$insert into storage.objects (bucket_id, name) values ('attachments', '%s/chat/%s/abc-photo.jpg')$$, (select w from ctx), (select ch from ctx))),
  'ok:1', 'viewer: can upload into the chat folder');
select is(tests.try(format($$insert into storage.objects (bucket_id, name) values ('attachments', '%s/x/y-note.pdf')$$, (select w from ctx))),
  '42501', 'viewer: still cannot upload other attachments');
select is(tests.try(format($$insert into public.chat_files (wedding_id, channel_id, message_id, storage_path, name, size, mime)
  values (%L, %L, %L, %L, 'photo.jpg', 1200, 'image/jpeg')$$,
  (select w from ctx), (select ch from ctx), (select msg from ctx), (select w from ctx) || '/chat/' || (select ch from ctx) || '/abc-photo.jpg')),
  'ok:1', 'viewer: can attach a file to a message');
select is(tests.try(format($$insert into public.chat_files (wedding_id, channel_id, message_id, storage_path, name, size)
  values (%L, %L, %L, %L, 'x.pdf', 1)$$,
  (select w from ctx), (select ch from ctx), (select msg from ctx), (select w2 from ctx) || '/chat/' || (select ch from ctx) || '/x.pdf')),
  '23514', 'a file row cannot point outside this wedding''s chat folder');

select tests.act_as('outsider@example.test');
select is((select count(*) from storage.objects where name like (select w from ctx)::text || '/chat/%'), 0::bigint, 'outsider: cannot see chat files in storage');
select is(tests.try(format($$insert into storage.objects (bucket_id, name) values ('attachments', '%s/chat/%s/evil.jpg')$$, (select w from ctx), (select ch from ctx))),
  '42501', 'outsider: cannot upload into another wedding''s chat');
select is((select count(*) from public.chat_files where wedding_id = (select w from ctx)), 0::bigint, 'outsider: sees no chat files');

-- ─── notes ───────────────────────────────────────────────────────────────────
select tests.act_as('viewer@example.test');
select is(tests.try(format($$insert into public.chat_channel_notes (channel_id, wedding_id, body) values (%L, %L, 'Venue: Villa Cetinale')$$, (select ch from ctx), (select w from ctx))),
  'ok:1', 'viewer: can write the channel note');
select is((select updated_by from public.chat_channel_notes where channel_id = (select ch from ctx)),
  (select viewer from ctx), 'the note records who edited it');
select tests.act_as('outsider@example.test');
select is((select count(*) from public.chat_channel_notes where wedding_id = (select w from ctx)), 0::bigint, 'outsider: cannot read the note');

-- ─── saved items and stars are private ───────────────────────────────────────
select tests.act_as('viewer@example.test');
insert into public.chat_saved (message_id, wedding_id) select msg, w from ctx;
insert into public.chat_reads (wedding_id, channel_id, starred) select w, ch, true from ctx;
select tests.act_as('owner@example.test');
select is((select count(*) from public.chat_saved), 0::bigint, 'owner: cannot see the viewer''s saved items');
select is((select count(*) from public.chat_reads where starred), 0::bigint, 'owner: cannot see the viewer''s stars');

-- ─── deleting a message removes its files and queues storage cleanup ─────────
select tests.act_as('planner@example.test');
delete from public.chat_messages where id = (select msg from ctx);
select tests.act_as_postgres();
select is((select count(*) from public.chat_files where message_id = (select msg from ctx)), 0::bigint, 'file rows go with the message');
select ok(exists (select 1 from app.storage_purge_queue where storage_path like '%/chat/%/abc-photo.jpg'), 'the stored file is queued for purge');

select * from finish();
rollback;
