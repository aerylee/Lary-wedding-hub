// Venues (main spec §7.2): a decision instrument, not a list. Weighted scores rank the
// shortlist; the banner distinguishes still-choosing, held-but-unsigned and signed.
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Venue, VenueStatus } from '@/lib/types';
import { VENUE_CRITERIA, chosenVenue, venueScore, type Criterion } from '@/lib/derive';
import { cls, daysUntil, eur, fmtDate, num, pct, relativeDays, sortBy } from '@/lib/util';
import { Area, Banner, Bar, Check, Empty, Field, IconButton, Input, Modal, Money, NumberInput, Panel, PanelHead, Pill, Segmented, Select, SectionTitle } from '@/components/kit';
import { CanButton } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconPencil, IconPlus } from '@/components/icons';
import { Grid, StatusPill, lines } from './common';

const STATUSES: VenueStatus[] = ['shortlist', 'visiting', 'quoted', 'held', 'booked', 'passed'];
const STATUS_TONE = { shortlist: 'default', visiting: 'info', quoted: 'info', held: 'warn', booked: 'good', passed: 'muted' } as const;
const CRITERION_LABEL: Record<Criterion, string> = {
  cost: 'Cost', capacity: 'Capacity', lodging: 'Beds / lodging', legal: 'Legal marriage', travel: 'Getting there',
  weather: 'Weather', flexibility: 'Flexibility', feel: 'Feel',
};
const DEFAULT_WEIGHTS: Record<Criterion, number> = { cost: 3, capacity: 2, lodging: 2, legal: 3, travel: 2, weather: 1, flexibility: 1, feel: 3 };

const blank = (): Venue => ({
  id: crypto.randomUUID(), wedding_id: '', name: '', status: 'shortlist', country: '', region: '', town: '', url: '', nearest_airport: '',
  airport_mins: null, capacity_seated: null, beds_on_site: null, catering_model: '', curfew: '', rain_plan: '', exclusivity: '',
  quote_eur: null, quote_is_estimate: true, hold_expires: null, legal_note: '', scores: {}, pros: [], cons: [], notes: '', visit_date: null,
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Venues() {
  const { get, settings, saveSettings } = useStore();
  const { can } = useAuth();
  const venues = get('venues');
  const [view, setView] = useState<'grid' | 'cards'>('grid');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const ed = useEditor<Venue>('venues', blank);
  const chosen = chosenVenue(venues);

  const ranked = useMemo(
    () => sortBy(venues.map((v) => ({ v, score: venueScore(v.scores, weights) })), (x) => (x.v.status === 'passed' ? 1 : 0), (x) => -x.score),
    [venues, weights],
  );
  const decideIn = daysUntil(settings.decide_venue_by);

  return (
    <div>
      <SectionTitle
        sub="Score each venue 1–5 on what matters, weight what matters most, and let the ranking argue with your gut."
        actions={<CanButton perm="venues:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add venue</CanButton>}
      >
        Venues
      </SectionTitle>

      {chosen.signed && chosen.venue ? (
        <Banner tone="good"><strong>{chosen.venue.name} is booked.</strong> The others stay here as the record of why.</Banner>
      ) : chosen.held && chosen.venue ? (
        <Banner tone="warn">
          <strong>{chosen.venue.name} is holding your dates</strong>{chosen.venue.hold_expires && ` until ${fmtDate(chosen.venue.hold_expires)} (${relativeDays(daysUntil(chosen.venue.hold_expires))})`}.
          A hold is a courtesy, not a booking — get the contract, then mark it booked.
        </Banner>
      ) : (
        <Banner
          tone={decideIn !== null && decideIn < 90 ? 'bad' : 'info'}
          action={
            <label className="flex items-center gap-2 text-xs">
              Decide by
              <Input
                type="date"
                className="h-8 w-40 py-1"
                disabled={!can('settings:write')}
                value={settings.decide_venue_by ?? ''}
                onChange={(e) => saveSettings({ decide_venue_by: e.target.value || null }).catch(() => undefined)}
              />
            </label>
          }
        >
          <strong>Nothing chosen yet.</strong> Score them and pick one{decideIn !== null && decideIn >= 0 ? ` — your decide-by date is ${relativeDays(decideIn)}` : decideIn !== null ? ' — your decide-by date has passed' : ''}.
          When one is holding your dates, mark it held.
        </Banner>
      )}

      {venues.length === 0 ? (
        <Panel>
          <Empty title="No venues yet" body="Add the places you're considering — even the ones you're lukewarm on. Comparison is the point." action={<CanButton perm="venues:write" variant="primary" onClick={() => ed.open()}>Add a venue</CanButton>} />
        </Panel>
      ) : (
        <>
          <Panel className="mb-4">
            <PanelHead
              title="Ranking"
              sub="Σ(weight × score) as a share of the best possible"
              actions={<button className="text-xs font-medium text-amber-800 underline dark:text-amber-400" onClick={() => setShowWeights((s) => !s)}>{showWeights ? 'Hide weights' : 'Adjust weights'}</button>}
            />
            {showWeights && (
              <div className="grid gap-x-6 gap-y-2 border-b border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-stone-800">
                {VENUE_CRITERIA.map((c) => (
                  <label key={c} className="text-xs">
                    <span className="flex justify-between"><span>{CRITERION_LABEL[c]}</span><span className="tabular-nums">×{weights[c]}</span></span>
                    <input type="range" min={0} max={5} value={weights[c]} onChange={(e) => setWeights({ ...weights, [c]: Number(e.target.value) })} className="w-full accent-amber-700" />
                  </label>
                ))}
                <p className="col-span-full text-xs text-stone-500">Weights are just for this view — they aren&rsquo;t saved. Scores are saved on each venue.</p>
              </div>
            )}
            <ol className="divide-y divide-stone-100 dark:divide-stone-800">
              {ranked.map(({ v, score }, i) => (
                <li key={v.id} className={cls('flex items-center gap-3 px-4 py-2.5', v.status === 'passed' && 'opacity-50')}>
                  <span className="w-5 text-right text-sm tabular-nums text-stone-400">{v.status === 'passed' ? '–' : i + 1}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => ed.open(v)}>
                    <div className="truncate text-sm font-medium">{v.name}</div>
                    <div className="truncate text-xs text-stone-500">{[v.town, v.region, v.country].filter(Boolean).join(', ')}</div>
                  </button>
                  <StatusPill value={v.status} tones={STATUS_TONE} />
                  <div className="hidden w-40 items-center gap-2 sm:flex">
                    <Bar value={score} tone={i === 0 && v.status !== 'passed' ? 'good' : 'default'} label={`${v.name} score`} />
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{pct(score)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Segmented className="mb-3" value={view} onChange={setView} options={[{ value: 'grid', label: 'Comparison grid' }, { value: 'cards', label: 'Detail cards' }]} />
          {view === 'grid' ? <ComparisonGrid venues={ranked.map((r) => r.v)} weights={weights} onEdit={ed.open} /> : <Cards venues={ranked.map((r) => r.v)} onEdit={ed.open} />}
        </>
      )}

      <Modal open={!!ed.draft} wide title={ed.isNew ? 'Add venue' : ed.draft?.name || 'Venue'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="venues" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid cols={3}>
              <Field label="Name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
              <Field label="Status" hint="Held = holding your dates, unsigned. Booked = contract signed.">
                <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as VenueStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Website"><Input type="url" value={ed.draft.url} onChange={(e) => ed.set('url', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Country"><Input value={ed.draft.country} onChange={(e) => ed.set('country', e.target.value)} /></Field>
              <Field label="Region"><Input value={ed.draft.region} onChange={(e) => ed.set('region', e.target.value)} /></Field>
              <Field label="Town"><Input value={ed.draft.town} onChange={(e) => ed.set('town', e.target.value)} /></Field>
            </Grid>
            <Grid cols={4}>
              <Field label="Nearest airport"><Input value={ed.draft.nearest_airport} onChange={(e) => ed.set('nearest_airport', e.target.value)} /></Field>
              <Field label="Transfer (mins)"><NumberInput value={ed.draft.airport_mins} onChange={(v) => ed.set('airport_mins', v)} /></Field>
              <Field label="Seated capacity"><NumberInput value={ed.draft.capacity_seated} onChange={(v) => ed.set('capacity_seated', v)} /></Field>
              <Field label="Beds on site"><NumberInput value={ed.draft.beds_on_site} onChange={(v) => ed.set('beds_on_site', v)} /></Field>
            </Grid>
            <Grid>
              <Field label="Catering model"><Input value={ed.draft.catering_model} onChange={(e) => ed.set('catering_model', e.target.value)} placeholder="In-house only / external allowed" /></Field>
              <Field label="Curfew"><Input value={ed.draft.curfew} onChange={(e) => ed.set('curfew', e.target.value)} /></Field>
              <Field label="Rain plan"><Input value={ed.draft.rain_plan} onChange={(e) => ed.set('rain_plan', e.target.value)} /></Field>
              <Field label="Exclusivity"><Input value={ed.draft.exclusivity} onChange={(e) => ed.set('exclusivity', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Quote (EUR)"><Money value={ed.draft.quote_eur} onChange={(v) => ed.set('quote_eur', v)} /></Field>
              <Field label="Hold expires"><Input type="date" value={ed.draft.hold_expires ?? ''} onChange={(e) => ed.set('hold_expires', e.target.value || null)} /></Field>
              <Field label="Visit date"><Input type="date" value={ed.draft.visit_date ?? ''} onChange={(e) => ed.set('visit_date', e.target.value || null)} /></Field>
            </Grid>
            <Check checked={ed.draft.quote_is_estimate} onChange={(v) => ed.set('quote_is_estimate', v)} label="The quote is our estimate, not their figure" />
            <Field label="Legal marriage" hint="Can you legally marry here, and how? (See the Legal page.)"><Input value={ed.draft.legal_note} onChange={(e) => ed.set('legal_note', e.target.value)} /></Field>
            <div>
              <div className="mb-1 text-xs font-medium text-stone-600 dark:text-stone-300">Scores (1 poor – 5 excellent)</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VENUE_CRITERIA.map((c) => {
                  const scores = (ed.draft!.scores ?? {}) as Record<string, number>;
                  return (
                    <Field key={c} label={CRITERION_LABEL[c]}>
                      <Select value={scores[c] ?? ''} onChange={(e) => ed.set('scores', { ...scores, [c]: e.target.value ? Number(e.target.value) : undefined })}>
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Select>
                    </Field>
                  );
                })}
              </div>
            </div>
            <Grid>
              <Field label="Pros" hint="One per line"><Area value={lines.toText(ed.draft.pros)} onChange={(e) => ed.set('pros', lines.fromText(e.target.value))} /></Field>
              <Field label="Cons" hint="One per line"><Area value={lines.toText(ed.draft.cons)} onChange={(e) => ed.set('cons', lines.fromText(e.target.value))} /></Field>
            </Grid>
            <Field label="Notes"><Area value={ed.draft.notes} onChange={(e) => ed.set('notes', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}

function ComparisonGrid({ venues, weights, onEdit }: { venues: Venue[]; weights: Record<Criterion, number>; onEdit: (v: Venue) => void }) {
  const { can } = useAuth();
  const rows: [string, (v: Venue) => ReactNode][] = [
    ['Status', (v) => <StatusPill value={v.status} tones={STATUS_TONE} />],
    ['Score', (v) => <strong>{pct(venueScore(v.scores, weights))}</strong>],
    ['Where', (v) => [v.town, v.region, v.country].filter(Boolean).join(', ') || '—'],
    ['Legal marriage', (v) => v.legal_note || '—'],
    ['Seated capacity', (v) => v.capacity_seated ?? '—'],
    ['Beds on site', (v) => v.beds_on_site ?? '—'],
    ['Airport & transfer', (v) => (v.nearest_airport ? `${v.nearest_airport}${v.airport_mins ? ` · ${v.airport_mins} min` : ''}` : '—')],
    ['Catering', (v) => v.catering_model || '—'],
    ['Rain plan', (v) => v.rain_plan || '—'],
    ['Curfew', (v) => v.curfew || '—'],
    ['Exclusivity', (v) => v.exclusivity || '—'],
    ['Quote', (v) => (v.quote_eur !== null ? <>{eur(num(v.quote_eur))} {v.quote_is_estimate && <Pill tone="warn">estimate</Pill>}</> : '—')],
    ['Hold expires', (v) => (v.hold_expires ? fmtDate(v.hold_expires) : '—')],
    ['Visit', (v) => (v.visit_date ? fmtDate(v.visit_date) : '—')],
  ];
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-stone-900" />
            {venues.map((v) => (
              <th key={v.id} className={cls('min-w-[12rem] border-b border-stone-200 px-3 py-2 text-left align-bottom dark:border-stone-800', v.status === 'passed' && 'opacity-50')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-base font-semibold">{v.name}</span>
                  <IconButton label={can('venues:write') ? `Edit ${v.name}` : `View ${v.name}`} onClick={() => onEdit(v)}><IconPencil /></IconButton>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, render]) => (
            <tr key={label}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-stone-100 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:bg-stone-900">{label}</th>
              {venues.map((v) => (
                <td key={v.id} className={cls('border-b border-stone-100 px-3 py-2 align-top dark:border-stone-800', v.status === 'passed' && 'opacity-50')}>{render(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Cards({ venues, onEdit }: { venues: Venue[]; onEdit: (v: Venue) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {venues.map((v) => (
        <Panel key={v.id} className={cls(v.status === 'passed' && 'opacity-60')}>
          <PanelHead
            title={v.name}
            sub={[v.town, v.region, v.country].filter(Boolean).join(', ')}
            actions={<><StatusPill value={v.status} tones={STATUS_TONE} /><IconButton label={`Edit ${v.name}`} onClick={() => onEdit(v)}><IconPencil /></IconButton></>}
          />
          <div className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-stone-600 dark:text-stone-300">
              {v.quote_eur !== null && <span>Quote <strong>{eur(num(v.quote_eur))}</strong>{v.quote_is_estimate && ' (estimate)'}</span>}
              {v.hold_expires && <span>Hold expires {fmtDate(v.hold_expires)}</span>}
              {v.capacity_seated && <span>{v.capacity_seated} seated</span>}
              {v.beds_on_site && <span>{v.beds_on_site} beds</span>}
            </div>
            {v.legal_note && <p><span className="font-medium">Legal: </span>{v.legal_note}</p>}
            {(v.pros.length > 0 || v.cons.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <ul className="space-y-0.5">{v.pros.map((p) => <li key={p} className="text-emerald-800 dark:text-emerald-400">+ {p}</li>)}</ul>
                <ul className="space-y-0.5">{v.cons.map((c) => <li key={c} className="text-rose-800 dark:text-rose-400">− {c}</li>)}</ul>
              </div>
            )}
            {v.notes && <p className="whitespace-pre-wrap text-stone-600 dark:text-stone-300">{v.notes}</p>}
            {v.url && <a href={v.url} target="_blank" rel="noreferrer" className="text-amber-800 underline dark:text-amber-400">Website</a>}
          </div>
        </Panel>
      ))}
    </div>
  );
}
