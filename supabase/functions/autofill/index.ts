// Email autofill, layer 3 (main spec §9.2): ask the model for a summary and a follow-up
// deadline as strict JSON where every field carries a verbatim quote, then verify every
// quote against the source HERE, server-side, and drop anything that doesn't match.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.129.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { callerPermissions } from '../_shared/supabase.ts';
import { isIsoDate, verifyEvidence } from '../_shared/evidence.ts';

const MODEL = 'claude-opus-5-5';
const MAX_BODY = 20_000;

const field = {
  anyOf: [
    {
      type: 'object',
      properties: { value: { type: 'string' }, evidence: { type: 'string' } },
      required: ['value', 'evidence'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
};

const SCHEMA = {
  type: 'object',
  properties: { summary: field, follow_up_by: field },
  required: ['summary', 'follow_up_by'],
  additionalProperties: false,
};

const PROMPT = (subject: string, body: string, today: string) => `Read this email between a wedding couple and a vendor. Fill two fields — only with what the email states outright.

- summary: one or two plain sentences saying what was said or agreed (prices, dates, decisions, requests). evidence: copy the single most important sentence from the email EXACTLY, character for character.
- follow_up_by: a date (YYYY-MM-DD) by which someone must reply or act, ONLY if the email names a specific deadline. evidence: copy the exact words that state that deadline. Today is ${today}; use it only to pick the year when the email gives a day and month without one.

Return null for a field if the email doesn't state it clearly. Never infer, never guess, never combine separate sentences into one quote.

Subject: ${subject}

<email>
${body}
</email>`;

type Out = { summary: { value: string; evidence: string } | null; follow_up_by: { value: string; evidence: string } | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  let input: { wedding_id?: string; subject?: string; body?: string };
  try {
    input = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON' }, 400);
  }
  const w = input.wedding_id ?? '';
  const body = String(input.body ?? '').slice(0, MAX_BODY);
  const subject = String(input.subject ?? '').slice(0, 500);
  if (!w || !body.trim()) return json(req, { error: 'wedding_id and body are required' }, 400);

  const caller = await callerPermissions(req, w);
  if (!caller) return json(req, { error: 'Not signed in' }, 401);
  if (!caller.perms.has('comms:write')) return json(req, { error: 'You can’t edit the vendor log.' }, 403);
  const { data: allowed } = await caller.db.rpc('assistant_take_token', { w, p_kind: 'autofill' });
  if (!allowed) return json(req, { error: 'Autofill limit reached for this hour.' }, 429);

  const apiKey = Deno.env.get('MODEL_API_KEY');
  if (!apiKey) return json(req, { error: 'not configured' }, 503);
  const client = new Anthropic({ apiKey });

  let parsed: Out;
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: PROMPT(subject, body, new Date().toISOString().slice(0, 10)) }],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal') return json(req, { fields: {}, dropped: ['Summary and follow-up — the model declined to read this email.'] });
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '{}';
    parsed = JSON.parse(text);
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : 500;
    return json(req, { error: e instanceof Anthropic.APIError ? `model error ${e.status}` : 'could not read the model output' }, status === 429 ? 429 : 502);
  }

  // the verification step: nothing reaches the user unless its quote is in the file
  const source = `${subject}\n${body}`;
  const fields: Partial<Out> = {};
  const dropped: string[] = [];
  if (parsed.summary) {
    const v = verifyEvidence(source, parsed.summary.evidence);
    if (v.ok && parsed.summary.value.trim()) fields.summary = { value: parsed.summary.value.trim().slice(0, 1000), evidence: parsed.summary.evidence.trim() };
    else dropped.push(`What was said — dropped: ${v.reason ?? 'empty'}.`);
  } else dropped.push('What was said — the model found nothing it could state with certainty.');
  if (parsed.follow_up_by) {
    const v = verifyEvidence(source, parsed.follow_up_by.evidence);
    if (!v.ok) dropped.push(`Follow-up date — dropped: ${v.reason}.`);
    else if (!isIsoDate(parsed.follow_up_by.value)) dropped.push('Follow-up date — dropped: not a valid date.');
    else fields.follow_up_by = { value: parsed.follow_up_by.value, evidence: parsed.follow_up_by.evidence.trim() };
  } else dropped.push('Follow-up date — the email doesn’t state a deadline.');

  return json(req, { fields, dropped });
});
