// Timeline (main spec §7.3). Tasks fall due at target_date − offset_days, so moving the
// date moves the whole plan; a fixed-date override covers real-world deadlines.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Task, TaskStatus } from '@/lib/types';
import { taskState, taskSummary, type TaskState } from '@/lib/derive';
import { addDays, cls, daysBetween, fmtDate, groupBy, matches, relativeDays, sortBy, uniq } from '@/lib/util';
import { Area, Bar, Check, Empty, Field, Input, Modal, NumberInput, Panel, Pill, SearchInput, Segmented, Select, SectionTitle, Stat, StatGrid } from '@/components/kit';
import { CanButton, whyNot } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconCalendar, IconList, IconPlus } from '@/components/icons';
import { CsvButton, Grid, Toolbar } from './common';
import { TimelineCalendar } from './TimelineCalendar';

type Filter = 'open' | 'overdue' | 'soon' | 'key' | 'all';
type GroupBy = 'phase' | 'category' | 'owner';
type View = 'list' | 'calendar';
const VIEW_KEY = 'hub:timeline-view';

const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'na', na: 'todo' };
const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done', na: 'N/A' };
const STATUS_TONE = { todo: 'default', doing: 'info', done: 'good', na: 'muted' } as const;

const blank = (): Task => ({
  id: crypto.randomUUID(), wedding_id: '', title: '', phase: '', offset_days: 180, due_override: null, owner: '', status: 'todo',
  category: '', note: '', critical: false, created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Timeline() {
  const { get, settings, put } = useStore();
  const { can } = useAuth();
  const tasks = get('tasks');
  const [filter, setFilter] = useState<Filter>('open');
  const [group, setGroup] = useState<GroupBy>('phase');
  const [q, setQ] = useState('');
  const [view, setViewRaw] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  });
  const setView = (v: View) => {
    setViewRaw(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* only a convenience */
    }
  };
  const ed = useEditor<Task>('tasks', blank);
  const canWrite = can('tasks:write');

  const withState = useMemo(() => tasks.map((t) => ({ t, s: taskState(t, settings.target_date) })), [tasks, settings.target_date]);
  const sum = taskSummary(tasks, settings.target_date);

  const counts = {
    open: withState.filter((x) => !x.s.done).length,
    overdue: withState.filter((x) => x.s.overdue).length,
    soon: withState.filter((x) => x.s.soon).length,
    key: withState.filter((x) => x.t.critical && !x.s.done).length,
    all: withState.length,
  };

  const visible = useMemo(() => {
    const f = withState.filter(({ t, s }) => {
      if (filter === 'open' && s.done) return false;
      if (filter === 'overdue' && !s.overdue) return false;
      if (filter === 'soon' && !s.soon) return false;
      if (filter === 'key' && (!t.critical || s.done)) return false;
      return matches(q, t.title, t.note, t.owner, t.category, t.phase);
    });
    return sortBy(f, (x) => x.s.due, (x) => x.t.title);
  }, [withState, filter, q]);

  const groups = useMemo(() => {
    const key = (x: { t: Task }) => (group === 'phase' ? x.t.phase : group === 'category' ? x.t.category : x.t.owner) || 'Unassigned';
    const m = groupBy(visible, key);
    // phases in date order (by their earliest task), others alphabetically
    const entries = [...m.entries()];
    return group === 'phase' ? sortBy(entries, ([, xs]) => xs[0]?.s.due) : sortBy(entries, ([k]) => k);
  }, [visible, group]);

  const phaseTotals = useMemo(() => groupBy(withState, (x) => (group === 'phase' ? x.t.phase : group === 'category' ? x.t.category : x.t.owner) || 'Unassigned'), [withState, group]);
  const owners = uniq(tasks.map((t) => t.owner).filter(Boolean)).sort();
  const phases = uniq(tasks.map((t) => t.phase).filter(Boolean));
  const categories = uniq(tasks.map((t) => t.category).filter(Boolean)).sort();

  const cycle = (t: Task) => put('tasks', { ...t, status: NEXT[t.status] }).catch(() => undefined);

  return (
    <div>
      <SectionTitle
        sub={`Every due date is counted back from ${fmtDate(settings.target_date, { weekday: true })}. Move the wedding date and the plan moves with it.`}
        actions={
          <>
            <CsvButton
              filename="timeline.csv"
              rows={() => withState.map(({ t, s }) => ({ task: t.title, phase: t.phase, area: t.category, owner: t.owner, due: s.due, status: t.status, key: t.critical ? 'yes' : '', note: t.note }))}
            />
            <CanButton perm="tasks:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add task</CanButton>
          </>
        }
      >
        Timeline
      </SectionTitle>

      <StatGrid>
        <Stat label="Done" value={`${sum.done}/${sum.total}`} sub={`${Math.round(sum.pct * 100)}% complete`} tone="good" />
        <Stat label="Overdue" value={sum.overdue} tone={sum.overdue ? 'bad' : 'default'} />
        <Stat label="Next 30 days" value={sum.soon} />
        <Stat label="Key tasks open" value={counts.key} tone={counts.key ? 'warn' : 'default'} />
      </StatGrid>
      <Bar value={sum.pct} tone="good" className="mb-5" label="Overall progress" />

      <Toolbar>
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: <span className="inline-flex items-center gap-1.5"><IconList size={14} /> List</span> },
            { value: 'calendar', label: <span className="inline-flex items-center gap-1.5"><IconCalendar size={14} /> Calendar</span> },
          ]}
        />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'soon', label: 'Next 30 days', count: counts.soon },
            { value: 'key', label: 'Key', count: counts.key },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        {view === 'list' && <Segmented<GroupBy>
          size="sm"
          value={group}
          onChange={setGroup}
          options={[{ value: 'phase', label: 'By phase' }, { value: 'category', label: 'By area' }, { value: 'owner', label: 'By owner' }]}
        />}
        <div className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search tasks…" /></div>
      </Toolbar>

      {view === 'calendar' ? (
        <TimelineCalendar
          tasks={visible}
          onOpen={(t) => ed.open(t)}
          onAdd={(date) => {
            ed.open();
            ed.patch({ offset_days: daysBetween(date, settings.target_date) });
          }}
        />
      ) : visible.length === 0 ? (
        <Panel>
          <Empty
            title={tasks.length === 0 ? 'No tasks yet' : 'Nothing matches'}
            body={tasks.length === 0 ? 'Add the first task, or ask the assistant to draft a plan.' : 'Try another filter, or clear the search.'}
            action={tasks.length === 0 ? <CanButton perm="tasks:write" variant="primary" onClick={() => ed.open()}>Add a task</CanButton> : undefined}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map(([name, xs]) => {
            const all = phaseTotals.get(name) ?? [];
            const done = all.filter((x) => x.s.done).length;
            return (
              <Panel key={name}>
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
                  <h2 className="font-serif text-lg font-semibold">{name}</h2>
                  <div className="flex w-40 items-center gap-2 text-xs text-stone-500">
                    <Bar value={all.length ? done / all.length : 0} tone="good" label={`${name} progress`} />
                    <span className="tabular-nums">{done}/{all.length}</span>
                  </div>
                </div>
                <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                  {xs.map(({ t, s }) => (
                    <TaskRow key={t.id} t={t} s={s} canWrite={canWrite} onCycle={() => cycle(t)} onOpen={() => ed.open(t)} />
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add task' : 'Edit task'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="tasks" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="Task"><Input value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} placeholder="Book the photographer" /></Field>
            <Grid>
              <Field label="Status">
                <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as TaskStatus)}>
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </Field>
              <Field label="Phase">
                <Input list="phases" value={ed.draft.phase} onChange={(e) => ed.set('phase', e.target.value)} />
                <datalist id="phases">{phases.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
            </Grid>
            <Grid>
              <Field label="Days before the wedding" hint={ed.draft.due_override ? 'Ignored while a fixed date is set.' : `Due ${fmtDate(addDays(settings.target_date, -(ed.draft.offset_days ?? 0)), { weekday: true })}`}>
                <NumberInput value={ed.draft.offset_days} onChange={(v) => ed.set('offset_days', v ?? 0)} />
              </Field>
              <Field label="Fixed date instead" hint="For real-world deadlines that don't move with the wedding.">
                <Input type="date" value={ed.draft.due_override ?? ''} onChange={(e) => ed.set('due_override', e.target.value || null)} />
              </Field>
            </Grid>
            <Grid>
              <Field label="Area">
                <Input list="areas" value={ed.draft.category} onChange={(e) => ed.set('category', e.target.value)} />
                <datalist id="areas">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Owner">
                <Input list="owners" value={ed.draft.owner} onChange={(e) => ed.set('owner', e.target.value)} />
                <datalist id="owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
              </Field>
            </Grid>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
            <Check checked={ed.draft.critical} onChange={(v) => ed.set('critical', v)} label="Key task" hint="Things that block other things, or have a hard external deadline." />
            {ed.draft.due_override && (
              <p className="text-xs text-stone-500">
                Fixed date is {Math.abs(daysBetween(ed.draft.due_override, settings.target_date))} days {ed.draft.due_override <= settings.target_date ? 'before' : 'after'} the wedding.
              </p>
            )}
          </fieldset>
        )}
      </Modal>
    </div>
  );
}

function TaskRow({ t, s, canWrite, onCycle, onOpen }: { t: Task; s: TaskState; canWrite: boolean; onCycle: () => void; onOpen: () => void }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5" data-comment-key={t.id}>
      <button
        onClick={onCycle}
        disabled={!canWrite}
        title={canWrite ? 'Click to move to the next status' : whyNot('tasks:write')}
        className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
        aria-label={`Status: ${STATUS_LABEL[t.status]}. Change status`}
      >
        <Pill tone={STATUS_TONE[t.status]} className="w-14 justify-center">{STATUS_LABEL[t.status]}</Pill>
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className={cls('text-sm', s.done && 'text-stone-400 line-through')}>
          {t.title} {t.critical && <Pill tone="warn">key</Pill>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone-500">
          <span className={cls(s.overdue && 'font-medium text-rose-700 dark:text-rose-400')}>
            {fmtDate(s.due)}{!s.done && ` · ${relativeDays(s.days)}`}{t.due_override && ' · fixed date'}
          </span>
          {t.owner && <span>{t.owner}</span>}
          {t.category && <span>{t.category}</span>}
          {t.note && <span className="truncate">{t.note}</span>}
        </div>
      </button>
    </li>
  );
}
