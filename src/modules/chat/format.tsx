// Message formatting: a small, predictable Markdown subset.
//
//   **bold**  _italic_  ~strike~  `code`  ```code block```  > quote  - list  1. list
//
// Plus links, @mentions, and links to other hub pages shown as a chip ("Budget ·
// comment"). Everything renders as React text, never HTML, so nothing typed can inject
// markup.
import type { ReactNode } from 'react';
import { cls } from '@/lib/util';
import { TAB_BY_KEY } from '@/modules/registry';
import type { Person } from '@/components/MentionInput';

export type Block =
  | { type: 'p'; lines: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[]; start: number }
  | { type: 'code'; text: string };

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

export function parseBlocks(body: string): Block[] {
  const out: Block[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const last = () => out[out.length - 1];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const buf: string[] = [];
      const first = line.trimStart().slice(3);
      if (first.includes('```')) {
        out.push({ type: 'code', text: first.slice(0, first.indexOf('```')) });
        continue;
      }
      if (first) buf.push(first);
      for (i++; i < lines.length && !lines[i].trimEnd().endsWith('```'); i++) buf.push(lines[i]);
      if (i < lines.length) {
        const end = lines[i].trimEnd();
        const rest = end.slice(0, -3);
        if (rest) buf.push(rest);
      }
      out.push({ type: 'code', text: buf.join('\n') });
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = QUOTE.exec(line))) {
      const b = last();
      if (b?.type === 'quote') b.lines.push(m[1]);
      else out.push({ type: 'quote', lines: [m[1]] });
    } else if ((m = UL.exec(line))) {
      const b = last();
      if (b?.type === 'ul') b.items.push(m[1]);
      else out.push({ type: 'ul', items: [m[1]] });
    } else if ((m = OL.exec(line))) {
      const b = last();
      if (b?.type === 'ol') b.items.push(m[2]);
      else out.push({ type: 'ol', items: [m[2]], start: Number(m[1]) });
    } else {
      const b = last();
      if (b?.type === 'p') b.lines.push(line);
      else out.push({ type: 'p', lines: [line] });
    }
  }
  // trim blank paragraph lines at the edges
  return out
    .map((b) => (b.type === 'p' ? { ...b, lines: trimBlank(b.lines) } : b))
    .filter((b) => b.type !== 'p' || b.lines.length > 0);
}

function trimBlank(lines: string[]) {
  let a = 0;
  let z = lines.length;
  while (a < z && !lines[a].trim()) a++;
  while (z > a && !lines[z - 1].trim()) z--;
  return lines.slice(a, z);
}

/** The text without formatting marks, for previews, search and notifications. */
export function plainText(body: string): string {
  return body
    .replace(/```/g, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1$2')
    .replace(/~([^~\n]+?)~/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '• ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type HubLink = { page: string; label: string; kind: 'page' | 'comment' | 'message' };

/** A link to another page of this hub, recognised so it can show as a chip. */
export function hubLink(href: string, origin: string): HubLink | null {
  let u: URL;
  try {
    u = new URL(href, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  const m = /^\/w\/[^/]+\/([a-z][a-z-]*)\/?$/.exec(u.pathname);
  if (!m) return null;
  const page = m[1];
  const label = page === 'chat' ? 'Team chat' : page === 'account' ? 'Account & team' : TAB_BY_KEY.get(page)?.label;
  if (!label) return null;
  const kind = u.searchParams.get('comment') ? 'comment' : u.searchParams.get('message') ? 'message' : 'page';
  return { page, label, kind };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Ctx = { names: Person[]; meId?: string; origin: string; onHubLink?: (href: string) => void };

function inline(text: string, ctx: Ctx, key = 'i'): ReactNode[] {
  const mention = ctx.names.map((p) => `@${escapeRe(p.name)}(?![\\w])`).join('|');
  const pattern = new RegExp(
    [
      '`(?<code>[^`\\n]+)`',
      '\\*\\*(?<bold>[^*\\n]+?)\\*\\*',
      '(?<![\\w])_(?<italic>[^_\\n]+?)_(?![\\w])',
      '~(?<strike>[^~\\n]+?)~',
      '(?<url>https?://[^\\s<]+[^\\s<.,;:!?)\\]])',
      ...(mention ? [`(?<mention>${mention})`] : []),
    ].join('|'),
    'gi',
  );
  const parts: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const g = m.groups ?? {};
    const k = `${key}.${n++}`;
    if (g.code !== undefined) {
      parts.push(<code key={k} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-700 dark:bg-stone-800 dark:text-rose-300">{g.code}</code>);
    } else if (g.bold !== undefined) {
      parts.push(<strong key={k} className="font-semibold">{inline(g.bold, ctx, k)}</strong>);
    } else if (g.italic !== undefined) {
      parts.push(<em key={k}>{inline(g.italic, ctx, k)}</em>);
    } else if (g.strike !== undefined) {
      parts.push(<s key={k}>{inline(g.strike, ctx, k)}</s>);
    } else if (g.url !== undefined) {
      const hub = hubLink(g.url, ctx.origin);
      parts.push(
        hub ? (
          <a
            key={k}
            href={g.url}
            onClick={(e) => {
              if (!ctx.onHubLink || e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              ctx.onHubLink(g.url!);
            }}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 align-baseline text-xs font-medium text-amber-900 no-underline hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
          >
            ↗ {hub.label}{hub.kind !== 'page' && <span className="font-normal opacity-70">· {hub.kind}</span>}
          </a>
        ) : (
          <a key={k} href={g.url} target="_blank" rel="noreferrer noopener" className="break-all text-amber-800 underline dark:text-amber-400">{g.url}</a>
        ),
      );
    } else if (g.mention !== undefined) {
      const p = ctx.names.find((x) => `@${x.name}`.toLowerCase() === g.mention!.toLowerCase());
      parts.push(
        <span
          key={k}
          title={p?.email}
          className={cls(
            'rounded px-0.5 font-medium',
            p?.id === ctx.meId ? 'bg-amber-200 text-amber-950 dark:bg-amber-700/60 dark:text-amber-50' : 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
          )}
        >
          {g.mention}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function lines(ls: string[], ctx: Ctx, key: string): ReactNode[] {
  return ls.flatMap((l, i) => (i ? [<br key={`${key}.br${i}`} />, ...inline(l, ctx, `${key}.${i}`)] : inline(l, ctx, `${key}.${i}`)));
}

/** A formatted message body. */
export function Formatted({ body, mentioned, people, meId, onHubLink, origin }: {
  body: string; mentioned: string[]; people: Person[]; meId?: string; onHubLink?: (href: string) => void; origin?: string;
}) {
  const ctx: Ctx = {
    names: people.filter((p) => mentioned.includes(p.id)).sort((a, b) => b.name.length - a.name.length),
    meId,
    onHubLink,
    origin: origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'),
  };
  return (
    <div className="space-y-1 break-words [overflow-wrap:anywhere]">
      {parseBlocks(body).map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case 'code':
            return <pre key={k} className="overflow-x-auto rounded-md bg-stone-100 px-3 py-2 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-100">{b.text}</pre>;
          case 'quote':
            return <blockquote key={k} className="border-l-4 border-stone-300 pl-3 text-stone-600 dark:border-stone-600 dark:text-stone-300">{lines(b.lines, ctx, k)}</blockquote>;
          case 'ul':
            return <ul key={k} className="ml-5 list-disc space-y-0.5">{b.items.map((it, j) => <li key={j}>{inline(it, ctx, `${k}.${j}`)}</li>)}</ul>;
          case 'ol':
            return <ol key={k} start={b.start} className="ml-5 list-decimal space-y-0.5">{b.items.map((it, j) => <li key={j}>{inline(it, ctx, `${k}.${j}`)}</li>)}</ol>;
          default:
            return <p key={k}>{lines(b.lines, ctx, k)}</p>;
        }
      })}
    </div>
  );
}

/** Wrap the textarea's selection in markers (or insert them around the cursor). */
export function wrapSelection(el: HTMLTextAreaElement, before: string, after = before): string {
  const { selectionStart: a, selectionEnd: z, value } = el;
  const picked = value.slice(a, z);
  const next = value.slice(0, a) + before + picked + after + value.slice(z);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(a + before.length, a + before.length + picked.length);
  });
  return next;
}

/** Prefix each selected line (for lists and quotes). */
export function prefixLines(el: HTMLTextAreaElement, prefix: (i: number) => string): string {
  const { selectionStart: a, selectionEnd: z, value } = el;
  const start = value.lastIndexOf('\n', a - 1) + 1;
  const block = value.slice(start, z) || '';
  const done = block.split('\n').map((l, i) => prefix(i) + l).join('\n');
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + done.length, start + done.length);
  });
  return value.slice(0, start) + done + value.slice(z);
}
