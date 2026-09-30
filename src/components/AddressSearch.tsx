// "Search Google Maps" box above the address editor. Suggestions render in the app's own
// dropdown; picking one fills the address in mailing order. Hidden when no key is set.
import { useEffect, useId, useRef, useState } from 'react';
import { addressFromSuggestion, newSessionToken, placesEnabled, suggestAddresses, type AddressSuggestion } from '@/lib/googlePlaces';
import { cls } from '@/lib/util';
import { Input } from './kit';
import { IconMapPin } from './icons';

export function AddressSearch({ onPick, disabled }: { onPick: (block: string, country: string) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<unknown>(null);
  const seq = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (!placesEnabled || q.trim().length < 3) {
      setItems([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        token.current ??= await newSessionToken();
        const found = await suggestAddresses(q.trim(), token.current);
        if (mine !== seq.current) return; // a newer keystroke won
        setItems(found.slice(0, 6));
        setActive(0);
        setOpen(true);
        setError(null);
      } catch (e) {
        if (mine === seq.current) setError((e as Error).message || 'Google address search is unavailable.');
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!placesEnabled) return null;

  async function pick(s: AddressSuggestion) {
    setOpen(false);
    try {
      const { block, parts } = await addressFromSuggestion(s);
      onPick(block, parts.country);
      setQ('');
      setItems([]);
      token.current = null; // a session ends when a place is chosen
    } catch {
      setError('Could not load that address from Google.');
    }
  }

  return (
    <div className="relative mb-2">
      <div className="relative">
        <IconMapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
            if (e.key === 'Enter') { e.preventDefault(); pick(items[active]); }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search Google Maps for an address…"
          className="pl-8"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={cls('cursor-pointer px-3 py-2 text-sm', i === active && 'bg-amber-50 dark:bg-stone-800')}
            >
              {s.label}
            </li>
          ))}
          <li className="px-3 py-1 text-right text-[10px] text-stone-400">Powered by Google</li>
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error} You can still type the address below.</p>}
      <p className="mt-1 text-[11px] text-stone-400">What you type here is sent to Google to find matches.</p>
    </div>
  );
}
