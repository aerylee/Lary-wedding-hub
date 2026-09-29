-- Storage policies (auth spec §11 test 7), create_wedding and the audit/activity triggers.
begin;
select plan(14);

select tests.act_as_postgres();
create temp table ctx as
select tests.wedding('Rylee & Laurel') as w, tests.wedding('Sam & Alex') as w2;
grant select on ctx to authenticated;
insert into storage.objects (bucket_id, name)
select 'attachments', w || '/' || gen_random_uuid() || '/' || gen_random_uuid() || '-quote.pdf' from ctx;

-- ─── 7. attachments are tenant-scoped ────────────────────────────────────────
select tests.act_as('outsider@example.test');
select is((select count(*) from storage.objects where bucket_id = 'attachments'), 0::bigint,
  'outsider: cannot see (or sign a URL for) the other wedding''s files');
select is(
  tests.try(format($$insert into storage.objects (bucket_id, name) values ('attachments', '%s/x/y-evil.pdf')$$, (select w from ctx))),
  '42501', 'outsider: cannot upload into the other wedding');
select is(
  tests.try($$insert into storage.objects (bucket_id, name) values ('attachments', 'not-a-uuid/x/y.pdf')$$),
  '42501', 'malformed paths fail closed');

select tests.act_as('viewer@example.test');
select is((select count(*) from storage.objects where bucket_id = 'attachments'), 1::bigint, 'viewer: can read files');
select is(
  tests.try(format($$insert into storage.objects (bucket_id, name) values ('attachments', '%s/x/y-note.pdf')$$, (select w from ctx))),
  '42501', 'viewer: cannot upload');

-- ─── create_wedding seeds a complete first draft ─────────────────────────────
select tests.act_as('viewer@example.test');
create temp table fresh on commit drop as select public.create_wedding('Test Wedding', current_date + 400, 'A', 'B') as w;
select is((select count(*) from public.tasks where wedding_id = (select w from fresh)), 52::bigint, 'seed: 52 tasks');
select is((select count(*) from public.budget_lines where wedding_id = (select w from fresh)), 20::bigint, 'seed: 20 budget lines');
select is((select count(*) from public.schedule_items where wedding_id = (select w from fresh)), 31::bigint, 'seed: 31 run-of-show items');
select is(
  (select array[
     (select count(*) from public.budget_categories where wedding_id = f.w),
     (select count(*) from public.legal_docs where wedding_id = f.w),
     (select count(*) from public.templates where wedding_id = f.w),
     (select count(*) from public.faqs where wedding_id = f.w),
     (select count(*) from public.decisions where wedding_id = f.w),
     (select count(*) from public.rooms where wedding_id = f.w),
     (select count(*) from public.events where wedding_id = f.w and is_primary)]
   from fresh f),
  array[12, 13, 8, 10, 7, 3, 1]::bigint[], 'seed: categories, legal docs, templates, FAQs, decisions, rooms, one primary event');
select is((select role::text from public.memberships where wedding_id = (select w from fresh) and user_id = auth.uid()),
  'owner', 'create_wedding: the creator owns the new wedding (whatever their role elsewhere)');

-- ─── audit + activity ────────────────────────────────────────────────────────
select tests.act_as('planner@example.test');
update public.wedding_settings set date_is_firm = true where wedding_id = (select w from ctx);
select is(
  (select updated_by from public.wedding_settings where wedding_id = (select w from ctx)),
  '00000000-0000-4000-8000-00000000000b'::uuid, 'audit trigger stamps updated_by');
select is(
  (select changed -> 'date_is_firm' from public.activity_log
    where wedding_id = (select w from ctx) and table_name = 'wedding_settings' order by id desc limit 1),
  '[false, true]'::jsonb, 'activity log records who changed what, old and new');

-- deleting a whole wedding cascades past the last-owner guard; only owners may do it
select tests.act_as('planner@example.test');
select is(tests.try(format('delete from public.weddings where id = %L', (select w from ctx))), 'ok:0',
  'planner: cannot delete the wedding');
select tests.act_as('owner@example.test');
select is(tests.try(format('delete from public.weddings where id = %L', (select w from ctx))), 'ok:1',
  'owner: deleting the wedding cascades cleanly');

select * from finish();
rollback;
