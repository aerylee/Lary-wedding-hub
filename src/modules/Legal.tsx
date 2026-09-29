// Legal (main spec §7.11). Leads with why the country matters, groups documents by
// country, and does the validity maths — several documents expire before a far-off wedding.
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { LegalDoc, LegalStatus } from '@/lib/types';
import { validityWarnings } from '@/lib/derive';
import { addDays, cls, fmtDate, groupBy, sortBy, uniq } from '@/lib/util';
import { Area, Check, Empty, Field, Input, Modal, NumberInput, Panel, PanelHead, Pill, Select, SectionTitle, Stat, StatGrid } from '@/components/kit';
import { CanButton } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconAlert, IconPlus } from '@/components/icons';
import { CsvButton, Grid, StatusPill, usePlan } from './common';

const STATUSES: LegalStatus[] = ['not_started', 'in_progress', 'obtained', 'expired', 'na'];
const STATUS_LABEL: Record<LegalStatus, string> = { not_started: 'Not started', in_progress: 'In progress', obtained: 'Obtained', expired: 'Expired', na: 'N/A' };
const STATUS_TONE = { not_started: 'default', in_progress: 'info', obtained: 'good', expired: 'bad', na: 'muted' } as const;

/** Planning summaries, not legal advice — the footer and the card both say so. */
const LAW: Record<string, { civil: boolean; summary: string; points: string[] }> = {
  Italy: {
    civil: true,
    summary: 'Two foreign nationals can marry civilly, with no residency requirement.',
    points: [
      'Paperwork: sworn statement at your consulate in Italy, then a Nulla Osta legalised at the Prefettura.',
      'Most home documents must be recent (within about 6 months), apostilled and translated by a sworn translator.',
      'The civil ceremony is at the town hall or an authorised venue; a religious or symbolic ceremony can follow.',
    ],
  },
  France: {
    civil: false,
    summary: 'A civil marriage needs one of you to have lived in the commune for about 40 days first.',
    points: [
      'The banns are posted at the mairie for 10 days, after the residency period.',
      'In practice most couples marry legally at home and hold a symbolic ceremony in France.',
      'Certificates de coutume and de célibat must be under 3 months old.',
    ],
  },
  Portugal: { civil: true, summary: 'Foreign nationals can marry civilly after a registry process of several weeks.', points: ['Start the process at a civil registry office 1–3 months ahead.', 'Documents need apostilles and translation.'] },
  Spain: { civil: false, summary: 'Civil marriage generally requires one partner to be resident.', points: ['Most visiting couples marry at home and celebrate symbolically in Spain.'] },
  Greece: { civil: true, summary: 'Civil and Orthodox ceremonies are open to foreign nationals.', points: ['Publish a notice in a local newspaper; documents need apostilles and translation.'] },
};

const blank = (): LegalDoc => ({
  id: crypto.randomUUID(), wedding_id: '', country: 'Both', title: '', who: '', issued_by: '', needs_apostille: false, needs_translation: false,
  validity_days: null, lead_time: '', status: 'not_started', obtained_on: null, expires_on: null, note: '',
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Legal() {
  const { get, settings } = useStore();
  const { chosen } = usePlan();
  const docs = get('legal_docs');
  const ed = useEditor<LegalDoc>('legal_docs', blank);
  const candidates = settings.candidate_countries.length ? settings.candidate_countries : uniq(docs.map((d) => d.country).filter((c) => c !== 'Both'));
  const active = chosen.venue?.country && candidates.includes(chosen.venue.country) ? chosen.venue.country : null;

  const warnings = useMemo(() => new Map(validityWarnings(docs, settings.target_date).map((w) => [w.doc.id, w])), [docs, settings.target_date]);
  // the documents that matter: Both, plus the active country (or all candidates while undecided)
  const relevant = docs.filter((d) => d.status !== 'na' && (d.country === 'Both' || !active || d.country === active));
  const obtained = relevant.filter((d) => d.status === 'obtained').length;

  const groups = useMemo(() => {
    const order = (c: string) => (c === 'Both' ? 0 : c === active ? 1 : candidates.includes(c) ? 2 + candidates.indexOf(c) : 99);
    return sortBy([...groupBy(docs, (d) => d.country || 'Both').entries()], ([c]) => order(c), ([c]) => c);
  }, [docs, active, candidates]);

  return (
    <div>
      <SectionTitle
        sub="Where you can legally marry decides most of the paperwork. Validity windows matter: obtain some documents too early and they lapse before the wedding."
        actions={
          <>
            <CsvButton filename="legal-documents.csv" rows={() => docs.map((d) => ({ country: d.country, document: d.title, who: d.who, issued_by: d.issued_by, apostille: d.needs_apostille ? 'yes' : '', translation: d.needs_translation ? 'yes' : '', validity_days: d.validity_days, lead_time: d.lead_time, status: STATUS_LABEL[d.status], obtained: d.obtained_on, expires: d.expires_on, note: d.note }))} />
            <CanButton perm="legal:write" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add document</CanButton>
          </>
        }
      >
        Legal
      </SectionTitle>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        {candidates.slice(0, 2).map((c) => {
          const law = LAW[c];
          const ruledOut = active && c !== active;
          return (
            <Panel key={c} className={cls(ruledOut && 'opacity-70')}>
              <PanelHead
                title={c}
                sub={active === c ? 'Your venue is here — this is the path.' : ruledOut ? 'The record of why it was ruled out.' : law ? (law.civil ? 'Civil marriage possible for visitors' : 'Civil marriage hard for visitors') : undefined}
                actions={active === c ? <Pill tone="good">active path</Pill> : law ? <Pill tone={law.civil ? 'good' : 'warn'}>{law.civil ? 'civil OK' : 'residency'}</Pill> : undefined}
              />
              <div className="p-4 text-sm">
                {law ? (
                  <>
                    <p className="font-medium">{law.summary}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600 dark:text-stone-300">{law.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  </>
                ) : (
                  <p className="text-stone-500">No summary for {c} yet. Check with the embassy and a local celebrant, and record the documents below.</p>
                )}
                <p className="mt-3 text-xs text-stone-500">A planning summary, not legal advice. Confirm with the town hall and your consulate.</p>
              </div>
            </Panel>
          );
        })}
      </div>

      <StatGrid>
        <Stat label="Obtained" value={`${obtained}/${relevant.length}`} sub={active ? `for ${active}` : 'all candidate paths'} tone={obtained === relevant.length && relevant.length ? 'good' : 'default'} />
        <Stat label="Active path" value={active ?? 'Undecided'} sub={active ? chosen.venue?.name : 'choose a venue to narrow the list'} />
        <Stat label="Apostilles needed" value={relevant.filter((d) => d.needs_apostille).length} />
        <Stat label="Sworn translations" value={relevant.filter((d) => d.needs_translation).length} />
      </StatGrid>

      {docs.length === 0 ? (
        <Panel><Empty title="No documents yet" body="List every certificate, statement and stamp you'll need, by country." action={<CanButton perm="legal:write" variant="primary" onClick={() => ed.open()}>Add a document</CanButton>} /></Panel>
      ) : (
        <div className="space-y-4">
          {groups.map(([country, list]) => (
            <Panel key={country} className={cls(active && country !== 'Both' && country !== active && 'opacity-60')}>
              <PanelHead title={country === 'Both' ? 'Needed either way' : country} sub={active && country !== 'Both' && country !== active ? 'Not your path — kept for the record.' : undefined} />
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {sortBy(list, (d) => (d.status === 'na' ? 1 : 0), (d) => d.title).map((d) => {
                  const w = warnings.get(d.id);
                  return (
                    <li key={d.id}>
                      <button onClick={() => ed.open(d)} className={cls('flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/40', d.status === 'na' && 'opacity-50')}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{d.title}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone-500">
                            {d.who && <span>{d.who}</span>}
                            {d.issued_by && <span>{d.issued_by}</span>}
                            {d.lead_time && <span>lead time {d.lead_time}</span>}
                            {d.validity_days && <span>valid {d.validity_days} days</span>}
                            {d.obtained_on && <span>obtained {fmtDate(d.obtained_on)}</span>}
                          </div>
                          {w && (
                            <div className={cls('mt-1 flex items-start gap-1 text-xs', w.severity === 'problem' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>
                              <IconAlert size={12} className="mt-0.5 shrink-0" /> {w.message}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {d.needs_apostille && <Pill>apostille</Pill>}
                          {d.needs_translation && <Pill>translation</Pill>}
                          <StatusPill value={d.status} tones={STATUS_TONE} labels={STATUS_LABEL} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add document' : 'Edit document'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="legal_docs" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="Document"><Input value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
            <Grid>
              <Field label="Country">
                <Input list="legal-countries" value={ed.draft.country} onChange={(e) => ed.set('country', e.target.value)} />
                <datalist id="legal-countries">{['Both', ...candidates].map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Status">
                <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as LegalStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </Field>
            </Grid>
            <Grid>
              <Field label="Whose"><Input value={ed.draft.who} onChange={(e) => ed.set('who', e.target.value)} placeholder="Each of you" /></Field>
              <Field label="Issued by"><Input value={ed.draft.issued_by} onChange={(e) => ed.set('issued_by', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Valid for (days)"><NumberInput value={ed.draft.validity_days} onChange={(v) => ed.set('validity_days', v)} /></Field>
              <Field label="Obtained on">
                <Input
                  type="date"
                  value={ed.draft.obtained_on ?? ''}
                  onChange={(e) => {
                    const on = e.target.value || null;
                    ed.patch({ obtained_on: on, expires_on: on && ed.draft!.validity_days ? addDays(on, ed.draft!.validity_days) : ed.draft!.expires_on });
                  }}
                />
              </Field>
              <Field label="Expires on"><Input type="date" value={ed.draft.expires_on ?? ''} onChange={(e) => ed.set('expires_on', e.target.value || null)} /></Field>
            </Grid>
            <Field label="Lead time"><Input value={ed.draft.lead_time} onChange={(e) => ed.set('lead_time', e.target.value)} placeholder="2–6 weeks" /></Field>
            <div className="flex flex-wrap gap-5">
              <Check checked={ed.draft.needs_apostille} onChange={(v) => ed.set('needs_apostille', v)} label="Needs an apostille" />
              <Check checked={ed.draft.needs_translation} onChange={(v) => ed.set('needs_translation', v)} label="Needs a sworn translation" />
            </div>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
            {ed.draft.validity_days && !ed.draft.obtained_on && (
              <p className="text-xs text-stone-500">Obtain on or after {fmtDate(addDays(settings.target_date, -ed.draft.validity_days))} so it is still valid on the day.</p>
            )}
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
