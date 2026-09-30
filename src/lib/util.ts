// Dates, money, CSV, sort/group. Pure helpers — no React, no Supabase.

// ─── dates ───────────────────────────────────────────────────────────────────
// Date-only values ('YYYY-MM-DD') are parsed at local noon so no timezone offset can roll
// them into the previous or next day.

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  return daysBetween(todayISO(now), iso);
}

/** Six-or-fewer weeks of ISO dates covering a month, Sunday first. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1, 12);
  const start = addDays(toISODate(first), -first.getDay());
  const last = new Date(year, month + 1, 0, 12);
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayOfWeek(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? WEEKDAYS[d.getDay()] : '';
}

/** Monday–Thursday: a real decision for guests taking leave, and worth saying out loud. */
export function isMidweek(iso: string | null | undefined): boolean {
  const d = parseDate(iso);
  return !!d && d.getDay() >= 1 && d.getDay() <= 4;
}

export function fmtDate(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: opts.weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: opts.year === false ? undefined : 'numeric',
  });
}

export function fmtDateLong(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

/** 'HH:MM[:SS]' → minutes after midnight. */
export function timeToMins(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minsToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function relativeDays(n: number | null): string {
  if (n === null) return '';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function timeAgo(ts: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── money ───────────────────────────────────────────────────────────────────
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(amount: number | null | undefined, currency: 'EUR' | 'USD' = 'EUR', opts: { cents?: boolean } = {}): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const digits = opts.cents ? 2 : 0;
  const s = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sym = currency === 'EUR' ? '€' : '$';
  return `${amount < 0 ? '−' : ''}${sym}${s}`;
}

export const eur = (n: number | null | undefined) => fmtMoney(n, 'EUR');
export const usd = (n: number | null | undefined) => fmtMoney(n, 'USD');

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
// Hand-rolled pair; RFC 4180 quoting, CRLF out, any newline in.

export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    // neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === '\t') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** CSV text → objects keyed by the (trimmed, lower-cased) header row. */
export function csvObjects(text: string): Record<string, string>[] {
  const [head, ...body] = parseCSV(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function download(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── collections ─────────────────────────────────────────────────────────────
export function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function sortBy<T>(items: T[], ...keys: ((t: T) => string | number | null | undefined)[]): T[] {
  return [...items].sort((a, b) => {
    for (const k of keys) {
      const va = k(a);
      const vb = k(b);
      if (va === vb) continue;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb), undefined, { numeric: true });
    }
    return 0;
  });
}

export function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function cls(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

export function guestName(g: { first_name: string; last_name: string }): string {
  return `${g.first_name} ${g.last_name}`.trim() || 'Unnamed guest';
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
