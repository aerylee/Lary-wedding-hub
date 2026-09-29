// Email an invitation: a magic link that lands on /join?token=…. The caller must be able
// to see the invitation, which RLS only allows with members:manage.
import { corsHeaders, json } from '../_shared/cors.ts';
import { anonClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  let body: { invitation_id?: string; origin?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON' }, 400);
  }
  const db = userClient(req);
  const { data: inv } = await db.from('invitations').select('id, email, token, expires_at, accepted_at').eq('id', body.invitation_id ?? '').maybeSingle();
  if (!inv) return json(req, { error: 'Invitation not found' }, 404);
  if (inv.accepted_at || new Date(inv.expires_at) < new Date()) return json(req, { error: 'Invitation is no longer pending' }, 409);

  // never trust the browser for where the link points
  const site = Deno.env.get('SITE_URL') ?? '';
  const origin = site || (body.origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(body.origin) ? body.origin : '');
  if (!origin) return json(req, { error: 'SITE_URL is not configured' }, 503);

  const { error } = await anonClient().auth.signInWithOtp({
    email: inv.email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/join?token=${inv.token}` },
  });
  if (error) return json(req, { error: error.message }, 502);
  return json(req, { sent: true });
});
