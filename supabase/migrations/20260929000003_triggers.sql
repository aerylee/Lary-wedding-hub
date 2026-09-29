-- Table registry, audit triggers, activity log, new-user handling, last-owner guard.

-- ─── registry ────────────────────────────────────────────────────────────────
-- The single source of truth for which permission guards which table. The RLS loop,
-- the activity-log visibility and the permission tests all read from it, so a new
-- table cannot be protected in one place and forgotten in another.
create table app.table_perms (
  tbl          text primary key,
  read_perms   text[] not null,
  write_perms  text[] not null,
  label_col    text                 -- column used as a human label in the activity feed
);

insert into app.table_perms (tbl, read_perms, write_perms, label_col) values
  ('wedding_settings',  '{settings:read}',  '{settings:write}',  null),
  ('budget_settings',   '{finance:read}',   '{finance:write}',   null),
  ('venues',            '{venues:read}',    '{venues:write}',    'name'),
  ('tasks',             '{tasks:read}',     '{tasks:write}',     'title'),
  ('vendors',           '{vendors:read}',   '{vendors:write}',   'name'),
  ('vendor_finance',    '{finance:read}',   '{finance:write}',   null),
  ('budget_categories', '{finance:read}',   '{finance:write}',   'name'),
  ('budget_lines',      '{finance:read}',   '{finance:write}',   'label'),
  ('payments',          '{finance:read}',   '{finance:write}',   'label'),
  ('events',            '{settings:read}',  '{settings:write}',  'name'),
  ('rooms',             '{travel:read}',    '{travel:write}',    'name'),
  ('seat_tables',       '{seating:read}',   '{seating:write}',   'name'),
  ('guests',            '{guests:read}',    '{guests:write}',    'first_name'),
  ('guest_contacts',    '{guests:contact}', '{guests:write,guests:contact}', null),
  ('rsvps',             '{guests:read}',    '{guests:write}',    null),
  ('legal_docs',        '{legal:read}',     '{legal:write}',     'title'),
  ('decisions',         '{decisions:read}', '{decisions:write}', 'title'),
  ('schedule_items',    '{schedule:read}',  '{schedule:write}',  'title'),
  ('comms_rows',        '{comms:read}',     '{comms:write}',     'household'),
  ('templates',         '{comms:read}',     '{comms:write}',     'name'),
  ('correspondence',    '{comms:read}',     '{comms:write}',     'subject'),
  ('attachments',       '{files:read}',     '{files:write}',     'name'),
  ('faqs',              '{comms:read}',     '{comms:write}',     'question');

-- ─── audit columns ───────────────────────────────────────────────────────────
create or replace function app.set_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    -- rows never change tenant; a member of two weddings must not move data between them
    if new.wedding_id is distinct from old.wedding_id then
      raise exception 'wedding_id cannot be changed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

-- ─── activity log ────────────────────────────────────────────────────────────
create table public.activity_log (
  id          bigserial primary key,
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('insert','update','delete')),
  label       text,
  changed     jsonb,                 -- {field: [old, new]} for updates
  read_perms  text[] not null,       -- who may see this entry: the source table's read permissions
  at          timestamptz not null default now()
);
create index activity_log_wedding_idx on public.activity_log (wedding_id, at desc);

create or replace function app.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reg      app.table_perms;
  o        jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n        jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r        jsonb := coalesce(n, o);
  diff     jsonb := null;
  k        text;
  lbl      text;
begin
  select * into reg from app.table_perms where tbl = tg_table_name;

  if tg_op = 'UPDATE' then
    diff := '{}'::jsonb;
    for k in select jsonb_object_keys(n) loop
      if k in ('updated_at','updated_by','created_at','created_by') then continue; end if;
      if (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return null; end if;   -- nothing meaningful changed
  end if;

  if reg.label_col is not null then
    lbl := r ->> reg.label_col;
    if tg_table_name = 'guests' then
      lbl := trim(coalesce(r ->> 'first_name','') || ' ' || coalesce(r ->> 'last_name',''));
    end if;
  end if;

  insert into public.activity_log (wedding_id, actor_id, table_name, row_id, action, label, changed, read_perms)
  values (
    (r ->> 'wedding_id')::uuid,
    auth.uid(),
    tg_table_name,
    coalesce((r ->> 'id')::uuid, (r ->> 'wedding_id')::uuid),
    lower(tg_op),
    lbl,
    diff,
    coalesce(reg.read_perms, '{settings:read}')
  );
  return null;
exception
  -- a cascade from deleting the whole wedding: the parent is gone, nothing to log against
  when foreign_key_violation then return null;
end $$;

do $$
declare t record;
begin
  for t in select tbl from app.table_perms loop
    execute format(
      'create trigger %1$s_audit before insert or update on public.%1$I
         for each row execute function app.set_audit()', t.tbl);
    execute format(
      'create trigger %1$s_activity after insert or update or delete on public.%1$I
         for each row execute function app.log_activity()', t.tbl);
  end loop;
end $$;

-- ─── new users: profile + claim invitations ─────────────────────────────────
-- Runs as definer on auth.users, so it validates invitations itself and never trusts
-- raw_user_meta_data for anything but a display name.
create or replace function app.claim_invitations(p_user uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inv record; n integer := 0;
begin
  for inv in
    select * from public.invitations
    where lower(email::text) = lower(p_email)
      and accepted_at is null
      and expires_at > now()
    for update
  loop
    insert into public.memberships (wedding_id, user_id, role, invited_by)
    values (inv.wedding_id, p_user, inv.role, inv.invited_by)
    on conflict (wedding_id, user_id) do nothing;
    update public.invitations set accepted_at = now(), accepted_by = p_user where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function app.claim_invitations(uuid, text) from public;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), '')
  )
  on conflict (id) do update set email = excluded.email;

  if new.email is not null then
    perform app.claim_invitations(new.id, new.email);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ─── last-owner guard ────────────────────────────────────────────────────────
-- Two invariants no policy can express: a wedding always has an active owner, and the
-- last owner cannot demote or remove themselves. Without this one careless edit locks
-- everybody out permanently.
create or replace function app.last_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare losing boolean;
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return coalesce(new, old);
  end if;

  losing := tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active';
  if not losing then return new; end if;

  -- the wedding itself is being deleted (cascade) — nothing to protect
  if not exists (select 1 from public.weddings where id = old.wedding_id) then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.memberships
    where wedding_id = old.wedding_id and role = 'owner' and status = 'active' and id <> old.id
  ) then
    raise exception 'A wedding must keep at least one owner. Make someone else an owner first.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger memberships_last_owner
  before update or delete on public.memberships
  for each row execute function app.last_owner_guard();

-- membership changes are worth a line in the feed too ("who removed Aunt Jo")
create or replace function app.log_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r public.memberships := coalesce(new, old); who text;
begin
  select coalesce(nullif(full_name, ''), email) into who from public.profiles where id = r.user_id;
  insert into public.activity_log (wedding_id, actor_id, table_name, row_id, action, label, changed, read_perms)
  values (
    r.wedding_id, auth.uid(), 'memberships', r.id, lower(tg_op), who,
    case when tg_op = 'UPDATE' then jsonb_build_object('role', jsonb_build_array(old.role, new.role)) end,
    '{settings:read}'
  );
  return null;
exception when foreign_key_violation then return null;
end $$;

create trigger memberships_activity
  after insert or update of role, status or delete on public.memberships
  for each row execute function app.log_membership();
