// Decisions (main spec §7.12): an append-mostly log of every question settled, with the
// rationale that stops the argument coming back. Reversals supersede, never overwrite.
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Decision, DecisionStatus } from '@/lib/types';
import { daysUntil, fmtDate, matches, relativeDays, sortBy, todayISO, uniq } from '@/lib/util';
import { Area, Button, Empty, Field, Input, Modal, Panel, Pill, SearchInput, Segmented, Select, SectionTitle, Stat, StatGrid } from '@/components/kit';
import { CanButton } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconPlus } from '@/components/icons';
import { CsvButton, Grid, StatusPill, Toolbar, lines } from './common';

const STATUS_TONE = { open: 'warn', decided: 'good', parked: 'muted' } as const;

const blank = (): Decision => ({
  id: crypto.randomUUID(), wedding_id: '', title: '', area: '', status: 'open', decide_by: null, decided_on: null, decided_by: '',
  outcome: '', rationale: '', alternatives: [], impact: '', supersedes_id: null, created_on: todayISO(),
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Decisions() {
  const { get } = useStore();
  const { can } = useAuth();
  const decisions = get('decisions');
  const [filter, setFilter] = useState<'all' | DecisionStatus>('open');
  const [q, setQ] = useState('');
  const ed = useEditor<Decision>('decisions', blank);

  const byId = new Map(decisions.map((d) => [d.id, d]));
  const supersededBy = new Map(decisions.filter((d) => d.supersedes_id).map((d) => [d.supersedes_id!, d]));
  const open = decisions.filter((d) => d.status === 'open');
  const soonest = sortBy(open.filter((d) => d.decide_by), (d) => d.decide_by)[0];
  const visible = sortBy(
    decisions.filter((d) => (filter === 'all' || d.status === filter) && matches(q, d.title, d.area, d.outcome, d.rationale)),
    (d) => (d.status === 'open' ? 0 : d.status === 'parked' ? 2 : 1),
    (d) => (d.status === 'open' ? d.decide_by : null),
    (d) => (d.decided_on ? -new Date(d.decided_on).getTime() : 0),
  );

  return (
    <div>
      <SectionTitle
        sub="Phrase each entry as the question, record what you chose and why. When you change your mind, add a new decision that supersedes the old one — both stay."
        actions={
          <>
            <CsvButton filename="decisions.csv" rows={() => decisions.map((d) => ({ question: d.title, area: d.area, status: d.status, decide_by: d.decide_by, decided_on: d.decided_on, decided_by: d.decided_by, outcome: d.outcome, why: d.rationale, alternatives: d.alternatives, impact: d.impact, supersedes: d.supersedes_id ? byId.get(d.supersedes_id)?.title : '' }))} />
            <CanButton perm="decisions:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> New question</CanButton>
          </>
        }
      >
        Decisions
      </SectionTitle>

      <StatGrid>
        <Stat label="Open" value={open.length} sub={soonest ? `next: ${fmtDate(soonest.decide_by)} (${relativeDays(daysUntil(soonest.decide_by))})` : 'no deadlines set'} tone={soonest && (daysUntil(soonest.decide_by) ?? 1) < 0 ? 'bad' : 'warn'} />
        <Stat label="Settled" value={decisions.filter((d) => d.status === 'decided').length} tone="good" />
        <Stat label="Parked" value={decisions.filter((d) => d.status === 'parked').length} />
        <Stat label="Reversed" value={supersededBy.size} sub="superseded by a later decision" />
      </StatGrid>

      <Toolbar>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: open.length },
            { value: 'decided', label: 'Decided', count: decisions.filter((d) => d.status === 'decided').length },
            { value: 'parked', label: 'Parked', count: decisions.filter((d) => d.status === 'parked').length },
            { value: 'all', label: 'All', count: decisions.length },
          ]}
        />
        <div className="ml-auto"><SearchInput value={q} onChange={setQ} /></div>
      </Toolbar>

      {visible.length === 0 ? (
        <Panel><Empty title={decisions.length ? 'Nothing here' : 'No decisions yet'} body={decisions.length ? 'Try another filter.' : 'Write down the questions you need to settle.'} action={!decisions.length ? <CanButton perm="decisions:write" variant="primary" onClick={() => ed.open()}>Add a question</CanButton> : undefined} /></Panel>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const later = supersededBy.get(d.id);
            const earlier = d.supersedes_id ? byId.get(d.supersedes_id) : undefined;
            const due = daysUntil(d.decide_by);
            return (
              <Panel key={d.id} className={later ? 'opacity-60' : undefined}>
                <button className="block w-full p-4 text-left" onClick={() => ed.open(d)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold">{d.title}</h3>
                    <div className="flex gap-1">
                      {d.area && <Pill tone="muted">{d.area}</Pill>}
                      {later && <Pill tone="bad">reversed</Pill>}
                      <StatusPill value={d.status} tones={STATUS_TONE} />
                    </div>
                  </div>
                  {d.status === 'open' && d.decide_by && (
                    <div className={`mt-1 text-xs ${due !== null && due < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-stone-500'}`}>Decide by {fmtDate(d.decide_by)} · {relativeDays(due)}</div>
                  )}
                  {d.outcome && <p className="mt-2 text-sm"><span className="font-medium">We chose: </span>{d.outcome}</p>}
                  {d.rationale && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300"><span className="font-medium">Why: </span>{d.rationale}</p>}
                  {d.alternatives.length > 0 && <p className="mt-1 text-xs text-stone-500">{d.status === 'decided' ? 'Rejected' : 'Options'}: {d.alternatives.join(' · ')}</p>}
                  {d.impact && <p className="mt-1 text-xs text-stone-500">Impact: {d.impact}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-stone-500">
                    {d.decided_on && <span>Decided {fmtDate(d.decided_on)}{d.decided_by && ` by ${d.decided_by}`}</span>}
                    {earlier && <span>Supersedes “{earlier.title}”</span>}
                    {later && <span>Superseded by “{later.title}”</span>}
                  </div>
                </button>
                {d.status === 'decided' && !later && can('decisions:write') && (
                  <div className="border-t border-stone-100 px-4 py-2 dark:border-stone-800">
                    <Button size="sm" variant="subtle" onClick={() => ed.open({ ...blank(), title: d.title, area: d.area, supersedes_id: d.id, alternatives: d.outcome ? [d.outcome] : [] })}>
                      Revisit — record a new decision
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <Modal open={!!ed.draft} wide title={ed.isNew ? (ed.draft?.supersedes_id ? 'Revisit a decision' : 'New question') : 'Decision'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="decisions" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="The question" hint="Phrase it as the question, not the answer: “Where do we marry legally?”"><Input value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
            <Grid cols={3}>
              <Field label="Area">
                <Input list="decision-areas" value={ed.draft.area} onChange={(e) => ed.set('area', e.target.value)} />
                <datalist id="decision-areas">{uniq(decisions.map((d) => d.area).filter(Boolean)).map((a) => <option key={a} value={a} />)}</datalist>
              </Field>
              <Field label="Status">
                <Select
                  value={ed.draft.status}
                  onChange={(e) => {
                    const s = e.target.value as DecisionStatus;
                    ed.patch({ status: s, decided_on: s === 'decided' ? ed.draft!.decided_on ?? todayISO() : ed.draft!.decided_on });
                  }}
                >
                  <option value="open">Open</option><option value="decided">Decided</option><option value="parked">Parked</option>
                </Select>
              </Field>
              <Field label="Decide by"><Input type="date" value={ed.draft.decide_by ?? ''} onChange={(e) => ed.set('decide_by', e.target.value || null)} /></Field>
            </Grid>
            <Field label="What we chose"><Area rows={2} value={ed.draft.outcome} onChange={(e) => ed.set('outcome', e.target.value)} /></Field>
            <Field label="Why" hint="The reasoning that stops the argument recurring."><Area value={ed.draft.rationale} onChange={(e) => ed.set('rationale', e.target.value)} /></Field>
            <Grid>
              <Field label="Alternatives considered" hint="One per line"><Area value={lines.toText(ed.draft.alternatives)} onChange={(e) => ed.set('alternatives', lines.fromText(e.target.value))} /></Field>
              <Field label="Impact"><Area value={ed.draft.impact} onChange={(e) => ed.set('impact', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Decided on"><Input type="date" value={ed.draft.decided_on ?? ''} onChange={(e) => ed.set('decided_on', e.target.value || null)} /></Field>
              <Field label="Decided by"><Input value={ed.draft.decided_by} onChange={(e) => ed.set('decided_by', e.target.value)} placeholder="Both of us" /></Field>
              <Field label="Supersedes">
                <Select value={ed.draft.supersedes_id ?? ''} onChange={(e) => ed.set('supersedes_id', e.target.value || null)}>
                  <option value="">—</option>
                  {decisions.filter((d) => d.id !== ed.draft!.id && d.status === 'decided').map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </Select>
              </Field>
            </Grid>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
