// Travel (main spec §7.7): room blocks, release dates and the arrivals board.
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Room } from '@/lib/types';
import { rsvpSummary } from '@/lib/derive';
import { cls, daysUntil, eur, fmtDate, groupBy, guestName, num, relativeDays, sortBy, usd } from '@/lib/util';
import { Area, Banner, Empty, Field, Input, Modal, Money, NumberInput, Panel, PanelHead, Pill, Segmented, Select, SectionTitle, Stat, StatGrid, TD, TH, TR, TWrap } from '@/components/kit';
import { CanButton } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconPlane, IconPlus } from '@/components/icons';
import { CsvButton, Grid, StatusPill, usePlan } from './common';

const blank = (): Room => ({
  id: crypto.randomUUID(), wedding_id: '', property: '', name: '', type: '', beds: 2, nightly_eur: null, nights: 3, held_until: null,
  assigned_to: '', status: 'held', note: '', created_at: '', updated_at: '', created_by: null, updated_by: null,
});
const STATUS_TONE = { held: 'warn', confirmed: 'good', released: 'muted' } as const;

export default function Travel() {
  const { get } = useStore();
  const { fx, chosen, primary } = usePlan();
  const rooms = get('rooms');
  const guests = get('guests');
  const rsvps = get('rsvps');
  const [tab, setTab] = useState<'rooms' | 'arrivals'>('rooms');
  const ed = useEditor<Room>('rooms', blank);

  const active = rooms.filter((r) => r.status !== 'released');
  const beds = active.reduce((s, r) => s + num(r.beds), 0);
  const s = rsvpSummary(rsvps, guests, primary);
  const toHouse = guests.length ? s.total - s.no : 0;
  const onSite = chosen.venue?.beds_on_site ?? 0;
  const needHotel = Math.max(0, toHouse - onSite);
  const cost = active.reduce((a, r) => a + num(r.nightly_eur) * num(r.nights), 0);
  const nextRelease = sortBy(rooms.filter((r) => r.status === 'held' && r.held_until && (daysUntil(r.held_until) ?? -1) >= 0), (r) => r.held_until)[0];
  const assigned = groupBy(guests.filter((g) => g.room_id), (g) => g.room_id!);

  const arrivals = sortBy(guests.filter((g) => g.arrival || g.arrival_flight || g.departure), (g) => g.arrival ?? '9999', (g) => g.arrival_flight);

  return (
    <div>
      <SectionTitle
        sub="Room blocks release on fixed dates — unclaimed rooms go back to the hotel. Watch the release column."
        actions={
          <>
            <CsvButton filename="arrivals.csv" rows={() => arrivals.map((g) => ({ guest: guestName(g), household: g.household, arrives: g.arrival, arrival_flight: g.arrival_flight, departs: g.departure, departure_flight: g.departure_flight, shuttle: g.needs_shuttle ? 'yes' : '' }))} label="Arrivals CSV" />
            <CanButton perm="travel:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add room block</CanButton>
          </>
        }
      >
        Travel
      </SectionTitle>

      {chosen.venue ? (
        <Banner tone="info">
          <IconPlane size={14} className="mr-1 inline" /> <strong>{chosen.venue.name}</strong>
          {chosen.venue.nearest_airport && ` — nearest airport ${chosen.venue.nearest_airport}${chosen.venue.airport_mins ? `, about ${chosen.venue.airport_mins} minutes away` : ''}`}.
          {` ${onSite} bed${onSite === 1 ? '' : 's'} on site.`}
        </Banner>
      ) : (
        <Banner tone="muted">No venue chosen yet — airports and on-site beds will show here once one is held or booked.</Banner>
      )}

      <StatGrid>
        <Stat label="Beds held" value={beds} sub={`for ${toHouse || '—'} guests to house`} tone={toHouse && beds < toHouse ? 'warn' : 'default'} />
        <Stat label="Need a hotel" value={needHotel} sub={`after ${onSite} on-site beds`} />
        <Stat label="Block cost" value={eur(cost)} sub={usd(cost * fx)} />
        <Stat label="Next release" value={nextRelease ? fmtDate(nextRelease.held_until, { year: false }) : '—'} sub={nextRelease ? `${nextRelease.name} · ${relativeDays(daysUntil(nextRelease.held_until))}` : 'nothing held'} tone={nextRelease && (daysUntil(nextRelease.held_until) ?? 99) < 30 ? 'warn' : 'default'} />
      </StatGrid>

      <Segmented className="mb-3" value={tab} onChange={setTab} options={[{ value: 'rooms', label: 'Room blocks', count: rooms.length }, { value: 'arrivals', label: 'Arrivals board', count: arrivals.length }]} />

      {tab === 'rooms' ? (
        <Panel>
          {rooms.length === 0 ? (
            <Empty title="No room blocks yet" body="Hold rooms near the venue early; note the release date the hotel gives you." action={<CanButton perm="travel:write" variant="primary" onClick={() => ed.open()}>Add a room block</CanButton>} />
          ) : (
            <TWrap>
              <thead><tr><TH>Property</TH><TH>Block</TH><TH align="right">Beds</TH><TH align="right">Nightly</TH><TH align="right">Nights</TH><TH align="right">Total</TH><TH>Release</TH><TH>Assigned</TH><TH>Status</TH></tr></thead>
              <tbody>
                {sortBy(rooms, (r) => r.property, (r) => r.name).map((r) => {
                  const d = daysUntil(r.held_until);
                  const urgent = r.status === 'held' && d !== null && d < 30;
                  const people = assigned.get(r.id) ?? [];
                  return (
                    <TR key={r.id} commentKey={r.id} onClick={() => ed.open(r)} className={cls(r.status === 'released' && 'opacity-50')}>
                      <TD>{r.property}</TD>
                      <TD className="font-medium">{r.name}<div className="text-xs font-normal text-stone-500">{r.type}</div></TD>
                      <TD align="right">{r.beds}</TD>
                      <TD align="right">{r.nightly_eur != null ? eur(num(r.nightly_eur)) : 'incl.'}</TD>
                      <TD align="right">{r.nights}</TD>
                      <TD align="right">{r.nightly_eur != null ? eur(num(r.nightly_eur) * num(r.nights)) : '—'}</TD>
                      <TD className={cls(urgent && 'font-medium text-rose-700 dark:text-rose-400')}>{r.held_until ? <>{fmtDate(r.held_until)}<div className="text-xs">{relativeDays(d)}</div></> : '—'}</TD>
                      <TD>{r.assigned_to}{people.length > 0 && <div className="text-xs text-stone-500">{people.map(guestName).join(', ')}</div>}</TD>
                      <TD><StatusPill value={r.status} tones={STATUS_TONE} /></TD>
                    </TR>
                  );
                })}
              </tbody>
            </TWrap>
          )}
        </Panel>
      ) : (
        <Panel>
          <PanelHead title="Arrivals" sub={`${guests.filter((g) => g.needs_shuttle).length} need the shuttle`} />
          {arrivals.length === 0 ? (
            <Empty title="No travel details yet" body="Add arrival dates and flights on each guest to plan shuttles." />
          ) : (
            <TWrap>
              <thead><tr><TH>Arrives</TH><TH>Guest</TH><TH>Flight in</TH><TH>Departs</TH><TH>Flight out</TH><TH>Shuttle</TH></tr></thead>
              <tbody>
                {arrivals.map((g) => (
                  <tr key={g.id}>
                    <TD className="whitespace-nowrap">{fmtDate(g.arrival, { weekday: true, year: false })}</TD>
                    <TD>{guestName(g)}<div className="text-xs text-stone-500">{g.household}</div></TD>
                    <TD>{g.arrival_flight}</TD>
                    <TD className="whitespace-nowrap">{fmtDate(g.departure, { weekday: true, year: false })}</TD>
                    <TD>{g.departure_flight}</TD>
                    <TD>{g.needs_shuttle ? <Pill tone="info">shuttle</Pill> : ''}</TD>
                  </tr>
                ))}
              </tbody>
            </TWrap>
          )}
        </Panel>
      )}

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add room block' : 'Edit room block'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="rooms" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid>
              <Field label="Property"><Input value={ed.draft.property} onChange={(e) => ed.set('property', e.target.value)} placeholder="Hotel in town" /></Field>
              <Field label="Block / room name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Type"><Input value={ed.draft.type} onChange={(e) => ed.set('type', e.target.value)} placeholder="Double" /></Field>
              <Field label="Beds"><NumberInput value={ed.draft.beds} onChange={(v) => ed.set('beds', v ?? 0)} /></Field>
              <Field label="Nights"><NumberInput value={ed.draft.nights} onChange={(v) => ed.set('nights', v ?? 0)} /></Field>
            </Grid>
            <Grid>
              <Field label="Nightly rate (EUR)" hint="Leave empty if included."><Money value={ed.draft.nightly_eur} onChange={(v) => ed.set('nightly_eur', v)} /></Field>
              <Field label="Held until (release date)"><Input type="date" value={ed.draft.held_until ?? ''} onChange={(e) => ed.set('held_until', e.target.value || null)} /></Field>
            </Grid>
            <Grid>
              <Field label="Assigned to"><Input value={ed.draft.assigned_to} onChange={(e) => ed.set('assigned_to', e.target.value)} placeholder="The Parkers" /></Field>
              <Field label="Status">
                <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as Room['status'])}>
                  <option value="held">Held</option><option value="confirmed">Confirmed</option><option value="released">Released</option>
                </Select>
              </Field>
            </Grid>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
