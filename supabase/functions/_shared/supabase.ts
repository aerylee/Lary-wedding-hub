import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * A client that acts as the caller: every query runs under their JWT, so row-level
 * security decides what they (and the model working for them) can read.
 */
export function userClient(req: Request): SupabaseClient {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Bypasses every policy. Only for jobs with no user behind them (cron). */
export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cron callers present the service-role key; nobody else may run the job. */
export function isServiceCaller(req: Request): boolean {
  return (req.headers.get('Authorization') ?? '') === `Bearer ${SERVICE}`;
}

/** Verify the JWT and load the caller's permissions on a wedding. */
export async function callerPermissions(req: Request, weddingId: string): Promise<{ db: SupabaseClient; userId: string; perms: Set<string> } | null> {
  const db = userClient(req);
  const { data: user } = await db.auth.getUser();
  if (!user?.user) return null;
  const { data } = await db.rpc('my_permissions', { w: weddingId });
  return { db, userId: user.user.id, perms: new Set((data as string[] | null) ?? []) };
}
