// Shared calculations (main spec §5). Every module imports these; none re-implements them.
import type {
  BudgetCategory, BudgetLine, Guest, LegalDoc, Payment, Rsvp, ScheduleItem, Task, Venue,
  WeddingEvent, WeddingSettings,
} from './types';
import { addDays, daysBetween, fmtDate, fmtDateLong, num, timeToMins, todayISO } from './util';

// ─── money ───────────────────────────────────────────────────────────────────

export type LineEur = {
  estimate: number;
  quoted: number | null;
  contracted: number | null;
  paid: number;
  /** contracted || quoted || estimate — the figure the plan runs on */
  best: number;
  isFirm: boolean;
};

/** Convert an amount in `currency` to euros. fx is USD per 1 EUR. */
export function toEur(amount: number, currency: string, fx: number): number {
  return currency === 'USD' ? amount / (fx || 1) : amount;
}

/** Resolve one budget line to euros, converting currency and multiplying per-guest lines. */
export function lineEur(line: Pick<BudgetLine, 'estimate_eur' | 'quoted_eur' | 'contracted_eur' | 'paid_eur' | 'currency' | 'per_guest'>, headcount: number, fx: number): LineEur {
  const mult = line.per_guest ? Math.max(0, headcount) : 1;
  const conv = (v: number | null | undefined) => (v === null || v === undefined ? null : toEur(num(v), line.currency, fx) * mult);
  const estimate = conv(line.estimate_eur) ?? 0;
  const quoted = conv(line.quoted_eur);
  const contracted = conv(line.contracted_eur);
  const paid = toEur(num(line.paid_eur), line.currency, fx); // paid is what left the account — never per head
  const best = contracted || quoted || estimate;
  return { estimate, quoted, contracted, paid, best, isFirm: contracted !== null && contracted > 0 };
}

export type BudgetTotals = {
  fx: number;
  estimate: number;
  best: number;
  paid: number;
  firm: number;
  firmCount: number;
  ceilingEur: number;
  ceilingUsd: number;
  bestUsd: number;
  paidUsd: number;
  remaining: number;
  remainingUsd: number;
  over: boolean;
  usedPct: number;
  perGuest: number;
};

export function budgetTotals(lines: BudgetLine[], headcount: number, settings: Pick<WeddingSettings, 'fx_eur_usd' | 'budget_ceiling_usd'>): BudgetTotals {
  const fx = num(settings.fx_eur_usd) || 1;
  let estimate = 0, best = 0, paid = 0, firm = 0, firmCount = 0;
  for (const l of lines) {
    const r = lineEur(l, headcount, fx);
    estimate += r.estimate;
    best += r.best;
    paid += r.paid;
    if (r.isFirm) {
      firm += r.contracted ?? 0;
      firmCount++;
    }
  }
  const ceilingUsd = num(settings.budget_ceiling_usd);
  const ceilingEur = ceilingUsd / fx;
  const remaining = ceilingEur - best;
  return {
    fx, estimate, best, paid, firm, firmCount,
    ceilingEur, ceilingUsd,
    bestUsd: best * fx,
    paidUsd: paid * fx,
    remaining,
    remainingUsd: remaining * fx,
    over: ceilingEur > 0 && best > ceilingEur,
    usedPct: ceilingEur > 0 ? best / ceilingEur : 0,
    perGuest: headcount > 0 ? best / headcount : 0,
  };
}

export type CategoryTotal = { id: string | null; name: string; best: number; estimate: number; paid: number; count: number };

/** Per-category totals, sorted by `best` descending. Lines whose category was deleted
 *  land in "Uncategorised" — deleting a category never hides money. */
export function categoryTotals(lines: BudgetLine[], categories: BudgetCategory[], headcount: number, fx: number): CategoryTotal[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const acc = new Map<string, CategoryTotal>();
  for (const l of lines) {
    const cat = l.category_id ? byId.get(l.category_id) : undefined;
    const key = cat?.id ?? '__none';
    const t = acc.get(key) ?? { id: cat?.id ?? null, name: cat?.name ?? 'Uncategorised', best: 0, estimate: 0, paid: 0, count: 0 };
    const r = lineEur(l, headcount, fx);
    t.best += r.best;
    t.estimate += r.estimate;
    t.paid += r.paid;
    t.count++;
    acc.set(key, t);
  }
  return [...acc.values()].sort((a, b) => b.best - a.best);
}

/** Marginal cost of one more guest: the sum of per-guest lines, in euros. */
export function perGuestCost(lines: BudgetLine[], fx: number): number {
  return lines.filter((l) => l.per_guest).reduce((s, l) => s + lineEur(l, 1, fx).best, 0);
}

/** The "what if" sandbox: never touches per-guest lines, contingency or anything contracted. */
export function scenarioTotal(lines: BudgetLine[], categories: BudgetCategory[], headcount: number, fx: number, trim: number): number {
  const contingencyIds = new Set(categories.filter((c) => /contingen/i.test(c.name)).map((c) => c.id));
  return lines.reduce((s, l) => {
    const r = lineEur(l, headcount, fx);
    const trimmable = !l.per_guest && !r.isFirm && !(l.category_id && contingencyIds.has(l.category_id)) && !/contingen/i.test(l.label);
    return s + (trimmable ? r.best * (1 - trim) : r.best);
  }, 0);
}

export type UpcomingPayment = Payment & { days: number; eur: number };

/** Unpaid payments with a due date, annotated with days-until and euro value, soonest first. */
export function upcomingPayments(payments: Payment[], fx: number, today = todayISO()): UpcomingPayment[] {
  return payments
    .filter((p) => !p.paid_date && p.due_date)
    .map((p) => ({ ...p, days: daysBetween(today, p.due_date!), eur: toEur(num(p.amount), p.currency, fx) }))
    .sort((a, b) => a.days - b.days);
}

// ─── tasks ───────────────────────────────────────────────────────────────────

export function taskDue(task: Pick<Task, 'due_override' | 'offset_days'>, targetDate: string): string {
  return task.due_override || addDays(targetDate, -num(task.offset_days));
}

export type TaskState = { due: string; days: number; done: boolean; overdue: boolean; soon: boolean };

export function taskState(task: Task, targetDate: string, today = todayISO()): TaskState {
  const due = taskDue(task, targetDate);
  const days = daysBetween(today, due);
  const done = task.status === 'done' || task.status === 'na';
  return { due, days, done, overdue: !done && days < 0, soon: !done && days >= 0 && days <= 30 };
}

/** The task after moving it to `date`: a fixed date stays fixed; a relative one stays relative. */
export function rescheduled(t: Task, date: string, targetDate: string): Task {
  return t.due_override ? { ...t, due_override: date } : { ...t, offset_days: daysBetween(date, targetDate) };
}

export type TaskSummary = { done: number; overdue: number; soon: number; open: number; total: number; pct: number };

export function taskSummary(tasks: Task[], targetDate: string, today = todayISO()): TaskSummary {
  let done = 0, overdue = 0, soon = 0;
  for (const t of tasks) {
    const s = taskState(t, targetDate, today);
    if (s.done) done++;
    if (s.overdue) overdue++;
    if (s.soon) soon++;
  }
  const total = tasks.length;
  return { done, overdue, soon, open: total - done, total, pct: total ? done / total : 0 };
}

// ─── guests & RSVPs ──────────────────────────────────────────────────────────

/** Guests invited to an event: tier-A-only events exclude the B list. */
export function eventInvitees(guests: Guest[], event: Pick<WeddingEvent, 'invited_tier'> | null | undefined): Guest[] {
  if (!event) return guests;
  return event.invited_tier === 'A' ? guests.filter((g) => g.tier === 'A') : guests;
}

export type RsvpSummary = { yes: number; no: number; maybe: number; pending: number; total: number };

/** A missing row counts as pending. */
export function rsvpSummary(rsvps: Rsvp[], guests: Guest[], event: WeddingEvent | null | undefined): RsvpSummary {
  const out: RsvpSummary = { yes: 0, no: 0, maybe: 0, pending: 0, total: 0 };
  if (!event) return out;
  const byGuest = new Map(rsvps.filter((r) => r.event_id === event.id).map((r) => [r.guest_id, r.status]));
  for (const g of eventInvitees(guests, event)) {
    out[byGuest.get(g.id) ?? 'pending']++;
    out.total++;
  }
  return out;
}

export function primaryEvent(events: WeddingEvent[]): WeddingEvent | undefined {
  return events.find((e) => e.is_primary);
}

/**
 * The headcount the budget runs on. No guests yet → the planning target. Otherwise the
 * guests invited to the primary event, minus anyone who has declined: yes and maybe
 * count, and so does anyone who hasn't answered yet — until they say no, you are
 * catering for them. Never returns zero, or every per-guest line would read €0.
 */
export function planningHeadcount(guests: Guest[], rsvps: Rsvp[], events: WeddingEvent[], settings: Pick<WeddingSettings, 'guest_target'>): number {
  const target = Math.max(1, num(settings.guest_target) || 1);
  if (guests.length === 0) return target;
  const primary = primaryEvent(events);
  if (!primary) return Math.max(1, guests.length);
  const s = rsvpSummary(rsvps, guests, primary);
  const answered = s.yes + s.no + s.maybe;
  const n = answered > 0 ? s.total - s.no : s.total;
  return Math.max(1, n);
}

// ─── dates & venue ───────────────────────────────────────────────────────────

export function countdown(targetDate: string, today = todayISO()): { days: number; months: number } {
  const days = daysBetween(today, targetDate);
  return { days, months: Math.max(0, Math.floor(days / 30.44)) };
}

/** booked first, else held. Distinguishes "decided but unsigned" from "still choosing". */
export function chosenVenue(venues: Venue[]): { venue: Venue | null; signed: boolean; held: boolean } {
  const booked = venues.find((v) => v.status === 'booked');
  if (booked) return { venue: booked, signed: true, held: false };
  const held = venues.find((v) => v.status === 'held');
  if (held) return { venue: held, signed: false, held: true };
  return { venue: null, signed: false, held: false };
}

export const VENUE_CRITERIA = ['cost', 'capacity', 'lodging', 'legal', 'travel', 'weather', 'flexibility', 'feel'] as const;
export type Criterion = (typeof VENUE_CRITERIA)[number];

/** Σ(weight × score) as a fraction of the maximum possible (all 5s). */
export function venueScore(scores: unknown, weights: Record<Criterion, number>): number {
  const s = (scores && typeof scores === 'object' ? scores : {}) as Record<string, unknown>;
  let got = 0, max = 0;
  for (const c of VENUE_CRITERIA) {
    const w = weights[c] ?? 0;
    got += w * Math.min(5, Math.max(0, num(s[c])));
    max += w * 5;
  }
  return max > 0 ? got / max : 0;
}

// ─── legal ───────────────────────────────────────────────────────────────────

export type ValidityWarning = {
  doc: LegalDoc;
  /** problem = will be (or is) invalid on the day; timing = don't obtain it before a date */
  severity: 'problem' | 'timing';
  message: string;
  obtainAfter?: string;
};

/** Documents whose validity window clashes with the wedding date. */
export function validityWarnings(docs: LegalDoc[], targetDate: string, today = todayISO()): ValidityWarning[] {
  const out: ValidityWarning[] = [];
  for (const doc of docs) {
    if (doc.status === 'na') continue;
    if (doc.status === 'expired') {
      out.push({ doc, severity: 'problem', message: 'Marked expired — it needs replacing.' });
      continue;
    }
    const validity = doc.validity_days ? num(doc.validity_days) : 0;
    const expires = doc.expires_on || (doc.obtained_on && validity ? addDays(doc.obtained_on, validity) : null);
    if (doc.status === 'obtained' || doc.obtained_on) {
      if (expires && expires < targetDate) {
        out.push({
          doc,
          severity: 'problem',
          message: `${expires < today ? 'Expired' : 'Expires'} ${fmtDate(expires)} — before the wedding on ${fmtDate(targetDate)}.`,
        });
      }
      continue;
    }
    if (validity) {
      const earliest = addDays(targetDate, -validity);
      if (today < earliest) {
        out.push({
          doc,
          severity: 'timing',
          message: `Valid ${validity} days — obtained today it would lapse before the wedding. Get it after ${fmtDate(earliest)}.`,
          obtainAfter: earliest,
        });
      }
    }
  }
  return out;
}

// ─── run of show ─────────────────────────────────────────────────────────────

const EXCLUSIVE_KINDS = new Set(['moment', 'food', 'music']);

/**
 * Pairs of items that cannot overlap: two guest-facing items of the same kind (two
 * ceremonies, two meals, two sets of music), or two items with the same named owner —
 * one person cannot be in two places. A toast during dinner is fine.
 */
export function scheduleClashes(items: ScheduleItem[]): [ScheduleItem, ScheduleItem][] {
  const timed = items
    .map((i) => ({ i, start: timeToMins(i.time) }))
    .filter((x): x is { i: ScheduleItem; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start);
  const out: [ScheduleItem, ScheduleItem][] = [];
  for (let a = 0; a < timed.length; a++) {
    const A = timed[a];
    const aEnd = A.start + Math.max(1, num(A.i.duration_mins));
    for (let b = a + 1; b < timed.length; b++) {
      const B = timed[b];
      if (B.start >= aEnd) break;
      if (A.i.event_id !== B.i.event_id) continue;
      const sameKind = A.i.kind === B.i.kind && EXCLUSIVE_KINDS.has(A.i.kind);
      const sameOwner = !!A.i.owner && A.i.owner.trim().toLowerCase() === B.i.owner.trim().toLowerCase();
      if (sameKind || sameOwner) out.push([A.i, B.i]);
    }
  }
  return out;
}

// ─── templates ───────────────────────────────────────────────────────────────

export type TokenValues = { couple: string; date: string; venue: string; guests: string; household: string; rsvpBy: string; website: string };

export function templateTokens(settings: WeddingSettings, venue: Venue | null, headcount: number, household = ''): TokenValues {
  const couple = [settings.couple_a, settings.couple_b].filter(Boolean).join(' & ') || 'Us';
  return {
    couple,
    date: fmtDateLong(settings.target_date),
    venue: venue ? [venue.name, venue.town || venue.region, venue.country].filter(Boolean).join(', ') : '[venue to be confirmed]',
    guests: String(headcount),
    household: household || '[household]',
    rsvpBy: settings.rsvp_by ? fmtDateLong(settings.rsvp_by) : '[RSVP date]',
    website: settings.website || '[wedding website]',
  };
}

export function fillTemplate(text: string, tokens: TokenValues): string {
  return text.replace(/\{(couple|date|venue|guests|household|rsvpBy|website)\}/g, (_, k: keyof TokenValues) => tokens[k]);
}
