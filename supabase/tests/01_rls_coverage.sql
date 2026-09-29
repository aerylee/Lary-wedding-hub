-- Test 9 (auth spec §11): every table has RLS enabled and at least one policy.
-- The single highest-value test in the suite — a missing policy isn't an error, it's an
-- empty table, and a missing `enable row level security` is a leak.
begin;
select plan(5);

select is(
  (select array_agg(tablename::text order by tablename) from pg_tables
    where schemaname = 'public' and not rowsecurity),
  null,
  'every public table has row level security enabled'
);

select is(
  (select array_agg(t.tablename::text order by t.tablename) from pg_tables t
    where t.schemaname = 'public'
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)),
  null,
  'every public table has at least one policy'
);

select is(
  (select array_agg(c.table_name::text order by c.table_name)
     from information_schema.columns c
     join pg_tables t on t.schemaname = c.table_schema and t.tablename = c.table_name
    where c.table_schema = 'public' and c.column_name = 'wedding_id'
      and c.table_name not in ('memberships', 'invitations', 'activity_log')
      and c.table_name not in (select tbl from app.table_perms)),
  null,
  'every tenant table is registered in app.table_perms (so the policy loop covers it)'
);

select is(
  (select array_agg(tbl order by tbl) from app.table_perms
    where (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = tbl)
          < case when tbl in ('wedding_settings','budget_settings') then 2 else 4 end),
  null,
  'every registered table has its full set of policies'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null,
  'every SECURITY DEFINER function pins its search_path'
);

select * from finish();
rollback;
