// Email autofill for the vendor log (main spec §9.2): "never guess, only fill what is 100%
// clear". Layer 1 parses the file here, deterministically. Layer 2 matches vendor and
// direction on exact addresses. Layer 3 asks the model for a summary and follow-up date
// with verbatim evidence, verified server-side. Only empty fields are ticked by default,
// and nothing is saved until the user presses Save.
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Correspondence, Vendor } from '@/lib/types';
import { canAutofill, matchVendor, parseEmail } from '@/lib/email';
import { fmtDate } from '@/lib/util';
import { Button } from './kit';
import { IconSparkles } from './icons';

type Field = 'date' | 'subject' | 'channel' | 'vendor_id' | 'direction' | 'summary' | 'follow_up_by';
type Proposal = { field: Field; value: string; display: string; reason: string };
type ServerResult = {
  fields: Partial<Record<'summary' | 'follow_up_by', { value: string; evidence: string }>>;
  dropped: string[];
};

const LABEL: Record<Field, string> = {
  date: 'Date', subject: 'Subject', channel: 'Channel', vendor_id: 'Vendor', direction: 'Direction', summary: 'What was said', follow_up_by: 'Follow up by',
};

export function Autofill({ draft, vendors, onApply }: { draft: Correspondence; vendors: Vendor[]; onApply: (patch: Partial<Correspondence>) => void }) {
  const { invoke } = useStore();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<Field>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    setProposals(null);
    const ok = canAutofill(file);
    if (!ok.ok) return setError(ok.reason!);
    setBusy(true);
    const text = await file.text();
    const email = parseEmail(text);
    const out: Proposal[] = [];
    const skip: string[] = [];

    if (email.date) out.push({ field: 'date', value: email.date, display: fmtDate(email.date), reason: 'From the file itself (Date header)' });
    else skip.push('Date — the file has no Date header.');
    if (email.subject) out.push({ field: 'subject', value: email.subject, display: email.subject, reason: 'From the file itself (Subject header)' });
    if (email.fromAddr) out.push({ field: 'channel', value: 'email', display: 'email', reason: 'It is an email file' });

    const match = matchVendor(email, vendors);
    if (match) {
      out.push({ field: 'vendor_id', value: match.vendorId, display: match.vendorName, reason: `Matched on address ${match.address}` });
      out.push({ field: 'direction', value: match.direction, display: match.direction, reason: match.direction === 'received' ? `Sender ${match.address} is the vendor` : `Recipient ${match.address} is the vendor` });
    } else if (email.fromAddr) {
      skip.push(`Vendor and direction — no vendor has ${[email.fromAddr, ...email.toAddrs].join(', ')} as their email. Nothing changed.`);
    }

    if (email.body.trim()) {
      try {
        const r = await invoke<ServerResult>('autofill', { subject: email.subject, body: email.body.slice(0, 20000) });
        if (r.fields.summary) out.push({ field: 'summary', value: r.fields.summary.value, display: r.fields.summary.value, reason: `Quoted: “${r.fields.summary.evidence}”` });
        if (r.fields.follow_up_by) out.push({ field: 'follow_up_by', value: r.fields.follow_up_by.value, display: fmtDate(r.fields.follow_up_by.value), reason: `Quoted: “${r.fields.follow_up_by.evidence}”` });
        skip.push(...r.dropped);
      } catch (e) {
        skip.push(`Summary and follow-up date — the AI step isn't available (${(e as Error).message}). The fields from the file itself are still here.`);
      }
    }

    // only empty fields are ticked by default
    const empty = (f: Field) => {
      const v = draft[f as keyof Correspondence];
      return v === null || v === '' || v === undefined || (f === 'direction' && !draft.vendor_id) || (f === 'channel' && draft.channel === 'email');
    };
    setChecked(new Set(out.filter((p) => empty(p.field)).map((p) => p.field)));
    setProposals(out);
    setSkipped(skip);
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <IconSparkles size={14} className="text-amber-700" />
        <span className="text-sm font-medium">Fill from an email</span>
        <label className="ml-auto">
          <input type="file" accept=".eml,.txt,.md,.html,.htm,.json,.csv,message/rfc822,text/*" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          <span className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-medium hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900">{busy ? 'Reading…' : 'Choose .eml or text file'}</span>
        </label>
      </div>
      <p className="mt-1 text-xs text-stone-500">Only fills what the file says outright; anything uncertain is left blank and listed. PDFs aren&rsquo;t read.</p>
      {error && <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">{error}</p>}
      {proposals && (
        <div className="mt-3 space-y-2">
          {proposals.length === 0 && <p className="text-sm text-stone-500">Nothing could be filled with certainty.</p>}
          {proposals.map((p) => (
            <label key={p.field} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={checked.has(p.field)}
                onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.field); else n.delete(p.field); return n; })}
              />
              <span className="min-w-0">
                <span className="font-medium">{LABEL[p.field]}:</span> {p.display}
                <span className="block text-xs text-stone-500">{p.reason}</span>
              </span>
            </label>
          ))}
          {skipped.length > 0 && (
            <div className="rounded-md bg-white/70 p-2 text-xs text-stone-600 dark:bg-stone-900/60 dark:text-stone-300">
              <div className="font-medium">Left blank:</div>
              <ul className="list-disc pl-4">{skipped.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {proposals.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!checked.size} onClick={() => {
                const patch: Partial<Correspondence> = {};
                for (const p of proposals) if (checked.has(p.field)) (patch as Record<string, unknown>)[p.field] = p.value;
                onApply(patch);
                setProposals(null);
              }}>
                Fill {checked.size} field{checked.size === 1 ? '' : 's'}
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setProposals(null)}>Discard</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
