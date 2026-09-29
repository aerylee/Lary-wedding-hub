-- Shared helpers for the pgTAP suite. Created in its own transaction and kept (the other
-- files roll back), so each test file can call them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- act as a user the way PostgREST does: role authenticated + JWT claims
create or replace function tests.act_as(email text)
returns void language plpgsql as $$
declare uid uuid;
begin
  reset role;
  select id into uid from auth.users u where u.email = act_as.email;
  if uid is null then raise exception 'no such test user %', email; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.act_as_postgres()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- run a statement; return 'ok:<rows>' or the SQLSTATE it failed with
create or replace function tests.try(stmt text)
returns text language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return 'ok:' || n;
exception when others then
  return sqlstate;
end $$;

-- count rows of a table visible to the current role for a wedding
create or replace function tests.visible(tbl text, w uuid)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where wedding_id = $1', tbl) into n using w;
  return n;
end $$;

create or replace function tests.wedding(p_name text)
returns uuid language sql security definer set search_path = public as $$
  select id from public.weddings where name = p_name;
$$;

-- the registry, readable from inside a test running as `authenticated`
create or replace function tests.tables()
returns setof text language sql stable security definer set search_path = public as $$
  select tbl from app.table_perms order by tbl;
$$;

grant execute on all functions in schema tests to authenticated, anon;

select pass('helpers installed');
select * from finish();
commit;
