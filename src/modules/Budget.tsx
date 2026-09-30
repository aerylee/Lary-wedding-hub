// Budget (main spec §7.4) — finance:read to open, finance:write to change anything.
// Euro spend against a dollar ceiling, side by side everywhere money appears.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { BudgetCategory, BudgetLine, Payment } from '@/lib/types';
import { budgetTotals, categoryTotals, lineEur, perGuestCost, scenarioTotal, toEur } from '@/lib/derive';
import { cls, daysUntil, eur, fmtDate, fmtMoney, num, pct, relativeDays, sortBy, todayISO, usd } from '@/lib/util';
import {
  Area, Banner, Bar, Button, Check, Empty, Field, IconButton, Input, Modal, Money, Panel, PanelHead, Pill, Segmented, Select,
  SectionTitle, Stat, StatGrid, TD, TH, TR, TWrap,
} from '@/components/kit';
import { CanButton, whyNot } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconArrowDown, IconArrowUp, IconChevronDown, IconChevronRight, IconChevronUp, IconGrip, IconPencil, IconPlus, IconTrash } from '@/components/icons';
import { CsvButton, Grid, usePlan } from './common';

type Tab = 'lines' | 'payments' | 'whatif';

const blankLine = (): BudgetLine => ({
  id: crypto.randomUUID(), wedding_id: '', category_id: null, label: '', vendor_id: null, estimate_eur: 0, quoted_eur: null,
  contracted_eur: null, paid_eur: 0, currency: 'EUR', per_guest: false, funded_by: '', note: '',
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});
const blankPayment = (): Payment => ({
  id: crypto.randomUUID(), wedding_id: '', label: '', line_id: null, vendor_id: null, amount: 0, currency: 'EUR',
  due_date: null, paid_date: null, method: '', note: '', created_at: '', updated_at: '', created_by: null, updated_by: null,
});

export default function Budget() {
  const { get, settings } = useStore();
  const { headcount, fx } = usePlan();
  const [tab, setTab] = useState<Tab>('lines');
  const lines = get('budget_lines');
  const categories = sortBy(get('budget_categories'), (c) => c.sort_order, (c) => c.name);
  const payments = get('payments');
  const vendors = get('vendors');
  const guests = get('guests');
  const t = budgetTotals(lines, headcount, settings);
  const cats = categoryTotals(lines, categories, headcount, fx);
  const [editCats, setEditCats] = useState(false);

  const csvRows = () =>
    lines.map((l) => {
      const r = lineEur(l, headcount, fx);
      return {
        category: categories.find((c) => c.id === l.category_id)?.name ?? 'Uncategorised',
        line: l.label, currency: l.currency, per_guest: l.per_guest ? 'yes' : '',
        estimate: l.estimate_eur, quoted: l.quoted_eur, contracted: l.contracted_eur, paid: l.paid_eur,
        best_eur: Math.round(r.best), best_usd: Math.round(r.best * fx), funded_by: l.funded_by, note: l.note,
      };
    });

  return (
    <div>
      <SectionTitle
        sub={`Planning for ${headcount} guests${guests.length ? ' (from the live guest list)' : ' (the planning target, until real guests exist)'}. 1 EUR = ${num(settings.fx_eur_usd).toFixed(4)} USD, set ${fmtDate(settings.fx_set_on)}${settings.fx_source === 'auto' ? ' automatically' : ''}.`}
        actions={<CsvButton filename="budget.csv" rows={csvRows} />}
      >
        Budget
      </SectionTitle>

      <HeaderControls />

      {t.over && <Banner tone="bad">The plan is <strong>{eur(-t.remaining)}</strong> ({usd(-t.remainingUsd)}) over the ceiling. The What-if tab shows what guest count or trims would close the gap.</Banner>}

      <StatGrid>
        <Stat label="Planned" value={eur(t.best)} sub={`${usd(t.bestUsd)} · ${eur(t.perGuest)} a guest`} />
        <Stat label="Contracted" value={eur(t.firm)} sub={`${t.firmCount} of ${lines.length} lines firm`} />
        <Stat label="Paid" value={eur(t.paid)} sub={usd(t.paidUsd)} tone="good" />
        <Stat label="Remaining" value={eur(t.remaining)} sub={`${usd(t.remainingUsd)} of ${usd(t.ceilingUsd)}`} tone={t.over ? 'bad' : 'default'} />
      </StatGrid>
      <div className="mb-5">
        <Bar value={t.usedPct} tone={t.over ? 'bad' : t.usedPct > 0.9 ? 'warn' : 'default'} label="Share of ceiling planned" />
        <div className="mt-1 text-xs text-stone-500">{pct(t.usedPct)} of the ceiling planned</div>
      </div>

      <Panel className="mb-5">
        <PanelHead
          title="By category"
          sub="Share of the planned total"
          actions={<CanButton perm="finance:write" size="sm" onClick={() => setEditCats(true)}>Manage categories</CanButton>}
        />
        <ul className="grid gap-x-8 gap-y-2.5 p-4 md:grid-cols-2">
          {cats.map((c) => (
            <li key={c.id ?? 'none'} className="text-sm">
              <div className="mb-1 flex justify-between gap-3">
                <span>{c.name} <span className="text-xs text-stone-400">({c.count})</span></span>
                <span className="tabular-nums text-stone-600 dark:text-stone-300">{eur(c.best)} · {pct(t.best ? c.best / t.best : 0)}</span>
              </div>
              <Bar value={t.best ? c.best / t.best : 0} tone={c.id ? 'default' : 'warn'} label={c.name} />
            </li>
          ))}
        </ul>
      </Panel>

      <Segmented<Tab>
        className="mb-3"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'lines', label: 'Line items', count: lines.length },
          { value: 'payments', label: 'Payment schedule', count: payments.length },
          { value: 'whatif', label: 'What if' },
        ]}
      />
      {tab === 'lines' && <Lines lines={lines} categories={categories} vendors={vendors} onManage={() => setEditCats(true)} />}
      {tab === 'payments' && <Payments payments={payments} lines={lines} vendors={vendors} />}
      {tab === 'whatif' && <WhatIf lines={lines} categories={categories} />}

      <CategoryManager open={editCats} onClose={() => setEditCats(false)} categories={categories} lines={lines} />
    </div>
  );
}

// ─── header controls ─────────────────────────────────────────────────────────
function HeaderControls() {
  const { settings, saveSettings } = useStore();
  const { can } = useAuth();
  const { headcount } = usePlan();
  const [ceiling, setCeiling] = useState<number | null>(settings.budget_ceiling_usd);
  const [fx, setFx] = useState<string>(String(settings.fx_eur_usd));
  const w = can('finance:write');
  return (
    <Panel className="mb-5">
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Ceiling (USD)" hint={!w ? whyNot('finance:write') : undefined}>
          <Money
            currency="USD"
            value={ceiling}
            disabled={!w}
            onChange={setCeiling}
          />
        </Field>
        <Field label="1 EUR in USD" hint={`Set ${fmtDate(settings.fx_set_on)} · ${settings.fx_source}`}>
          <Input type="number" step="0.0001" value={fx} disabled={!w || !can('settings:write')} onChange={(e) => setFx(e.target.value)} />
        </Field>
        <Field label="Planning headcount" hint="Read-only here: the live figure from the guest list and RSVPs.">
          <Input value={headcount} readOnly disabled />
        </Field>
      </div>
      {w && (num(ceiling) !== num(settings.budget_ceiling_usd) || num(fx) !== num(settings.fx_eur_usd)) && (
        <div className="flex justify-end gap-2 border-t border-stone-100 px-4 py-2 dark:border-stone-800">
          <Button size="sm" variant="subtle" onClick={() => { setCeiling(settings.budget_ceiling_usd); setFx(String(settings.fx_eur_usd)); }}>Cancel</Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const patch: Record<string, unknown> = {};
              if (num(ceiling) !== num(settings.budget_ceiling_usd)) patch.budget_ceiling_usd = num(ceiling);
              if (num(fx) > 0 && num(fx) !== num(settings.fx_eur_usd)) Object.assign(patch, { fx_eur_usd: num(fx), fx_set_on: todayISO(), fx_source: 'manual' });
              saveSettings(patch).catch(() => undefined);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </Panel>
  );
}

// ─── line items ──────────────────────────────────────────────────────────────
// each category gets its own colour, so the groups read as groups at a glance
const CAT_TONES = [
  { stripe: 'border-l-amber-500', dot: 'bg-amber-500', head: 'bg-amber-50/80 dark:bg-amber-950/30' },
  { stripe: 'border-l-sky-500', dot: 'bg-sky-500', head: 'bg-sky-50/80 dark:bg-sky-950/30' },
  { stripe: 'border-l-emerald-500', dot: 'bg-emerald-500', head: 'bg-emerald-50/80 dark:bg-emerald-950/30' },
  { stripe: 'border-l-violet-500', dot: 'bg-violet-500', head: 'bg-violet-50/80 dark:bg-violet-950/30' },
  { stripe: 'border-l-rose-500', dot: 'bg-rose-500', head: 'bg-rose-50/80 dark:bg-rose-950/30' },
  { stripe: 'border-l-teal-500', dot: 'bg-teal-500', head: 'bg-teal-50/80 dark:bg-teal-950/30' },
  { stripe: 'border-l-orange-500', dot: 'bg-orange-500', head: 'bg-orange-50/80 dark:bg-orange-950/30' },
  { stripe: 'border-l-indigo-500', dot: 'bg-indigo-500', head: 'bg-indigo-50/80 dark:bg-indigo-950/30' },
];
const NONE_TONE = { stripe: 'border-l-stone-400', dot: 'bg-stone-400', head: 'bg-stone-100 dark:bg-stone-800/60' };

function useCollapsed(weddingId: string) {
  const key = `hub:budget-collapsed:${weddingId}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const save = (next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* only a convenience */
    }
  };
  return [collapsed, save] as const;
}

function Lines({ lines, categories, vendors, onManage }: { lines: BudgetLine[]; categories: BudgetCategory[]; vendors: { id: string; name: string }[]; onManage: () => void }) {
  const { headcount, fx } = usePlan();
  const { weddingId } = useStore();
  const ed = useEditor<BudgetLine>('budget_lines', blankLine);
  const [collapsed, setCollapsed] = useCollapsed(weddingId);
  const catIds = new Set(categories.map((c) => c.id));
  const sections = [
    ...categories.map((c, i) => ({ key: c.id, name: c.name, tone: CAT_TONES[i % CAT_TONES.length], rows: lines.filter((l) => l.category_id === c.id) })),
    { key: '__none', name: 'Uncategorised', tone: NONE_TONE, rows: lines.filter((l) => !l.category_id || !catIds.has(l.category_id)) },
  ].filter((s) => s.rows.length || s.key !== '__none');
  const grand = lines.reduce((a, l) => a + lineEur(l, headcount, fx).best, 0);
  const allCollapsed = sections.every((s) => collapsed.has(s.key));
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  };

  return (
    <Panel>
      <PanelHead
        title="Line items"
        sub="Grouped by category. The plan runs on contracted, else quoted, else the estimate."
        actions={
          <>
            {lines.length > 0 && (
              <Button size="sm" variant="subtle" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.key)))}>
                {allCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />} {allCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
            )}
            <CanButton perm="finance:write" size="sm" onClick={onManage}>Categories</CanButton>
            <CanButton perm="finance:write" size="sm" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add line</CanButton>
          </>
        }
      />
      {lines.length === 0 ? (
        <Empty title="No budget lines yet" body="Start with the venue — everything else scales off it." action={<CanButton perm="finance:write" variant="primary" onClick={() => ed.open()}>Add a line</CanButton>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col />
              <col className="w-28" /><col className="w-28" /><col className="w-28" /><col className="w-28" /><col className="w-32" /><col className="w-32" />
            </colgroup>
            <thead>
              <tr>
                <TH>Line</TH><TH align="right">Estimate</TH><TH align="right">Quoted</TH><TH align="right">Contracted</TH>
                <TH align="right">Paid</TH><TH align="right">Plan (€)</TH><TH>Funded by</TH>
              </tr>
            </thead>
            {sections.map((s, si) => {
              const figures = s.rows.map((l) => lineEur(l, headcount, fx));
              const subtotal = figures.reduce((a, r) => a + r.best, 0);
              const estimate = figures.reduce((a, r) => a + r.estimate, 0);
              const paid = figures.reduce((a, r) => a + r.paid, 0);
              const firm = figures.filter((r) => r.isFirm).length;
              const isCollapsed = collapsed.has(s.key);
              const share = grand ? subtotal / grand : 0;
              return (
                <tbody key={s.key}>
                  {si > 0 && <tr aria-hidden="true"><td colSpan={7} className="h-3 p-0" /></tr>}
                  <tr className={cls(s.tone.head)}>
                    <td colSpan={4} className={cls('border-y border-l-4 border-y-stone-200 px-3 py-2.5 dark:border-y-stone-700', s.tone.stripe)}>
                      <button
                        type="button"
                        onClick={() => toggle(s.key)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80 text-stone-600 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700">
                          {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                        </span>
                        <span className="font-serif text-base font-semibold text-stone-900 dark:text-stone-50">{s.name}</span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700">
                          {s.rows.length} {s.rows.length === 1 ? 'line' : 'lines'}{firm > 0 && ` · ${firm} firm`}
                        </span>
                        <span className="ml-auto hidden items-center gap-2 text-xs text-stone-500 sm:flex">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/80 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700">
                            <span className={cls('block h-full rounded-full', s.tone.dot)} style={{ width: `${Math.round(share * 100)}%` }} />
                          </span>
                          <span className="w-10 text-right tabular-nums">{pct(share)}</span>
                        </span>
                      </button>
                    </td>
                    <td className="border-y border-y-stone-200 px-3 py-2.5 text-right tabular-nums text-stone-600 dark:border-y-stone-700 dark:text-stone-300">
                      {paid > 0 ? <WithUsd eurAmount={paid} fx={fx} /> : <span className="text-stone-400">—</span>}
                    </td>
                    <td className="border-y border-y-stone-200 px-3 py-2.5 text-right font-semibold tabular-nums dark:border-y-stone-700">
                      <WithUsd eurAmount={subtotal} fx={fx} />
                    </td>
                    <td className="border-y border-r border-stone-200 px-3 py-2.5 text-xs text-stone-500 dark:border-stone-700">
                      {estimate !== subtotal && <span title="What the estimates alone add up to">est. {eur(estimate)}</span>}
                    </td>
                  </tr>
                  {!isCollapsed &&
                    (s.rows.length === 0 ? (
                      <tr><td colSpan={7} className={cls('border-b border-l-4 border-b-stone-100 px-3 py-2 text-xs text-stone-400 dark:border-b-stone-800', s.tone.stripe)}>No lines in this category.</td></tr>
                    ) : (
                      sortBy(s.rows, (l) => -lineEur(l, headcount, fx).best).map((l) => {
                        const r = lineEur(l, headcount, fx);
                        // euro figures get their dollar equivalent underneath; dollar lines are already in USD
                        const m = (v: number | null) => (v === null ? '—' : l.currency === 'EUR' ? <WithUsd eurAmount={v} fx={fx} /> : fmtMoney(v, l.currency));
                        return (
                          <TR key={l.id} commentKey={l.id} onClick={() => ed.open(l)}>
                            <TD className={cls('border-l-4 pl-4', s.tone.stripe)}>
                              <div>{l.label}</div>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {l.per_guest && <Pill tone="info">per guest × {headcount}</Pill>}
                                {l.currency === 'USD' && <Pill>USD</Pill>}
                                {r.isFirm && <Pill tone="good">firm</Pill>}
                                {l.vendor_id && <Pill tone="muted">{vendors.find((v) => v.id === l.vendor_id)?.name ?? 'vendor'}</Pill>}
                              </div>
                            </TD>
                            <TD align="right">{m(num(l.estimate_eur))}</TD>
                            <TD align="right">{m(l.quoted_eur === null ? null : num(l.quoted_eur))}</TD>
                            <TD align="right">{m(l.contracted_eur === null ? null : num(l.contracted_eur))}</TD>
                            <TD align="right">{m(num(l.paid_eur))}</TD>
                            <TD align="right" className="font-medium"><WithUsd eurAmount={r.best} fx={fx} /></TD>
                            <TD className="text-stone-500">{l.funded_by}</TD>
                          </TR>
                        );
                      })
                    ))}
                </tbody>
              );
            })}
            <tbody>
              <tr aria-hidden="true"><td colSpan={7} className="h-3 p-0" /></tr>
              <tr className="bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                <td colSpan={5} className="rounded-l-lg px-3 py-2.5 font-semibold">Total plan</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  <div>{eur(grand)}</div>
                  <div className="text-[11px] font-normal opacity-70">{usd(grand * fx)}</div>
                </td>
                <td className="rounded-r-lg px-3 py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!ed.draft} title={ed.isNew ? 'Add budget line' : 'Edit budget line'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="budget_lines" />} wide>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid>
              <Field label="Line"><Input value={ed.draft.label} onChange={(e) => ed.set('label', e.target.value)} placeholder="Photographer — two days" /></Field>
              <Field label="Category">
                <Select value={ed.draft.category_id ?? ''} onChange={(e) => ed.set('category_id', e.target.value || null)}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Currency" hint="All four figures are in this currency.">
                <Select value={ed.draft.currency} onChange={(e) => ed.set('currency', e.target.value as BudgetLine['currency'])}>
                  <option value="EUR">EUR €</option>
                  <option value="USD">USD $</option>
                </Select>
              </Field>
              <Field label="Linked vendor">
                <Select value={ed.draft.vendor_id ?? ''} onChange={(e) => ed.set('vendor_id', e.target.value || null)}>
                  <option value="">None</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </Field>
              <Field label="Funded by"><Input value={ed.draft.funded_by} onChange={(e) => ed.set('funded_by', e.target.value)} placeholder="Couple" /></Field>
            </Grid>
            <Check checked={ed.draft.per_guest} onChange={(v) => ed.set('per_guest', v)} label="Priced per guest" hint={`Figures are per head and multiply by the planning headcount (${headcount}). Paid is always the actual amount paid.`} />
            <Grid cols={4}>
              <Field label="Estimate"><Money currency={ed.draft.currency} value={num(ed.draft.estimate_eur)} onChange={(v) => ed.set('estimate_eur', v ?? 0)} /></Field>
              <Field label="Quoted"><Money currency={ed.draft.currency} value={ed.draft.quoted_eur} onChange={(v) => ed.set('quoted_eur', v)} /></Field>
              <Field label="Contracted"><Money currency={ed.draft.currency} value={ed.draft.contracted_eur} onChange={(v) => ed.set('contracted_eur', v)} /></Field>
              <Field label="Paid"><Money currency={ed.draft.currency} value={num(ed.draft.paid_eur)} onChange={(v) => ed.set('paid_eur', v ?? 0)} /></Field>
            </Grid>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Plan figure: <strong>{eur(lineEur(ed.draft, headcount, fx).best)}</strong> ({usd(lineEur(ed.draft, headcount, fx).best * fx)})
            </p>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </Panel>
  );
}

/** A euro amount with its dollar conversion in small text underneath. */
function WithUsd({ eurAmount, fx }: { eurAmount: number; fx: number }) {
  return (
    <>
      <div>{eur(eurAmount)}</div>
      <div className="text-[11px] font-normal text-stone-500 dark:text-stone-400">{usd(eurAmount * fx)}</div>
    </>
  );
}

// ─── payment schedule ────────────────────────────────────────────────────────
function Payments({ payments, lines, vendors }: { payments: Payment[]; lines: BudgetLine[]; vendors: { id: string; name: string }[] }) {
  const { put } = useStore();
  const { can } = useAuth();
  const { fx } = usePlan();
  const ed = useEditor<Payment>('payments', blankPayment);
  const sorted = sortBy(payments, (p) => (p.paid_date ? 1 : 0), (p) => p.due_date);
  const unpaid = payments.filter((p) => !p.paid_date);
  const dueEur = unpaid.reduce((s, p) => s + toEur(num(p.amount), p.currency, fx), 0);

  return (
    <Panel>
      <PanelHead
        title="Payment schedule"
        sub={`${unpaid.length} unpaid · ${eur(dueEur)} (${usd(dueEur * fx)}) still to pay`}
        actions={
          <>
            <CsvButton filename="payments.csv" rows={() => sorted.map((p) => ({ payment: p.label, amount: p.amount, currency: p.currency, due: p.due_date, paid: p.paid_date, method: p.method, line: lines.find((l) => l.id === p.line_id)?.label ?? '', vendor: vendors.find((v) => v.id === p.vendor_id)?.name ?? '', note: p.note }))} />
            <CanButton perm="finance:write" size="sm" variant="primary" onClick={() => ed.open()}><IconPlus size={14} /> Add payment</CanButton>
          </>
        }
      />
      {payments.length === 0 ? (
        <Empty title="No payments scheduled" body="Add deposits and balances as contracts arrive, so nothing is paid late." action={<CanButton perm="finance:write" variant="primary" onClick={() => ed.open()}>Add a payment</CanButton>} />
      ) : (
        <TWrap>
          <thead><tr><TH>Payment</TH><TH align="right">Amount</TH><TH>Due</TH><TH>Paid</TH><TH>Method</TH><TH /></tr></thead>
          <tbody>
            {sorted.map((p) => {
              const d = daysUntil(p.due_date);
              const overdue = !p.paid_date && d !== null && d < 0;
              return (
                <TR key={p.id} commentKey={p.id} onClick={() => ed.open(p)} className={cls(overdue && 'bg-rose-50/60 dark:bg-rose-950/30')}>
                  <TD>
                    <div>{p.label}</div>
                    <div className="text-xs text-stone-500">{[lines.find((l) => l.id === p.line_id)?.label, vendors.find((v) => v.id === p.vendor_id)?.name].filter(Boolean).join(' · ')}</div>
                  </TD>
                  <TD align="right">{fmtMoney(num(p.amount), p.currency)}{p.currency === 'USD' && <div className="text-xs text-stone-500">{eur(num(p.amount) / fx)}</div>}</TD>
                  <TD className={cls(overdue && 'font-medium text-rose-700 dark:text-rose-400')}>{fmtDate(p.due_date)}{!p.paid_date && d !== null && <div className="text-xs">{relativeDays(d)}</div>}</TD>
                  <TD>{p.paid_date ? <Pill tone="good">{fmtDate(p.paid_date)}</Pill> : overdue ? <Pill tone="bad">overdue</Pill> : <Pill tone="muted">unpaid</Pill>}</TD>
                  <TD className="text-stone-500">{p.method}</TD>
                  <TD align="right">
                    {!p.paid_date && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="subtle" disabled={!can('finance:write')} title={!can('finance:write') ? whyNot('finance:write') : 'Mark paid today'} onClick={() => put('payments', { ...p, paid_date: todayISO() }).catch(() => undefined)}>
                          Mark paid
                        </Button>
                      </span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </TWrap>
      )}
      <Modal open={!!ed.draft} title={ed.isNew ? 'Add payment' : 'Edit payment'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="payments" />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="What for"><Input value={ed.draft.label} onChange={(e) => ed.set('label', e.target.value)} placeholder="Venue deposit (30%)" /></Field>
            <Grid>
              <Field label="Amount"><Money currency={ed.draft.currency} value={num(ed.draft.amount)} onChange={(v) => ed.set('amount', v ?? 0)} /></Field>
              <Field label="Currency">
                <Select value={ed.draft.currency} onChange={(e) => ed.set('currency', e.target.value as Payment['currency'])}>
                  <option value="EUR">EUR €</option><option value="USD">USD $</option>
                </Select>
              </Field>
            </Grid>
            <Grid>
              <Field label="Due"><Input type="date" value={ed.draft.due_date ?? ''} onChange={(e) => ed.set('due_date', e.target.value || null)} /></Field>
              <Field label="Paid on" hint="Leave empty until it's paid."><Input type="date" value={ed.draft.paid_date ?? ''} onChange={(e) => ed.set('paid_date', e.target.value || null)} /></Field>
            </Grid>
            <Grid>
              <Field label="Budget line">
                <Select value={ed.draft.line_id ?? ''} onChange={(e) => ed.set('line_id', e.target.value || null)}>
                  <option value="">None</option>
                  {lines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </Select>
              </Field>
              <Field label="Vendor">
                <Select value={ed.draft.vendor_id ?? ''} onChange={(e) => ed.set('vendor_id', e.target.value || null)}>
                  <option value="">None</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </Field>
            </Grid>
            <Field label="Method / reference"><Input value={ed.draft.method} onChange={(e) => ed.set('method', e.target.value)} placeholder="Bank transfer, ref 4471" /></Field>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
          </fieldset>
        )}
      </Modal>
    </Panel>
  );
}

// ─── what if (not persisted) ─────────────────────────────────────────────────
function WhatIf({ lines, categories }: { lines: BudgetLine[]; categories: BudgetCategory[] }) {
  const { settings } = useStore();
  const { headcount, fx } = usePlan();
  const [guests, setGuests] = useState(Math.min(160, Math.max(20, headcount)));
  const [trim, setTrim] = useState(0);
  const plan = budgetTotals(lines, headcount, settings);
  const scenario = useMemo(() => scenarioTotal(lines, categories, guests, fx, trim / 100), [lines, categories, guests, fx, trim]);
  const marginal = perGuestCost(lines, fx);
  const delta = scenario - plan.best;
  const vsCeiling = plan.ceilingEur - scenario;

  return (
    <Panel>
      <PanelHead title="What if" sub="A sandbox — nothing here is saved. Trims never touch per-guest lines, contingency, or anything contracted." />
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <div className="space-y-5">
          <Field label={`Guests: ${guests}`} hint={`The plan currently uses ${headcount}.`}>
            <input type="range" min={20} max={160} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full accent-amber-700" aria-label="Guest count" />
          </Field>
          <Field label={`Trim uncontracted fixed costs: ${trim}%`}>
            <input type="range" min={0} max={40} value={trim} onChange={(e) => setTrim(Number(e.target.value))} className="w-full accent-amber-700" aria-label="Trim percentage" />
          </Field>
          <Button size="sm" variant="subtle" onClick={() => { setGuests(Math.min(160, Math.max(20, headcount))); setTrim(0); }}>Reset</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Scenario total" value={eur(scenario)} sub={usd(scenario * fx)} />
          <Stat label="Versus the plan" value={`${delta >= 0 ? '+' : ''}${eur(delta)}`} tone={delta > 0 ? 'bad' : delta < 0 ? 'good' : 'default'} sub={usd(delta * fx)} />
          <Stat label="Each extra guest" value={eur(marginal)} sub={`${usd(marginal * fx)} — per-guest lines only`} />
          <Stat label="Versus the ceiling" value={eur(vsCeiling)} tone={vsCeiling < 0 ? 'bad' : 'good'} sub={vsCeiling < 0 ? 'over' : 'headroom'} />
        </div>
      </div>
    </Panel>
  );
}

// ─── categories: add, rename, delete, reorder (drag, or arrows for touch/keyboard) ─
function CategoryManager({ open, onClose, categories, lines }: { open: boolean; onClose: () => void; categories: BudgetCategory[]; lines: BudgetLine[] }) {
  const { put, putMany, remove } = useStore();
  const { can } = useAuth();
  const w = can('finance:write');
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= categories.length || from === to) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    putMany('budget_categories', next.map((c, i) => ({ ...c, sort_order: i + 1 }))).catch(() => undefined);
  };

  return (
    <Modal open={open} title="Budget categories" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-stone-500">Drag to reorder, or use the arrows. Deleting a category never hides money — its lines move to &ldquo;Uncategorised&rdquo;.</p>
      <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {categories.map((c, i) => {
          const count = lines.filter((l) => l.category_id === c.id).length;
          return (
            <li
              key={c.id}
              draggable={w}
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = categories.findIndex((x) => x.id === dragId);
                if (from !== -1) reorder(from, i);
                setDragId(null);
              }}
              className={cls('flex items-center gap-2 px-2 py-1.5', dragId === c.id && 'opacity-50')}
            >
              <span className={cls('text-stone-400', w && 'cursor-grab')}><IconGrip /></span>
              {renaming?.id === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renaming.name.trim()) put('budget_categories', { ...c, name: renaming.name.trim() }).then(() => setRenaming(null), () => undefined);
                  }}
                >
                  <Input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} className="h-8 py-1" />
                  <Button size="sm" type="submit" variant="primary">Save</Button>
                </form>
              ) : (
                <span className="flex-1 text-sm">{c.name} <span className="text-xs text-stone-400">{count} line{count === 1 ? '' : 's'}</span></span>
              )}
              <IconButton label="Move up" disabled={!w || i === 0} onClick={() => reorder(i, i - 1)}><IconArrowUp /></IconButton>
              <IconButton label="Move down" disabled={!w || i === categories.length - 1} onClick={() => reorder(i, i + 1)}><IconArrowDown /></IconButton>
              <IconButton label="Rename" disabled={!w} onClick={() => setRenaming({ id: c.id, name: c.name })}><IconPencil /></IconButton>
              <IconButton
                label="Delete"
                disabled={!w}
                onClick={() => {
                  if (window.confirm(`Delete "${c.name}"?${count ? ` Its ${count} line${count === 1 ? '' : 's'} will move to Uncategorised.` : ''}`)) remove('budget_categories', c.id).catch(() => undefined);
                }}
              >
                <IconTrash />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          put('budget_categories', { name: newName.trim(), sort_order: categories.length + 1 }).then(() => setNewName(''), () => undefined);
        }}
      >
        <Input value={newName} disabled={!w} onChange={(e) => setNewName(e.target.value)} placeholder="New category" />
        <CanButton perm="finance:write" type="submit">Add</CanButton>
      </form>
    </Modal>
  );
}
