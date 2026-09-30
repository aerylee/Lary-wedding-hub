// Run of show (main spec §7.9): one timeline per event day, clash detection, and the
// vendor call-time sheet you send each supplier.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { ScheduleItem, ScheduleKind } from '@/lib/types';
import { scheduleClashes } from '@/lib/derive';
import { cls, download, fmtDate, fmtTime, minsToTime, num, sortBy, timeToMins, uniq } from '@/lib/util';
import { Area, Banner, Button, Empty, Field, Input, Modal, NumberInput, Panel, PanelHead, Pill, Segmented, Select, SectionTitle, type Tone } from '@/components/kit';
import { CanButton } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconAlert, IconDownload, IconPlus } from '@/components/icons';
import { CsvButton, Grid, usePlan } from './common';

const KINDS: ScheduleKind[] = ['moment', 'vendor', 'logistics', 'food', 'music', 'photo'];
const KIND_LABEL: Record<ScheduleKind, string> = { moment: 'Moment', vendor: 'Vendor call', logistics: 'Logistics', food: 'Food', music: 'Music', photo: 'Photo' };
const KIND_TONE: Record<ScheduleKind, Tone> = { moment: 'warn', vendor: 'info', logistics: 'default', food: 'good', music: 'bad', photo: 'muted' };

export default function RunOfShow() {
  const { get } = useStore();
  const { events } = usePlan();
  const items = get('schedule_items');
  const vendors = get('vendors');
  const [eventId, setEventId] = useState<string>(() => events.find((e) => e.is_primary)?.id ?? events[0]?.id ?? '');
  const [owner, setOwner] = useState('');
  const event = events.find((e) => e.id === eventId) ?? events[0];

  const blank = (): ScheduleItem => ({
    id: crypto.randomUUID(), wedding_id: '', event_id: event?.id ?? '', time: event?.start_time ?? '12:00', duration_mins: 30, title: '', detail: '',
    owner: '', vendor_id: null, location: event?.location ?? '', kind: 'moment', created_at: '', updated_at: '', created_by: null, updated_by: null,
  });
  const ed = useEditor<ScheduleItem>('schedule_items', blank);

  const day = useMemo(() => sortBy(items.filter((i) => i.event_id === event?.id), (i) => timeToMins(i.time), (i) => i.title), [items, event?.id]);
  const clashes = useMemo(() => scheduleClashes(day), [day]);
  const clashIds = new Set(clashes.flat().map((i) => i.id));
  const owners = uniq(day.map((i) => i.owner).filter(Boolean)).sort();
  const shown = owner ? day.filter((i) => i.owner === owner) : day;
  const callTimes = day.filter((i) => i.kind === 'vendor');
  const vendorName = (id: string | null) => (id ? vendors.find((v) => v.id === id)?.name : undefined);
  const end = (i: ScheduleItem) => minsToTime((timeToMins(i.time) ?? 0) + num(i.duration_mins));

  const exportText = () => {
    if (!event) return;
    const body = [
      `${event.name} — ${fmtDate(event.date, { weekday: true })}`,
      event.location ? `Location: ${event.location}` : '',
      '',
      ...shown.map((i) => `${fmtTime(i.time)}–${end(i)}  ${i.title}${i.location ? ` @ ${i.location}` : ''}${i.owner ? ` [${i.owner}]` : ''}${i.detail ? `\n             ${i.detail}` : ''}`),
    ].filter((l, idx) => l !== '' || idx === 2);
    download(`run-of-show-${event.name.toLowerCase().replace(/\W+/g, '-')}.txt`, body.join('\n'), 'text/plain;charset=utf-8');
  };

  if (!events.length) {
    return (
      <div>
        <SectionTitle>Run of show</SectionTitle>
        <Panel><Empty title="No events yet" body="The run of show is built from the weekend's events. Add them in Wedding settings first." /></Panel>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        sub="Minute by minute, per day. The day-of coordinator runs from this; vendors get their call times from it."
        actions={
          <>
            <Button size="sm" onClick={exportText}><IconDownload size={14} /> Schedule</Button>
            <CsvButton filename={`run-of-show-${event?.name ?? 'day'}.csv`} rows={() => shown.map((i) => ({ start: fmtTime(i.time), end: end(i), mins: i.duration_mins, what: i.title, type: KIND_LABEL[i.kind], owner: i.owner, vendor: vendorName(i.vendor_id) ?? '', where: i.location, detail: i.detail }))} />
            <CanButton perm="schedule:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add item</CanButton>
          </>
        }
      >
        Run of show
      </SectionTitle>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={event?.id ?? ''} onChange={setEventId} options={events.map((e) => ({ value: e.id, label: `${e.name}${e.date ? ` · ${fmtDate(e.date, { weekday: true, year: false })}` : ''}`, count: items.filter((i) => i.event_id === e.id).length }))} />
        {owners.length > 0 && (
          <Select className="h-9 w-44 py-1" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
            <option value="">Everyone</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        )}
      </div>

      {clashes.length > 0 && (
        <Banner tone="bad">
          <strong>{clashes.length} clash{clashes.length === 1 ? '' : 'es'}:</strong>{' '}
          {clashes.slice(0, 3).map(([a, b]) => `“${a.title}” overlaps “${b.title}”`).join('; ')}
          {clashes.length > 3 && '…'}
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel>
          <PanelHead title={event?.name ?? ''} sub={[fmtDate(event?.date, { weekday: true }), event?.location, event?.dress && `Dress: ${event.dress}`].filter(Boolean).join(' · ')} />
          {shown.length === 0 ? (
            <Empty title="Nothing scheduled" body="Add the first item — usually a vendor arriving." action={<CanButton perm="schedule:write" variant="primary" onClick={() => ed.open()}>Add an item</CanButton>} />
          ) : (
            <ol className="relative ml-4 border-l-2 border-stone-200 py-2 dark:border-stone-800">
              {shown.map((i) => (
                <li key={i.id} className="relative pl-5">
                  <span className={cls('absolute -left-[7px] top-4 h-3 w-3 rounded-full border-2 border-white dark:border-stone-900', clashIds.has(i.id) ? 'bg-rose-500' : 'bg-amber-600')} />
                  <button onClick={() => ed.open(i)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="w-28 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{fmtTime(i.time)}–{end(i)}</span>
                      <span className="text-sm font-medium">{i.title}</span>
                      <Pill tone={KIND_TONE[i.kind]}>{KIND_LABEL[i.kind]}</Pill>
                      {clashIds.has(i.id) && <Pill tone="bad"><IconAlert size={11} /> clash</Pill>}
                    </div>
                    <div className="ml-0 flex flex-wrap gap-x-3 text-xs text-stone-500 sm:ml-[6.75rem]">
                      {i.location && <span>{i.location}</span>}
                      {i.owner && <span>{i.owner}</span>}
                      {vendorName(i.vendor_id) && <span>{vendorName(i.vendor_id)}</span>}
                      {i.detail && <span>{i.detail}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel className="self-start">
          <PanelHead title="Vendor call times" sub="The sheet you send each supplier" actions={<CsvButton filename="call-times.csv" rows={() => callTimes.map((i) => ({ time: fmtTime(i.time), vendor: vendorName(i.vendor_id) ?? i.owner, what: i.title, where: i.location, detail: i.detail }))} />} />
          {callTimes.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">No vendor calls on this day. Items of type &ldquo;Vendor call&rdquo; appear here.</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {callTimes.map((i) => (
                <li key={i.id} className="px-4 py-2 text-sm">
                  <span className="font-semibold tabular-nums">{fmtTime(i.time)}</span> {vendorName(i.vendor_id) ?? i.title}
                  <div className="text-xs text-stone-500">{[vendorName(i.vendor_id) ? i.title : '', i.location].filter(Boolean).join(' · ')}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add item' : 'Edit item'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="schedule_items" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="What"><Input value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
            <Grid cols={3}>
              <Field label="Day">
                <Select value={ed.draft.event_id} onChange={(e) => ed.set('event_id', e.target.value)}>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </Field>
              <Field label="Starts"><Input type="time" value={fmtTime(ed.draft.time)} onChange={(e) => ed.set('time', e.target.value || null)} /></Field>
              <Field label="Minutes"><NumberInput value={ed.draft.duration_mins} min={0} onChange={(v) => ed.set('duration_mins', v ?? 0)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Type">
                <Select value={ed.draft.kind} onChange={(e) => ed.set('kind', e.target.value as ScheduleKind)}>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </Select>
              </Field>
              <Field label="Owner">
                <Input list="ros-owners" value={ed.draft.owner} onChange={(e) => ed.set('owner', e.target.value)} />
                <datalist id="ros-owners">{uniq(items.map((i) => i.owner).filter(Boolean)).map((o) => <option key={o} value={o} />)}</datalist>
              </Field>
              <Field label="Vendor">
                <Select value={ed.draft.vendor_id ?? ''} onChange={(e) => ed.set('vendor_id', e.target.value || null)}>
                  <option value="">—</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </Field>
            </Grid>
            <Field label="Where"><Input value={ed.draft.location} onChange={(e) => ed.set('location', e.target.value)} /></Field>
            <Field label="Detail"><Area value={ed.draft.detail} onChange={(e) => ed.set('detail', e.target.value)} /></Field>
            <p className="text-xs text-stone-500">Two moments, meals or music sets can&rsquo;t overlap, and neither can two items with the same owner — the app flags it.</p>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
