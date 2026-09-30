// Guests (main spec §7.6). Contact details live in guest_contacts and only load with
// guests:contact; exports honour that too — without it the file has no addresses in it.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Guest, Rsvp, RsvpStatus, WeddingEvent } from '@/lib/types';
import { eventInvitees, rsvpSummary } from '@/lib/derive';
import { cls, csvObjects, fmtDate, groupBy, guestName, matches, sortBy, uniq } from '@/lib/util';
import {
  Area, Button, Check, Empty, Field, Input, Modal, Panel, Pill, SearchInput, Segmented, Select, SectionTitle, Stat,
  StatGrid, TD, TH, TR, TWrap,
} from '@/components/kit';
import { Can, CanButton, whyNot } from '@/components/Gate';
import { useEditor } from '@/components/editor';
import { AddressEditor } from '@/components/AddressEditor';
import { IconChild, IconLeaf, IconPlus, IconUpload } from '@/components/icons';
import { useToast } from '@/components/toast';
import { CsvButton, Grid, Toolbar, usePlan } from './common';

type View = 'households' | 'table' | 'rsvp';
type Draft = Guest & { _email: string; _phone: string; _address: string; _country: string };

const RSVP_TONE = { yes: 'good', no: 'bad', maybe: 'warn', pending: 'muted' } as const;
const SIDE_LABEL = { A: 'Bride', B: 'Groom', both: 'Both' } as const;

const blank = (): Draft => ({
  id: crypto.randomUUID(), wedding_id: '', household: '', first_name: '', last_name: '', side: 'both', tier: 'A', relationship: '',
  is_child: false, plus_one_for: null, meal: '', dietary: '', room_id: null, table_id: null, arrival: null, departure: null,
  arrival_flight: '', departure_flight: '', needs_shuttle: false, invite_sent: null, notes: '',
  created_at: '', updated_at: '', created_by: null, updated_by: null, _email: '', _phone: '', _address: '', _country: '',
});

export default function Guests() {
  const { get, put, remove } = useStore();
  const { can } = useAuth();
  const { events, primary } = usePlan();
  const guests = get('guests');
  const contacts = get('guest_contacts');
  const rsvps = get('rsvps');
  const rooms = get('rooms');
  const tables = get('seat_tables');
  const [view, setView] = useState<View>('households');
  const [tier, setTier] = useState<'all' | 'A' | 'B'>('all');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const ed = useEditor<Draft>('guests', blank);
  const seeContacts = can('guests:contact');

  const contactBy = useMemo(() => new Map(contacts.map((c) => [c.guest_id, c])), [contacts]);
  const rsvpBy = useMemo(() => new Map(rsvps.map((r) => [`${r.guest_id}:${r.event_id}`, r])), [rsvps]);

  const filtered = useMemo(
    () =>
      sortBy(
        guests.filter((g) => (tier === 'all' || g.tier === tier) && matches(q, g.first_name, g.last_name, g.household, g.relationship, g.dietary, contactBy.get(g.id)?.email)),
        (g) => g.household || g.last_name,
        (g) => (g.is_child ? 1 : 0),
        (g) => g.first_name,
      ),
    [guests, tier, q, contactBy],
  );

  const primarySum = rsvpSummary(rsvps, guests, primary);
  const children = guests.filter((g) => g.is_child).length;
  const dietary = guests.filter((g) => g.dietary.trim()).length;

  function openGuest(g?: Guest) {
    if (!g) return ed.open();
    const c = contactBy.get(g.id);
    ed.open({ ...g, _email: c?.email ?? '', _phone: c?.phone ?? '', _address: c?.address ?? '', _country: c?.country ?? '' });
  }

  async function save() {
    const d = ed.draft;
    if (!d) return;
    if (!d.first_name.trim() && !d.last_name.trim()) return;
    const ok = await ed.save({ household: d.household.trim() || `${d.last_name || d.first_name} household` } as Partial<Draft>);
    if (!ok || !seeContacts) return;
    const existing = contactBy.get(d.id);
    const next = { email: d._email.trim(), phone: d._phone.trim(), address: d._address.trim(), country: d._country.trim() };
    const changed = existing ? (Object.keys(next) as (keyof typeof next)[]).some((k) => existing[k] !== next[k]) : Object.values(next).some(Boolean);
    if (changed) await put('guest_contacts', { ...(existing ?? {}), guest_id: d.id, ...next }).catch(() => undefined);
  }

  const setRsvp = (g: Guest, e: WeddingEvent, status: RsvpStatus) => {
    const existing = rsvpBy.get(`${g.id}:${e.id}`);
    return put('rsvps', { ...(existing ?? {}), guest_id: g.id, event_id: e.id, status, responded_at: status === 'pending' ? null : new Date().toISOString() }).catch(() => undefined);
  };

  const exportRows = () =>
    filtered.map((g) => {
      const c = contactBy.get(g.id);
      const row: Record<string, unknown> = {
        household: g.household, first_name: g.first_name, last_name: g.last_name, side: SIDE_LABEL[g.side], tier: g.tier,
        relationship: g.relationship, child: g.is_child ? 'yes' : '', meal: g.meal, dietary: g.dietary,
        arrival: g.arrival, arrival_flight: g.arrival_flight, departure: g.departure, departure_flight: g.departure_flight,
        shuttle: g.needs_shuttle ? 'yes' : '', invite_sent: g.invite_sent, notes: g.notes,
      };
      // no contact permission → the data never loaded, and the columns aren't even in the file
      if (seeContacts) Object.assign(row, { email: c?.email ?? '', phone: c?.phone ?? '', address: c?.address ?? '', country: c?.country ?? '' });
      for (const e of events) row[`rsvp: ${e.name}`] = eventInvitees([g], e).length ? rsvpBy.get(`${g.id}:${e.id}`)?.status ?? 'pending' : 'not invited';
      return row;
    });

  return (
    <div>
      <SectionTitle
        sub="One invitation goes to each household. The B list only goes out if A-list guests decline."
        actions={
          <>
            <CsvButton filename="guests.csv" rows={exportRows} disabled={!guests.length} />
            <CanButton perm="guests:write" size="sm" onClick={() => setImporting(true)}><IconUpload size={14} /> Import CSV</CanButton>
            <CanButton perm="guests:write" variant="primary" onClick={() => openGuest()}><IconPlus size={14} /> Add guest</CanButton>
          </>
        }
      >
        Guests
      </SectionTitle>

      <StatGrid>
        <Stat label="On the list" value={guests.length} sub={`${uniq(guests.map((g) => g.household)).length} households · ${guests.filter((g) => g.tier === 'B').length} on the B list`} />
        <Stat label={`Attending · ${primary?.name ?? 'main event'}`} value={primarySum.yes} sub={`${primarySum.maybe} maybe · ${primarySum.pending} pending · ${primarySum.no} declined`} tone="good" />
        <Stat label="Children" value={children} />
        <Stat label="Dietary notes" value={dietary} sub="recorded" />
      </StatGrid>

      <Toolbar>
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'households', label: 'By household' }, { value: 'table', label: 'Full table' }, { value: 'rsvp', label: 'RSVPs by event' }]} />
        <Segmented<'all' | 'A' | 'B'> size="sm" value={tier} onChange={setTier} options={[{ value: 'all', label: 'All' }, { value: 'A', label: 'A list' }, { value: 'B', label: 'B list' }]} />
        <div className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search guests…" /></div>
      </Toolbar>

      {guests.length === 0 ? (
        <Panel>
          <Empty
            title="No guests yet"
            body="Add people one at a time, or import a spreadsheet. Until then the budget runs on the planning headcount in Wedding settings."
            action={<div className="flex gap-2"><CanButton perm="guests:write" onClick={() => setImporting(true)}>Import CSV</CanButton><CanButton perm="guests:write" variant="primary" onClick={() => openGuest()}>Add a guest</CanButton></div>}
          />
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel><Empty title="Nobody matches" body="Try another search or tier." /></Panel>
      ) : view === 'households' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...groupBy(filtered, (g) => g.household || 'No household').entries()].map(([h, members]) => (
            <Panel key={h}>
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2 dark:border-stone-800">
                <h3 className="font-serif text-lg font-semibold">{h}</h3>
                <span className="text-xs text-stone-500">{members.length}</span>
              </div>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {members.map((g) => {
                  const r = primary ? rsvpBy.get(`${g.id}:${primary.id}`)?.status ?? 'pending' : null;
                  return (
                    <li key={g.id}>
                      <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800/50" onClick={() => openGuest(g)}>
                        <span className="min-w-0 flex-1 truncate">
                          {guestName(g)} {g.is_child && <IconChild size={13} className="inline text-stone-400" />} {g.dietary && <span title={g.dietary}><IconLeaf size={13} className="inline text-emerald-600" /></span>}
                          <span className="block text-xs text-stone-500">{[g.relationship, SIDE_LABEL[g.side], g.tier === 'B' ? 'B list' : ''].filter(Boolean).join(' · ')}</span>
                        </span>
                        {r && <Pill tone={RSVP_TONE[r]}>{r}</Pill>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      ) : view === 'table' ? (
        <Panel>
          <TWrap>
            <thead>
              <tr>
                <TH>Name</TH><TH>Household</TH><TH>Side</TH><TH>Tier</TH><TH>Relationship</TH><TH>Meal / diet</TH>
                {seeContacts && <TH>Email</TH>}<TH>Arrives</TH><TH>Invite sent</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <TR key={g.id} commentKey={g.id} onClick={() => openGuest(g)}>
                  <TD className="font-medium">{guestName(g)} {g.is_child && <Pill tone="muted">child</Pill>}</TD>
                  <TD>{g.household}</TD>
                  <TD>{SIDE_LABEL[g.side]}</TD>
                  <TD>{g.tier}</TD>
                  <TD>{g.relationship}</TD>
                  <TD>{[g.meal, g.dietary].filter(Boolean).join(' · ')}</TD>
                  {seeContacts && <TD className="text-stone-500">{contactBy.get(g.id)?.email}</TD>}
                  <TD>{fmtDate(g.arrival, { year: false })}{g.arrival_flight && <div className="text-xs text-stone-500">{g.arrival_flight}</div>}</TD>
                  <TD>{g.invite_sent ? fmtDate(g.invite_sent) : '—'}</TD>
                </TR>
              ))}
            </tbody>
          </TWrap>
        </Panel>
      ) : (
        <RsvpGrid guests={filtered} events={events} rsvpBy={rsvpBy} onSet={setRsvp} allGuests={guests} rsvps={rsvps} />
      )}

      <Modal
        open={!!ed.draft}
        wide
        title={ed.isNew ? 'Add guest' : guestName(ed.draft ?? { first_name: '', last_name: '' })}
        onClose={ed.close}
        footer={
          <>
            {!ed.isNew && <Button variant="danger" className="mr-auto" disabled={ed.readOnly} title={ed.readOnly ? whyNot('guests:write') : undefined} onClick={async () => {
              if (!ed.draft || !window.confirm(`Remove ${guestName(ed.draft)} from the list? Their RSVPs go too.`)) return;
              try { await remove('guests', ed.draft.id); ed.close(); } catch { /* toasted */ }
            }}>Delete</Button>}
            <Button variant="subtle" onClick={ed.close}>{ed.readOnly ? 'Close' : 'Cancel'}</Button>
            <Button variant="primary" disabled={ed.readOnly || ed.saving || !(ed.draft?.first_name.trim() || ed.draft?.last_name.trim())} title={ed.readOnly ? whyNot('guests:write') : undefined} onClick={save}>{ed.saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-4">
            <Grid cols={3}>
              <Field label="First name"><Input value={ed.draft.first_name} onChange={(e) => ed.set('first_name', e.target.value)} /></Field>
              <Field label="Last name"><Input value={ed.draft.last_name} onChange={(e) => ed.set('last_name', e.target.value)} /></Field>
              <Field label="Household" hint="Gets one invitation.">
                <Input list="households" value={ed.draft.household} onChange={(e) => ed.set('household', e.target.value)} />
                <datalist id="households">{uniq(guests.map((g) => g.household)).map((h) => <option key={h} value={h} />)}</datalist>
              </Field>
            </Grid>
            <Grid cols={4}>
              <Field label="Relationship"><Input value={ed.draft.relationship} onChange={(e) => ed.set('relationship', e.target.value)} /></Field>
              <Field label="Side">
                <Select value={ed.draft.side} onChange={(e) => ed.set('side', e.target.value as Guest['side'])}>
                  <option value="A">Bride</option><option value="B">Groom</option><option value="both">Both</option>
                </Select>
              </Field>
              <Field label="Tier">
                <Select value={ed.draft.tier} onChange={(e) => ed.set('tier', e.target.value as Guest['tier'])}>
                  <option value="A">A list</option><option value="B">B list</option>
                </Select>
              </Field>
              <Field label="Plus-one of">
                <Select value={ed.draft.plus_one_for ?? ''} onChange={(e) => ed.set('plus_one_for', e.target.value || null)}>
                  <option value="">—</option>
                  {sortBy(guests.filter((g) => g.id !== ed.draft!.id), guestName).map((g) => <option key={g.id} value={g.id}>{guestName(g)}</option>)}
                </Select>
              </Field>
            </Grid>
            <Check checked={ed.draft.is_child} onChange={(v) => ed.set('is_child', v)} label="Child" />

            <Can perm="guests:contact" fallback={<p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500 dark:bg-stone-950">Contact details are hidden for your role.</p>}>
              <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Contact</div>
                <Grid>
                  <Field label="Email"><Input type="email" value={ed.draft._email} onChange={(e) => ed.set('_email', e.target.value)} /></Field>
                  <Field label="Phone"><Input type="tel" value={ed.draft._phone} onChange={(e) => ed.set('_phone', e.target.value)} /></Field>
                </Grid>
                <div className="mt-3">
                  <AddressEditor value={ed.draft._address} country={ed.draft._country} disabled={ed.readOnly} onChange={(address, country) => ed.patch({ _address: address, _country: country })} />
                </div>
              </div>
            </Can>

            <Grid>
              <Field label="Meal choice"><Input value={ed.draft.meal} onChange={(e) => ed.set('meal', e.target.value)} placeholder="Fish" /></Field>
              <Field label="Dietary requirements"><Input value={ed.draft.dietary} onChange={(e) => ed.set('dietary', e.target.value)} placeholder="Vegetarian, no nuts" /></Field>
            </Grid>
            <Grid cols={4}>
              <Field label="Arrives"><Input type="date" value={ed.draft.arrival ?? ''} onChange={(e) => ed.set('arrival', e.target.value || null)} /></Field>
              <Field label="Arrival flight"><Input value={ed.draft.arrival_flight} onChange={(e) => ed.set('arrival_flight', e.target.value)} placeholder="BA 2590 VRN 10:35" /></Field>
              <Field label="Departs"><Input type="date" value={ed.draft.departure ?? ''} onChange={(e) => ed.set('departure', e.target.value || null)} /></Field>
              <Field label="Departure flight"><Input value={ed.draft.departure_flight} onChange={(e) => ed.set('departure_flight', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Room">
                <Select value={ed.draft.room_id ?? ''} onChange={(e) => ed.set('room_id', e.target.value || null)}>
                  <option value="">—</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.property} · {r.name}</option>)}
                </Select>
              </Field>
              <Field label="Table">
                <Select value={ed.draft.table_id ?? ''} onChange={(e) => ed.set('table_id', e.target.value || null)}>
                  <option value="">Unseated</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Invitation sent"><Input type="date" value={ed.draft.invite_sent ?? ''} onChange={(e) => ed.set('invite_sent', e.target.value || null)} /></Field>
            </Grid>
            <Check checked={ed.draft.needs_shuttle} onChange={(v) => ed.set('needs_shuttle', v)} label="Needs the airport shuttle" />
            <Field label="Notes"><Area value={ed.draft.notes} onChange={(e) => ed.set('notes', e.target.value)} /></Field>

            {!ed.isNew && events.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">RSVPs</div>
                <div className="flex flex-wrap gap-3">
                  {events.map((e) => {
                    const invited = eventInvitees([ed.draft!], e).length > 0;
                    const status = rsvpBy.get(`${ed.draft!.id}:${e.id}`)?.status ?? 'pending';
                    return (
                      <Field key={e.id} label={e.name}>
                        {invited ? (
                          <Select className="h-8 w-32 py-1" value={status} onChange={(ev) => setRsvp(ed.draft!, e, ev.target.value as RsvpStatus)}>
                            {(['pending', 'yes', 'maybe', 'no'] as RsvpStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        ) : (
                          <span className="text-sm text-stone-400">not invited (A list only)</span>
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>
        )}
      </Modal>

      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

function RsvpGrid({ guests, events, rsvpBy, onSet, allGuests, rsvps }: { guests: Guest[]; events: WeddingEvent[]; rsvpBy: Map<string, Rsvp>; onSet: (g: Guest, e: WeddingEvent, s: RsvpStatus) => void; allGuests: Guest[]; rsvps: Rsvp[] }) {
  const { can } = useAuth();
  const w = can('guests:write');
  if (!events.length) return <Panel><Empty title="No events yet" body="Add the weekend's events in Wedding settings to track RSVPs per event." /></Panel>;
  return (
    <Panel>
      <TWrap>
        <thead>
          <tr>
            <TH>Guest</TH>
            {events.map((e) => {
              const s = rsvpSummary(rsvps, allGuests, e);
              return (
                <TH key={e.id} align="center">
                  {e.name}{e.is_primary && ' ★'}
                  <div className="font-normal normal-case tracking-normal text-stone-400">{s.yes} yes · {s.pending} pending</div>
                </TH>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr key={g.id}>
              <TD className="whitespace-nowrap">{guestName(g)} <span className="text-xs text-stone-400">{g.household}</span></TD>
              {events.map((e) => {
                const invited = eventInvitees([g], e).length > 0;
                const status = rsvpBy.get(`${g.id}:${e.id}`)?.status ?? 'pending';
                return (
                  <TD key={e.id} align="center">
                    {invited ? (
                      <select
                        aria-label={`${guestName(g)} — ${e.name}`}
                        disabled={!w}
                        title={!w ? whyNot('guests:write') : undefined}
                        value={status}
                        onChange={(ev) => onSet(g, e, ev.target.value as RsvpStatus)}
                        className={cls(
                          'rounded-md border-0 px-2 py-1 text-xs font-medium ring-1 ring-inset disabled:cursor-not-allowed',
                          status === 'yes' && 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
                          status === 'no' && 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
                          status === 'maybe' && 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
                          status === 'pending' && 'bg-white text-stone-600 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700',
                        )}
                      >
                        {(['pending', 'yes', 'maybe', 'no'] as RsvpStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-stone-300 dark:text-stone-600" title="A-list-only event">—</span>
                    )}
                  </TD>
                );
              })}
            </tr>
          ))}
        </tbody>
      </TWrap>
    </Panel>
  );
}

// ─── CSV import ──────────────────────────────────────────────────────────────
const COLUMN_ALIASES: Record<string, string[]> = {
  first_name: ['first name', 'first', 'given name', 'firstname', 'forename'],
  last_name: ['last name', 'last', 'surname', 'family name', 'lastname'],
  name: ['name', 'full name', 'guest'],
  household: ['household', 'family', 'party', 'invitation'],
  side: ['side'],
  tier: ['tier', 'list'],
  relationship: ['relationship', 'relation'],
  is_child: ['child', 'is child', 'kid', 'children'],
  meal: ['meal', 'meal choice', 'entree'],
  dietary: ['dietary', 'diet', 'dietary requirements', 'allergies'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'mobile', 'telephone', 'phone number'],
  address: ['address', 'postal address', 'mailing address'],
  country: ['country'],
  notes: ['notes', 'note', 'comments'],
};

function mapColumns(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const h = headers.find((x) => aliases.includes(x));
    if (h) out[field] = h;
  }
  return out;
}

const truthy = (s: string) => /^(y|yes|true|1|x|child)$/i.test(s.trim());

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { putMany } = useStore();
  const { can } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => csvObjects(text), [text]);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const map = mapColumns(headers);
  const recognised = Object.keys(map);
  const withContacts = can('guests:contact');

  const parsed = rows
    .map((r) => {
      const get = (f: string) => (map[f] ? r[map[f]] ?? '' : '');
      let first = get('first_name');
      let last = get('last_name');
      if (!first && !last && get('name')) {
        const parts = get('name').trim().split(/\s+/);
        last = parts.length > 1 ? parts.pop()! : '';
        first = parts.join(' ');
      }
      const side = /^(b|groom)/i.test(get('side')) ? 'B' : /^(a|bride)/i.test(get('side')) ? 'A' : 'both';
      return {
        guest: {
          id: crypto.randomUUID(), first_name: first, last_name: last, household: get('household') || `${last || first} household`,
          side, tier: /^b/i.test(get('tier')) ? 'B' : 'A', relationship: get('relationship'), is_child: truthy(get('is_child')),
          meal: get('meal'), dietary: get('dietary'), notes: get('notes'),
        },
        contact: { email: get('email'), phone: get('phone'), address: get('address'), country: get('country') },
      };
    })
    .filter((p) => p.guest.first_name || p.guest.last_name);

  async function run() {
    setBusy(true);
    try {
      await putMany('guests', parsed.map((p) => p.guest));
      const contacts = parsed.filter((p) => Object.values(p.contact).some(Boolean)).map((p) => ({ guest_id: p.guest.id, ...p.contact }));
      if (withContacts && contacts.length) await putMany('guest_contacts', contacts);
      toast(`Imported ${parsed.length} guest${parsed.length === 1 ? '' : 's'}`, 'ok');
      setText('');
      onClose();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      wide
      title="Import guests from CSV"
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || parsed.length === 0} onClick={run}>{busy ? 'Importing…' : `Import ${parsed.length} guest${parsed.length === 1 ? '' : 's'}`}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Upload a CSV or paste rows from a spreadsheet. The first row must be headers. Recognised columns: first name, last name (or a single name), household, side, tier, relationship, child, meal, dietary{withContacts ? ', email, phone, address, country' : ''}, notes.
        </p>
        <input
          type="file"
          accept=".csv,text/csv,.tsv,text/plain"
          className="block text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
        />
        <Area rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'First name,Last name,Household,Email\nAnne,Parker,The Parkers,anne@example.com'} className="font-mono text-xs" />
        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1 text-xs">
              <span className="text-stone-500">Recognised:</span>
              {recognised.length ? recognised.map((f) => <Pill key={f} tone="good">{f.replace('_', ' ')} ← “{map[f]}”</Pill>) : <Pill tone="bad">nothing — check the header row</Pill>}
              {headers.filter((h) => !Object.values(map).includes(h)).map((h) => <Pill key={h} tone="muted">ignored: {h}</Pill>)}
            </div>
            <TWrap className="max-h-64 rounded-lg border border-stone-200 dark:border-stone-800">
              <thead><tr><TH>Name</TH><TH>Household</TH><TH>Side</TH><TH>Tier</TH><TH>Diet</TH>{withContacts && <TH>Email</TH>}</tr></thead>
              <tbody>
                {parsed.slice(0, 10).map((p) => (
                  <tr key={p.guest.id}>
                    <TD>{p.guest.first_name} {p.guest.last_name}</TD><TD>{p.guest.household}</TD><TD>{SIDE_LABEL[p.guest.side as Guest['side']]}</TD><TD>{p.guest.tier}</TD><TD>{p.guest.dietary}</TD>
                    {withContacts && <TD>{p.contact.email}</TD>}
                  </tr>
                ))}
              </tbody>
            </TWrap>
            {parsed.length > 10 && <p className="text-xs text-stone-500">…and {parsed.length - 10} more.</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
