// The timeline as a month calendar: tasks on their due dates, alongside the weekend's
// events, payments falling due and the big deadlines. Drag a task to another day to
// reschedule it — a task that counts back from the wedding keeps doing so.
import { useMemo, useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Task } from '@/lib/types';
import { rescheduled, type TaskState } from '@/lib/derive';
import { addDays, cls, daysBetween, fmtDate, fmtMoney, monthGrid, num, parseDate, todayISO } from '@/lib/util';
import { Button, IconButton, Panel, Pill } from '@/components/kit';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconHeart, IconPlus } from '@/components/icons';

type Item =
  | { kind: 'task'; id: string; date: string; label: string; t: Task; s: TaskState }
  | { kind: 'event' | 'payment' | 'milestone'; id: string; date: string; label: string; sub?: string; wedding?: boolean };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimelineCalendar({ tasks, onOpen, onAdd }: {
  tasks: { t: Task; s: TaskState }[];
  onOpen: (t: Task) => void;
  onAdd: (date: string) => void;
}) {
  const { get, settings, put } = useStore();
  const { can } = useAuth();
  const canWrite = can('tasks:write');
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const d = parseDate(today)!;
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const events = get('events');
  const payments = get('payments');
  const items = useMemo(() => {
    const all: Item[] = tasks.map(({ t, s }) => ({ kind: 'task', id: t.id, date: s.due, label: t.title, t, s }));
    for (const e of events) if (e.date) all.push({ kind: 'event', id: e.id, date: e.date, label: e.name, sub: e.start_time?.slice(0, 5) ?? undefined });
    if (can('finance:read')) {
      for (const p of payments) {
        if (p.due_date && !p.paid_date) all.push({ kind: 'payment', id: p.id, date: p.due_date, label: p.label || 'Payment', sub: fmtMoney(num(p.amount), p.currency) });
      }
    }
    all.push({ kind: 'milestone', id: 'wedding', date: settings.target_date, label: 'Wedding day', wedding: true });
    if (settings.rsvp_by) all.push({ kind: 'milestone', id: 'rsvp', date: settings.rsvp_by, label: 'RSVP deadline' });
    if (settings.decide_venue_by) all.push({ kind: 'milestone', id: 'venue', date: settings.decide_venue_by, label: 'Decide the venue' });
    const byDay = new Map<string, Item[]>();
    const order = { milestone: 0, event: 1, payment: 2, task: 3 } as const;
    for (const it of all) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
    for (const list of byDay.values()) list.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label));
    return byDay;
  }, [tasks, events, payments, settings.target_date, settings.rsvp_by, settings.decide_venue_by, can]);

  const weeks = monthGrid(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1, 12).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const go = (delta: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + delta, 1, 12);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const jump = (iso: string) => {
    const d = parseDate(iso)!;
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(iso);
  };

  const monthTasks = weeks.flat().filter((d) => parseDate(d)!.getMonth() === cursor.m).reduce((n, d) => n + (items.get(d)?.filter((i) => i.kind === 'task').length ?? 0), 0);

  const drop = (e: DragEvent, date: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/task-id');
    const hit = tasks.find((x) => x.t.id === id);
    if (!hit || hit.s.due === date) return;
    put('tasks', rescheduled(hit.t, date, settings.target_date)).catch(() => undefined);
  };

  const dayItems = items.get(selected) ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
          <h2 className="mr-auto font-serif text-xl font-semibold">{monthLabel}</h2>
          <span className="text-xs text-stone-500">{monthTasks} task{monthTasks === 1 ? '' : 's'} this month</span>
          <IconButton label="Previous month" onClick={() => go(-1)}><IconChevronLeft size={16} /></IconButton>
          <Button size="sm" variant="subtle" onClick={() => jump(today)}>Today</Button>
          <IconButton label="Next month" onClick={() => go(1)}><IconChevronRight size={16} /></IconButton>
          <Button size="sm" onClick={() => jump(settings.target_date)}><IconHeart size={13} className="text-rose-600" /> Wedding month</Button>
        </div>
        <div role="grid" aria-label={monthLabel} className="select-none">
          <div role="row" className="grid grid-cols-7 border-b border-stone-100 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800">
            {WEEKDAYS.map((d) => <div role="columnheader" key={d} className="py-1.5">{d}</div>)}
          </div>
          {weeks.map((week) => (
            <div role="row" key={week[0]} className="grid grid-cols-7">
              {week.map((d) => {
                const inMonth = parseDate(d)!.getMonth() === cursor.m;
                const list = items.get(d) ?? [];
                const isWedding = d === settings.target_date;
                const shown = list.slice(0, 3);
                const more = list.length - shown.length;
                return (
                  <div
                    role="gridcell"
                    key={d}
                    aria-selected={d === selected}
                    aria-label={`${fmtDate(d, { weekday: true })}: ${list.length} item${list.length === 1 ? '' : 's'}`}
                    tabIndex={d === selected ? 0 : -1}
                    onClick={() => setSelected(d)}
                    onKeyDown={(e) => {
                      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                      if (step) {
                        e.preventDefault();
                        const next = addDays(d, step);
                        jump(next);
                        requestAnimationFrame(() => (document.querySelector(`[data-day="${next}"]`) as HTMLElement | null)?.focus());
                      }
                    }}
                    data-day={d}
                    onDragOver={canWrite ? (e) => { e.preventDefault(); setDragOver(d); } : undefined}
                    onDragLeave={canWrite ? () => setDragOver((x) => (x === d ? null : x)) : undefined}
                    onDrop={canWrite ? (e) => drop(e, d) : undefined}
                    className={cls(
                      'min-h-[4.25rem] cursor-pointer border-b border-r border-stone-100 p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 dark:border-stone-800 sm:min-h-[6.5rem]',
                      !inMonth && 'bg-stone-50/70 text-stone-400 dark:bg-stone-950/40',
                      d === selected && 'bg-amber-50/80 dark:bg-amber-950/30',
                      isWedding && 'bg-rose-50 dark:bg-rose-950/30',
                      dragOver === d && 'bg-amber-100 ring-2 ring-inset ring-amber-500 dark:bg-amber-900/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cls(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums',
                          d === today && 'bg-amber-700 font-semibold text-white',
                        )}
                      >
                        {parseDate(d)!.getDate()}
                      </span>
                      {isWedding && <IconHeart size={13} className="text-rose-600" />}
                    </div>
                    {/* phones: dots; wider screens: chips */}
                    <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 6).map((it) => <span key={it.kind + it.id} className={cls('h-1.5 w-1.5 rounded-full', dot(it))} />)}
                    </div>
                    <div className="mt-0.5 hidden space-y-0.5 sm:block">
                      {shown.map((it) => <Chip key={it.kind + it.id} it={it} canWrite={canWrite} onOpen={onOpen} />)}
                      {more > 0 && (
                        <button className="w-full rounded px-1 text-left text-[11px] font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800" onClick={(e) => { e.stopPropagation(); setSelected(d); }}>
                          +{more} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[11px] text-stone-500">
          <Legend className="bg-white ring-1 ring-stone-300 dark:bg-stone-800">Task</Legend>
          <Legend className="bg-rose-500">Overdue</Legend>
          <Legend className="bg-violet-500">Event</Legend>
          {can('finance:read') && <Legend className="bg-emerald-500">Payment due</Legend>}
          <Legend className="bg-amber-500">Deadline</Legend>
          {canWrite && <span>Drag a task to another day to reschedule it.</span>}
        </div>
      </Panel>

      <Panel className="self-start">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
          <div>
            <h3 className="font-serif text-lg font-semibold">{fmtDate(selected, { weekday: true, year: true })}</h3>
            <div className="text-xs text-stone-500">{relative(selected, settings.target_date)}</div>
          </div>
          {canWrite && <IconButton label="Add a task on this day" onClick={() => onAdd(selected)}><IconPlus size={16} /></IconButton>}
        </div>
        {dayItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-stone-500">
            <IconCalendar size={22} className="mx-auto mb-2 text-stone-300" />
            Nothing on this day.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {dayItems.map((it) => (
              <li key={it.kind + it.id} className="px-4 py-2">
                {it.kind === 'task' ? (
                  <button className="w-full text-left" onClick={() => onOpen(it.t)}>
                    <div className={cls('text-sm', it.s.done && 'text-stone-400 line-through')}>{it.label}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {it.s.overdue && <Pill tone="bad">overdue</Pill>}
                      {it.t.critical && <Pill tone="warn">key</Pill>}
                      {it.t.owner && <Pill tone="muted">{it.t.owner}</Pill>}
                      {it.t.due_override && <Pill tone="muted">fixed date</Pill>}
                    </div>
                  </button>
                ) : (
                  <div className="flex items-start gap-2 text-sm">
                    <span className={cls('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot(it))} />
                    <div>
                      <div className="font-medium">{it.label}</div>
                      {it.sub && <div className="text-xs text-stone-500">{it.sub}</div>}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Chip({ it, canWrite, onOpen }: { it: Item; canWrite: boolean; onOpen: (t: Task) => void }) {
  if (it.kind !== 'task') {
    return (
      <div
        title={it.sub ? `${it.label} · ${it.sub}` : it.label}
        className={cls(
          'truncate rounded px-1 py-px text-[11px] font-medium',
          it.kind === 'event' && 'bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100',
          it.kind === 'payment' && 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
          it.kind === 'milestone' && (it.wedding ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'),
        )}
      >
        {it.sub && it.kind === 'event' ? `${it.sub} ` : ''}{it.label}
      </div>
    );
  }
  const { t, s } = it;
  return (
    <button
      draggable={canWrite}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', t.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(t);
      }}
      title={`${t.title}${canWrite ? ' — drag to reschedule' : ''}`}
      className={cls(
        'block w-full truncate rounded border px-1 py-px text-left text-[11px]',
        canWrite && 'cursor-grab active:cursor-grabbing',
        s.done
          ? 'border-transparent bg-stone-100 text-stone-400 line-through dark:bg-stone-800'
          : s.overdue
            ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
            : t.status === 'doing'
              ? 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'
              : 'border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100',
        t.critical && !s.done && 'border-l-2 border-l-amber-500',
      )}
    >
      {t.title}
    </button>
  );
}

function dot(it: Item) {
  if (it.kind === 'task') return it.s.done ? 'bg-stone-300' : it.s.overdue ? 'bg-rose-500' : 'bg-stone-500';
  if (it.kind === 'event') return 'bg-violet-500';
  if (it.kind === 'payment') return 'bg-emerald-500';
  return it.wedding ? 'bg-rose-600' : 'bg-amber-500';
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cls('h-2 w-2 rounded-full', className)} /> {children}
    </span>
  );
}

function relative(date: string, wedding: string) {
  const n = daysBetween(date, wedding);
  if (n === 0) return 'The wedding day';
  return n > 0 ? `${n} day${n === 1 ? '' : 's'} before the wedding` : `${-n} day${n === -1 ? '' : 's'} after the wedding`;
}
