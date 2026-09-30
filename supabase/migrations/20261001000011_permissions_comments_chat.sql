-- Per-wedding role permissions, comments pinned to anything on screen, @mentions, and
-- team chat (channels in categories, threads, pins, unread tracking).

-- ─── new permissions ─────────────────────────────────────────────────────────
-- Commenting and chatting don't change the plan, so every role gets them by default;
-- organising channels is for everyone but viewers.
insert into public.role_permissions (role, permission)
select r.role::public.app_role, m.permission
from (values
  -- permission         owner planner collab viewer
  ('comments:write',    true, true,  true,  true),
  ('chat:read',         true, true,  true,  true),
  ('chat:write',        true, true,  true,  true),
  ('chat:manage',       true, true,  true,  false)
) as m(permission, owner, planner, collaborator, viewer)
cross join lateral (values
  ('owner', m.owner), ('planner', m.planner),
  ('collaborator', m.collaborator), ('viewer', m.viewer)
) as r(role, granted)
where r.granted
on conflict do nothing;

-- ─── per-wedding overrides of the role matrix ───────────────────────────────
-- A row exists only where a wedding differs from the default in role_permissions.
-- Owners always keep everything, and the two team-level powers stay owner-only, so
-- nobody can lock the couple out or hand themselves the keys.
create table public.wedding_role_permissions (
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  role        public.app_role not null check (role <> 'owner'),
  permission  text not null check (permission not in ('members:manage', 'wedding:delete')),
  granted     boolean not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (wedding_id, role, permission)
);

alter table public.wedding_role_permissions enable row level security;
create policy wedding_role_permissions_select on public.wedding_role_permissions for select to authenticated
  using (app.is_member(wedding_id));
-- writes go through set_role_permissions() only

-- does user u hold perm on wedding w? The override wins; otherwise the default matrix.
create or replace function app.user_has(u uuid, w uuid, perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.wedding_id = w and m.user_id = u and m.status = 'active'
      and coalesce(
        (select o.granted from public.wedding_role_permissions o
          where o.wedding_id = w and o.role = m.role and o.permission = perm),
        exists (select 1 from public.role_permissions rp where rp.role = m.role and rp.permission = perm)
      )
  );
$$;
revoke execute on function app.user_has(uuid, uuid, text) from public;

create or replace function app.has(w uuid, perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select app.user_has(auth.uid(), w, perm);
$$;

create or replace function app.user_has_all(u uuid, w uuid, perms text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(bool_and(app.user_has(u, w, p)), false) from unnest(perms) as p;
$$;
revoke execute on function app.user_has_all(uuid, uuid, text[]) from public;

create or replace function public.my_permissions(w uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.permission order by p.permission), '{}')
  from (select distinct permission from public.role_permissions) p
  where app.user_has(auth.uid(), w, p.permission);
$$;

-- Save a batch of matrix changes: [{role, permission, granted}, …]. Setting a cell back
-- to its default removes the override, so "differs from default" stays meaningful.
create or replace function public.set_role_permissions(w uuid, changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c jsonb; r public.app_role; p text; g boolean;
begin
  if not app.has(w, 'members:manage') then
    raise exception 'Only owners can change what each role can do' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' then
    raise exception 'changes must be an array' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(changes) loop
    r := (c ->> 'role')::public.app_role;
    p := c ->> 'permission';
    g := (c ->> 'granted')::boolean;
    if r = 'owner' then
      raise exception 'Owners always have every permission' using errcode = '22023';
    end if;
    if p in ('members:manage', 'wedding:delete') then
      raise exception '% stays with owners only', p using errcode = '22023';
    end if;
    if not exists (select 1 from public.role_permissions where permission = p) then
      raise exception 'Unknown permission %', p using errcode = '22023';
    end if;
    if g is null then
      raise exception 'granted must be true or false' using errcode = '22023';
    end if;

    if g = exists (select 1 from public.role_permissions where role = r and permission = p) then
      delete from public.wedding_role_permissions where wedding_id = w and role = r and permission = p;
    else
      insert into public.wedding_role_permissions (wedding_id, role, permission, granted, updated_by, updated_at)
      values (w, r, p, g, auth.uid(), now())
      on conflict (wedding_id, role, permission)
      do update set granted = excluded.granted, updated_by = excluded.updated_by, updated_at = now();
    end if;
  end loop;
end $$;

revoke all on function public.set_role_permissions(uuid, jsonb) from public, anon;
grant execute on function public.set_role_permissions(uuid, jsonb) to authenticated;

-- ─── comments ────────────────────────────────────────────────────────────────
-- A comment belongs to a page (a module key) and an anchor on it — the element that was
-- clicked, described well enough to find it again. Who may read it follows the page:
-- a comment on the Budget is as private as the budget.
create or replace function app.page_read_perms(p_page text)
returns text[]
language sql immutable set search_path = ''
as $$
  select case p_page
    when 'venues'      then '{venues:read}'
    when 'timeline'    then '{tasks:read}'
    when 'budget'      then '{finance:read}'
    when 'vendors'     then '{vendors:read}'
    when 'guests'      then '{guests:read}'
    when 'travel'      then '{travel:read}'
    when 'seating'     then '{seating:read}'
    when 'run-of-show' then '{schedule:read}'
    when 'comms'       then '{comms:read}'
    when 'legal'       then '{legal:read}'
    when 'decisions'   then '{decisions:read}'
    else '{settings:read}'               -- dashboard, wedding settings, account & team
  end::text[];
$$;

create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  parent_id     uuid,                                    -- a reply; null for the thread's first comment
  page          text not null check (page ~ '^[a-z][a-z0-9-]{0,39}$'),
  anchor        jsonb not null default '{}'::jsonb,      -- {path, text, tag, x, y, key}
  anchor_label  text not null default '' check (length(anchor_label) <= 200),
  body          text not null check (length(trim(body)) between 1 and 4000),
  mentions      uuid[] not null default '{}',
  author_id     uuid references public.profiles(id) on delete set null default auth.uid(),
  read_perms    text[] not null default '{settings:read}',
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null,
  edited_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, parent_id) references public.comments (wedding_id, id) on delete cascade
);
create index comments_wedding_idx on public.comments (wedding_id, page, created_at);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;

create or replace function app.comments_before()
returns trigger
language plpgsql
set search_path = public
as $$
declare parent public.comments;
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
    new.resolved_at := null;
    new.resolved_by := null;
    new.edited_at := null;
    if new.parent_id is not null then
      -- a reply lives where its thread lives, and threads are one level deep
      select * into parent from public.comments where id = new.parent_id and wedding_id = new.wedding_id;
      if parent.id is null then
        raise exception 'That comment no longer exists' using errcode = '23503';
      end if;
      if parent.parent_id is not null then
        new.parent_id := parent.parent_id;
      end if;
      new.page := parent.page;
      new.anchor := parent.anchor;
      new.anchor_label := parent.anchor_label;
    end if;
    new.read_perms := app.page_read_perms(new.page);
  else
    if new.wedding_id is distinct from old.wedding_id or new.page is distinct from old.page
       or new.parent_id is distinct from old.parent_id or new.author_id is distinct from old.author_id
       or new.anchor is distinct from old.anchor or new.read_perms is distinct from old.read_perms
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the text of a comment can be edited' using errcode = '42501';
    end if;
    if (new.body is distinct from old.body or new.mentions is distinct from old.mentions) then
      if old.author_id is distinct from auth.uid() then
        raise exception 'You can only edit your own comments' using errcode = '42501';
      end if;
      new.edited_at := now();
    end if;
    if new.resolved_at is distinct from old.resolved_at then
      new.resolved_by := case when new.resolved_at is null then null else auth.uid() end;
      new.resolved_at := case when new.resolved_at is null then null else now() end;
    end if;
  end if;
  return new;
end $$;

create trigger comments_before before insert or update on public.comments
  for each row execute function app.comments_before();

alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated
  using (app.has_all(wedding_id, read_perms));
create policy comments_insert on public.comments for insert to authenticated
  with check (app.has(wedding_id, 'comments:write') and app.has_all(wedding_id, app.page_read_perms(page)));
-- the trigger limits a non-author to resolving and reopening
create policy comments_update on public.comments for update to authenticated
  using (app.has(wedding_id, 'comments:write') and app.has_all(wedding_id, read_perms))
  with check (app.has(wedding_id, 'comments:write') and app.has_all(wedding_id, read_perms));
create policy comments_delete on public.comments for delete to authenticated
  using (app.has_all(wedding_id, read_perms) and (author_id = auth.uid() or app.has(wedding_id, 'members:manage')));

-- ─── chat ────────────────────────────────────────────────────────────────────
create table public.chat_categories (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  position    integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (wedding_id, id)
);
create index chat_categories_wedding_idx on public.chat_categories (wedding_id);

create table public.chat_channels (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings(id) on delete cascade,
  category_id  uuid,
  name         text not null check (name ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  topic        text not null default '' check (length(topic) <= 250),
  position     integer not null default 0,
  archived_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (wedding_id, id),
  unique (wedding_id, name),
  foreign key (wedding_id, category_id) references public.chat_categories (wedding_id, id) on delete set null (category_id)
);
create index chat_channels_wedding_idx on public.chat_channels (wedding_id);

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  channel_id  uuid not null,
  parent_id   uuid,                                     -- a thread reply
  body        text not null check (length(trim(body)) between 1 and 4000),
  mentions    uuid[] not null default '{}',
  pinned      boolean not null default false,
  author_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  edited_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (wedding_id, id),
  foreign key (wedding_id, channel_id) references public.chat_channels (wedding_id, id) on delete cascade,
  foreign key (wedding_id, parent_id) references public.chat_messages (wedding_id, id) on delete cascade
);
create index chat_messages_channel_idx on public.chat_messages (channel_id, created_at);
create index chat_messages_wedding_idx on public.chat_messages (wedding_id, created_at desc);

create table public.chat_reads (
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  channel_id    uuid not null,
  user_id       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  last_read_at  timestamptz not null default now(),
  primary key (channel_id, user_id),
  foreign key (wedding_id, channel_id) references public.chat_channels (wedding_id, id) on delete cascade
);
create index chat_reads_wedding_idx on public.chat_reads (wedding_id, user_id);

create or replace function app.chat_messages_before()
returns trigger
language plpgsql
set search_path = public
as $$
declare parent public.chat_messages;
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
    new.edited_at := null;
    new.pinned := false;
    if new.parent_id is not null then
      select * into parent from public.chat_messages where id = new.parent_id and wedding_id = new.wedding_id;
      if parent.id is null then
        raise exception 'That message no longer exists' using errcode = '23503';
      end if;
      new.parent_id := coalesce(parent.parent_id, parent.id);   -- threads are one level deep
      new.channel_id := parent.channel_id;
    end if;
    if exists (select 1 from public.chat_channels where id = new.channel_id and archived_at is not null) then
      raise exception 'This channel is archived' using errcode = '42501';
    end if;
  else
    if new.wedding_id is distinct from old.wedding_id or new.channel_id is distinct from old.channel_id
       or new.parent_id is distinct from old.parent_id or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the text of a message can be edited' using errcode = '42501';
    end if;
    if new.body is distinct from old.body or new.mentions is distinct from old.mentions then
      if old.author_id is distinct from auth.uid() then
        raise exception 'You can only edit your own messages' using errcode = '42501';
      end if;
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger chat_messages_before before insert or update on public.chat_messages
  for each row execute function app.chat_messages_before();

alter table public.chat_categories enable row level security;
alter table public.chat_channels   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.chat_reads      enable row level security;

create policy chat_categories_select on public.chat_categories for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_categories_insert on public.chat_categories for insert to authenticated
  with check (app.has(wedding_id, 'chat:manage'));
create policy chat_categories_update on public.chat_categories for update to authenticated
  using (app.has(wedding_id, 'chat:manage')) with check (app.has(wedding_id, 'chat:manage'));
create policy chat_categories_delete on public.chat_categories for delete to authenticated
  using (app.has(wedding_id, 'chat:manage'));

create policy chat_channels_select on public.chat_channels for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_channels_insert on public.chat_channels for insert to authenticated
  with check (app.has(wedding_id, 'chat:manage'));
create policy chat_channels_update on public.chat_channels for update to authenticated
  using (app.has(wedding_id, 'chat:manage')) with check (app.has(wedding_id, 'chat:manage'));
create policy chat_channels_delete on public.chat_channels for delete to authenticated
  using (app.has(wedding_id, 'chat:manage'));

create policy chat_messages_select on public.chat_messages for select to authenticated
  using (app.has(wedding_id, 'chat:read'));
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (app.has(wedding_id, 'chat:write'));
-- authors edit their own words; anyone who can post may pin (the trigger enforces which)
create policy chat_messages_update on public.chat_messages for update to authenticated
  using (app.has(wedding_id, 'chat:write')) with check (app.has(wedding_id, 'chat:write'));
create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (app.has(wedding_id, 'chat:read') and (author_id = auth.uid() or app.has(wedding_id, 'chat:manage')));

create policy chat_reads_select on public.chat_reads for select to authenticated
  using (user_id = auth.uid());
create policy chat_reads_insert on public.chat_reads for insert to authenticated
  with check (user_id = auth.uid() and app.has(wedding_id, 'chat:read'));
create policy chat_reads_update on public.chat_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and app.has(wedding_id, 'chat:read'));
create policy chat_reads_delete on public.chat_reads for delete to authenticated
  using (user_id = auth.uid());

-- every wedding starts with a place to talk
create or replace function app.seed_chat(w uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare planning uuid; people uuid;
begin
  if exists (select 1 from public.chat_channels where wedding_id = w) then return; end if;
  insert into public.chat_categories (wedding_id, name, position, created_by)
  values (w, 'Planning', 0, null) returning id into planning;
  insert into public.chat_categories (wedding_id, name, position, created_by)
  values (w, 'Guests & travel', 1, null) returning id into people;
  insert into public.chat_channels (wedding_id, category_id, name, topic, position, created_by) values
    (w, planning, 'general',  'Anything and everything about the wedding', 0, null),
    (w, planning, 'vendors',  'Quotes, calls and contracts', 1, null),
    (w, planning, 'ideas',    'Inspiration, links and half-formed thoughts', 2, null),
    (w, people,   'guests',   'The list, RSVPs and who sits where', 0, null),
    (w, people,   'travel',   'Flights, rooms and getting everyone there', 1, null);
end $$;
revoke execute on function app.seed_chat(uuid) from public;

create or replace function app.weddings_seed_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app.seed_chat(new.id);
  return null;
end $$;

create trigger weddings_seed_chat after insert on public.weddings
  for each row execute function app.weddings_seed_chat();

do $$ begin perform app.seed_chat(id) from public.weddings; end $$;

-- ─── mentions ────────────────────────────────────────────────────────────────
-- One row per person tagged. Written only by triggers, which drop anyone who couldn't
-- read what they were tagged in. `emailed_at` is for the email notifications to come.
create table public.mentions (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  comment_id  uuid references public.comments(id) on delete cascade,
  message_id  uuid references public.chat_messages(id) on delete cascade,
  page        text,                  -- where to go: a module key, or 'chat'
  channel_id  uuid,
  excerpt     text not null default '',
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  emailed_at  timestamptz,
  check (num_nonnulls(comment_id, message_id) = 1)
);
create unique index mentions_comment_uidx on public.mentions (comment_id, user_id) where comment_id is not null;
create unique index mentions_message_uidx on public.mentions (message_id, user_id) where message_id is not null;
create index mentions_user_idx on public.mentions (user_id, wedding_id, created_at desc);
create index mentions_unsent_idx on public.mentions (created_at) where emailed_at is null;

alter table public.mentions enable row level security;
create policy mentions_select on public.mentions for select to authenticated
  using (user_id = auth.uid() and app.is_member(wedding_id));
create policy mentions_update on public.mentions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- a person may mark their mentions read, nothing else
revoke insert, update, delete on public.mentions from authenticated;
grant update (read_at) on public.mentions to authenticated;

create or replace function app.record_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perms   text[];
  pg      text;
  chan    uuid;
  fresh   uuid[];
  valid   uuid[];
begin
  fresh := array(
    select distinct u from unnest(new.mentions) as u
    where u is distinct from new.author_id
      and (tg_op = 'INSERT' or not (u = any (old.mentions)))
  );
  if coalesce(array_length(fresh, 1), 0) = 0 then return null; end if;

  if tg_table_name = 'comments' then
    perms := new.read_perms; pg := new.page; chan := null;
  else
    perms := '{chat:read}'; pg := 'chat'; chan := new.channel_id;
  end if;
  valid := array(select u from unnest(fresh) as u where app.user_has_all(u, new.wedding_id, perms));

  insert into public.mentions (wedding_id, user_id, author_id, comment_id, message_id, page, channel_id, excerpt)
  select new.wedding_id, u, new.author_id,
         case when tg_table_name = 'comments' then new.id end,
         case when tg_table_name = 'chat_messages' then new.id end,
         pg, chan, left(regexp_replace(new.body, '\s+', ' ', 'g'), 200)
  from unnest(valid) as u
  on conflict do nothing;
  return null;
end $$;

create trigger comments_mentions after insert or update of mentions on public.comments
  for each row execute function app.record_mentions();
create trigger chat_messages_mentions after insert or update of mentions on public.chat_messages
  for each row execute function app.record_mentions();

-- ─── realtime ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['wedding_role_permissions', 'comments', 'chat_categories', 'chat_channels',
                             'chat_messages', 'chat_reads', 'mentions'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

revoke all on public.wedding_role_permissions, public.comments, public.chat_categories, public.chat_channels,
  public.chat_messages, public.chat_reads, public.mentions from anon;
