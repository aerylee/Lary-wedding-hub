// Vendors (main spec §7.5). Money lives in vendor_finance and simply doesn't load without
// finance:read — a collaborator sees the vendor without the money, not a permission error.
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Vendor, VendorFinance, VendorStatus } from '@/lib/types';
import { eur, fmtDate, matches, num, sortBy, uniq } from '@/lib/util';
import { Area, Button, Empty, Field, Input, Modal, Money, Panel, Pill, SearchInput, Segmented, Select, SectionTitle, Stat, StatGrid, TD, TH, TR, TWrap } from '@/components/kit';
import { Can, CanButton, whyNot } from '@/components/Gate';
import { useEditor } from '@/components/editor';
import { IconPlus } from '@/components/icons';
import { CsvButton, Grid, StatusPill, Toolbar } from './common';

const STATUSES: VendorStatus[] = ['researching', 'contacted', 'quoted', 'booked', 'deposit_paid', 'complete', 'passed'];
const STATUS_LABEL: Record<VendorStatus, string> = {
  researching: 'Researching', contacted: 'Contacted', quoted: 'Quoted', booked: 'Booked', deposit_paid: 'Deposit paid', complete: 'Complete', passed: 'Passed',
};
const STATUS_TONE = { researching: 'default', contacted: 'info', quoted: 'info', booked: 'good', deposit_paid: 'good', complete: 'good', passed: 'muted' } as const;

type Draft = Vendor & { _quote: number | null; _deposit: number | null; _deposit_due: string | null; _balance_due: string | null };

const blank = (): Draft => ({
  id: crypto.randomUUID(), wedding_id: '', name: '', category: '', status: 'researching', contact: '', email: '', phone: '', country: '',
  language: '', website: '', cancellation: '', notes: '', created_at: '', updated_at: '', created_by: null, updated_by: null,
  _quote: null, _deposit: null, _deposit_due: null, _balance_due: null,
});

export default function Vendors() {
  const { get, put, remove } = useStore();
  const { can } = useAuth();
  const vendors = get('vendors');
  const finance = get('vendor_finance');
  const [view, setView] = useState<'board' | 'table'>('board');
  const [q, setQ] = useState('');
  const ed = useEditor<Draft>('vendors', blank);
  const seeMoney = can('finance:read');
  const finBy = useMemo(() => new Map(finance.map((f) => [f.vendor_id, f])), [finance]);

  const filtered = sortBy(vendors.filter((v) => matches(q, v.name, v.category, v.contact, v.email, v.notes)), (v) => v.category, (v) => v.name);
  const booked = vendors.filter((v) => ['booked', 'deposit_paid', 'complete'].includes(v.status));
  const committed = booked.reduce((s, v) => s + num(finBy.get(v.id)?.quote_eur), 0);
  const categories = uniq(vendors.map((v) => v.category).filter(Boolean)).sort();

  function open(v?: Vendor) {
    if (!v) return ed.open();
    const f = finBy.get(v.id);
    ed.open({ ...v, _quote: f?.quote_eur ?? null, _deposit: f?.deposit_eur ?? null, _deposit_due: f?.deposit_due ?? null, _balance_due: f?.balance_due ?? null });
  }

  async function save() {
    const d = ed.draft;
    if (!d || !d.name.trim()) return;
    const ok = await ed.save();
    if (!ok || !can('finance:write')) return;
    const f = finBy.get(d.id);
    const next = { quote_eur: d._quote, deposit_eur: d._deposit, deposit_due: d._deposit_due, balance_due: d._balance_due };
    const changed = f ? (Object.keys(next) as (keyof typeof next)[]).some((k) => (f as VendorFinance)[k] !== next[k]) : Object.values(next).some((x) => x !== null);
    if (changed) await put('vendor_finance', { ...(f ?? {}), vendor_id: d.id, ...next }).catch(() => undefined);
  }

  return (
    <div>
      <SectionTitle
        sub="From first enquiry to final payment. Log every conversation in Comms → Vendor log."
        actions={
          <>
            <CsvButton
              filename="vendors.csv"
              rows={() => filtered.map((v) => ({
                vendor: v.name, category: v.category, status: STATUS_LABEL[v.status], contact: v.contact, email: v.email, phone: v.phone,
                country: v.country, language: v.language, website: v.website, cancellation: v.cancellation, notes: v.notes,
                ...(seeMoney ? { quote_eur: finBy.get(v.id)?.quote_eur ?? '', deposit_eur: finBy.get(v.id)?.deposit_eur ?? '', deposit_due: finBy.get(v.id)?.deposit_due ?? '', balance_due: finBy.get(v.id)?.balance_due ?? '' } : {}),
              }))}
            />
            <CanButton perm="vendors:write" variant="primary" onClick={() => open()}><IconPlus size={14} /> Add vendor</CanButton>
          </>
        }
      >
        Vendors
      </SectionTitle>

      <StatGrid>
        <Stat label="Vendors" value={vendors.length} sub={`${vendors.filter((v) => v.status !== 'passed').length} active`} />
        <Stat label="Booked" value={booked.length} tone="good" />
        <Stat label="Awaiting quotes" value={vendors.filter((v) => v.status === 'contacted').length} />
        {seeMoney ? <Stat label="Committed (quotes)" value={eur(committed)} sub="booked vendors" /> : <Stat label="Categories" value={categories.length} />}
      </StatGrid>

      <Toolbar>
        <Segmented value={view} onChange={setView} options={[{ value: 'board', label: 'Pipeline' }, { value: 'table', label: 'Table' }]} />
        <div className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search vendors…" /></div>
      </Toolbar>

      {vendors.length === 0 ? (
        <Panel><Empty title="No vendors yet" body="Add photographers, caterers, florists — anyone you're talking to." action={<CanButton perm="vendors:write" variant="primary" onClick={() => open()}>Add a vendor</CanButton>} /></Panel>
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STATUSES.map((s) => {
            const col = filtered.filter((v) => v.status === s);
            return (
              <div key={s} className="w-60 shrink-0 rounded-xl bg-stone-100 p-2 dark:bg-stone-900/60">
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {STATUS_LABEL[s]} <span className="tabular-nums">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((v) => (
                    <button key={v.id} onClick={() => open(v)} className="block w-full rounded-lg border border-stone-200 bg-white p-2.5 text-left text-sm shadow-sm hover:border-amber-400 dark:border-stone-800 dark:bg-stone-900">
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-stone-500">{v.category}{v.country && ` · ${v.country}`}</div>
                      {seeMoney && finBy.get(v.id)?.quote_eur != null && <div className="mt-1 text-xs tabular-nums">{eur(num(finBy.get(v.id)!.quote_eur))}</div>}
                    </button>
                  ))}
                  {col.length === 0 && <div className="px-1 py-3 text-center text-xs text-stone-400">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel>
          <TWrap>
            <thead><tr><TH>Vendor</TH><TH>Category</TH><TH>Status</TH><TH>Contact</TH><TH>Language</TH>{seeMoney && <TH align="right">Quote</TH>}{seeMoney && <TH>Deposit due</TH>}</tr></thead>
            <tbody>
              {filtered.map((v) => {
                const f = finBy.get(v.id);
                return (
                  <TR key={v.id} commentKey={v.id} onClick={() => open(v)}>
                    <TD className="font-medium">{v.name}</TD>
                    <TD>{v.category}</TD>
                    <TD><StatusPill value={v.status} tones={STATUS_TONE} labels={STATUS_LABEL} /></TD>
                    <TD>{v.contact}<div className="text-xs text-stone-500">{v.email}</div></TD>
                    <TD>{v.language}</TD>
                    {seeMoney && <TD align="right">{f?.quote_eur != null ? eur(num(f.quote_eur)) : '—'}</TD>}
                    {seeMoney && <TD>{f?.deposit_due ? fmtDate(f.deposit_due) : '—'}</TD>}
                  </TR>
                );
              })}
            </tbody>
          </TWrap>
        </Panel>
      )}

      <Modal
        open={!!ed.draft}
        wide
        title={ed.isNew ? 'Add vendor' : ed.draft?.name || 'Vendor'}
        onClose={ed.close}
        footer={
          <>
            {!ed.isNew && <Button variant="danger" className="mr-auto" disabled={ed.readOnly} title={ed.readOnly ? whyNot('vendors:write') : undefined} onClick={async () => {
              if (!ed.draft || !window.confirm(`Delete ${ed.draft.name}? Budget lines and payments linked to it keep their money but lose the link.`)) return;
              try { await remove('vendors', ed.draft.id); ed.close(); } catch { /* toasted */ }
            }}>Delete</Button>}
            <Button variant="subtle" onClick={ed.close}>{ed.readOnly ? 'Close' : 'Cancel'}</Button>
            <Button variant="primary" disabled={ed.readOnly || ed.saving || !ed.draft?.name.trim()} title={ed.readOnly ? whyNot('vendors:write') : undefined} onClick={save}>{ed.saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Grid cols={3}>
              <Field label="Name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
              <Field label="Category">
                <Input list="vendor-cats" value={ed.draft.category} onChange={(e) => ed.set('category', e.target.value)} placeholder="Photography" />
                <datalist id="vendor-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Status">
                <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as VendorStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Contact person"><Input value={ed.draft.contact} onChange={(e) => ed.set('contact', e.target.value)} /></Field>
              <Field label="Email" hint="Used to match uploaded emails in the vendor log."><Input type="email" value={ed.draft.email} onChange={(e) => ed.set('email', e.target.value)} /></Field>
              <Field label="Phone"><Input type="tel" value={ed.draft.phone} onChange={(e) => ed.set('phone', e.target.value)} /></Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Country"><Input value={ed.draft.country} onChange={(e) => ed.set('country', e.target.value)} /></Field>
              <Field label="Working language"><Input value={ed.draft.language} onChange={(e) => ed.set('language', e.target.value)} /></Field>
              <Field label="Website"><Input type="url" value={ed.draft.website} onChange={(e) => ed.set('website', e.target.value)} /></Field>
            </Grid>
            <Field label="Cancellation terms"><Area rows={2} value={ed.draft.cancellation} onChange={(e) => ed.set('cancellation', e.target.value)} /></Field>
            <Field label="Notes"><Area value={ed.draft.notes} onChange={(e) => ed.set('notes', e.target.value)} /></Field>
            <Can perm="finance:read">
              <fieldset disabled={!can('finance:write')} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Money</legend>
                <Grid cols={4}>
                  <Field label="Quote (EUR)"><Money value={ed.draft._quote} onChange={(v) => ed.set('_quote', v)} /></Field>
                  <Field label="Deposit (EUR)"><Money value={ed.draft._deposit} onChange={(v) => ed.set('_deposit', v)} /></Field>
                  <Field label="Deposit due"><Input type="date" value={ed.draft._deposit_due ?? ''} onChange={(e) => ed.set('_deposit_due', e.target.value || null)} /></Field>
                  <Field label="Balance due"><Input type="date" value={ed.draft._balance_due ?? ''} onChange={(e) => ed.set('_balance_due', e.target.value || null)} /></Field>
                </Grid>
                <p className="mt-2 text-xs text-stone-500">Only people who can see the budget see this. Add the payments themselves on the Budget page.</p>
              </fieldset>
            </Can>
            {!ed.isNew && <p className="text-xs text-stone-500"><Pill tone="muted">tip</Pill> Budget lines and payments can link to this vendor.</p>}
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
