// The hub assistant (main spec §9.1). Verifies the caller, checks assistant:use, reads the
// wedding AS the caller (RLS applies — a collaborator's assistant cannot see the budget),
// streams its answer as server-sent events, and only ever STAGES changes: the browser
// applies them through the normal write path, where RLS checks them again.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.129.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { callerPermissions } from '../_shared/supabase.ts';

const MODEL = 'claude-opus-5-5';
const MAX_TURNS = 8;
const MAX_ROWS = 120;

// collection → the permission that reads it (mirrors app.table_perms)
const READ_PERM: Record<string, string> = {
  venues: 'venues:read', tasks: 'tasks:read', budget_categories: 'finance:read', budget_lines: 'finance:read',
  payments: 'finance:read', vendors: 'vendors:read', vendor_finance: 'finance:read', guests: 'guests:read',
  guest_contacts: 'guests:contact', rsvps: 'guests:read', events: 'settings:read', rooms: 'travel:read',
  legal_docs: 'legal:read', decisions: 'decisions:read', seat_tables: 'seating:read', schedule_items: 'schedule:read',
  comms_rows: 'comms:read', templates: 'comms:read', correspondence: 'comms:read', faqs: 'comms:read',
};
const AUDIT = new Set(['wedding_id', 'created_at', 'updated_at', 'created_by', 'updated_by']);

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function strip(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (AUDIT.has(k) || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}…` : v;
  }
  return out;
}

async function overview(db: SupabaseClient, w: string, perms: Set<string>): Promise<string> {
  const { data: s } = await db.from('wedding_settings').select('*').eq('wedding_id', w).single();
  const count = async (t: string) => {
    if (!perms.has(READ_PERM[t])) return null;
    const { count: n } = await db.from(t).select('id', { count: 'exact', head: true }).eq('wedding_id', w);
    return n ?? 0;
  };
  const lines = [
    `Couple: ${s?.couple_a} & ${s?.couple_b}`,
    `Wedding date: ${s?.target_date}${s?.date_is_firm ? '' : ' (working date, not final)'}`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Planning headcount target: ${s?.guest_target}`,
    `Candidate countries: ${(s?.candidate_countries ?? []).join(', ')}`,
  ];
  // financial lines only for callers who may see money
  if (perms.has('finance:read')) {
    const { data: b } = await db.from('budget_settings').select('budget_ceiling_usd').eq('wedding_id', w).maybeSingle();
    lines.push(`Budget ceiling: $${b?.budget_ceiling_usd} USD; 1 EUR = ${s?.fx_eur_usd} USD (set ${s?.fx_set_on})`);
    const { data: bl } = await db.from('budget_lines').select('estimate_eur,quoted_eur,contracted_eur,currency,per_guest').eq('wedding_id', w);
    const fx = Number(s?.fx_eur_usd) || 1;
    const planned = (bl ?? []).reduce((sum, l) => {
      const v = Number(l.contracted_eur || l.quoted_eur || l.estimate_eur || 0) * (l.per_guest ? Number(s?.guest_target) || 1 : 1);
      return sum + (l.currency === 'USD' ? v / fx : v);
    }, 0);
    lines.push(`Planned spend (approx., at the target headcount): €${Math.round(planned)}`);
  }
  const counts: string[] = [];
  for (const t of Object.keys(READ_PERM)) {
    const n = await count(t);
    if (n !== null) counts.push(`${t}: ${n}`);
  }
  lines.push(`Rows: ${counts.join(', ')}`);
  const { data: tasks } = perms.has('tasks:read')
    ? await db.from('tasks').select('status').eq('wedding_id', w)
    : { data: null };
  if (tasks) lines.push(`Tasks: ${tasks.filter((t) => t.status === 'done' || t.status === 'na').length} of ${tasks.length} done`);
  return lines.join('\n');
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_collection',
    description:
      'Read rows from one collection of this wedding\'s plan. Returns at most 120 rows with empty fields removed and long text truncated. Collections the user may not see return an error — tell the user it isn\'t available to them rather than guessing.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string', enum: Object.keys(READ_PERM) },
        contains: { type: 'string', description: 'Optional case-insensitive text filter applied across all fields.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_ROWS },
      },
      required: ['collection'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_settings',
    description: 'Read the wedding settings: names, date, whether the date is firm, FX rate, headcount target, RSVP-by date, website.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_change',
    description:
      'Stage an insert, update or delete for the user to review. Nothing is written until they press Apply. For update/delete give the row id (from read_collection). For update, give only the fields that change. Use the exact column names you saw in read_collection.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string', enum: Object.keys(READ_PERM) },
        action: { type: 'string', enum: ['insert', 'update', 'delete'] },
        id: { type: 'string', description: 'Row id; required for update and delete.' },
        fields: { type: 'object', description: 'Column → new value.', additionalProperties: true },
        reason: { type: 'string', description: 'One sentence the user will read: why this change.' },
      },
      required: ['collection', 'action', 'reason'],
      additionalProperties: false,
    },
  },
];

const SYSTEM = `You are the planning assistant inside a shared wedding-planning hub used by a couple and their team.
Answer questions about their plan using the tools; read before you answer, and never invent rows, figures or dates.
Money is in euros unless a row says otherwise; the budget ceiling is in US dollars.
When the user asks you to change something, call propose_change once per row. Changes are staged for the user to review — say so briefly; never claim you have saved anything.
If a collection isn't available to this user, say so plainly; don't speculate about its contents.
Be concise and practical. Benchmarks you mention are planning estimates, not quotes or legal advice.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  let body: { wedding_id?: string; messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON' }, 400);
  }
  const w = body.wedding_id ?? '';
  const history = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-20);
  if (!w || !history.length || history[history.length - 1].role !== 'user') return json(req, { error: 'wedding_id and a user message are required' }, 400);

  const caller = await callerPermissions(req, w);
  if (!caller) return json(req, { error: 'Not signed in' }, 401);
  if (!caller.perms.has('assistant:use')) return json(req, { error: 'Your role on this wedding doesn’t include the assistant.' }, 403);
  const { data: allowed } = await caller.db.rpc('assistant_take_token', { w, p_kind: 'assistant' });
  if (!allowed) return json(req, { error: 'You’ve reached the assistant’s hourly limit. Try again later.' }, 429);

  const apiKey = Deno.env.get('MODEL_API_KEY');
  if (!apiKey) return json(req, { error: 'The assistant isn’t configured (MODEL_API_KEY is not set).' }, 503);
  const client = new Anthropic({ apiKey });
  const { db, perms } = caller;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: Record<string, unknown>) => controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      let aborted = false;
      req.signal.addEventListener('abort', () => (aborted = true));

      async function runTool(name: string, input: Record<string, unknown>): Promise<{ content: string; is_error?: boolean }> {
        if (name === 'get_settings') {
          const { data } = await db.from('wedding_settings').select('*').eq('wedding_id', w).single();
          return { content: JSON.stringify(strip(data ?? {})) };
        }
        const coll = String(input.collection ?? '');
        if (!READ_PERM[coll]) return { content: `Unknown collection ${coll}`, is_error: true };
        // filtered by the caller's permissions server-side — and RLS would return nothing anyway
        if (!perms.has(READ_PERM[coll])) return { content: `${coll} isn't available to this user's role.`, is_error: true };
        if (name === 'read_collection') {
          send({ type: 'activity', text: `Reading ${coll.replace(/_/g, ' ')}${input.contains ? ` matching “${input.contains}”` : ''}` });
          const { data, error } = await db.from(coll).select('*').eq('wedding_id', w).limit(1000);
          if (error) return { content: error.message, is_error: true };
          const needle = String(input.contains ?? '').toLowerCase();
          const rows = (data ?? []).filter((r) => !needle || JSON.stringify(r).toLowerCase().includes(needle));
          const limit = Math.min(Number(input.limit) || MAX_ROWS, MAX_ROWS);
          return { content: JSON.stringify({ total: rows.length, rows: rows.slice(0, limit).map(strip) }) };
        }
        if (name === 'propose_change') {
          const action = String(input.action);
          if ((action === 'update' || action === 'delete') && !input.id) return { content: 'id is required for update and delete', is_error: true };
          let before: Record<string, unknown> | null = null;
          if (input.id) {
            const { data } = await db.from(coll).select('*').eq('wedding_id', w).eq('id', String(input.id)).maybeSingle();
            if (!data) return { content: `No ${coll} row with id ${input.id}`, is_error: true };
            before = strip(data);
          }
          const fields = (input.fields && typeof input.fields === 'object' ? input.fields : {}) as Record<string, unknown>;
          for (const k of Object.keys(fields)) if (AUDIT.has(k) || k === 'id') delete fields[k];
          const proposal = { id: crypto.randomUUID(), collection: coll, action, rowId: input.id ?? null, fields, before, reason: String(input.reason ?? '') };
          send({ type: 'proposal', proposal });
          return { content: 'Staged for the user to review. Not saved yet.' };
        }
        return { content: `Unknown tool ${name}`, is_error: true };
      }

      try {
        const context = await overview(db, w, perms);
        const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
        messages[messages.length - 1] = {
          role: 'user',
          content: `<plan_overview>\n${context}\n</plan_overview>\n\n${history[history.length - 1].content}`,
        };

        for (let turn = 0; turn < MAX_TURNS && !aborted; turn++) {
          const s = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 16000,
              output_config: { effort: 'medium' },
              system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
              tools: TOOLS as Anthropic.Beta.BetaToolUnion[],
              messages,
              // on a policy decline, the API re-runs the request on a fallback model
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
            } as Anthropic.Beta.MessageCreateParamsStreaming,
            { signal: req.signal },
          );
          for await (const event of s) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') send({ type: 'text', text: event.delta.text });
          }
          const msg = await s.finalMessage();
          if (msg.stop_reason === 'refusal') {
            send({ type: 'error', message: 'The assistant declined that request.' });
            break;
          }
          const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
          if (msg.stop_reason !== 'tool_use' || uses.length === 0) break;
          messages.push({ role: 'assistant', content: msg.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const u of uses) {
            const r = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>);
            results.push({ type: 'tool_result', tool_use_id: u.id, content: r.content, is_error: r.is_error });
          }
          messages.push({ role: 'user', content: results });
        }
        send({ type: 'done' });
      } catch (e) {
        if (!aborted) {
          const message =
            e instanceof Anthropic.RateLimitError ? 'The model is busy — try again in a minute.'
            : e instanceof Anthropic.APIError ? `The model returned an error (${e.status}).`
            : (e as Error).message;
          send({ type: 'error', message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders(req), 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
});
