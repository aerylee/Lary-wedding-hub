// Settings (main spec §7.13): names, date, money, and the weekend's events.
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { WeddingEvent, WeddingSettings } from '@/lib/types';
import { dayOfWeek, fmtDate, fmtTime, isMidweek, num, todayISO } from '@/lib/util';
import { Button, Check, Empty, Field, Input, Modal, Money, NumberInput, Panel, PanelHead, Pill, Select, SectionTitle, TD, TH, TR, TWrap, Area } from '@/components/kit';
import { Can, CanButton, whyNot } from '@/components/Gate';
import { EditorFooter, useEditor } from '@/components/editor';
import { IconPlus } from '@/components/icons';
import { Grid, usePlan } from './common';

/** A settings field saves when you leave it — the one place that writes without a Save button. */
function useSetting<K extends keyof WeddingSettings>(key: K) {
  const { settings, saveSettings } = useStore();
  const [v, setV] = useState(settings[key]);
  useEffect(() => {
    setV(settings[key]);
  }, [settings, key]);
  const commit = (next = v) => {
    if (next !== settings[key]) saveSettings({ [key]: next } as Partial<WeddingSettings>).catch(() => setV(settings[key]));
  };
  return [v, setV, commit] as const;
}

function TextSetting({ k, label, hint, type = 'text', disabled }: { k: 'couple_a' | 'couple_b' | 'website' | 'target_date' | 'decide_venue_by' | 'rsvp_by'; label: string; hint?: string; type?: string; disabled: boolean }) {
  const [v, setV, commit] = useSetting(k);
  return (
    <Field label={label} hint={hint}>
      <Input type={type} value={(v as string | null) ?? ''} disabled={disabled} onChange={(e) => setV(e.target.value || (type === 'date' ? null : '') as never)} onBlur={() => commit()} />
    </Field>
  );
}

export default function Settings() {
  const { settings, saveSettings } = useStore();
  const { can } = useAuth();
  const { headcount } = usePlan();
  const w = can('settings:write');
  const [ceiling, setCeiling, commitCeiling] = useSetting('budget_ceiling_usd');
  const [fx, setFx] = useSetting('fx_eur_usd');
  const [target, setTarget, commitTarget] = useSetting('guest_target');
  const [countries, setCountries] = useState(settings.candidate_countries.join(', '));
  useEffect(() => {
    setCountries(settings.candidate_countries.join(', '));
  }, [settings.candidate_countries]);

  return (
    <div>
      <SectionTitle sub="The working date drives every countdown and task due date — move it and the whole plan moves with it.">Wedding settings</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead title="The couple & the date" />
          <div className="space-y-3 p-4">
            <Grid>
              <TextSetting k="couple_a" label="One of you" disabled={!w} />
              <TextSetting k="couple_b" label="The other" disabled={!w} />
            </Grid>
            <TextSetting
              k="target_date"
              type="date"
              label="Wedding date"
              disabled={!w}
              hint={`${dayOfWeek(settings.target_date)}${isMidweek(settings.target_date) ? ' — a midweek wedding. That is a real decision: most guests will need extra days off.' : '.'}`}
            />
            <Check
              checked={settings.date_is_firm}
              disabled={!w}
              onChange={(v) => saveSettings({ date_is_firm: v }).catch(() => undefined)}
              label="The date is firm"
              hint="Until it is, the app labels it the working date."
            />
            <Grid>
              <TextSetting k="decide_venue_by" type="date" label="Decide the venue by" disabled={!w} />
              <TextSetting k="rsvp_by" type="date" label="RSVP by" disabled={!w} hint="Fills {rsvpBy} in templates." />
            </Grid>
            <TextSetting k="website" label="Wedding website" disabled={!w} hint="Fills {website} in templates." />
            <Field label="Candidate countries" hint="Comma-separated. The Legal page compares these.">
              <Input
                value={countries}
                disabled={!w}
                onChange={(e) => setCountries(e.target.value)}
                onBlur={() => {
                  const list = countries.split(',').map((s) => s.trim()).filter(Boolean);
                  if (list.join(',') !== settings.candidate_countries.join(',')) saveSettings({ candidate_countries: list }).catch(() => undefined);
                }}
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Money & headcount" sub="Spend is in euros against a ceiling in dollars." />
          <div className="space-y-3 p-4">
            <Can perm="finance:read" fallback={<p className="text-sm text-stone-500">The budget ceiling and exchange rate are visible to owners and planners.</p>}>
              <Field label="Budget ceiling (USD)" hint={!can('finance:write') ? whyNot('finance:write') : undefined}>
                <Money currency="USD" value={ceiling} disabled={!can('finance:write')} onChange={(v) => setCeiling(v)} />
              </Field>
              <Field label="Exchange rate: 1 EUR =" hint={`USD. Set ${fmtDate(settings.fx_set_on)} (${settings.fx_source === 'auto' ? 'refreshed automatically' : 'entered by hand'}).`}>
                <Input
                  type="number"
                  step="0.0001"
                  value={fx ?? ''}
                  disabled={!can('finance:write') || !w}
                  onChange={(e) => setFx(Number(e.target.value))}
                  onBlur={() => {
                    if (num(fx) > 0 && num(fx) !== num(settings.fx_eur_usd)) saveSettings({ fx_eur_usd: num(fx), fx_set_on: todayISO(), fx_source: 'manual' }).catch(() => undefined);
                  }}
                />
              </Field>
              <div className="flex justify-end">
                <Button size="sm" variant="primary" disabled={!can('finance:write') || num(ceiling) === num(settings.budget_ceiling_usd)} onClick={() => commitCeiling()}>
                  Save ceiling
                </Button>
              </div>
            </Can>
            <Field label="Planning headcount" hint={`Used until a real guest list exists. The budget currently runs on ${headcount}.`}>
              <NumberInput value={target} min={1} disabled={!w} onChange={(v) => setTarget(v ?? 1)} onBlur={() => commitTarget()} />
            </Field>
          </div>
        </Panel>
      </div>

      <Events />
    </div>
  );
}

function blankEvent(): WeddingEvent {
  return {
    id: crypto.randomUUID(), wedding_id: '', name: '', date: null, start_time: null, location: '', dress: '', invited_tier: 'all',
    note: '', sort_order: 99, is_primary: false, created_at: '', updated_at: '', created_by: null, updated_by: null,
  };
}

function Events() {
  const { put } = useStore();
  const { events, primary } = usePlan();
  const ed = useEditor<WeddingEvent>('events', blankEvent);

  async function save() {
    if (!ed.draft) return;
    // exactly one primary: clear the old one first (a unique index enforces it)
    if (ed.draft.is_primary && primary && primary.id !== ed.draft.id) {
      try {
        await put('events', { ...primary, is_primary: false });
      } catch {
        return;
      }
    }
    await ed.save(ed.isNew ? { sort_order: events.length + 1 } : undefined);
  }

  return (
    <Panel className="mt-5">
      <PanelHead
        title="The weekend"
        sub="Events drive the RSVP columns, the run of show and the headcount. The primary event is the ceremony."
        actions={<CanButton perm="settings:write" size="sm" onClick={() => ed.open()}><IconPlus size={14} /> Add event</CanButton>}
      />
      {events.length === 0 ? (
        <Empty title="No events yet" body="Add the ceremony first, then anything around it." action={<CanButton perm="settings:write" variant="primary" onClick={() => ed.open()}>Add an event</CanButton>} />
      ) : (
        <TWrap>
          <thead><tr><TH>Event</TH><TH>When</TH><TH>Where</TH><TH>Dress</TH><TH>Invited</TH></tr></thead>
          <tbody>
            {events.map((e) => (
              <TR key={e.id} commentKey={e.id} onClick={() => ed.open(e)}>
                <TD><span className="font-medium">{e.name}</span> {e.is_primary && <Pill tone="warn">primary</Pill>}</TD>
                <TD>{fmtDate(e.date, { weekday: true })} {fmtTime(e.start_time)}</TD>
                <TD>{e.location}</TD>
                <TD>{e.dress}</TD>
                <TD>{e.invited_tier === 'A' ? 'A-list only' : 'Everyone'}</TD>
              </TR>
            ))}
          </tbody>
        </TWrap>
      )}
      <Modal open={!!ed.draft} title={ed.isNew ? 'Add event' : 'Edit event'} onClose={ed.close} footer={<EditorFooter ed={ed} coll="events" onSave={save} />}>
        {ed.draft && (
          <fieldset disabled={ed.readOnly} className="space-y-3">
            <Field label="Name"><Input value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
            <Grid cols={3}>
              <Field label="Date"><Input type="date" value={ed.draft.date ?? ''} onChange={(e) => ed.set('date', e.target.value || null)} /></Field>
              <Field label="Start"><Input type="time" value={fmtTime(ed.draft.start_time)} onChange={(e) => ed.set('start_time', e.target.value || null)} /></Field>
              <Field label="Order"><NumberInput value={ed.draft.sort_order} onChange={(v) => ed.set('sort_order', v ?? 0)} /></Field>
            </Grid>
            <Grid>
              <Field label="Location"><Input value={ed.draft.location} onChange={(e) => ed.set('location', e.target.value)} /></Field>
              <Field label="Dress code"><Input value={ed.draft.dress} onChange={(e) => ed.set('dress', e.target.value)} /></Field>
            </Grid>
            <Field label="Who is invited">
              <Select value={ed.draft.invited_tier} onChange={(e) => ed.set('invited_tier', e.target.value as WeddingEvent['invited_tier'])}>
                <option value="all">Everyone (A and B lists)</option>
                <option value="A">A-list only</option>
              </Select>
            </Field>
            <Field label="Note"><Area value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} /></Field>
            <Check checked={ed.draft.is_primary} onChange={(v) => ed.set('is_primary', v)} label="This is the primary event (the ceremony)" hint="RSVPs for this event set the planning headcount." />
          </fieldset>
        )}
      </Modal>
    </Panel>
  );
}
