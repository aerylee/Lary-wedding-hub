-- RPCs: creating a wedding, permissions for the client, invitations.

-- ─── create_wedding ──────────────────────────────────────────────────────────
-- The only way to create a wedding: wedding, owner membership, settings and seed in
-- one transaction (auth spec §5.4). seed_wedding() is defined in the next migration.
create or replace function public.create_wedding(
  p_name        text,
  p_target_date date default null,
  p_couple_a    text default '',
  p_couple_b    text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare w uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'A wedding needs a name' using errcode = '22023';
  end if;
  -- a crude brake on scripted abuse: nobody plans more than a handful of weddings
  if (select count(*) from public.weddings where created_by = auth.uid()) >= 10 then
    raise exception 'Too many weddings created from this account' using errcode = '54000';
  end if;

  insert into public.profiles (id, email)
  select auth.uid(), coalesce((select email from auth.users where id = auth.uid()), '')
  on conflict (id) do nothing;

  insert into public.weddings (name, created_by) values (trim(p_name), auth.uid()) returning id into w;
  insert into public.memberships (wedding_id, user_id, role) values (w, auth.uid(), 'owner');
  insert into public.wedding_settings (wedding_id, couple_a, couple_b, target_date, decide_venue_by, rsvp_by)
  values (
    w, coalesce(p_couple_a, ''), coalesce(p_couple_b, ''),
    coalesce(p_target_date, current_date + 540),
    coalesce(p_target_date, current_date + 540) - 420,
    coalesce(p_target_date, current_date + 540) - 70
  );
  insert into public.budget_settings (wedding_id) values (w);
  perform public.seed_wedding(w);
  return w;
end $$;

-- ─── my_permissions ──────────────────────────────────────────────────────────
create or replace function public.my_permissions(w uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(rp.permission order by rp.permission), '{}')
  from public.memberships m
  join public.role_permissions rp on rp.role = m.role
  where m.wedding_id = w and m.user_id = auth.uid() and m.status = 'active';
$$;

-- ─── last seen ───────────────────────────────────────────────────────────────
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
$$;

-- ─── invitations ─────────────────────────────────────────────────────────────
-- Re-inviting the same address replaces the pending row. Returns the invitation.
create or replace function public.invite_member(w uuid, p_email text, p_role public.app_role)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invitations; e text := lower(trim(p_email));
begin
  if not app.has(w, 'members:manage') then
    raise exception 'You don''t have permission to invite people' using errcode = '42501';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That doesn''t look like an email address' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.wedding_id = w and lower(p.email) = e
  ) then
    raise exception '% is already on the team', e using errcode = '23505';
  end if;

  delete from public.invitations where wedding_id = w and lower(email::text) = e and accepted_at is null;
  insert into public.invitations (wedding_id, email, role, invited_by)
  values (w, e, p_role, auth.uid())
  returning * into inv;

  -- an existing user is added straight away; the email is then just a notification
  if exists (select 1 from auth.users where lower(email) = e) then
    perform app.claim_invitations((select id from auth.users where lower(email) = e limit 1), e);
    select * into inv from public.invitations where id = inv.id;
  end if;
  return inv;
end $$;

create or replace function public.resend_invitation(p_id uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = p_id and accepted_at is null;
  if inv.id is null or not app.has(inv.wedding_id, 'members:manage') then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  update public.invitations
    set token = gen_random_uuid(), expires_at = now() + interval '14 days'
    where id = p_id
    returning * into inv;
  return inv;
end $$;

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare w uuid;
begin
  select wedding_id into w from public.invitations where id = p_id and accepted_at is null;
  if w is null or not app.has(w, 'members:manage') then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  delete from public.invitations where id = p_id;
end $$;

-- /join?token=… for a user who already has an account. The invitation must be pending,
-- unexpired and addressed to the caller's own email — a leaked link is useless to anyone else.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invitations; my_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select email into my_email from auth.users where id = auth.uid();
  select * into inv from public.invitations where token = p_token for update;

  if inv.id is null then
    raise exception 'This invitation link is not valid' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then return inv.wedding_id; end if;
    raise exception 'This invitation has already been used' using errcode = 'P0002';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invitation has expired — ask for a new one' using errcode = 'P0002';
  end if;
  if lower(inv.email::text) <> lower(coalesce(my_email, '')) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.memberships (wedding_id, user_id, role, invited_by)
  values (inv.wedding_id, auth.uid(), inv.role, inv.invited_by)
  on conflict (wedding_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.wedding_id;
end $$;

-- ─── grants ──────────────────────────────────────────────────────────────────
revoke all on function
  public.create_wedding(text, date, text, text),
  public.my_permissions(uuid),
  public.touch_last_seen(),
  public.invite_member(uuid, text, public.app_role),
  public.resend_invitation(uuid),
  public.revoke_invitation(uuid),
  public.accept_invitation(uuid)
from public, anon;

grant execute on function
  public.create_wedding(text, date, text, text),
  public.my_permissions(uuid),
  public.touch_last_seen(),
  public.invite_member(uuid, text, public.app_role),
  public.resend_invitation(uuid),
  public.revoke_invitation(uuid),
  public.accept_invitation(uuid)
to authenticated;
