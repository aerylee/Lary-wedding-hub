// The no-guessing guarantee for email autofill (main spec §9.2, layer 3): every value the
// model proposes must come with a quote, and the quote must appear verbatim in the source.
// Runs server-side, after the model returns, so it can't be bypassed from the browser.

export const MIN_WORDS = 5;
export const MIN_CHARS = 20;

const norm = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Whitespace- and case-insensitive verbatim match, with a minimum quote length. */
export function verifyEvidence(source: string, quote: string | null | undefined): { ok: boolean; reason?: string } {
  if (!quote) return { ok: false, reason: 'no quote given' };
  const q = norm(quote);
  if (q.length < MIN_CHARS || q.split(' ').length < MIN_WORDS) return { ok: false, reason: 'quote too short to trust' };
  if (!norm(source).includes(q)) return { ok: false, reason: 'quote is not in the file' };
  return { ok: true };
}

/** A follow-up date must be a real calendar date. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
