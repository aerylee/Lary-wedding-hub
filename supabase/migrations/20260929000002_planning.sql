-- Planning tables. Main spec §4, auth spec §4.2.
--
-- Conventions:
--   * every table has wedding_id → weddings on delete cascade, and an index leading with it;
--   * every parent table has unique (wedding_id, id) so children can use composite foreign
--     keys — a row can never point at a row belonging to another wedding;
--   * audit columns (created_at/updated_at/created_by/updated_by) are maintained by triggers
--     in the next migration.

-- ─── enums ───────────────────────────────────────────────────────────────────
create type public.venue_status    as enum ('shortlist','visiting','quoted','held','booked','passed');
create type public.task_status     as enum ('todo','doing','done','na');
create type public.vendor_status   as enum ('researching','contacted','quoted','booked','deposit_paid','complete','passed');
create type public.legal_status    as enum ('not_started','in_progress','obtained','expired','na');
create type public.decision_status as enum ('open','decided','parked');
create type public.rsvp_status     as enum ('pending','yes','no','maybe');
create type public.room_status     as enum ('held','confirmed','released');
create type public.table_shape     as enum ('round','long','head');
create type public.schedule_kind   as enum ('moment','vendor','logistics','food','music','photo');
create type public.guest_side      as enum ('A','B','both');
create type public.guest_tier      as enum ('A','B');
create type public.currency_code   as enum ('EUR','USD');
create type public.invited_tier    as enum ('A','all');
create type public.comm_direction  as enum ('sent','received');
create type public.template_audience as enum ('guest','vendor');
create type public.fx_source       as enum ('auto','manual');

-- ─── settings ────────────────────────────────────────────────────────────────
create table public.wedding_settings (
  wedding_id          uuid primary key references public.weddings(id) on delete cascade,
  couple_a            text not null default '',
  couple_b            text not null default '',
  target_date         date not null default (current_date + 540),
  date_is_firm        boolean not null default false,
  fx_eur_usd          numeric(10,4) not null default 1.08 check (fx_eur_usd > 0),
  fx_set_on           date not null default current_date,
  fx_source           public.fx_source not null default 'manual',
  guest_target        integer not null default 60 check (guest_target > 0),
  decide_venue_by     date,
  rsvp_by             date,
  website             text not null default '',
  candidate_countries text[] not null default '{Italy,France}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id) on delete set null,
  updated_by          uuid references public.profiles(id) on delete set null
);

-- The ceiling is money: it lives apart from the settings row so RLS can gate it on
-- finance:read (row-level security is row-level — auth spec §5.3).
create table public.budget_settings (
  wedding_id          uuid primary key references public.weddings(id) on delete cascade,
  budget_ceiling_usd  numeric(12,2) not null default 80000 check (budget_ceiling_usd >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id) on delete set null,
  updated_by          uuid references public.profiles(id) on delete set null
);

-- ─── venues ──────────────────────────────────────────────────────────────────
create table public.venues (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings(id) on delete cascade,
  name              text not null,
  status            public.venue_status not null default 'shortlist',
  country           text not null default '',
  region            text not null default '',
  town              text not null default '',
  url               text not null default '',
  nearest_airport   text not null default '',
  airport_mins      integer,
  capacity_seated   integer,
  beds_on_site      integer,
  catering_model    text not null default '',
  curfew            text not null default '',
  rain_plan         text not null default '',
  exclusivity       text not null default '',
  quote_eur         numeric(12,2),
  quote_is_estimate boolean not null default true,
  hold_expires      date,
  legal_note        text not null default '',
  scores            jsonb not null default '{}'::jsonb,
  pros              text[] not null default '{}',
  cons              text[] not null default '{}',
  notes             text not null default '',
  visit_date        date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index venues_wedding_idx on public.venues (wedding_id);

-- ─── tasks ───────────────────────────────────────────────────────────────────
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  title         text not null,
  phase         text not null default '',
  offset_days   integer not null default 0,
  due_override  date,
  owner         text not null default '',
  status        public.task_status not null default 'todo',
  category      text not null default '',
  note          text not null default '',
  critical      boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
create index tasks_wedding_idx on public.tasks (wedding_id);

-- ─── vendors (non-financial) ─────────────────────────────────────────────────
create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  name          text not null,
  category      text not null default '',
  status        public.vendor_status not null default 'researching',
  contact       text not null default '',
  email         text not null default '',
  phone         text not null default '',
  country       text not null default '',
  language      text not null default '',
  website       text not null default '',
  cancellation  text not null default '',
  notes         text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index vendors_wedding_idx on public.vendors (wedding_id);

-- Vendor money, gated on finance:read (auth spec §5.3).
create table public.vendor_finance (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  vendor_id     uuid not null,
  quote_eur     numeric(12,2),
  deposit_eur   numeric(12,2),
  deposit_due   date,
  balance_due   date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (vendor_id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete cascade
);
create index vendor_finance_wedding_idx on public.vendor_finance (wedding_id);

-- ─── budget ──────────────────────────────────────────────────────────────────
create table public.budget_categories (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index budget_categories_wedding_idx on public.budget_categories (wedding_id, sort_order);

create table public.budget_lines (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings(id) on delete cascade,
  category_id     uuid,
  label           text not null,
  vendor_id       uuid,
  estimate_eur    numeric(12,2) not null default 0,
  quoted_eur      numeric(12,2),
  contracted_eur  numeric(12,2),
  paid_eur        numeric(12,2) not null default 0,
  currency        public.currency_code not null default 'EUR',
  per_guest       boolean not null default false,
  funded_by       text not null default '',
  note            text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id),
  -- deleting a category must never hide money: the line survives, uncategorised
  foreign key (wedding_id, category_id) references public.budget_categories (wedding_id, id) on delete set null (category_id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id)
);
create index budget_lines_wedding_idx on public.budget_lines (wedding_id);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  label       text not null,
  line_id     uuid,
  vendor_id   uuid,
  amount      numeric(12,2) not null default 0,
  currency    public.currency_code not null default 'EUR',
  due_date    date,
  paid_date   date,
  method      text not null default '',
  note        text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  foreign key (wedding_id, line_id) references public.budget_lines (wedding_id, id) on delete set null (line_id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id)
);
create index payments_wedding_idx on public.payments (wedding_id, due_date);

-- ─── events ──────────────────────────────────────────────────────────────────
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  name          text not null,
  date          date,
  start_time    time,
  location      text not null default '',
  dress         text not null default '',
  invited_tier  public.invited_tier not null default 'all',
  note          text not null default '',
  sort_order    integer not null default 0,
  is_primary    boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index events_wedding_idx on public.events (wedding_id, sort_order);
-- exactly one primary event (the ceremony) per wedding
create unique index events_one_primary_uidx on public.events (wedding_id) where is_primary;

-- ─── rooms & seating tables (guests reference both) ─────────────────────────
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings(id) on delete cascade,
  property     text not null default '',
  name         text not null,
  type         text not null default '',
  beds         integer not null default 0,
  nightly_eur  numeric(12,2),
  nights       integer not null default 0,
  held_until   date,
  assigned_to  text not null default '',
  status       public.room_status not null default 'held',
  note         text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index rooms_wedding_idx on public.rooms (wedding_id);

create table public.seat_tables (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  name        text not null,
  shape       public.table_shape not null default 'round',
  seats       integer not null default 8 check (seats >= 0),
  x           numeric(5,2) not null default 50 check (x between 0 and 100),
  y           numeric(5,2) not null default 50 check (y between 0 and 100),
  note        text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id)
);
create index seat_tables_wedding_idx on public.seat_tables (wedding_id);

-- ─── guests ──────────────────────────────────────────────────────────────────
create table public.guests (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings(id) on delete cascade,
  household         text not null default '',
  first_name        text not null default '',
  last_name         text not null default '',
  side              public.guest_side not null default 'both',
  tier              public.guest_tier not null default 'A',
  relationship      text not null default '',
  is_child          boolean not null default false,
  plus_one_for      uuid,
  meal              text not null default '',
  dietary           text not null default '',
  room_id           uuid,
  table_id          uuid,
  arrival           date,
  departure         date,
  arrival_flight    text not null default '',
  departure_flight  text not null default '',
  needs_shuttle     boolean not null default false,
  invite_sent       date,
  notes             text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id),
  foreign key (wedding_id, plus_one_for) references public.guests (wedding_id, id) on delete set null (plus_one_for),
  foreign key (wedding_id, room_id) references public.rooms (wedding_id, id) on delete set null (room_id),
  foreign key (wedding_id, table_id) references public.seat_tables (wedding_id, id) on delete set null (table_id)
);
create index guests_wedding_idx on public.guests (wedding_id);

-- Contact details, gated on guests:contact (auth spec §5.3).
create table public.guest_contacts (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  guest_id    uuid not null,
  email       text not null default '',
  phone       text not null default '',
  address     text not null default '',
  country     text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (guest_id),
  foreign key (wedding_id, guest_id) references public.guests (wedding_id, id) on delete cascade
);
create index guest_contacts_wedding_idx on public.guest_contacts (wedding_id);

-- One RSVP per guest per event — a destination wedding is a weekend, not an evening.
create table public.rsvps (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  guest_id      uuid not null,
  event_id      uuid not null,
  status        public.rsvp_status not null default 'pending',
  responded_at  timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (guest_id, event_id),
  foreign key (wedding_id, guest_id) references public.guests (wedding_id, id) on delete cascade,
  foreign key (wedding_id, event_id) references public.events (wedding_id, id) on delete cascade
);
create index rsvps_wedding_idx on public.rsvps (wedding_id);

-- ─── legal ───────────────────────────────────────────────────────────────────
create table public.legal_docs (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references public.weddings(id) on delete cascade,
  country            text not null default 'Both',
  title              text not null,
  who                text not null default '',
  issued_by          text not null default '',
  needs_apostille    boolean not null default false,
  needs_translation  boolean not null default false,
  validity_days      integer,
  lead_time          text not null default '',
  status             public.legal_status not null default 'not_started',
  obtained_on        date,
  expires_on         date,
  note               text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
create index legal_docs_wedding_idx on public.legal_docs (wedding_id);

-- ─── decisions ───────────────────────────────────────────────────────────────
create table public.decisions (
  id             uuid primary key default gen_random_uuid(),
  wedding_id     uuid not null references public.weddings(id) on delete cascade,
  title          text not null,
  area           text not null default '',
  status         public.decision_status not null default 'open',
  decide_by      date,
  decided_on     date,
  decided_by     text not null default '',
  outcome        text not null default '',
  rationale      text not null default '',
  alternatives   text[] not null default '{}',
  impact         text not null default '',
  supersedes_id  uuid,
  created_on     date not null default current_date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id),
  foreign key (wedding_id, supersedes_id) references public.decisions (wedding_id, id) on delete set null (supersedes_id)
);
create index decisions_wedding_idx on public.decisions (wedding_id);

-- ─── run of show ─────────────────────────────────────────────────────────────
create table public.schedule_items (
  id             uuid primary key default gen_random_uuid(),
  wedding_id     uuid not null references public.weddings(id) on delete cascade,
  event_id       uuid not null,
  time           time,
  duration_mins  integer not null default 0 check (duration_mins >= 0),
  title          text not null,
  detail         text not null default '',
  owner          text not null default '',
  vendor_id      uuid,
  location       text not null default '',
  kind           public.schedule_kind not null default 'moment',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  foreign key (wedding_id, event_id) references public.events (wedding_id, id) on delete cascade,
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id)
);
create index schedule_items_wedding_idx on public.schedule_items (wedding_id, event_id);

-- ─── comms ───────────────────────────────────────────────────────────────────
create table public.comms_rows (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings(id) on delete cascade,
  household       text not null,
  save_the_date   date,
  invitation      date,
  reminder        date,
  thank_you       date,
  channel         text not null default '',
  note            text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
create index comms_rows_wedding_idx on public.comms_rows (wedding_id);

create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  name        text not null,
  audience    public.template_audience not null default 'guest',
  channel     text not null default 'email',
  subject     text not null default '',
  body        text not null default '',
  sort_order  integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
create index templates_wedding_idx on public.templates (wedding_id, sort_order);

create table public.correspondence (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings(id) on delete cascade,
  vendor_id     uuid,
  date          date not null default current_date,
  direction     public.comm_direction not null default 'sent',
  channel       text not null default 'email',
  subject       text not null default '',
  summary       text not null default '',
  follow_up_by  date,
  done          boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (wedding_id, id),
  foreign key (wedding_id, vendor_id) references public.vendors (wedding_id, id) on delete set null (vendor_id)
);
create index correspondence_wedding_idx on public.correspondence (wedding_id, date desc);

create table public.attachments (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references public.weddings(id) on delete cascade,
  correspondence_id  uuid not null,
  storage_path       text not null unique,
  name               text not null,
  size               bigint not null default 0 check (size <= 20 * 1024 * 1024),
  mime               text not null default 'application/octet-stream',
  uploaded_by        uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  -- the storage path's first segment is the tenant key; it must match the row's wedding
  check (split_part(storage_path, '/', 1) = wedding_id::text),
  foreign key (wedding_id, correspondence_id) references public.correspondence (wedding_id, id) on delete cascade
);
create index attachments_wedding_idx on public.attachments (wedding_id, correspondence_id);

create table public.faqs (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  question    text not null,
  answer      text not null default '',
  sort_order  integer not null default 0,
  published   boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
create index faqs_wedding_idx on public.faqs (wedding_id, sort_order);
