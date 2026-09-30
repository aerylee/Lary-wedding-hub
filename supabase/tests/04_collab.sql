-- Per-wedding role permissions, comments, mentions and chat.
begin;
select plan(33);

select tests.act_as_postgres();
create temp table ctx as
select tests.wedding('Rylee & Laurel') as w, tests.wedding('Sam & Alex') as w2,
       (select id from auth.users where email = 'viewer@example.test') as viewer,
       (select id from auth.users where email = 'collaborator@example.test') as collab,
       (select id from auth.users where email = 'planner@example.test') as planner;
grant select on ctx to authenticated;

-- ─── role permission overrides ───────────────────────────────────────────────
select tests.act_as('planner@example.test');
select is(tests.try(format($$select public.set_role_permissions(%L, '[{"role":"collaborator","permission":"finance:read","granted":true}]')$$, (select w from ctx))),
  '42501', 'planner: cannot change the role matrix');

select tests.act_as('owner@example.test');
select is(tests.try(format($$select public.set_role_permissions(%L, '[{"role":"owner","permission":"finance:read","granted":false}]')$$, (select w from ctx))),
  '22023', 'owner: cannot take anything away from owners');
select is(tests.try(format($$select public.set_role_permissions(%L, '[{"role":"planner","permission":"members:manage","granted":true}]')$$, (select w from ctx))),
  '22023', 'owner: members:manage stays owner-only');
select is(tests.try(format($$select public.set_role_permissions(%L, '[{"role":"planner","permission":"made:up","granted":true}]')$$, (select w from ctx))),
  '22023', 'owner: unknown permissions are rejected');
select is(tests.try(format($$select public.set_role_permissions(%L, '[{"role":"collaborator","permission":"finance:read","granted":true},{"role":"collaborator","permission":"venues:write","granted":false}]')$$, (select w from ctx))),
  'ok:1', 'owner: can grant and revoke for a role');

select tests.act_as('collaborator@example.test');
select ok(tests.visible('budget_lines', (select w from ctx)) > 0, 'collaborator: sees the budget once granted finance:read');
select ok('finance:read' = any (public.my_permissions((select w from ctx))), 'collaborator: my_permissions includes the grant');
select ok(not ('venues:write' = any (public.my_permissions((select w from ctx)))), 'collaborator: my_permissions drops the revoked permission');
select is(tests.try(format($$insert into public.venues (wedding_id, name) values (%L, 'Villa X')$$, (select w from ctx))),
  '42501', 'collaborator: revoked venues:write is enforced by RLS');
select is(tests.try(format($$insert into public.budget_categories (wedding_id, name) values (%L, 'x')$$, (select w from ctx))),
  '42501', 'collaborator: finance:write was not granted');

select tests.act_as('outsider@example.test');
select is(tests.visible('wedding_role_permissions', (select w from ctx)), 0::bigint, 'outsider: cannot see another wedding''s matrix');

select tests.act_as('owner@example.test');
select public.set_role_permissions((select w from ctx), '[{"role":"collaborator","permission":"venues:write","granted":true}]');
select is(tests.visible('wedding_role_permissions', (select w from ctx)), 1::bigint, 'owner: setting a cell back to its default removes the override');
select public.set_role_permissions((select w from ctx), '[{"role":"collaborator","permission":"finance:read","granted":false}]');
select tests.act_as('collaborator@example.test');
select is(tests.visible('budget_lines', (select w from ctx)), 0::bigint, 'collaborator: back to no budget after reset');

-- ─── comments ────────────────────────────────────────────────────────────────
select tests.act_as('planner@example.test');
select is(tests.try(format($$insert into public.comments (wedding_id, page, anchor_label, body, mentions)
  values (%L, 'budget', 'Venue hire', 'Can we get this lower?', array[%L, %L]::uuid[])$$,
  (select w from ctx), (select viewer from ctx), (select collab from ctx))), 'ok:1', 'planner: comments on the budget');
select is((select read_perms from public.comments where body = 'Can we get this lower?'), '{finance:read}'::text[],
  'a budget comment is as private as the budget');
select is(tests.try(format($$insert into public.comments (wedding_id, page, body, mentions)
  values (%L, 'guests', 'Check the Parkers'' plus-one @Grandpa', array[%L]::uuid[])$$,
  (select w from ctx), (select viewer from ctx))), 'ok:1', 'planner: comments on the guest list with a mention');

select tests.act_as_postgres();
select is((select count(*) from public.mentions m join public.comments c on c.id = m.comment_id where c.body = 'Can we get this lower?'),
  0::bigint, 'mentions of people who cannot see the budget are dropped');
select is((select count(*) from public.mentions m join public.comments c on c.id = m.comment_id
  where c.page = 'guests' and m.user_id = (select viewer from ctx)), 1::bigint, 'the viewer is notified about the guest-list comment');

select tests.act_as('collaborator@example.test');
select is((select count(*) from public.comments where wedding_id = (select w from ctx) and page = 'budget'), 0::bigint,
  'collaborator: cannot read budget comments');
select is(tests.try(format($$insert into public.comments (wedding_id, page, body) values (%L, 'budget', 'sneaky')$$, (select w from ctx))),
  '42501', 'collaborator: cannot comment on a page they cannot read');
select is(tests.try($$update public.comments set body = 'rewritten' where page = 'guests'$$),
  '42501', 'collaborator: cannot edit someone else''s comment');
select is(tests.try($$update public.comments set resolved_at = now() where page = 'guests'$$),
  'ok:1', 'collaborator: can resolve a thread');
select is(tests.try(format($$insert into public.comments (wedding_id, page, parent_id, body)
  select %L, 'budget', id, 'reply' from public.comments where page = 'guests'$$, (select w from ctx))),
  'ok:1', 'collaborator: can reply');
select is((select page from public.comments where body = 'reply'), 'guests', 'a reply lives on its thread''s page, whatever was sent');

select tests.act_as('viewer@example.test');
select is((select count(*) from public.mentions where wedding_id = (select w from ctx)), 1::bigint, 'viewer: sees their mention');
select is(tests.try($$update public.mentions set read_at = now()$$), 'ok:1', 'viewer: can mark it read');
select is(tests.try($$update public.mentions set excerpt = 'x'$$), '42501', 'viewer: cannot rewrite it');

-- ─── chat ────────────────────────────────────────────────────────────────────
select is((select count(*) from public.chat_channels where wedding_id = (select w from ctx)), 5::bigint, 'every wedding starts with channels');
select is(tests.try(format($$insert into public.chat_messages (wedding_id, channel_id, body, mentions)
  select %L, id, 'Lovely menu!', array[%L]::uuid[] from public.chat_channels where wedding_id = %L and name = 'general'$$,
  (select w from ctx), (select planner from ctx), (select w from ctx))), 'ok:1', 'viewer: can post');
select is(tests.try(format($$insert into public.chat_channels (wedding_id, name) values (%L, 'secret')$$, (select w from ctx))),
  '42501', 'viewer: cannot create channels');

select tests.act_as('planner@example.test');
select is((select count(*) from public.mentions where message_id is not null), 1::bigint, 'planner: mentioned in chat');
select is(tests.try($$update public.chat_messages set body = 'edited' where body = 'Lovely menu!'$$),
  '42501', 'planner: cannot edit someone else''s message');

select tests.act_as('outsider@example.test');
select is((select count(*) from public.chat_messages where wedding_id = (select w from ctx)), 0::bigint, 'outsider: reads no chat');

select * from finish();
rollback;
