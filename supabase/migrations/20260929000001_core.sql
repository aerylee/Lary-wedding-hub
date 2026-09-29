-- Core tenancy: profiles, weddings, memberships, roles → permissions, invitations.
-- Auth spec §4.1.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;
grant usage on schema app to authenticated;

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null default '',
  avatar_url    text not null default '',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── weddings ────────────────────────────────────────────────────────────────
create table public.weddings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- ─── roles & memberships ─────────────────────────────────────────────────────
create type public.app_role as enum ('owner', 'planner', 'collaborator', 'viewer');
create type public.membership_status as enum ('active', 'suspended');

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  status      public.membership_status not null default 'active',
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (wedding_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_wedding_idx on public.memberships (wedding_id);

create table public.role_permissions (
  role        public.app_role not null,
  permission  text not null,
  primary key (role, permission)
);

-- The matrix from auth spec §3. Policies check permissions, never role names.
insert into public.role_permissions (role, permission)
select r.role::public.app_role, m.permission
from (values
  -- permission            owner planner collab viewer
  ('settings:read',        true, true,  true,  true),
  ('settings:write',       true, true,  false, false),
  ('venues:read',          true, true,  true,  true),
  ('venues:write',         true, true,  true,  false),
  ('tasks:read',           true, true,  true,  true),
  ('tasks:write',          true, true,  true,  false),
  ('legal:read',           true, true,  true,  true),
  ('legal:write',          true, true,  true,  false),
  ('decisions:read',       true, true,  true,  true),
  ('decisions:write',      true, true,  true,  false),
  ('guests:read',          true, true,  true,  true),
  ('guests:write',         true, true,  true,  false),
  ('guests:contact',       true, true,  true,  false),
  ('travel:read',          true, true,  true,  true),
  ('travel:write',         true, true,  true,  false),
  ('seating:read',         true, true,  true,  true),
  ('seating:write',        true, true,  true,  false),
  ('schedule:read',        true, true,  true,  true),
  ('schedule:write',       true, true,  true,  false),
  ('comms:read',           true, true,  true,  true),
  ('comms:write',          true, true,  true,  false),
  ('vendors:read',         true, true,  true,  true),
  ('vendors:write',        true, true,  false, false),
  ('finance:read',         true, true,  false, false),
  ('finance:write',        true, true,  false, false),
  ('files:read',           true, true,  true,  true),
  ('files:write',          true, true,  true,  false),
  ('assistant:use',        true, true,  true,  false),
  ('assistant:apply',      true, true,  false, false),
  ('members:manage',       true, false, false, false),
  ('wedding:delete',       true, false, false, false)
) as m(permission, owner, planner, collaborator, viewer)
cross join lateral (values
  ('owner', m.owner), ('planner', m.planner),
  ('collaborator', m.collaborator), ('viewer', m.viewer)
) as r(role, granted)
where r.granted;

-- ─── invitations ─────────────────────────────────────────────────────────────
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  email       extensions.citext not null,
  role        public.app_role not null,
  invited_by  uuid not null references public.profiles(id) on delete cascade,
  token       uuid not null default gen_random_uuid() unique,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index invitations_pending_uidx on public.invitations (wedding_id, email) where accepted_at is null;
create index invitations_email_idx on public.invitations (email) where accepted_at is null;
