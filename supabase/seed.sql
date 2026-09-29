-- Local development data: one wedding with one user per role, plus an outsider who owns a
-- second wedding (for cross-tenant checks). Sign in locally with any of these addresses —
-- the magic link lands in Inbucket/Mailpit at http://127.0.0.1:54324.
--
--   owner@example.test         owner        ("Rylee & Laurel")
--   planner@example.test       planner
--   collaborator@example.test  collaborator — the Budget tab disappears
--   viewer@example.test        viewer       — read-only banner, no money
--   outsider@example.test      owner of a different wedding; sees none of the above

do $$
declare
  users constant jsonb := '[
    {"id":"00000000-0000-4000-8000-00000000000a","email":"owner@example.test",        "name":"Rylee"},
    {"id":"00000000-0000-4000-8000-00000000000b","email":"planner@example.test",      "name":"Paola (planner)"},
    {"id":"00000000-0000-4000-8000-00000000000c","email":"collaborator@example.test", "name":"Aunt Jo"},
    {"id":"00000000-0000-4000-8000-00000000000d","email":"viewer@example.test",       "name":"Grandpa Ed"},
    {"id":"00000000-0000-4000-8000-00000000000e","email":"outsider@example.test",     "name":"Sam Outsider"}
  ]';
  u jsonb;
  full_auth boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'aud'
  );
  w uuid;
  w2 uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid;
  primary_event uuid;
begin
  for u in select * from jsonb_array_elements(users) loop
    if full_auth then
      -- a real Supabase auth.users row (local stack)
      execute $q$
        insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change, email_change_token_new)
        values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '',
          now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', $3),
          now(), now(), '', '', '', '')
        on conflict (id) do nothing
      $q$ using (u ->> 'id')::uuid, u ->> 'email', u ->> 'name';
      execute $q$
        insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
        values (gen_random_uuid(), $1, $1::text, jsonb_build_object('sub', $1::text, 'email', $2), 'email', now(), now(), now())
        on conflict do nothing
      $q$ using (u ->> 'id')::uuid, u ->> 'email';
    else
      insert into auth.users (id, email, raw_user_meta_data)
      values ((u ->> 'id')::uuid, u ->> 'email', jsonb_build_object('full_name', u ->> 'name'))
      on conflict (id) do nothing;
    end if;
  end loop;

  -- act as the owner so create_wedding() and the audit triggers see a real user
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  w := public.create_wedding('Rylee & Laurel', (current_date + 420), 'Rylee', 'Laurel');

  insert into public.memberships (wedding_id, user_id, role, invited_by) values
    (w, '00000000-0000-4000-8000-00000000000b', 'planner',      '00000000-0000-4000-8000-00000000000a'),
    (w, '00000000-0000-4000-8000-00000000000c', 'collaborator', '00000000-0000-4000-8000-00000000000a'),
    (w, '00000000-0000-4000-8000-00000000000d', 'viewer',       '00000000-0000-4000-8000-00000000000a');

  -- a little real data so every module has something to show
  insert into public.venues (wedding_id, name, status, country, region, town, nearest_airport, airport_mins,
    capacity_seated, beds_on_site, catering_model, curfew, rain_plan, exclusivity, quote_eur, quote_is_estimate,
    scores, pros, cons, legal_note)
  values
    (w, 'Villa Cariola', 'quoted', 'Italy', 'Lake Garda', 'Cariola', 'Verona (VRN)', 55, 90, 24,
     'In-house', 'Midnight outdoors', 'Covered limonaia for 100', 'Exclusive use, 3 nights', 16500, false,
     '{"cost":3,"capacity":5,"lodging":4,"legal":5,"travel":4,"weather":4,"flexibility":3,"feel":5}',
     '{"Lake views","Beds for the family on site"}', '{"In-house catering only"}',
     'Civil ceremony possible at the town hall, 10 minutes away.'),
    (w, 'Mas des Oliviers', 'shortlist', 'France', 'Provence', 'Saint-Rémy', 'Marseille (MRS)', 60, 120, 18,
     'External caterers allowed', '1 am', 'Marquee required (extra cost)', 'Exclusive use, 2 nights', 14000, true,
     '{"cost":4,"capacity":5,"lodging":3,"legal":1,"travel":3,"weather":4,"flexibility":5,"feel":4}',
     '{"Bring your own caterer"}', '{"Residency rule means a symbolic ceremony only"}',
     'France requires residency — legal ceremony would have to happen at home.');

  insert into public.guests (wedding_id, household, first_name, last_name, side, tier, relationship, meal, dietary)
  values (w, 'The Parkers', 'Anne', 'Parker', 'A', 'A', 'Mother', 'Fish', '') returning id into g1;
  insert into public.guests (wedding_id, household, first_name, last_name, side, tier, relationship, meal, dietary)
  values (w, 'The Parkers', 'Tom', 'Parker', 'A', 'A', 'Father', 'Beef', 'No shellfish') returning id into g2;
  insert into public.guests (wedding_id, household, first_name, last_name, side, tier, relationship, is_child)
  values (w, 'The Parkers', 'Milo', 'Parker', 'A', 'A', 'Nephew', true) returning id into g3;
  insert into public.guests (wedding_id, household, first_name, last_name, side, tier, relationship, dietary)
  values (w, 'Chen household', 'Laurel''s', 'Grandmother', 'B', 'A', 'Grandmother', 'Vegetarian') returning id into g4;

  insert into public.guest_contacts (wedding_id, guest_id, email, phone, address, country) values
    (w, g1, 'anne.parker@example.test', '+1 303 555 0101', E'1200 Larimer St\nDenver, CO 80202', 'United States'),
    (w, g4, '', '', E'14 Harbour Road\nLondon SW1A 1AA', 'United Kingdom');

  select id into primary_event from public.events where wedding_id = w and is_primary;
  insert into public.rsvps (wedding_id, guest_id, event_id, status, responded_at) values
    (w, g1, primary_event, 'yes', now()), (w, g2, primary_event, 'yes', now()),
    (w, g3, primary_event, 'maybe', now());

  insert into public.vendors (wedding_id, name, category, status, contact, email, country, language)
  values (w, 'Studio Luce', 'Photography', 'quoted', 'Giulia', 'giulia@studioluce.example', 'Italy', 'Italian, English');
  insert into public.vendor_finance (wedding_id, vendor_id, quote_eur, deposit_eur, deposit_due)
  select w, id, 4600, 1380, current_date + 30 from public.vendors where wedding_id = w and name = 'Studio Luce';

  insert into public.payments (wedding_id, label, amount, currency, due_date, method)
  values (w, 'Venue deposit (30%)', 4950, 'EUR', current_date + 21, 'Bank transfer');

  -- the outsider's own wedding, for cross-tenant tests
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
  w2 := public.create_wedding('Sam & Alex', (current_date + 300), 'Sam', 'Alex');

  perform set_config('request.jwt.claims', '', true);
  raise notice 'seeded weddings % and %', w, w2;
end $$;
