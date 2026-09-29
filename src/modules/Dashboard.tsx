// Dashboard (main spec §7.1): a read-only roll-up; every card jumps to its module and only
// renders if the viewer can read what's underneath.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { ActivityEntry } from '@/lib/types';
import {
  budgetTotals, categoryTotals, countdown, rsvpSummary, taskState, taskSummary, upcomingPayments, validityWarnings,
} from '@/lib/derive';
import { cls, daysUntil, dayOfWeek, eur, fmtDate, fmtDateLong, fmtMoney, pct, relativeDays, sortBy, timeAgo, usd } from '@/lib/util';
import { Banner, Bar, Empty, Panel, PanelHead, Pill, Stat, StatGrid } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { usePlan } from './common';

function Jump({ to, children = 'Open' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={`../${to}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-800 hover:underline dark:text-amber-400">
      {children} <IconChevronRight size={12} />
    </Link>
  );
}

export default function Dashboard() {
  const { get, settings } = useStore();
  const { can } = useAuth();
  const { headcount, fx, primary, chosen } = usePlan();
  const tasks = get('tasks');
  const lines = get('budget_lines');
  const categories = get('budget_categories');
  const payments = get('payments');
  const legal = get('legal_docs');
  const guests = get('guests');
  const rsvps = get('rsvps');

  const cd = countdown(settings.target_date);
  const ts = taskSummary(tasks, settings.target_date);
  const bt = can('finance:read') ? budgetTotals(lines, headcount, settings) : null;
  const rs = rsvpSummary(rsvps, guests, primary);
  const warnings = validityWarnings(legal, settings.target_date).filter((w) => w.severity === 'problem');
  const legalApplicable = legal.filter((d) => d.status !== 'na');
  const legalDone = legalApplicable.filter((d) => d.status === 'obtained').length;
  const decideIn = daysUntil(settings.decide_venue_by);

  const nextTasks = useMemo(
    () => sortBy(tasks.map((t) => ({ t, s: taskState(t, settings.target_date) })).filter((x) => !x.s.done), (x) => x.s.due).slice(0, 7),
    [tasks, settings.target_date],
  );

  const venue = chosen.venue;

  return (
    <div>
      <Panel className="mb-5 overflow-hidden">
        <div className="bg-gradient-to-br from-amber-50 to-rose-50 px-5 py-6 dark:from-stone-900 dark:to-stone-900">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-400">{settings.date_is_firm ? 'The date' : 'Working date'}</div>
          <div className="mt-1 font-serif text-3xl font-semibold sm:text-4xl">{fmtDateLong(settings.target_date)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-stone-300">
            <span>{venue ? <>{venue.name}{venue.country && `, ${venue.country}`} {!chosen.signed && <Pill tone="warn">held, not signed</Pill>}</> : 'Venue not yet chosen'}</span>
            <span className="tabular-nums">{cd.days >= 0 ? `${cd.days} days · about ${cd.months} months away` : 'Congratulations!'}</span>
          </div>
        </div>
      </Panel>

      {/* ─── alerts, only when true ─── */}
      {chosen.held && venue && (
        <Banner tone="warn" action={<Jump to="venues">Venues</Jump>}>
          <strong>{venue.name} is holding your dates, but nothing is signed.</strong> A hold is a courtesy, not a booking
          {venue.hold_expires ? ` — it expires ${fmtDate(venue.hold_expires)} (${relativeDays(daysUntil(venue.hold_expires))})` : ''}. Get the contract.
        </Banner>
      )}
      {!venue && can('venues:read') && (
        <Banner tone={decideIn !== null && decideIn < 90 ? 'bad' : 'info'} action={<Jump to="venues">Compare venues</Jump>}>
          <strong>No venue chosen yet.</strong>{' '}
          {settings.decide_venue_by
            ? decideIn! < 0
              ? `The decide-by date (${fmtDate(settings.decide_venue_by)}) has passed.`
              : `You planned to decide by ${fmtDate(settings.decide_venue_by)} — ${relativeDays(decideIn)}.`
            : 'Set a decide-by date on the Venues page.'}
        </Banner>
      )}
      {bt?.over && (
        <Banner tone="bad" action={<Jump to="budget">Budget</Jump>}>
          <strong>The plan is over the ceiling</strong> by {eur(-bt.remaining)} ({usd(-bt.remainingUsd)}).
        </Banner>
      )}
      {ts.overdue > 0 && (
        <Banner tone="bad" action={<Jump to="timeline">Timeline</Jump>}>
          <strong>{ts.overdue} overdue task{ts.overdue === 1 ? '' : 's'}.</strong>
        </Banner>
      )}
      {warnings.length > 0 && (
        <Banner tone="warn" action={<Jump to="legal">Legal</Jump>}>
          <strong>{warnings.length} legal document{warnings.length === 1 ? '' : 's'}</strong> will not be valid on the day: {warnings.slice(0, 3).map((w) => w.doc.title).join(', ')}.
        </Banner>
      )}

      <StatGrid>
        {bt && (
          <Stat
            label="Budget used"
            value={pct(bt.usedPct)}
            tone={bt.over ? 'bad' : bt.usedPct > 0.9 ? 'warn' : 'default'}
            sub={`${eur(bt.best)} of ${eur(bt.ceilingEur)} (${usd(bt.ceilingUsd)})`}
          />
        )}
        <Stat label="Tasks done" value={`${ts.done}/${ts.total}`} sub={`${ts.soon} due in the next 30 days`} tone={ts.overdue ? 'warn' : 'default'} />
        {can('guests:read') && <Stat label={`RSVPs · ${primary?.name ?? 'main event'}`} value={rs.yes} sub={`${rs.maybe} maybe · ${rs.pending} pending · ${rs.no} no`} />}
        <Stat label="Legal documents" value={`${legalDone}/${legalApplicable.length}`} sub={`${legalApplicable.length - legalDone} outstanding`} tone={warnings.length ? 'warn' : 'default'} />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Next up" sub="The seven soonest open tasks" actions={<Jump to="timeline">Timeline</Jump>} />
          {nextTasks.length === 0 ? (
            <Empty title="Nothing open" body="Every task is done or marked not applicable." />
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {nextTasks.map(({ t, s }) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={cls('w-24 shrink-0 tabular-nums', s.overdue ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-stone-500')}>{fmtDate(s.due, { year: false })}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.critical && <Pill tone="warn">key</Pill>}
                  {s.overdue && <Pill tone="bad">overdue</Pill>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Activity />

        {bt && (
          <Panel>
            <PanelHead title="Payments due" actions={<Jump to="budget">Budget</Jump>} />
            {(() => {
              const next = upcomingPayments(payments, fx).slice(0, 4);
              return next.length === 0 ? (
                <Empty title="No payments scheduled" body="Add instalments on the Budget page as contracts come in." />
              ) : (
                <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                  {next.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{p.label}</div>
                        <div className={cls('text-xs', p.days < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-stone-500')}>{fmtDate(p.due_date)} · {relativeDays(p.days)}</div>
                      </div>
                      <span className="tabular-nums">{fmtMoney(Number(p.amount), p.currency)}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Panel>
        )}

        {bt && (
          <Panel className="lg:col-span-2">
            <PanelHead title="Where the money goes" sub={`Top categories · ${headcount} guests`} actions={<Jump to="budget">Budget</Jump>} />
            <ul className="space-y-2.5 p-4">
              {categoryTotals(lines, categories, headcount, fx).slice(0, 6).map((c) => (
                <li key={c.id ?? 'none'} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span>{c.name}</span>
                    <span className="tabular-nums text-stone-600 dark:text-stone-300">{eur(c.best)} · {pct(bt.best ? c.best / bt.best : 0)}</span>
                  </div>
                  <Bar value={bt.best ? c.best / bt.best : 0} label={c.name} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      <p className="mt-4 text-xs text-stone-500">{dayOfWeek(settings.target_date)} wedding · planning for {headcount} guests</p>
    </div>
  );
}

// ─── activity feed ───────────────────────────────────────────────────────────

const TABLE_NOUN: Record<string, string> = {
  wedding_settings: 'the settings', budget_settings: 'the budget ceiling', venues: 'venue', tasks: 'task', vendors: 'vendor',
  vendor_finance: 'a vendor’s money', budget_categories: 'budget category', budget_lines: 'budget line', payments: 'payment',
  events: 'event', rooms: 'room block', seat_tables: 'table', guests: 'guest', guest_contacts: 'contact details', rsvps: 'an RSVP',
  legal_docs: 'document', decisions: 'decision', schedule_items: 'run-of-show item', comms_rows: 'comms for', templates: 'template',
  correspondence: 'vendor log entry', attachments: 'file', faqs: 'FAQ', memberships: 'team member',
};

function describeValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return '…';
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function describe(a: ActivityEntry): { verb: string; what: string; detail: string } {
  const noun = TABLE_NOUN[a.table_name] ?? a.table_name.replace(/_/g, ' ');
  const verb = a.action === 'insert' ? 'added' : a.action === 'delete' ? 'removed' : 'changed';
  const what = a.label ? `${noun} “${a.label}”` : noun;
  let detail = '';
  if (a.action === 'update' && a.changed && typeof a.changed === 'object') {
    detail = Object.entries(a.changed as Record<string, [unknown, unknown]>)
      .slice(0, 3)
      .map(([k, [o, n]]) => `${k.replace(/_/g, ' ')}: ${describeValue(o)} → ${describeValue(n)}`)
      .join('; ');
  }
  return { verb, what, detail };
}

function Activity() {
  const { activity, members } = useStore();
  const names = new Map(members.map((m) => [m.user_id, m.profile?.full_name || m.profile?.email || 'Someone']));
  return (
    <Panel className="lg:row-span-2">
      <PanelHead title="Activity" sub="Who changed what, most recent first" />
      {activity.length === 0 ? (
        <Empty title="Nothing yet" body="Changes the team makes will show up here." />
      ) : (
        <ul className="max-h-[32rem] divide-y divide-stone-100 overflow-y-auto dark:divide-stone-800">
          {activity.slice(0, 40).map((a) => {
            const d = describe(a);
            return (
              <li key={a.id} className="px-4 py-2 text-sm">
                <div>
                  <span className="font-medium">{a.actor_id ? names.get(a.actor_id) ?? 'A former member' : 'The system'}</span> {d.verb} {d.what}
                </div>
                {d.detail && <div className="truncate text-xs text-stone-500" title={d.detail}>{d.detail}</div>}
                <div className="text-[11px] text-stone-400">{timeAgo(a.at)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

