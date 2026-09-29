// Small pieces several modules share.
import { useMemo, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { chosenVenue, planningHeadcount, primaryEvent } from '@/lib/derive';
import { download, num, sortBy, toCSV } from '@/lib/util';
import { Button, Pill, type Tone } from '@/components/kit';
import { IconDownload } from '@/components/icons';

/** The figures nearly every module needs, derived once. */
export function usePlan() {
  const { settings, get } = useStore();
  const guests = get('guests');
  const rsvps = get('rsvps');
  const events = get('events');
  const venues = get('venues');
  return useMemo(() => {
    const sortedEvents = sortBy(events, (e) => e.sort_order, (e) => e.date);
    return {
      settings,
      fx: num(settings.fx_eur_usd) || 1,
      headcount: planningHeadcount(guests, rsvps, events, settings),
      events: sortedEvents,
      primary: primaryEvent(events) ?? null,
      chosen: chosenVenue(venues),
    };
  }, [settings, guests, rsvps, events, venues]);
}

export function CsvButton({ filename, rows, columns, label = 'CSV', disabled }: { filename: string; rows: () => Record<string, unknown>[]; columns?: string[]; label?: string; disabled?: boolean }) {
  return (
    <Button size="sm" disabled={disabled} onClick={() => download(filename, toCSV(rows(), columns))} title="Download as CSV">
      <IconDownload size={14} /> {label}
    </Button>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2">{children}</div>;
}

export function StatusPill<T extends string>({ value, tones, labels }: { value: T; tones: Partial<Record<T, Tone>>; labels?: Partial<Record<T, string>> }) {
  return <Pill tone={tones[value] ?? 'default'}>{labels?.[value] ?? value.replace(/_/g, ' ')}</Pill>;
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 gap-3 ${c}`}>{children}</div>;
}

/** Split/join helpers for text[] columns edited as one item per line. */
export const lines = {
  toText: (xs: string[] | null | undefined) => (xs ?? []).join('\n'),
  fromText: (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean),
};
