-- Role and tenancy tests — auth spec §11, tests 1–6 and 8.
begin;
select plan(34);

select tests.act_as_postgres();
create temp table ctx as
select tests.wedding('Rylee & Laurel') as w, tests.wedding('Sam & Alex') as w2;
grant select on ctx to authenticated;

-- ─── 1. a collaborator sees zero finance rows — not an error, zero rows ──────
select tests.act_as('collaborator@example.test');
select is(tests.visible('budget_lines', (select w from ctx)), 0::bigint, 'collaborator: budget_lines is empty');
select is(tests.visible('budget_categories', (select w from ctx)), 0::bigint, 'collaborator: budget_categories is empty');
select is(tests.visible('payments', (select w from ctx)), 0::bigint, 'collaborator: payments is empty');
select is(tests.visible('vendor_finance', (select w from ctx)), 0::bigint, 'collaborator: vendor_finance is empty');
select is(tests.visible('budget_settings', (select w from ctx)), 0::bigint, 'collaborator: budget ceiling is hidden');
select ok(tests.visible('vendors', (select w from ctx)) > 0, 'collaborator: still sees vendors without their money');
select ok(tests.visible('guest_contacts', (select w from ctx)) > 0, 'collaborator: sees guest contact details');
select is(
  (select count(*) from public.activity_log where wedding_id = (select w from ctx) and table_name in ('budget_lines','payments','vendor_finance')),
  0::bigint, 'collaborator: activity feed carries no finance entries');
select is(tests.try(format($$insert into public.budget_categories (wedding_id, name) values (%L, 'x')$$, (select w from ctx))),
  '42501', 'collaborator: cannot insert budget rows');

select tests.act_as('owner@example.test');
select is(tests.visible('budget_lines', (select w from ctx)), 20::bigint, 'owner: sees all 20 seeded budget lines');
select tests.act_as('planner@example.test');
select ok(tests.visible('payments', (select w from ctx)) > 0, 'planner: sees payments');

-- ─── 2. a viewer can change nothing ──────────────────────────────────────────
select tests.act_as('viewer@example.test');
select is(tests.visible('guest_contacts', (select w from ctx)), 0::bigint, 'viewer: no guest contact details');
select is(tests.visible('budget_lines', (select w from ctx)), 0::bigint, 'viewer: no money');

select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('insert into public.%I (wedding_id) values (%L)', tbl, (select w from ctx))) <> '42501'),
  null, 'viewer: every insert is rejected by policy');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('update public.%I set updated_at = now() where wedding_id = %L', tbl, (select w from ctx))) <> 'ok:0'),
  null, 'viewer: every update touches zero rows');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('delete from public.%I where wedding_id = %L', tbl, (select w from ctx))) <> 'ok:0'),
  null, 'viewer: every delete touches zero rows');

-- ─── 3. a member of wedding B cannot touch wedding A ─────────────────────────
select tests.act_as('outsider@example.test');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl where tests.visible(tbl, (select w from ctx)) <> 0),
  null, 'outsider: reads zero rows of every table in the other wedding');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('update public.%I set updated_at = now() where wedding_id = %L', tbl, (select w from ctx))) <> 'ok:0'),
  null, 'outsider: updates zero rows of every table in the other wedding');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('delete from public.%I where wedding_id = %L', tbl, (select w from ctx))) <> 'ok:0'),
  null, 'outsider: deletes zero rows of every table in the other wedding');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl
    where tests.try(format('insert into public.%I (wedding_id) values (%L)', tbl, (select w from ctx))) <> '42501'),
  null, 'outsider: every insert into the other wedding is rejected');
select is((select count(*) from public.weddings where id = (select w from ctx)), 0::bigint, 'outsider: cannot see the other wedding');
select is((select count(*) from public.memberships where wedding_id = (select w from ctx)), 0::bigint, 'outsider: cannot see the other team');
select is((select count(*) from public.profiles where email = 'owner@example.test'), 0::bigint, 'outsider: cannot read unrelated profiles');
select ok(tests.visible('tasks', (select w2 from ctx)) > 0, 'outsider: sees their own wedding');
-- a member of both weddings still cannot move rows between them
select is(
  tests.try(format('update public.tasks set wedding_id = %L where wedding_id = %L', (select w from ctx), (select w2 from ctx))),
  '42501', 'rows can never change wedding');

-- ─── 4. a planner cannot manage the team ─────────────────────────────────────
select tests.act_as('planner@example.test');
select is(
  tests.try(format($$insert into public.memberships (wedding_id, user_id, role) values (%L, '00000000-0000-4000-8000-00000000000e', 'owner')$$, (select w from ctx))),
  '42501', 'planner: cannot add members');
select is(
  tests.try(format($$update public.memberships set role = 'owner' where wedding_id = %L$$, (select w from ctx))),
  'ok:0', 'planner: cannot change roles (not even their own)');
select is(tests.try(format($$select public.invite_member(%L, 'x@example.test', 'viewer')$$, (select w from ctx))),
  '42501', 'planner: cannot invite');

-- ─── 5. the last owner cannot demote or remove themselves ────────────────────
select tests.act_as('owner@example.test');
select is(
  tests.try(format($$update public.memberships set role = 'planner' where wedding_id = %L and user_id = auth.uid()$$, (select w from ctx))),
  '42501', 'last owner: cannot demote themselves');
select is(
  tests.try(format($$delete from public.memberships where wedding_id = %L and user_id = auth.uid()$$, (select w from ctx))),
  '42501', 'last owner: cannot remove themselves');

-- ─── 6. an expired invitation does not create a membership ───────────────────
select tests.act_as_postgres();
insert into public.invitations (wedding_id, email, role, invited_by, expires_at)
values ((select w from ctx), 'late@example.test', 'viewer', '00000000-0000-4000-8000-00000000000a', now() - interval '1 day');
insert into public.invitations (wedding_id, email, role, invited_by)
values ((select w from ctx), 'Punctual@Example.test', 'collaborator', '00000000-0000-4000-8000-00000000000a');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'late@example.test'),
  ('00000000-0000-4000-8000-0000000000f2', 'punctual@example.test');
select is((select count(*) from public.memberships where user_id = '00000000-0000-4000-8000-0000000000f1'), 0::bigint,
  'expired invitation: no membership on sign-up');
select is((select role::text from public.memberships where user_id = '00000000-0000-4000-8000-0000000000f2'), 'collaborator',
  'valid invitation: claimed on sign-up, email matched case-insensitively');

-- an invitation link is useless to anyone but its addressee
select tests.act_as('outsider@example.test');
select is(
  tests.try(format('select public.accept_invitation(%L)',
    (select token from public.invitations where email = 'late@example.test'))),
  'P0002', 'accept_invitation: expired link rejected');

-- ─── 8. a removed member's live session reads nothing ───────────────────────
select tests.act_as('owner@example.test');
delete from public.memberships where wedding_id = (select w from ctx)
  and user_id = '00000000-0000-4000-8000-00000000000c';
select tests.act_as('collaborator@example.test');
select is(
  (select array_agg(tbl order by tbl) from tests.tables() as tbl where tests.visible(tbl, (select w from ctx)) <> 0),
  null, 'removed member: reads nothing, immediately');

select * from finish();
rollback;
