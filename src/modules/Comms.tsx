// Comms (main spec §7.10): send tracking, templates, the vendor log, and the guest FAQ.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { CommsRow, Correspondence, Faq, Template } from '@/lib/types';
import { fillTemplate, templateTokens } from '@/lib/derive';
import { cls, daysUntil, fmtDate, matches, relativeDays, sortBy, todayISO, uniq } from '@/lib/util';
import {
  Area, Bar, Button, Check, Empty, Field, IconButton, Input, Modal, Panel, PanelHead, Pill, SearchInput, Segmented, Select, SectionTitle, TD, TH, TR, TWrap,
} from '@/components/kit';
import { CanButton, whyNot } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { Attachments } from '@/components/Attachments';
import { Autofill } from '@/components/Autofill';
import { IconArrowDown, IconArrowUp, IconCheck, IconCopy, IconPaperclip, IconPlus } from '@/components/icons';
import { useToast } from '@/components/toast';
import { CsvButton, Grid, Toolbar, usePlan } from './common';

type Tab = 'tracking' | 'templates' | 'log' | 'faq';

export default function Comms() {
  const { get } = useStore();
  const [tab, setTab] = useState<Tab>('tracking');
  const awaiting = get('correspondence').filter((c) => !c.done).length;
  return (
    <div>
      <SectionTitle sub="What went out to whom and when, the words you send, every conversation with a vendor, and the answers guests keep asking for.">Comms</SectionTitle>
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tracking', label: 'Send tracking' },
          { value: 'templates', label: 'Templates', count: get('templates').length },
          { value: 'log', label: 'Vendor log', count: awaiting || undefined },
          { value: 'faq', label: 'Guest FAQ', count: get('faqs').length },
        ]}
      />
      {tab === 'tracking' && <Tracking />}
      {tab === 'templates' && <Templates />}
      {tab === 'log' && <VendorLog />}
      {tab === 'faq' && <FaqTab />}
    </div>
  );
}

// ─── 1. send tracking ────────────────────────────────────────────────────────
const STAGES = [
  { key: 'save_the_date', label: 'Save the date' },
  { key: 'invitation', label: 'Invitation' },
  { key: 'reminder', label: 'Reminder' },
  { key: 'thank_you', label: 'Thank you' },
] as const;
type Stage = (typeof STAGES)[number]['key'];

function Tracking() {
  const { get, put } = useStore();
  const { can } = useAuth();
  const w = can('comms:write');
  const rows = get('comms_rows');
  const households = uniq([...get('guests').map((g) => g.household).filter(Boolean), ...rows.map((r) => r.household)]).sort();
  const byHousehold = new Map(rows.map((r) => [r.household, r]));
  const [editing, setEditing] = useState<CommsRow | null>(null);

  const upsert = (household: string, patch: Partial<CommsRow>) => {
    const existing = byHousehold.get(household);
    return put('comms_rows', { ...(existing ?? { household }), ...patch }).catch(() => undefined);
  };

  if (!households.length) return <Panel><Empty title="No households yet" body="Households come from the guest list. Add guests first, then track what's been sent to each." /></Panel>;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAGES.map((s) => {
          const sent = households.filter((h) => byHousehold.get(h)?.[s.key]).length;
          return (
            <Panel key={s.key} className="p-3">
              <div className="flex justify-between text-sm"><span>{s.label}</span><span className="tabular-nums text-stone-500">{sent}/{households.length}</span></div>
              <Bar value={sent / households.length} tone={sent === households.length ? 'good' : 'default'} className="mt-2" label={s.label} />
            </Panel>
          );
        })}
      </div>
      <Panel>
        <PanelHead
          title="By household"
          sub={w ? 'Tick when it goes out — the date is recorded. Click a date to change it.' : whyNot('comms:write')}
          actions={<CsvButton filename="comms-tracking.csv" rows={() => households.map((h) => { const r = byHousehold.get(h); return { household: h, save_the_date: r?.save_the_date, invitation: r?.invitation, reminder: r?.reminder, thank_you: r?.thank_you, channel: r?.channel, note: r?.note }; })} />}
        />
        <TWrap>
          <thead><tr><TH>Household</TH>{STAGES.map((s) => <TH key={s.key} align="center">{s.label}</TH>)}<TH>Channel</TH><TH>Note</TH></tr></thead>
          <tbody>
            {households.map((h) => {
              const r = byHousehold.get(h);
              return (
                <tr key={h}>
                  <TD className="font-medium">{h}</TD>
                  {STAGES.map((s) => (
                    <TD key={s.key} align="center">
                      <StageCell value={r?.[s.key] ?? null} disabled={!w} onChange={(v) => upsert(h, { [s.key]: v } as Partial<Record<Stage, string | null>>)} />
                    </TD>
                  ))}
                  <TD className="text-stone-500">{r?.channel}</TD>
                  <TD>
                    <button className="max-w-[14rem] truncate text-left text-xs text-stone-500 hover:underline disabled:no-underline" disabled={!w} onClick={() => setEditing(r ?? ({ household: h, channel: '', note: '' } as CommsRow))}>
                      {r?.note || (w ? 'Add channel / note' : '')}
                    </button>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </TWrap>
      </Panel>
      <Modal
        open={!!editing}
        title={editing?.household ?? ''}
        onClose={() => setEditing(null)}
        footer={<><Button variant="subtle" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={() => upsert(editing!.household, { channel: editing!.channel, note: editing!.note }).then(() => setEditing(null))}>Save</Button></>}
      >
        {editing && (
          <div className="space-y-3">
            <Field label="Channel"><Input value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} placeholder="Post, email, WhatsApp" /></Field>
            <Field label="Note"><Area value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function StageCell({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled: boolean }) {
  const [edit, setEdit] = useState(false);
  if (edit) return <Input type="date" autoFocus className="h-8 w-36 py-1" defaultValue={value ?? ''} onBlur={(e) => { setEdit(false); onChange(e.target.value || null); }} />;
  if (value) return <button disabled={disabled} className="rounded-md px-1.5 py-0.5 text-xs text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950" onClick={() => setEdit(true)}>{fmtDate(value, { year: false })}</button>;
  return (
    <button disabled={disabled} title={disabled ? whyNot('comms:write') : 'Mark sent today'} onClick={() => onChange(todayISO())} className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-300 text-stone-300 hover:border-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed dark:border-stone-700">
      <IconCheck size={12} />
    </button>
  );
}

// ─── 2. templates ────────────────────────────────────────────────────────────
function Templates() {
  const { get } = useStore();
  const { settings, headcount, chosen } = usePlan();
  const toast = useToast();
  const templates = sortBy(get('templates'), (t) => t.sort_order, (t) => t.name);
  const households = uniq(get('guests').map((g) => g.household).filter(Boolean)).sort();
  const [selected, setSelected] = useState<string | null>(templates[0]?.id ?? null);
  const [household, setHousehold] = useState('');
  const ed = useEditor<Template>('templates', () => ({ id: crypto.randomUUID(), wedding_id: '', name: '', audience: 'guest', channel: 'email', subject: '', body: '', sort_order: templates.length + 1, created_at: '', updated_at: '', created_by: null, updated_by: null }));
  const t = templates.find((x) => x.id === selected) ?? templates[0];
  const tokens = templateTokens(settings, chosen.venue, headcount, household);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied', 'ok');
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Panel className="self-start">
        <PanelHead title="Templates" actions={<CanButton perm="comms:write" size="sm" onClick={() => ed.open()}><IconPlus size={14} /> New</CanButton>} />
        {(['guest', 'vendor'] as const).map((aud) => (
          <div key={aud} className="py-1">
            <div className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">For {aud}s</div>
            {templates.filter((x) => x.audience === aud).map((x) => (
              <button key={x.id} onClick={() => setSelected(x.id)} className={cls('block w-full px-4 py-1.5 text-left text-sm', t?.id === x.id ? 'bg-amber-50 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50')}>{x.name}</button>
            ))}
          </div>
        ))}
      </Panel>
      {t ? (
        <Panel>
          <PanelHead
            title={t.name}
            sub={`${t.audience === 'guest' ? 'Guest' : 'Vendor'} · ${t.channel} — tokens are filled from the plan as you read`}
            actions={<><Button size="sm" onClick={() => ed.open(t)}>Edit</Button><Button size="sm" variant="primary" onClick={() => copy(`${fillTemplate(t.subject, tokens)}\n\n${fillTemplate(t.body, tokens)}`)}><IconCopy size={14} /> Copy</Button></>}
          />
          <div className="space-y-3 p-4">
            {t.audience === 'guest' && households.length > 0 && (
              <Field label="Fill {household} with">
                <Select value={household} onChange={(e) => setHousehold(e.target.value)} className="max-w-xs">
                  <option value="">[household]</option>
                  {households.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            )}
            {t.subject && <div className="text-sm"><span className="text-stone-500">Subject: </span><strong>{fillTemplate(t.subject, tokens)}</strong></div>}
            <pre className="whitespace-pre-wrap rounded-lg bg-stone-50 p-4 font-sans text-sm leading-relaxed dark:bg-stone-950">{fillTemplate(t.body, tokens)}</pre>
            <p className="text-xs text-stone-500">Tokens: {'{couple} {date} {venue} {guests} {household} {rsvpBy} {website}'}. Set the website and RSVP date in Wedding settings.</p>
          </div>
        </Panel>
      ) : (
        <Panel><Empty title="No templates" body="Write the messages you'll send more than once." action={<CanButton perm="comms:write" variant="primary" onClick={() => ed.open()}>New template</CanButton>} /></Panel>
      )}
      <Modal open={!!ed.draft} wide title={ed.isNew ? 'New template' : 'Edit template'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="templates" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid cols={3}>
              <Field label="Name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
              <Field label="For">
                <Select value={ed.draft.audience} onChange={(e) => ed.set('audience', e.target.value as Template['audience'])}><option value="guest">Guests</option><option value="vendor">Vendors</option></Select>
              </Field>
              <Field label="Channel"><Input value={ed.draft.channel} onChange={(e) => ed.set('channel', e.target.value)} /></Field>
            </Grid>
            <Field label="Subject"><Input value={ed.draft.subject} onChange={(e) => ed.set('subject', e.target.value)} /></Field>
            <Field label="Body" hint="Tokens: {couple} {date} {venue} {guests} {household} {rsvpBy} {website}"><Area rows={12} value={ed.draft.body} onChange={(e) => ed.set('body', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}

// ─── 3. vendor log ───────────────────────────────────────────────────────────
function VendorLog() {
  const { get } = useStore();
  const log = get('correspondence');
  const vendors = get('vendors');
  const attachments = get('attachments');
  const [filter, setFilter] = useState<'all' | 'awaiting'>('all');
  const [q, setQ] = useState('');
  const ed = useEditor<Correspondence>('correspondence', () => ({
    id: crypto.randomUUID(), wedding_id: '', vendor_id: null, date: todayISO(), direction: 'sent', channel: 'email', subject: '', summary: '',
    follow_up_by: null, done: false, created_at: '', updated_at: '', created_by: null, updated_by: null,
  }));
  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? '—';
  const attachCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attachments) m.set(a.correspondence_id, (m.get(a.correspondence_id) ?? 0) + 1);
    return m;
  }, [attachments]);

  const shown = sortBy(
    log.filter((c) => (filter === 'all' || !c.done) && matches(q, c.subject, c.summary, vendorName(c.vendor_id))),
    (c) => (filter === 'awaiting' ? c.follow_up_by ?? '9999' : ''),
    (c) => -new Date(c.date).getTime(),
  );
  const savedIds = new Set(log.map((c) => c.id));

  return (
    <>
      <Toolbar>
        <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: log.length }, { value: 'awaiting', label: 'Awaiting a reply', count: log.filter((c) => !c.done).length }]} />
        <div className="ml-auto flex gap-2">
          <SearchInput value={q} onChange={setQ} />
          <CsvButton filename="vendor-log.csv" rows={() => shown.map((c) => ({ date: c.date, vendor: vendorName(c.vendor_id), direction: c.direction, channel: c.channel, subject: c.subject, summary: c.summary, follow_up_by: c.follow_up_by, done: c.done ? 'yes' : '' }))} />
          <CanButton perm="comms:write" variant="primary" size="sm" onClick={() => ed.open()}><IconPlus size={14} /> Log entry</CanButton>
        </div>
      </Toolbar>
      <Panel>
        {shown.length === 0 ? (
          <Empty title={log.length ? 'Nothing waiting' : 'No conversations logged'} body={log.length ? 'Every thread is marked done.' : 'Log each call and email with a vendor — or drop in a saved email and let autofill read it.'} action={!log.length ? <CanButton perm="comms:write" variant="primary" onClick={() => ed.open()}>Log the first one</CanButton> : undefined} />
        ) : (
          <TWrap>
            <thead><tr><TH>Date</TH><TH>Vendor</TH><TH>Subject</TH><TH>Follow up</TH><TH /></tr></thead>
            <tbody>
              {shown.map((c) => {
                const d = daysUntil(c.follow_up_by);
                return (
                  <TR key={c.id} commentKey={c.id} onClick={() => ed.open(c)}>
                    <TD className="whitespace-nowrap">{fmtDate(c.date, { year: false })}<div className="text-xs text-stone-500">{c.direction === 'sent' ? '→ sent' : '← received'} · {c.channel}</div></TD>
                    <TD>{vendorName(c.vendor_id)}</TD>
                    <TD><div className="font-medium">{c.subject || '(no subject)'}</div><div className="line-clamp-2 text-xs text-stone-500">{c.summary}</div></TD>
                    <TD className={cls(!c.done && d !== null && d < 0 && 'text-rose-700 dark:text-rose-400')}>{c.follow_up_by ? <>{fmtDate(c.follow_up_by, { year: false })}{!c.done && <div className="text-xs">{relativeDays(d)}</div>}</> : '—'}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        {attachCount.get(c.id) ? <Pill tone="muted"><IconPaperclip size={11} />{attachCount.get(c.id)}</Pill> : null}
                        {c.done ? <Pill tone="good">done</Pill> : <Pill tone="warn">open</Pill>}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </TWrap>
        )}
      </Panel>
      <Modal open={!!ed.draft} wide title={ed.isNew ? 'Log a conversation' : ed.draft?.subject || 'Conversation'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="correspondence" />}>
        {ed.draft && (
          <div className="space-y-4">
            {!ed.readOnly && <Autofill draft={ed.draft} vendors={vendors} onApply={ed.patch} />}
            <fieldset disabled={ed.readOnly} className="space-y-3">
              <Grid cols={4}>
                <Field label="Date"><Input type="date" value={ed.draft.date} onChange={(e) => ed.set('date', e.target.value)} /></Field>
                <Field label="Vendor">
                  <Select value={ed.draft.vendor_id ?? ''} onChange={(e) => ed.set('vendor_id', e.target.value || null)}>
                    <option value="">—</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </Select>
                </Field>
                <Field label="Direction">
                  <Select value={ed.draft.direction} onChange={(e) => ed.set('direction', e.target.value as Correspondence['direction'])}><option value="sent">We sent</option><option value="received">We received</option></Select>
                </Field>
                <Field label="Channel"><Input value={ed.draft.channel} onChange={(e) => ed.set('channel', e.target.value)} /></Field>
              </Grid>
              <Field label="Subject"><Input value={ed.draft.subject} onChange={(e) => ed.set('subject', e.target.value)} /></Field>
              <Field label="What was said"><Area rows={4} value={ed.draft.summary} onChange={(e) => ed.set('summary', e.target.value)} /></Field>
              <Grid>
                <Field label="Follow up by"><Input type="date" value={ed.draft.follow_up_by ?? ''} onChange={(e) => ed.set('follow_up_by', e.target.value || null)} /></Field>
                <div className="pt-6"><Check checked={ed.draft.done} onChange={(v) => ed.set('done', v)} label="Done — no reply needed" /></div>
              </Grid>
            </fieldset>
            <Attachments correspondenceId={ed.draft.id} saved={savedIds.has(ed.draft.id)} />
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── 4. guest FAQ ────────────────────────────────────────────────────────────
function FaqTab() {
  const { get, putMany } = useStore();
  const { can } = useAuth();
  const toast = useToast();
  const faqs = sortBy(get('faqs'), (f) => f.sort_order);
  const w = can('comms:write');
  const ed = useEditor<Faq>('faqs', () => ({ id: crypto.randomUUID(), wedding_id: '', question: '', answer: '', sort_order: faqs.length + 1, published: false, created_at: '', updated_at: '', created_by: null, updated_by: null }));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= faqs.length) return;
    const next = [...faqs];
    [next[i], next[j]] = [next[j], next[i]];
    putMany('faqs', next.map((f, k) => ({ ...f, sort_order: k + 1 }))).catch(() => undefined);
  };
  const published = faqs.filter((f) => f.published);

  return (
    <Panel>
      <PanelHead
        title="Guest FAQ"
        sub={`${published.length} published — meant to be pasted onto the wedding website`}
        actions={
          <>
            <Button size="sm" disabled={!published.length} onClick={async () => {
              const text = published.map((f) => `${f.question}\n${f.answer}`).join('\n\n');
              try { await navigator.clipboard.writeText(text); toast('Published FAQ copied', 'ok'); } catch { window.prompt('Copy:', text); }
            }}><IconCopy size={14} /> Copy published</Button>
            <CanButton perm="comms:write" size="sm" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add</CanButton>
          </>
        }
      />
      {faqs.length === 0 ? (
        <Empty title="No questions yet" body="Answer the questions guests will ask anyway." action={<CanButton perm="comms:write" variant="primary" onClick={() => ed.open()}>Add a question</CanButton>} />
      ) : (
        <ol className="divide-y divide-stone-100 dark:divide-stone-800">
          {faqs.map((f, i) => (
            <li key={f.id} className="flex items-start gap-2 px-4 py-3">
              <div className="flex flex-col">
                <IconButton label="Move up" disabled={!w || i === 0} onClick={() => move(i, -1)}><IconArrowUp /></IconButton>
                <IconButton label="Move down" disabled={!w || i === faqs.length - 1} onClick={() => move(i, 1)}><IconArrowDown /></IconButton>
              </div>
              <button className="min-w-0 flex-1 text-left" onClick={() => ed.open(f)}>
                <div className="font-medium">{f.question} {!f.published && <Pill tone="muted">draft</Pill>}</div>
                <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{f.answer}</p>
              </button>
            </li>
          ))}
        </ol>
      )}
      <Modal open={!!ed.draft} title={ed.isNew ? 'Add question' : 'Edit question'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="faqs" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="Question"><Input value={ed.draft.question} onChange={(e) => ed.set('question', e.target.value)} /></Field>
            <Field label="Answer"><Area rows={5} value={ed.draft.answer} onChange={(e) => ed.set('answer', e.target.value)} /></Field>
            <Check checked={ed.draft.published} onChange={(v) => ed.set('published', v)} label="Published" hint="Included when you copy the FAQ for the website." />
          </fieldset>
        )}
      </Modal>
    </Panel>
  );
}
