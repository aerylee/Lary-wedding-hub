// Postgres cascades don't reach Storage. Deleted attachment rows queue their object paths;
// this job (hourly, via pg_cron) removes the objects.
import { json } from '../_shared/cors.ts';
import { adminClient, isServiceCaller } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (!isServiceCaller(req)) return json(req, { error: 'forbidden' }, 403);
  const db = adminClient();
  let removed = 0;
  for (let i = 0; i < 10; i++) {
    const { data: paths, error } = await db.rpc('claim_storage_purge', { p_limit: 200 });
    if (error) return json(req, { error: error.message, removed }, 500);
    const list = (paths as string[] | null) ?? [];
    if (!list.length) break;
    const { error: rmErr } = await db.storage.from('attachments').remove(list);
    if (rmErr) return json(req, { error: rmErr.message, removed }, 500);
    removed += list.length;
  }
  return json(req, { removed });
});
