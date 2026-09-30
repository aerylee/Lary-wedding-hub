// Address editing (main spec §7.6, §10): a free-text block, a split-into-fields modal, a
// "tidy" action, completeness warnings and a postal preview. Offline and deterministic —
// nothing is checked against a real address database, and the UI says so.
import { useState } from 'react';
import { COUNTRIES, checkAddress, formatForMail, parseAddressBlock, type AddressParts } from '@/lib/address';
import { Area, Button, Field, Input, Modal } from './kit';
import { IconAlert } from './icons';
import { AddressSearch } from './AddressSearch';

export function AddressEditor({ value, country, onChange, disabled }: { value: string; country: string; onChange: (address: string, country: string) => void; disabled?: boolean }) {
  const [parts, setParts] = useState<AddressParts | null>(null);
  const parsed = value.trim() ? parseAddressBlock(country && !value.toUpperCase().includes(country.toUpperCase()) ? `${value}\n${country}` : value) : null;
  const warnings = parsed ? checkAddress(parsed) : [];

  return (
    <div>
      <AddressSearch disabled={disabled} onPick={(block, country) => onChange(block, country)} />
      <Field label="Postal address" hint="Paste it however you have it; Split and Tidy will sort it out.">
        <Area rows={4} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value, country)} placeholder={'1200 Larimer St\nDenver, CO 80202\nUnited States'} />
      </Field>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled} onClick={() => setParts(parseAddressBlock(value ? `${value}${country && !value.toUpperCase().includes(country.toUpperCase()) ? `\n${country}` : ''}` : ''))}>
          Split into fields
        </Button>
        <Button
          size="sm"
          disabled={disabled || !parsed}
          title="Reorder the lines the way the destination post office expects"
          onClick={() => parsed && onChange(formatForMail(parsed), parsed.country || country)}
        >
          Tidy
        </Button>
        {parsed && warnings.length === 0 && <span className="text-xs text-emerald-700 dark:text-emerald-400">Looks complete</span>}
      </div>
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1"><IconAlert size={12} className="mt-0.5 shrink-0" /> {w}</li>
          ))}
        </ul>
      )}

      <Modal
        open={!!parts}
        title="Address fields"
        onClose={() => setParts(null)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setParts(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { onChange(formatForMail(parts!), parts!.country); setParts(null); }}>Use this address</Button>
          </>
        }
      >
        {parts && (
          <div className="space-y-3">
            <Field label="Street"><Input value={parts.street} onChange={(e) => setParts({ ...parts, street: e.target.value })} /></Field>
            <Field label="Second line"><Input value={parts.line2} onChange={(e) => setParts({ ...parts, line2: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Town / city"><Input value={parts.city} onChange={(e) => setParts({ ...parts, city: e.target.value })} /></Field>
              <Field label="State / region"><Input value={parts.region} onChange={(e) => setParts({ ...parts, region: e.target.value })} /></Field>
              <Field label="Postcode"><Input value={parts.postcode} onChange={(e) => setParts({ ...parts, postcode: e.target.value })} /></Field>
              <Field label="Country">
                <Input list="countries" value={parts.country} onChange={(e) => setParts({ ...parts, country: e.target.value })} />
                <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            {checkAddress(parts).length > 0 && (
              <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {checkAddress(parts).map((w) => <li key={w}>• {w}</li>)}
              </ul>
            )}
            <div>
              <div className="mb-1 text-xs font-medium text-stone-600 dark:text-stone-300">How it will look on the envelope</div>
              <pre className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-sm dark:bg-stone-950">{formatForMail(parts) || '—'}</pre>
              <p className="mt-1 text-xs text-stone-500">Formatted offline by country convention. Not verified against any postal database.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
