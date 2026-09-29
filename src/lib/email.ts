// Deterministic .eml parsing (main spec §9.2, layer 1) and address matching (layer 2).
// No model involved: yields exactly what the file says, or blank.

export type ParsedEmail = {
  date: string;            // YYYY-MM-DD, or '' if absent/unparseable
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  fromAddr: string;        // lower-cased bare address
  toAddrs: string[];
  body: string;            // plain text
};

export const AUTOFILL_EXTENSIONS = ['.eml', '.txt', '.md', '.html', '.htm', '.json', '.csv'];
export const AUTOFILL_MAX_BYTES = 512 * 1024;

export function canAutofill(file: { name: string; size: number }): { ok: boolean; reason?: string } {
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  if (ext === '.pdf') return { ok: false, reason: 'PDF text extraction isn’t supported — autofill reads text files only (.eml, .txt, .html…).' };
  if (!AUTOFILL_EXTENSIONS.includes(ext)) return { ok: false, reason: `Autofill reads ${AUTOFILL_EXTENSIONS.join(', ')} files only.` };
  if (file.size > AUTOFILL_MAX_BYTES) return { ok: false, reason: 'That file is too large to read for autofill (512 KB max).' };
  return { ok: true };
}

// ─── decoding ────────────────────────────────────────────────────────────────

function bytesToString(bytes: Uint8Array, charset = 'utf-8'): string {
  try {
    return new TextDecoder(charset.toLowerCase(), { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Quoted-printable → bytes (soft line breaks removed). */
function qpToBytes(s: string, header = false): Uint8Array {
  const src = (header ? s.replace(/_/g, ' ') : s).replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) {
      out.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const code = src.charCodeAt(i);
      if (code < 128) out.push(code);
      else out.push(...new TextEncoder().encode(ch));
    }
  }
  return new Uint8Array(out);
}

export function decodeQuotedPrintable(s: string, charset = 'utf-8'): string {
  return bytesToString(qpToBytes(s), charset);
}

/** RFC 2047 encoded words: =?charset?Q|B?text?= (adjacent words join without the space). */
export function decodeEncodedWords(s: string): string {
  return s
    .replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, '$1')
    .replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, charset: string, enc: string, text: string) => {
      try {
        const bytes = enc.toUpperCase() === 'B' ? base64ToBytes(text) : qpToBytes(text, true);
        return bytesToString(bytes, charset.replace(/\*.*$/, ''));
      } catch {
        return text;
      }
    });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── structure ───────────────────────────────────────────────────────────────

type Part = { headers: Map<string, string>; body: string };

function splitHeaders(raw: string): Part {
  const text = raw.replace(/\r\n/g, '\n');
  const idx = text.search(/\n\n/);
  const head = idx === -1 ? text : text.slice(0, idx);
  const body = idx === -1 ? '' : text.slice(idx + 2);
  // unfold continuation lines (RFC 5322 §2.2.3)
  const unfolded = head.replace(/\n[ \t]+/g, ' ');
  const headers = new Map<string, string>();
  for (const line of unfolded.split('\n')) {
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (!headers.has(k)) headers.set(k, m[2]);
  }
  return { headers, body };
}

function param(header: string | undefined, name: string): string {
  if (!header) return '';
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i').exec(header);
  return m ? (m[2] ?? m[1]) : '';
}

function decodeBody(part: Part): string {
  const cte = (part.headers.get('content-transfer-encoding') ?? '').toLowerCase().trim();
  const ctype = part.headers.get('content-type') ?? 'text/plain';
  const charset = param(ctype, 'charset') || 'utf-8';
  let text: string;
  if (cte === 'base64') {
    try {
      text = bytesToString(base64ToBytes(part.body), charset);
    } catch {
      text = part.body;
    }
  } else if (cte === 'quoted-printable') text = decodeQuotedPrintable(part.body, charset);
  else text = part.body;
  return /text\/html/i.test(ctype) ? stripHtml(text) : text;
}

/** Depth-first: the first text/plain part wins, then the first text/html. */
function findText(part: Part, depth = 0): { plain?: string; html?: string } {
  const ctype = part.headers.get('content-type') ?? 'text/plain';
  if (/^multipart\//i.test(ctype) && depth < 6) {
    const boundary = param(ctype, 'boundary');
    if (!boundary) return { plain: part.body };
    const found: { plain?: string; html?: string } = {};
    const chunks = part.body.split(`--${boundary}`).slice(1);
    for (const chunk of chunks) {
      if (chunk.startsWith('--')) break;
      const sub = splitHeaders(chunk.replace(/^\r?\n/, ''));
      if (/attachment/i.test(sub.headers.get('content-disposition') ?? '')) continue;
      const r = findText(sub, depth + 1);
      found.plain ??= r.plain;
      found.html ??= r.html;
      if (found.plain) break;
    }
    return found;
  }
  if (/text\/html/i.test(ctype)) return { html: decodeBody(part) };
  if (/text\//i.test(ctype) || !part.headers.has('content-type')) return { plain: decodeBody(part) };
  return {};
}

export function extractAddresses(header: string): string[] {
  const out: string[] = [];
  const re = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header))) out.push(m[0].toLowerCase());
  return Array.from(new Set(out));
}

function isoDate(dateHeader: string): string {
  if (!dateHeader) return '';
  const d = new Date(dateHeader.replace(/\s*\([^)]*\)\s*$/, ''));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse an .eml (or any text file — non-email text yields just a body). */
export function parseEmail(raw: string): ParsedEmail {
  const top = splitHeaders(raw);
  const looksLikeEmail = top.headers.has('from') || top.headers.has('subject') || top.headers.has('date');
  if (!looksLikeEmail) {
    const body = /<html|<body|<div|<p[\s>]/i.test(raw) ? stripHtml(raw) : raw.trim();
    return { date: '', subject: '', from: '', to: [], cc: [], fromAddr: '', toAddrs: [], body };
  }
  const h = (k: string) => decodeEncodedWords(top.headers.get(k) ?? '').trim();
  const text = findText(top);
  const from = h('from');
  const to = h('to');
  const cc = h('cc');
  return {
    date: isoDate(top.headers.get('date') ?? ''),
    subject: h('subject'),
    from,
    to: to ? to.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean) : [],
    cc: cc ? cc.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean) : [],
    fromAddr: extractAddresses(from)[0] ?? '',
    toAddrs: [...extractAddresses(to), ...extractAddresses(cc)],
    body: (text.plain ?? text.html ?? '').replace(/\r\n/g, '\n').trim(),
  };
}

// ─── address matching ────────────────────────────────────────────────────────

export type VendorMatch = { vendorId: string; vendorName: string; direction: 'sent' | 'received'; address: string };

/**
 * Decide vendor and direction by exact address only. Sender matches → received; a
 * recipient matches → sent. No fuzzy name matching; no match → null, change nothing.
 */
export function matchVendor(email: ParsedEmail, vendors: { id: string; name: string; email: string }[]): VendorMatch | null {
  const index = new Map<string, { id: string; name: string }>();
  for (const v of vendors) for (const a of extractAddresses(v.email ?? '')) index.set(a, v);
  const sender = email.fromAddr && index.get(email.fromAddr);
  if (sender) return { vendorId: sender.id, vendorName: sender.name, direction: 'received', address: email.fromAddr };
  for (const a of email.toAddrs) {
    const v = index.get(a);
    if (v) return { vendorId: v.id, vendorName: v.name, direction: 'sent', address: a };
  }
  return null;
}
