// Daily FX refresh (main spec §9.3), called by pg_cron with the service-role key. Updates
// the EUR→USD rate for every active wedding and marks it automatic.
import { json } from '../_shared/cors.ts';
import { adminClient, isServiceCaller } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (!isServiceCaller(req)) return json(req, { error: 'forbidden' }, 403);
  const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');
  if (!res.ok) return json(req, { error: `rate source returned ${res.status}` }, 502);
  const body = await res.json();
  const rate = Number(body?.rates?.USD);
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2.5) return json(req, { error: 'implausible rate', rate }, 502);

  const db = adminClient();
  const { data: active } = await db.from('weddings').select('id').is('archived_at', null);
  const ids = (active ?? []).map((w) => w.id);
  if (!ids.length) return json(req, { updated: 0, rate });
  const { error, count } = await db
    .from('wedding_settings')
    .update({ fx_eur_usd: Math.round(rate * 10000) / 10000, fx_set_on: body.date ?? new Date().toISOString().slice(0, 10), fx_source: 'auto' }, { count: 'exact' })
    .in('wedding_id', ids);
  if (error) return json(req, { error: error.message }, 500);
  return json(req, { updated: count, rate });
});
