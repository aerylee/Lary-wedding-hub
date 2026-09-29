-- Authorisation in the database. Auth spec §5.
--
-- SECURITY DEFINER helpers (not JWT claims): always current, so a removed member loses
-- access on their very next query, and they work across several weddings per user.

create or replace function app.is_member(w uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.wedding_id = w and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function app.has(w uuid, perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.wedding_id = w
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission = perm
  );
$$;

create or replace function app.has_all(w uuid, perms text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(bool_and(app.has(w, p)), false) from unnest(perms) as p;
$$;

-- true when the two users share at least one active wedding (for reading team profiles)
create or replace function app.shares_wedding(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on b.wedding_id = a.wedding_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = other
  );
$$;

revoke execute on function app.is_member(uuid), app.has(uuid, text), app.has_all(uuid, text[]),
  app.shares_wedding(uuid) from public;
grant execute on function app.is_member(uuid), app.has(uuid, text), app.has_all(uuid, text[]),
  app.shares_wedding(uuid) to authenticated;

-- ─── the policy loop ─────────────────────────────────────────────────────────
-- Every planning table gets the same four policies, varying only in permission strings,
-- driven by app.table_perms so the set is identical and auditable.
do $$
declare t record;
begin
  for t in select * from app.table_perms loop
    execute format('alter table public.%I enable row level security', t.tbl);

    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (app.has_all(wedding_id, %2$L::text[]))', t.tbl, t.read_perms);

    -- settings rows are created only by create_wedding(); nobody inserts or deletes them
    if t.tbl in ('wedding_settings', 'budget_settings') then
      execute format(
        'create policy %1$s_update on public.%1$I for update to authenticated
           using (app.has_all(wedding_id, %2$L::text[]))
           with check (app.has_all(wedding_id, %2$L::text[]))', t.tbl, t.write_perms);
      continue;
    end if;

    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (app.has_all(wedding_id, %2$L::text[]))', t.tbl, t.write_perms);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (app.has_all(wedding_id, %2$L::text[]))
         with check (app.has_all(wedding_id, %2$L::text[]))', t.tbl, t.write_perms);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using (app.has_all(wedding_id, %2$L::text[]))', t.tbl, t.write_perms);
  end loop;
end $$;

-- ─── core tables ─────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.weddings         enable row level security;
alter table public.memberships      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.invitations      enable row level security;
alter table public.activity_log     enable row level security;

-- profiles: yourself, and the people you plan with
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.shares_wedding(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- weddings: insert only through create_wedding() (security definer) — no insert policy
create policy weddings_select on public.weddings for select to authenticated
  using (app.is_member(id));
create policy weddings_update on public.weddings for update to authenticated
  using (app.has(id, 'settings:write')) with check (app.has(id, 'settings:write'));
create policy weddings_delete on public.weddings for delete to authenticated
  using (app.has(id, 'wedding:delete'));

-- memberships: see your team; only members:manage may change it
create policy memberships_select on public.memberships for select to authenticated
  using (app.is_member(wedding_id) or user_id = auth.uid());
create policy memberships_insert on public.memberships for insert to authenticated
  with check (app.has(wedding_id, 'members:manage'));
create policy memberships_update on public.memberships for update to authenticated
  using (app.has(wedding_id, 'members:manage')) with check (app.has(wedding_id, 'members:manage'));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app.has(wedding_id, 'members:manage'));

-- the matrix is not a secret
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (true);

-- invitations: managers only (the invitee accepts through accept_invitation())
create policy invitations_select on public.invitations for select to authenticated
  using (app.has(wedding_id, 'members:manage'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (app.has(wedding_id, 'members:manage') and invited_by = auth.uid());
create policy invitations_update on public.invitations for update to authenticated
  using (app.has(wedding_id, 'members:manage')) with check (app.has(wedding_id, 'members:manage'));
create policy invitations_delete on public.invitations for delete to authenticated
  using (app.has(wedding_id, 'members:manage'));

-- activity: an entry is visible only to those who can read the table it describes, so a
-- collaborator's feed never carries budget figures in its diffs
create policy activity_log_select on public.activity_log for select to authenticated
  using (app.has_all(wedding_id, read_perms));

-- ─── grants ──────────────────────────────────────────────────────────────────
-- Supabase grants table privileges to anon/authenticated by default; RLS is the gate.
-- Make anon's position explicit: it gets nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all tables in schema app from anon, authenticated;
