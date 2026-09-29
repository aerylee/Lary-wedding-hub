// Seating (main spec §7.8). Works off the guests coming to the primary event. Every drag has
// a tap fallback: tap a chip (or a household) to pick it up, tap a table to seat it.
import { useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Guest, SeatTable } from '@/lib/types';
import { eventInvitees } from '@/lib/derive';
import { clamp, cls, groupBy, guestName, matches, num, sortBy } from '@/lib/util';
import { Area, Button, Empty, Field, Input, Modal, NumberInput, Panel, PanelHead, Pill, SearchInput, Segmented, Select, SectionTitle, Stat, StatGrid, TD, TH, TWrap } from '@/components/kit';
import { CanButton, whyNot } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconChild, IconLeaf, IconPlus } from '@/components/icons';
import { CsvButton, Grid, usePlan } from './common';

type Tab = 'chart' | 'plan' | 'caterer';

const blankTable = (): SeatTable => ({
  id: crypto.randomUUID(), wedding_id: '', name: '', shape: 'round', seats: 8, x: 50, y: 50, note: '',
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Seating() {
  const { get } = useStore();
  const { primary } = usePlan();
  const guests = get('guests');
  const rsvps = get('rsvps');
  const tables = sortBy(get('seat_tables'), (t) => t.name);
  const [tab, setTab] = useState<Tab>('chart');
  const ed = useEditor<SeatTable>('seat_tables', blankTable);

  // attending = invited to the primary event and not declined
  const attending = useMemo(() => {
    const declined = new Set(rsvps.filter((r) => r.event_id === primary?.id && r.status === 'no').map((r) => r.guest_id));
    return eventInvitees(guests, primary).filter((g) => !declined.has(g.id));
  }, [guests, rsvps, primary]);

  const byTable = groupBy(attending.filter((g) => g.table_id), (g) => g.table_id!);
  const seated = attending.filter((g) => g.table_id && tables.some((t) => t.id === g.table_id)).length;
  const seats = tables.reduce((s, t) => s + num(t.seats), 0);
  const over = tables.filter((t) => (byTable.get(t.id)?.length ?? 0) > num(t.seats)).length;
  const dietary = attending.filter((g) => g.dietary.trim()).length;

  return (
    <div>
      <SectionTitle
        sub={`Seating the ${attending.length} guests invited to ${primary?.name ?? 'the main event'} who haven't declined.`}
        actions={<CanButton perm="seating:write" variant="primary" onClick={() => ed.open({ ...blankTable(), name: `Table ${tables.length + 1}`, x: 15 + ((tables.length * 17) % 70), y: 20 + Math.floor(tables.length / 4) * 22 })}><IconPlus size={14} /> Add table</CanButton>}
      >
        Seating
      </SectionTitle>

      <StatGrid>
        <Stat label="Seated" value={`${seated}/${attending.length}`} tone={seated === attending.length && attending.length ? 'good' : 'default'} />
        <Stat label="Tables & seats" value={tables.length} sub={`${seats} seats laid`} tone={seats < attending.length ? 'warn' : 'default'} />
        <Stat label="Over capacity" value={over} tone={over ? 'bad' : 'default'} />
        <Stat label="Dietary needs" value={dietary} />
      </StatGrid>

      <Segmented className="mb-3" value={tab} onChange={setTab} options={[{ value: 'chart', label: 'Seating chart' }, { value: 'plan', label: 'Floor plan' }, { value: 'caterer', label: 'For the caterer' }]} />

      {tab === 'chart' && <Chart attending={attending} tables={tables} onEditTable={ed.open} onAddTable={() => ed.open({ ...blankTable(), name: `Table ${tables.length + 1}` })} />}
      {tab === 'plan' && <FloorPlan tables={tables} byTable={byTable} onEdit={ed.open} />}
      {tab === 'caterer' && <Caterer attending={attending} tables={tables} />}

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add table' : 'Edit table'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="seat_tables" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid cols={3}>
              <Field label="Name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
              <Field label="Shape">
                <Select value={ed.draft.shape} onChange={(e) => ed.set('shape', e.target.value as SeatTable['shape'])}>
                  <option value="round">Round</option><option value="long">Long</option><option value="head">Head table</option>
                </Select>
              </Field>
              <Field label="Seats"><NumberInput value={ed.draft.seats} min={0} onChange={(v) => ed.set('seats', v ?? 0)} /></Field>
            </Grid>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}

// ─── seating chart ───────────────────────────────────────────────────────────
function Chip({ g, selected, draggable, onDragStart, onClick }: { g: Guest; selected: boolean; draggable: boolean; onDragStart: (e: DragEvent) => void; onClick: () => void }) {
  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={g.dietary ? `Dietary: ${g.dietary}` : undefined}
      className={cls(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        selected ? 'border-amber-600 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' : 'border-stone-300 bg-white hover:border-amber-400 dark:border-stone-700 dark:bg-stone-900',
        draggable && 'cursor-grab',
      )}
    >
      {guestName(g)}
      {g.is_child && <IconChild size={11} className="text-stone-400" />}
      {g.dietary && <IconLeaf size={11} className="text-emerald-600" />}
    </button>
  );
}

function Chart({ attending, tables, onEditTable, onAddTable }: { attending: Guest[]; tables: SeatTable[]; onEditTable: (t: SeatTable) => void; onAddTable: () => void }) {
  const { putMany } = useStore();
  const { can } = useAuth();
  const w = can('seating:write') && can('guests:write');
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const tableIds = new Set(tables.map((t) => t.id));
  const unseated = attending.filter((g) => !g.table_id || !tableIds.has(g.table_id));
  const pool = unseated.filter((g) => matches(q, g.first_name, g.last_name, g.household));
  const byTable = groupBy(attending.filter((g) => g.table_id), (g) => g.table_id!);

  const seat = (ids: string[], tableId: string | null) => {
    if (!w || !ids.length) return;
    const rows = attending.filter((g) => ids.includes(g.id)).map((g) => ({ ...g, table_id: tableId }));
    setPicked([]);
    putMany('guests', rows).catch(() => undefined);
  };
  const toggle = (ids: string[]) => setPicked((p) => (ids.every((id) => p.includes(id)) ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
  const drag = (ids: string[]) => (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };
  const drop = (tableId: string | null) => (e: DragEvent) => {
    e.preventDefault();
    try {
      seat(JSON.parse(e.dataTransfer.getData('text/plain')), tableId);
    } catch {
      /* not ours */
    }
  };

  if (!attending.length) return <Panel><Empty title="Nobody to seat yet" body="Guests appear here once they're on the list and invited to the primary event." /></Panel>;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Panel className="self-start lg:sticky lg:top-32">
        <div onDragOver={(e) => e.preventDefault()} onDrop={drop(null)} onClick={() => picked.length && seat(picked, null)}>
          <PanelHead title="Unseated" sub={`${unseated.length} guest${unseated.length === 1 ? '' : 's'}`} />
        </div>
        <div className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Find a guest…" />
          <p className="mt-2 text-xs text-stone-500">{w ? 'Drag a guest or a household onto a table — or tap to pick up, then tap a table.' : whyNot('seating:write')}</p>
          {picked.length > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1 text-xs dark:bg-amber-950">
              {picked.length} picked up — tap a table
              <button className="underline" onClick={() => setPicked([])}>cancel</button>
            </div>
          )}
          <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
            {[...groupBy(pool, (g) => g.household || '—').entries()].map(([h, gs]) => (
              <div key={h}>
                <button
                  draggable={w}
                  onDragStart={drag(gs.map((g) => g.id))}
                  onClick={() => w && toggle(gs.map((g) => g.id))}
                  className={cls('mb-1 text-xs font-semibold text-stone-500 hover:text-amber-800', w && 'cursor-grab')}
                  title="Drag or tap to move the whole household"
                >
                  {h} ({gs.length})
                </button>
                <div className="flex flex-wrap gap-1">
                  {gs.map((g) => <Chip key={g.id} g={g} selected={picked.includes(g.id)} draggable={w} onDragStart={drag([g.id])} onClick={() => w && toggle([g.id])} />)}
                </div>
              </div>
            ))}
            {pool.length === 0 && <p className="text-xs text-stone-400">{unseated.length ? 'No matches.' : 'Everyone is seated.'}</p>}
          </div>
        </div>
      </Panel>

      {tables.length === 0 ? (
        <Panel><Empty title="No tables yet" body="Add tables, then seat people at them." action={<CanButton perm="seating:write" variant="primary" onClick={onAddTable}>Add a table</CanButton>} /></Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((t) => {
            const at = byTable.get(t.id) ?? [];
            const overCap = at.length > num(t.seats);
            return (
              <div
                key={t.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={drop(t.id)}
                onClick={() => picked.length && seat(picked, t.id)}
                className={cls(
                  'rounded-xl border bg-white p-3 shadow-sm dark:bg-stone-900',
                  overCap ? 'border-rose-400 dark:border-rose-800' : 'border-stone-200 dark:border-stone-800',
                  picked.length > 0 && 'cursor-pointer ring-2 ring-amber-300/60',
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button className="font-serif text-lg font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); onEditTable(t); }}>{t.name}</button>
                  <Pill tone={overCap ? 'bad' : at.length === num(t.seats) ? 'good' : 'default'}>{at.length}/{t.seats}{overCap && ' over'}</Pill>
                </div>
                <div className="flex min-h-[2rem] flex-wrap gap-1">
                  {at.map((g) => (
                    <span key={g.id} onClick={(e) => e.stopPropagation()}>
                      <Chip g={g} selected={picked.includes(g.id)} draggable={w} onDragStart={drag([g.id])} onClick={() => w && toggle([g.id])} />
                    </span>
                  ))}
                  {at.length === 0 && <span className="text-xs text-stone-400">Drop guests here</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── floor plan ──────────────────────────────────────────────────────────────
function FloorPlan({ tables, byTable, onEdit }: { tables: SeatTable[]; byTable: Map<string, Guest[]>; onEdit: (t: SeatTable) => void }) {
  const { put } = useStore();
  const { can } = useAuth();
  const w = can('seating:write');
  const room = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const pos = (t: SeatTable) => (drag?.id === t.id ? { x: drag.x, y: drag.y } : { x: num(t.x), y: num(t.y) });
  const fromEvent = (e: RPointerEvent) => {
    const r = room.current!.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100), y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100) };
  };
  const commit = (t: SeatTable, x: number, y: number) => put('seat_tables', { ...t, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }).catch(() => undefined);

  if (!tables.length) return <Panel><Empty title="No tables to place" body="Add tables first; then drag them into position here." /></Panel>;

  return (
    <Panel>
      <PanelHead title="Floor plan" sub={w ? 'Drag tables into place. Select one and use the arrow keys to nudge it. Positions are saved as a share of the room, so the plan fits any screen.' : 'Read-only.'} />
      <div className="p-3">
        <div
          ref={room}
          className="relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-950"
          onPointerMove={(e) => drag && setDrag({ ...drag, ...fromEvent(e), moved: true })}
          onPointerUp={() => {
            if (!drag) return;
            const t = tables.find((x) => x.id === drag.id)!;
            if (drag.moved) commit(t, drag.x, drag.y);
            setDrag(null);
          }}
        >
          {tables.map((t) => {
            const p = pos(t);
            const seats = Math.max(1, num(t.seats));
            const count = byTable.get(t.id)?.length ?? 0;
            // drawn to scale: size grows with seats
            const size = t.shape === 'round' ? 6 + seats * 0.55 : 0;
            const style =
              t.shape === 'round'
                ? { width: `${size}%`, aspectRatio: '1' }
                : { width: `${Math.max(8, seats * (t.shape === 'head' ? 2.2 : 1.6))}%`, height: `${t.shape === 'head' ? 6 : 8}%` };
            return (
              <button
                key={t.id}
                style={{ left: `${p.x}%`, top: `${p.y}%`, ...style }}
                className={cls(
                  'absolute -translate-x-1/2 -translate-y-1/2 border-2 text-[10px] font-medium leading-tight shadow-sm',
                  t.shape === 'round' ? 'rounded-full' : 'rounded-md',
                  count > seats ? 'border-rose-500 bg-rose-50 dark:bg-rose-950' : 'border-amber-600 bg-white dark:bg-stone-900',
                  selected === t.id && 'ring-4 ring-amber-300',
                  w ? 'cursor-move' : 'cursor-default',
                )}
                onPointerDown={(e) => {
                  setSelected(t.id);
                  if (!w) return;
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDrag({ id: t.id, ...pos(t), moved: false });
                }}
                onDoubleClick={() => onEdit(t)}
                onKeyDown={(e) => {
                  if (!w) return;
                  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
                  if (d) {
                    e.preventDefault();
                    commit(t, clamp(num(t.x) + d[0], 0, 100), clamp(num(t.y) + d[1], 0, 100));
                  }
                  if (e.key === 'Enter') onEdit(t);
                }}
                aria-label={`${t.name}, ${count} of ${seats} seats`}
              >
                <span className="block truncate px-0.5">{t.name}</span>
                <span className="block text-stone-500">{count}/{seats}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
          <span>Double-click (or Enter) to edit a table.</span>
          {selected && <Button size="sm" variant="subtle" onClick={() => onEdit(tables.find((t) => t.id === selected)!)}>Edit selected</Button>}
        </div>
      </div>
    </Panel>
  );
}

// ─── for the caterer ─────────────────────────────────────────────────────────
function Caterer({ attending, tables }: { attending: Guest[]; tables: SeatTable[] }) {
  const byTable = groupBy(attending, (g) => g.table_id ?? '');
  const reqs = groupBy(attending.filter((g) => g.dietary.trim()), (g) => g.dietary.trim().toLowerCase());
  const meals = groupBy(attending.filter((g) => g.meal.trim()), (g) => g.meal.trim());
  const children = attending.filter((g) => g.is_child).length;
  const tableName = (id: string) => tables.find((t) => t.id === id)?.name ?? 'Unseated';

  const csv = () =>
    sortBy(attending, (g) => tableName(g.table_id ?? ''), (g) => g.last_name).map((g) => ({
      table: tableName(g.table_id ?? ''), guest: guestName(g), child: g.is_child ? 'yes' : '', meal: g.meal, dietary: g.dietary,
    }));

  return (
    <div className="space-y-4">
      <StatGrid>
        <Stat label="Covers" value={attending.length} sub={`${attending.length - children} adults`} />
        <Stat label="Children" value={children} />
        <Stat label="Dietary requirements" value={[...reqs.values()].reduce((s, x) => s + x.length, 0)} />
        <Stat label="Meal choices logged" value={[...meals.values()].reduce((s, x) => s + x.length, 0)} sub={`of ${attending.length}`} />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Totals by requirement" actions={<CsvButton filename="catering.csv" rows={csv} label="Kitchen CSV" />} />
          <TWrap>
            <thead><tr><TH>Requirement</TH><TH align="right">Guests</TH></tr></thead>
            <tbody>
              {sortBy([...reqs.entries()], ([, gs]) => -gs.length).map(([r, gs]) => <tr key={r}><TD className="capitalize">{r}</TD><TD align="right">{gs.length}</TD></tr>)}
              {[...meals.entries()].map(([m, gs]) => <tr key={`m-${m}`}><TD>Meal: {m}</TD><TD align="right">{gs.length}</TD></tr>)}
              {!reqs.size && !meals.size && <tr><TD colSpan={2} className="text-stone-400">Nothing recorded yet.</TD></tr>}
            </tbody>
          </TWrap>
        </Panel>
        <Panel>
          <PanelHead title="Dietary requirements by table" />
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {[...tables.map((t) => t.id), ''].map((id) => {
              const needs = (byTable.get(id) ?? []).filter((g) => g.dietary.trim() || g.is_child);
              if (!needs.length) return null;
              return (
                <li key={id || 'none'} className="px-4 py-2.5 text-sm">
                  <div className="font-medium">{tableName(id)}</div>
                  <ul className="mt-1 space-y-0.5 text-stone-600 dark:text-stone-300">
                    {needs.map((g) => <li key={g.id}>{guestName(g)}{g.is_child && ' (child)'}{g.dietary && ` — ${g.dietary}`}</li>)}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
