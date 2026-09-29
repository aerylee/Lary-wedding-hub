-- seed_wedding(w): a competent planner's first draft for every new wedding (main spec §13).
-- Every figure is a benchmark — the app footer says so. Called by create_wedding() in the
-- same transaction, so a wedding is never "seeded once, empty forever".
--
-- Leaves empty on purpose: venues, guests, payments, vendors, seat tables, correspondence.

create or replace function public.seed_wedding(w uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d        date;
  c        record;
  cats     jsonb := '{}'::jsonb;
  e_welcome uuid; e_wedding uuid; e_brunch uuid;
begin
  select target_date into d from public.wedding_settings where wedding_id = w;
  if d is null then raise exception 'wedding % has no settings row', w; end if;

  -- ─── timeline: 52 tasks, offset in days before the wedding ────────────────
  insert into public.tasks (wedding_id, title, phase, offset_days, category, owner, critical, note)
  select w, v.title, v.phase, v.off, v.cat, v.owner, v.crit, v.note from (values
    ('Agree the budget ceiling and who is contributing',          '18–24 months', 700, 'Budget',   'Couple',  true,  'Write down who is paying for what now — it avoids awkward conversations later.'),
    ('Draft the A-list and B-list headcount',                     '18–24 months', 690, 'Guests',   'Couple',  false, 'The B-list only goes out if A-list guests decline.'),
    ('Shortlist destination countries',                           '18–24 months', 680, 'Venue',    'Couple',  true,  ''),
    ('Research marriage law in each candidate country',          '18–24 months', 670, 'Legal',    'Couple',  true,  'Some countries let two foreign nationals marry civilly; some require residency. This decides a lot.'),
    ('Shortlist 5–8 venues and request brochures and prices',    '18–24 months', 650, 'Venue',    'Planner', false, 'Ask for: exclusivity, curfew, rain plan, catering model, beds on site, minimum spend.'),
    ('Set up the planning hub and invite the team',              '18–24 months', 640, 'Admin',    'Couple',  false, ''),
    ('Decide whether to hire a local planner',                   '18–24 months', 620, 'Vendors',  'Couple',  false, ''),
    ('Visit the shortlisted venues',                             '12–18 months', 520, 'Venue',    'Couple',  false, 'Visit in the same season as the wedding if you can — light, heat and crowds all change.'),
    ('Score the venues and choose one',                          '12–18 months', 480, 'Venue',    'Couple',  true,  ''),
    ('Sign the venue contract and pay the deposit',              '12–18 months', 450, 'Venue',    'Couple',  true,  'A hold is a courtesy, not a booking.'),
    ('Fix the date with the venue and mark it firm',             '12–18 months', 450, 'Admin',    'Couple',  true,  ''),
    ('Book the photographer',                                    '12–18 months', 420, 'Vendors',  'Couple',  false, 'Good destination photographers book 12–18 months out.'),
    ('Book the officiant or celebrant',                          '12–18 months', 400, 'Vendors',  'Planner', false, ''),
    ('Send save the dates',                                      '12–18 months', 380, 'Comms',    'Couple',  true,  'Destination guests need 9–12 months to book leave and flights.'),
    ('Build the wedding website with travel information',        '12–18 months', 370, 'Comms',    'Couple',  false, ''),
    ('Reserve room blocks near the venue',                       '12–18 months', 365, 'Travel',   'Planner', false, 'Note every release date — unclaimed rooms go back to the hotel.'),
    ('Book the caterer (or confirm the venue menu)',             '9–12 months',  330, 'Vendors',  'Planner', false, ''),
    ('Book the band or DJ',                                      '9–12 months',  320, 'Vendors',  'Couple',  false, 'Check the venue curfew and any amplified-music limits first.'),
    ('Book the videographer',                                    '9–12 months',  310, 'Vendors',  'Couple',  false, ''),
    ('Book the florist and agree the design brief',              '9–12 months',  300, 'Vendors',  'Planner', false, ''),
    ('Order wedding attire',                                     '9–12 months',  290, 'Attire',   'Couple',  false, 'Allow 6–8 months for made-to-order plus alterations.'),
    ('Get guest shuttle quotes',                                 '9–12 months',  280, 'Travel',   'Planner', false, ''),
    ('Buy travel insurance that covers the wedding trip',        '9–12 months',  270, 'Admin',    'Couple',  false, ''),
    ('Order recent certified birth certificates',                '6–9 months',   240, 'Legal',    'Couple',  true,  'Many countries want certificates issued within the last 6 months — do not order too early.'),
    ('Book the civil ceremony slot with the town hall',          '6–9 months',   220, 'Legal',    'Planner', true,  ''),
    ('Plan the welcome dinner and farewell brunch',              '6–9 months',   210, 'Events',   'Planner', false, ''),
    ('Book hair and make-up, with a trial',                      '6–9 months',   200, 'Attire',   'Couple',  false, ''),
    ('Book musicians for the ceremony',                          '6–9 months',   195, 'Vendors',  'Planner', false, ''),
    ('Hire lighting and furniture',                              '6–9 months',   185, 'Vendors',  'Planner', false, ''),
    ('Book your own flights and pre-wedding accommodation',      '6–9 months',   180, 'Travel',   'Couple',  false, ''),
    ('Send invitations with the RSVP-by date',                   '4–6 months',   150, 'Comms',    'Couple',  true,  ''),
    ('Order the cake or dessert table',                          '4–6 months',   140, 'Vendors',  'Planner', false, ''),
    ('Apostille the birth certificates',                         '4–6 months',   135, 'Legal',    'Couple',  true,  'Issued by the Secretary of State of the state that issued the certificate.'),
    ('Arrange sworn translations',                               '4–6 months',   125, 'Legal',    'Planner', true,  'Translate after the apostille, and translate the apostille too.'),
    ('Buy wedding rings',                                        '4–6 months',   120, 'Attire',   'Couple',  false, ''),
    ('Hold the menu tasting and fix the menu',                   '2–4 months',   100, 'Vendors',  'Couple',  false, ''),
    ('Obtain sworn statements and consular declarations',        '2–4 months',    90, 'Legal',    'Couple',  true,  'Consular appointments can take weeks to get.'),
    ('Draft the run of show for all three days',                 '2–4 months',    90, 'Events',   'Planner', false, ''),
    ('Chase outstanding RSVPs',                                  '2–4 months',    75, 'Guests',   'Couple',  true,  ''),
    ('Write vows and choose readings',                           '2–4 months',    70, 'Ceremony', 'Couple',  false, ''),
    ('Assign rooms to guests',                                   '2–4 months',    65, 'Travel',   'Planner', false, ''),
    ('Confirm the final headcount with the caterer',             '2–4 months',    60, 'Vendors',  'Planner', true,  ''),
    ('Finish the seating plan',                                  '1–2 months',    45, 'Guests',   'Couple',  false, ''),
    ('Collect arrival flights for shuttle planning',             '1–2 months',    45, 'Travel',   'Planner', false, ''),
    ('Final attire fitting',                                     '1–2 months',    40, 'Attire',   'Couple',  false, ''),
    ('Send vendor call-time sheets',                             '1–2 months',    35, 'Vendors',  'Planner', false, ''),
    ('Pay balances due before the wedding',                      '1–2 months',    30, 'Budget',   'Couple',  true,  ''),
    ('Deliver documents to the town hall',                       'Final month',   21, 'Legal',    'Planner', true,  ''),
    ('Confirm every vendor''s arrival time and on-the-day contact','Final month', 10, 'Vendors',  'Planner', false, ''),
    ('Pack the wedding-day emergency kit',                       'Final month',    5, 'Admin',    'Couple',  false, ''),
    ('Prepare envelopes with vendor tips',                       'Final month',    3, 'Budget',   'Couple',  false, ''),
    ('Hand the run of show to the day-of coordinator',           'Final month',    2, 'Events',   'Couple',  false, '')
  ) as v(title, phase, off, cat, owner, crit, note);

  -- ─── budget: 12 categories, 20 lines ──────────────────────────────────────
  for c in
    insert into public.budget_categories (wedding_id, name, sort_order)
    select w, v.name, v.ord from (values
      ('Venue & ceremony', 1), ('Food & catering', 2), ('Drinks & bar', 3), ('Accommodation', 4),
      ('Photography & film', 5), ('Music & entertainment', 6), ('Flowers & décor', 7),
      ('Attire & beauty', 8), ('Stationery & website', 9), ('Legal & admin', 10),
      ('Transport', 11), ('Contingency', 12)
    ) as v(name, ord)
    returning id, name
  loop
    cats := cats || jsonb_build_object(c.name, c.id);
  end loop;

  insert into public.budget_lines (wedding_id, category_id, label, estimate_eur, currency, per_guest, funded_by, note)
  select w, (cats ->> v.cat)::uuid, v.label, v.est, v.cur::public.currency_code, v.pg, v.funder, v.note from (values
    ('Venue & ceremony',      'Venue hire — exclusive use, 3 nights',         16000, 'EUR', false, 'Couple', 'Typical for an exclusive-use villa in shoulder season.'),
    ('Venue & ceremony',      'Officiant / celebrant',                          900, 'EUR', false, 'Couple', ''),
    ('Food & catering',       'Wedding dinner — aperitivo and 4 courses',        95, 'EUR', true,  'Couple', 'Per head.'),
    ('Food & catering',       'Welcome dinner',                                  55, 'EUR', true,  'Family', 'Per head.'),
    ('Food & catering',       'Farewell brunch',                                 30, 'EUR', true,  'Couple', 'Per head.'),
    ('Food & catering',       'Wedding cake',                                   650, 'EUR', false, 'Couple', ''),
    ('Drinks & bar',          'Wine, prosecco and open bar',                     45, 'EUR', true,  'Couple', 'Per head, 5 hours.'),
    ('Accommodation',         'Couple''s suite and rooms not covered by guests',3200, 'EUR', false, 'Couple', ''),
    ('Photography & film',    'Photographer — two days',                       4800, 'EUR', false, 'Couple', ''),
    ('Photography & film',    'Videographer',                                  3200, 'EUR', false, 'Couple', ''),
    ('Music & entertainment', 'Ceremony musicians',                            1200, 'EUR', false, 'Couple', ''),
    ('Music & entertainment', 'Band or DJ for the reception',                  3500, 'EUR', false, 'Couple', 'Check the curfew before paying for extra hours.'),
    ('Flowers & décor',       'Ceremony and table flowers',                    5500, 'EUR', false, 'Couple', ''),
    ('Flowers & décor',       'Lighting and furniture hire',                   2200, 'EUR', false, 'Couple', ''),
    ('Attire & beauty',       'Wedding attire and alterations',                4500, 'USD', false, 'Couple', 'Bought at home, in dollars.'),
    ('Attire & beauty',       'Hair and make-up on the day',                    900, 'EUR', false, 'Couple', ''),
    ('Stationery & website',  'Save the dates, invitations and postage',        850, 'USD', false, 'Couple', 'International postage adds up.'),
    ('Legal & admin',         'Documents, apostilles and sworn translations',   750, 'EUR', false, 'Couple', ''),
    ('Transport',             'Guest shuttles — airport and wedding day',        18, 'EUR', true,  'Couple', 'Per head.'),
    ('Contingency',           'Contingency (about 8%)',                        5000, 'EUR', false, 'Couple', 'Keep it. Something always comes up.')
  ) as v(cat, label, est, cur, pg, funder, note);

  -- ─── events: the weekend ──────────────────────────────────────────────────
  insert into public.events (wedding_id, name, date, start_time, location, dress, invited_tier, note, sort_order, is_primary)
  values (w, 'Welcome dinner', d - 1, '19:30', 'Venue terrace', 'Summer smart', 'all', 'Relaxed — everyone arriving.', 1, false)
  returning id into e_welcome;
  insert into public.events (wedding_id, name, date, start_time, location, dress, invited_tier, note, sort_order, is_primary)
  values (w, 'Ceremony & reception', d, '16:00', 'Venue gardens', 'Formal — black tie optional', 'all', '', 2, true)
  returning id into e_wedding;
  insert into public.events (wedding_id, name, date, start_time, location, dress, invited_tier, note, sort_order, is_primary)
  values (w, 'Farewell brunch', d + 1, '11:00', 'Venue courtyard', 'Casual', 'all', 'Drop in any time before the shuttles.', 3, false)
  returning id into e_brunch;

  -- ─── run of show: 31 items across the three days ──────────────────────────
  insert into public.schedule_items (wedding_id, event_id, time, duration_mins, title, detail, owner, location, kind)
  select w, v.ev, v.t::time, v.dur, v.title, v.detail, v.owner, v.loc, v.kind::public.schedule_kind from (values
    (e_welcome, '14:00',  60, 'Couple arrive and check in',              '',                                         'Couple',  'Reception',       'logistics'),
    (e_welcome, '15:00',  60, 'Walkthrough with the venue manager',      'Rain plan, power points, vendor access.',  'Planner', 'Whole venue',     'logistics'),
    (e_welcome, '17:30',  30, 'Welcome bags delivered to rooms',         '',                                         'Planner', 'Guest rooms',     'logistics'),
    (e_welcome, '18:30',  60, 'Caterer arrives to set up',               'Service entrance.',                        '',        'Terrace',         'vendor'),
    (e_welcome, '19:30',  60, 'Welcome drinks',                          '',                                         '',        'Terrace',         'food'),
    (e_welcome, '20:30',  90, 'Welcome dinner served',                   'Family style.',                            '',        'Terrace',         'food'),
    (e_welcome, '21:00',  10, 'Welcome toast',                           '',                                         '',        'Terrace',         'moment'),
    (e_welcome, '22:30',  30, 'Shuttle back to hotels',                  '',                                         'Planner', 'Front gate',      'logistics'),
    (e_wedding, '08:00', 180, 'Florist arrives — ceremony install',      'Arch, aisle, then tables.',                '',        'Gardens',         'vendor'),
    (e_wedding, '09:00', 240, 'Hair and make-up',                        '',                                         '',        'Bridal suite',    'vendor'),
    (e_wedding, '10:00', 120, 'Lighting and furniture delivery',         '',                                         '',        'Terrace',         'vendor'),
    (e_wedding, '11:00', 180, 'Photographer — getting ready',            '',                                         '',        'Suites',          'photo'),
    (e_wedding, '12:30',  45, 'Light lunch for the wedding party',       '',                                         '',        'Kitchen garden',  'food'),
    (e_wedding, '14:00',  30, 'Videographer arrives',                    '',                                         '',        'Gardens',         'vendor'),
    (e_wedding, '14:30',  45, 'Musicians arrive and sound check',        '',                                         '',        'Gardens',         'vendor'),
    (e_wedding, '15:00',  45, 'Guest shuttles leave the hotels',         '',                                         'Planner', 'Hotels',          'logistics'),
    (e_wedding, '15:30',  30, 'Guests seated — prelude music',           '',                                         '',        'Gardens',         'music'),
    (e_wedding, '16:00',  40, 'Ceremony',                                '',                                         '',        'Gardens',         'moment'),
    (e_wedding, '16:45',  45, 'Group photos',                            'Family list agreed in advance.',           '',        'Gardens',         'photo'),
    (e_wedding, '16:45',  75, 'Aperitivo and canapés',                   '',                                         '',        'Terrace',         'food'),
    (e_wedding, '18:00',  30, 'Couple portraits at golden hour',         '',                                         '',        'Olive grove',     'photo'),
    (e_wedding, '18:30',  15, 'Guests seated for dinner',                '',                                         'Planner', 'Terrace',         'logistics'),
    (e_wedding, '18:45', 150, 'Dinner — speeches between courses',       '',                                         '',        'Terrace',         'food'),
    (e_wedding, '21:30', 150, 'First dance, then the band',              '',                                         '',        'Terrace',         'music'),
    (e_wedding, '23:45',  15, 'Last dance and send-off',                 'Before the curfew.',                       '',        'Terrace',         'moment'),
    (e_brunch,  '10:00',  60, 'Caterer sets up brunch',                  '',                                         '',        'Courtyard',       'vendor'),
    (e_brunch,  '11:00', 120, 'Farewell brunch',                         '',                                         '',        'Courtyard',       'food'),
    (e_brunch,  '11:30',  10, 'A thank-you from the couple',             '',                                         '',        'Courtyard',       'moment'),
    (e_brunch,  '13:00',  30, 'Luggage collection',                      '',                                         'Planner', 'Front gate',      'logistics'),
    (e_brunch,  '13:30',  90, 'Airport shuttle — first run',             '',                                         'Planner', 'Front gate',      'logistics'),
    (e_brunch,  '15:30',  90, 'Airport shuttle — second run',            '',                                         'Planner', 'Front gate',      'logistics')
  ) as v(ev, t, dur, title, detail, owner, loc, kind);

  -- ─── legal: 13 documents ──────────────────────────────────────────────────
  insert into public.legal_docs (wedding_id, country, title, who, issued_by, needs_apostille, needs_translation, validity_days, lead_time, note)
  select w, v.* from (values
    ('Both',   'Valid passport',                                   'Each of you',        'Passport office',                              false, false, null::int, '6–10 weeks', 'Must stay valid at least 3 months beyond your return date.'),
    ('Both',   'Certified long-form birth certificate',            'Each of you',        'Vital records office of the birth state',       true,  true,  180,       '2–6 weeks',  'Most countries want one issued within the last 6 months.'),
    ('Both',   'Apostille on the birth certificate',               'Each of you',        'Secretary of State of the issuing state',       false, false, null,      '1–4 weeks',  ''),
    ('Both',   'Divorce decree or death certificate (if previously married)', 'Whoever it applies to', 'Court or vital records office', true, true, 180, '2–6 weeks', 'Mark as N/A if neither of you has been married before.'),
    ('Italy',  'Sworn statement (Dichiarazione Giurata)',          'Each of you',        'Your consulate in Italy',                       false, false, 180,       '2–6 weeks for an appointment', 'Sworn in person, in Italy.'),
    ('Italy',  'Atto Notorio (with two witnesses)',                'Each of you',        'Italian consulate at home, or an Italian court',false, false, 180,       '3–8 weeks',  'Witnesses must bring ID.'),
    ('Italy',  'Nulla Osta legalised at the Prefettura',           'Each of you',        'Prefettura — Ufficio Legalizzazioni',            false, false, 180,       '1–3 days',   'Done after the sworn statement, in the same region as the wedding.'),
    ('Italy',  'Declaration of intent to marry',                   'Both of you',        'Ufficiale di Stato Civile (town hall)',          false, false, null,      'Book 2–3 months ahead', 'Usually 1–3 days before the ceremony; an interpreter is needed if you don''t speak Italian.'),
    ('Italy',  'Revenue stamps (marche da bollo)',                 'Both of you',        'Any tabaccheria',                               false, false, null,      'Same day',   ''),
    ('France', 'Certificat de coutume',                            'Each of you',        'A lawyer licensed in both jurisdictions',        false, false, 90,         '2–4 weeks',  'Must be under 3 months old when the file is submitted.'),
    ('France', 'Certificat de célibat',                            'Each of you',        'Your embassy, or a lawyer',                      false, true,  90,         '2–4 weeks',  'Must be under 3 months old.'),
    ('France', 'Proof of residence in the commune',                'One of you',         'Mairie of the commune',                          false, false, null,      '40 days’ residence', 'One of you must live in the commune for about 40 days before the ceremony. For most couples this rules out a civil ceremony in France.'),
    ('France', 'Publication of the banns',                         'Both of you',        'Mairie of the commune',                          false, false, null,      '10 days',    'Posted at the town hall at least 10 days before the ceremony.')
  ) as v;

  -- ─── rooms: 3 blocks ──────────────────────────────────────────────────────
  insert into public.rooms (wedding_id, property, name, type, beds, nightly_eur, nights, held_until, status, note)
  values
    (w, 'Venue',                   'On-site rooms',          'Mixed doubles & twins', 24, null, 3, null,     'held', 'Included in exclusive use — family and wedding party first.'),
    (w, 'Hotel in town',           'Hotel block',            'Double',                30, 165,  3, d - 90,  'held', 'Unclaimed rooms are released on the date above.'),
    (w, 'Agriturismo nearby',      'Farm-stay family rooms', 'Family (3–4 beds)',     16, 130,  3, d - 120, 'held', '');

  -- ─── templates: 8 ─────────────────────────────────────────────────────────
  insert into public.templates (wedding_id, name, audience, channel, subject, body, sort_order)
  values
    (w, 'Save the date', 'guest', 'email', 'Save the date — {couple}',
     E'Dear {household},\n\nWe''re getting married! Please save the date: {date} at {venue}.\n\nIt''s a destination weekend, so we''re telling you early. Travel details and room blocks are on our website: {website}\n\nFormal invitation to follow.\n\nWith love,\n{couple}', 1),
    (w, 'Invitation', 'guest', 'email', 'You''re invited — {couple}, {date}',
     E'Dear {household},\n\nWe''d love you to join us for our wedding weekend at {venue}, with the ceremony on {date}.\n\nPlease RSVP by {rsvpBy} for each event you can attend — details, dress codes and travel tips are at {website}.\n\n{couple}', 2),
    (w, 'RSVP reminder', 'guest', 'email', 'A gentle reminder — RSVP by {rsvpBy}',
     E'Hi {household},\n\nA quick nudge: we need final numbers by {rsvpBy} so we can confirm with the venue. You can reply to this email or use {website}.\n\nThank you!\n{couple}', 3),
    (w, 'Travel & accommodation', 'guest', 'email', 'Getting to {venue}',
     E'Hi {household},\n\nHere''s everything you need for the trip: flights, airport transfers and the room blocks we''ve held are on {website}. Room blocks are released on set dates, so book early.\n\nSee you on {date}!\n{couple}', 4),
    (w, 'Thank you', 'guest', 'email', 'Thank you',
     E'Dear {household},\n\nThank you for travelling so far to celebrate with us. It meant the world.\n\nWith love,\n{couple}', 5),
    (w, 'Initial enquiry', 'vendor', 'email', 'Wedding enquiry — {date}',
     E'Hello,\n\nWe''re planning our wedding for {date} at {venue}, with about {guests} guests. Are you available on that date? If so, could you share your packages, prices and what is included?\n\nMany thanks,\n{couple}', 6),
    (w, 'Request a quote or visit', 'vendor', 'email', 'Quote request — wedding on {date}',
     E'Hello,\n\nThank you for your reply. Could you send a detailed quote for {guests} guests, including VAT, travel costs, deposit terms and your cancellation policy? We''d also love to arrange a call or visit.\n\nBest,\n{couple}', 7),
    (w, 'Confirm final details', 'vendor', 'email', 'Final details for {date}',
     E'Hello,\n\nWe''re confirming final details for {date} at {venue}: final guest count {guests}. Your call time and on-the-day contact are on the attached schedule. Please confirm you''ve received it.\n\nThank you,\n{couple}', 8);

  -- ─── FAQs: 10 ─────────────────────────────────────────────────────────────
  insert into public.faqs (wedding_id, question, answer, sort_order, published)
  select w, v.q, v.a, v.o, true from (values
    ('When should I arrive?',                 'Aim to arrive the day before the wedding so you can join the welcome dinner. Most guests stay three nights.', 1),
    ('Where should I stay?',                  'We''ve held rooms at the venue and two places nearby. The blocks are released on set dates, so please book early.', 2),
    ('How do I get from the airport?',        'We''re running shuttles from the nearest airport at set times. Tell us your flight and we''ll put you on one.', 3),
    ('What is the dress code?',               'Summer smart for the welcome dinner, formal for the wedding, and casual for the brunch. Comfortable shoes help on gravel and grass.', 4),
    ('Can I bring a plus-one?',               'Your invitation names everyone we''ve been able to invite. If you''re unsure, just ask us.', 5),
    ('Are children invited?',                 'Children named on your invitation are very welcome.', 6),
    ('What will the weather be like?',        'Warm days and cooler evenings. Bring a layer for after dark.', 7),
    ('Do I need a visa?',                     'Check that your passport is valid for at least three months after you travel home, and check the entry rules for your nationality.', 8),
    ('Is there a gift registry?',             'Your being there is the gift. If you''d like to give something, there''s a honeymoon fund on our website.', 9),
    ('When do I need to RSVP by?',            'Please RSVP by the date on your invitation, for each event you can attend.', 10)
  ) as v(q, a, o);

  -- ─── decisions: 7 open questions ──────────────────────────────────────────
  insert into public.decisions (wedding_id, title, area, status, decide_by, alternatives, impact)
  select w, v.t, v.area, 'open', d - v.off, v.alts, v.impact from (values
    ('Which country do we marry in?',                               'Venue',   560, '{Italy,France}'::text[],                               'Decides the legal path, the documents and the vendor market.'),
    ('Do we marry legally abroad, or at home with a symbolic ceremony abroad?', 'Legal', 540, '{"Legal ceremony abroad","Civil at home + symbolic abroad"}'::text[], 'Changes the document list and how early paperwork starts.'),
    ('Which venue?',                                                'Venue',   420, '{}'::text[],                                             'Fixes the date, capacity, beds on site and the catering model.'),
    ('Do we invite the A-list only, or A and B lists?',             'Guests',  400, '{"A-list only","A + B"}'::text[],                          'Every guest adds catering, drinks and shuttle costs.'),
    ('Do we hire a local planner?',                                 'Vendors', 600, '{"Full planner","Day-of coordinator only","No planner"}'::text[], 'Budget versus stress and language barriers.'),
    ('Are children invited?',                                       'Guests',  380, '{"All children","Family only","Adults only"}'::text[],    'Affects headcount, rooms and the evening schedule.'),
    ('Do we pay for guest shuttles?',                               'Travel',  300, '{"We pay","Guests pay","Shared"}'::text[],                'About €18 a head, but it ends the "how do I get there" question.')
  ) as v(t, area, off, alts, impact);
end $$;

revoke all on function public.seed_wedding(uuid) from public, anon, authenticated;
