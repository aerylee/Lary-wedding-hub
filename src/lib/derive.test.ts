import type { BudgetLine, Guest, LegalDoc, Rsvp, ScheduleItem, Task, Venue, WeddingEvent } from './types';
import {
  budgetTotals, categoryTotals, chosenVenue, lineEur, planningHeadcount, rsvpSummary, scenarioTotal,
  scheduleClashes, taskDue, taskState, validityWarnings, venueScore, fillTemplate, rescheduled,
} from './derive';

const line = (p: Partial<BudgetLine>): BudgetLine => ({
  id: crypto.randomUUID(), wedding_id: 'w', category_id: null, label: 'x', vendor_id: null,
  estimate_eur: 0, quoted_eur: null, contracted_eur: null, paid_eur: 0, currency: 'EUR', per_guest: false,
  funded_by: '', note: '', created_at: '', updated_at: '', created_by: null, updated_by: null, ...p,
});
const guest = (p: Partial<Guest> = {}): Guest => ({
  id: crypto.randomUUID(), wedding_id: 'w', household: '', first_name: 'G', last_name: '', side: 'both', tier: 'A',
  relationship: '', is_child: false, plus_one_for: null, meal: '', dietary: '', room_id: null, table_id: null,
  arrival: null, departure: null, arrival_flight: '', departure_flight: '', needs_shuttle: false, invite_sent: null,
  notes: '', created_at: '', updated_at: '', created_by: null, updated_by: null, ...p,
});
const event = (p: Partial<WeddingEvent> = {}): WeddingEvent => ({
  id: 'e1', wedding_id: 'w', name: 'Ceremony', date: null, start_time: null, location: '', dress: '',
  invited_tier: 'all', note: '', sort_order: 0, is_primary: true, created_at: '', updated_at: '', created_by: null, updated_by: null, ...p,
});
const rsvp = (guest_id: string, status: Rsvp['status'], event_id = 'e1'): Rsvp => ({
  id: crypto.randomUUID(), wedding_id: 'w', guest_id, event_id, status, responded_at: null,
  created_at: '', updated_at: '', created_by: null, updated_by: null,
});

describe('budget', () => {
  it('converts USD lines and multiplies per-guest lines', () => {
    expect(lineEur(line({ estimate_eur: 108, currency: 'USD' }), 10, 1.08).best).toBeCloseTo(100);
    expect(lineEur(line({ estimate_eur: 95, per_guest: true }), 60, 1.08).best).toBe(5700);
  });
  it('picks contracted over quoted over estimate, and marks firm lines', () => {
    const r = lineEur(line({ estimate_eur: 100, quoted_eur: 120, contracted_eur: 110 }), 1, 1);
    expect(r.best).toBe(110);
    expect(r.isFirm).toBe(true);
    expect(lineEur(line({ estimate_eur: 100, quoted_eur: 120 }), 1, 1).best).toBe(120);
  });
  it('compares against a USD ceiling in euros', () => {
    const t = budgetTotals([line({ estimate_eur: 60000 })], 50, { fx_eur_usd: 1.2, budget_ceiling_usd: 60000 });
    expect(t.ceilingEur).toBe(50000);
    expect(t.over).toBe(true);
    expect(t.remaining).toBe(-10000);
    expect(t.bestUsd).toBe(72000);
  });
  it('keeps lines of deleted categories visible', () => {
    const cats = categoryTotals([line({ estimate_eur: 5, category_id: 'gone' })], [], 1, 1);
    expect(cats[0].name).toBe('Uncategorised');
    expect(cats[0].best).toBe(5);
  });
  it('trims only uncontracted fixed, non-contingency costs', () => {
    const lines = [
      line({ estimate_eur: 1000 }),
      line({ estimate_eur: 10, per_guest: true }),
      line({ estimate_eur: 1000, contracted_eur: 1000 }),
      line({ estimate_eur: 500, label: 'Contingency' }),
    ];
    expect(scenarioTotal(lines, [], 10, 1, 0.5)).toBe(500 + 100 + 1000 + 500);
  });
});

describe('headcount', () => {
  it('falls back to the target with no guests, and never returns zero', () => {
    expect(planningHeadcount([], [], [], { guest_target: 80 })).toBe(80);
    const g = guest();
    expect(planningHeadcount([g], [rsvp(g.id, 'no')], [event()], { guest_target: 80 })).toBe(1);
  });
  it('uses the invited count until RSVPs arrive, then drops the declines', () => {
    const gs = [guest(), guest(), guest(), guest()];
    expect(planningHeadcount(gs, [], [event()], { guest_target: 80 })).toBe(4);
    expect(planningHeadcount(gs, [rsvp(gs[0].id, 'yes'), rsvp(gs[1].id, 'no')], [event()], { guest_target: 80 })).toBe(3);
  });
  it('summarises RSVPs per event, with tier-A-only events excluding the B list', () => {
    const a = guest({ tier: 'A' });
    const b = guest({ tier: 'B' });
    expect(rsvpSummary([rsvp(a.id, 'yes')], [a, b], event({ invited_tier: 'A' }))).toEqual({ yes: 1, no: 0, maybe: 0, pending: 0, total: 1 });
    expect(rsvpSummary([], [a, b], event()).pending).toBe(2);
  });
});

describe('tasks', () => {
  const task = (p: Partial<Task>): Task => ({
    id: 't', wedding_id: 'w', title: '', phase: '', offset_days: 0, due_override: null, owner: '', status: 'todo',
    category: '', note: '', critical: false, created_at: '', updated_at: '', created_by: null, updated_by: null, ...p,
  });
  it('dates tasks off the wedding, so moving the date moves the plan', () => {
    expect(taskDue(task({ offset_days: 30 }), '2027-06-12')).toBe('2027-05-13');
    expect(taskDue(task({ offset_days: 30, due_override: '2027-01-01' }), '2027-06-12')).toBe('2027-01-01');
  });
  it('flags overdue and soon; n/a counts as done', () => {
    expect(taskState(task({ offset_days: 30 }), '2027-06-12', '2027-05-20').overdue).toBe(true);
    expect(taskState(task({ offset_days: 30 }), '2027-06-12', '2027-05-01').soon).toBe(true);
    expect(taskState(task({ offset_days: 30, status: 'na' }), '2027-06-12', '2027-05-20').done).toBe(true);
  });
});

describe('venues & legal', () => {
  const venue = (status: Venue['status']) => ({ id: status, status } as Venue);
  it('prefers booked over held', () => {
    expect(chosenVenue([venue('held'), venue('booked')])).toMatchObject({ signed: true, held: false });
    expect(chosenVenue([venue('held')])).toMatchObject({ signed: false, held: true });
    expect(chosenVenue([venue('quoted')]).venue).toBeNull();
  });
  it('scores venues as a share of the weighted maximum', () => {
    const w = { cost: 2, capacity: 1, lodging: 0, legal: 0, travel: 0, weather: 0, flexibility: 0, feel: 0 };
    expect(venueScore({ cost: 5, capacity: 2 }, w)).toBeCloseTo((10 + 2) / 15);
  });
  it('warns when a document expires before the wedding, or would if obtained now', () => {
    const doc = (p: Partial<LegalDoc>) => ({ id: 'd', status: 'not_started', validity_days: 180, obtained_on: null, expires_on: null, ...p } as LegalDoc);
    const early = validityWarnings([doc({ status: 'obtained', obtained_on: '2026-01-01' })], '2027-06-12', '2026-02-01');
    expect(early[0].severity).toBe('problem');
    const timing = validityWarnings([doc({})], '2027-06-12', '2026-02-01');
    expect(timing[0]).toMatchObject({ severity: 'timing', obtainAfter: '2026-12-14' });
    expect(validityWarnings([doc({ status: 'na' })], '2027-06-12', '2026-02-01')).toHaveLength(0);
  });
});

describe('run of show', () => {
  const item = (p: Partial<ScheduleItem>): ScheduleItem => ({
    id: crypto.randomUUID(), wedding_id: 'w', event_id: 'e', time: '16:00', duration_mins: 30, title: '', detail: '',
    owner: '', vendor_id: null, location: '', kind: 'moment', created_at: '', updated_at: '', created_by: null, updated_by: null, ...p,
  });
  it('flags same-kind or same-owner overlaps, not a toast during dinner', () => {
    expect(scheduleClashes([item({ kind: 'food', duration_mins: 90 }), item({ time: '16:30', kind: 'moment' })])).toHaveLength(0);
    expect(scheduleClashes([item({ kind: 'food', duration_mins: 90 }), item({ time: '16:30', kind: 'food' })])).toHaveLength(1);
    expect(scheduleClashes([item({ owner: 'Paola', kind: 'logistics' }), item({ time: '16:10', owner: 'paola', kind: 'photo' })])).toHaveLength(1);
    expect(scheduleClashes([item({}), item({ time: '16:30' })])).toHaveLength(0);
  });
});

describe('templates', () => {
  it('fills known tokens and leaves unknown braces alone', () => {
    const t = { couple: 'R & L', date: 'D', venue: 'V', guests: '60', household: 'H', rsvpBy: 'R', website: 'W' };
    expect(fillTemplate('{couple} at {venue} — {unknown}', t)).toBe('R & L at V — {unknown}');
  });
});

describe('rescheduled', () => {
  const base = { offset_days: 100, due_override: null } as unknown as Parameters<typeof rescheduled>[0];
  it('keeps a relative task relative to the wedding', () => {
    expect(rescheduled(base, '2027-06-01', '2027-06-19').offset_days).toBe(18);
    expect(rescheduled(base, '2027-06-01', '2027-06-19').due_override).toBeNull();
  });
  it('moves a fixed-date task to the new date', () => {
    const fixed = { ...base, due_override: '2027-01-01' };
    expect(rescheduled(fixed, '2027-02-02', '2027-06-19')).toMatchObject({ due_override: '2027-02-02', offset_days: 100 });
  });
});
