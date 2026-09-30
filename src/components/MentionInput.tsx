// A textarea that completes @names from the team, and the renderer that shows them.
// A mention is stored twice: as "@Name" in the text people read, and as a user id in
// `mentions`, which is what the database notifies.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cls } from '@/lib/util';

export type Person = { id: string; name: string; email: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  onSubmit?: () => void;
  /** Enter sends and Shift+Enter makes a new line (chat); otherwise Cmd/Ctrl+Enter sends */
  enterSends?: boolean;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export type MentionInputHandle = { focus: () => void };

export const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { value, onChange, people, onSubmit, enterSends, placeholder, rows = 2, autoFocus, disabled, className, ariaLabel },
  ref,
) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus() }));

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().startsWith(q)).slice(0, 6);
  }, [query, people]);

  const detect = (text: string, caret: number) => {
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  };

  const pick = (p: Person) => {
    const el = ta.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${p.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
    }
    if (e.key === 'Enter' && onSubmit) {
      const send = enterSends ? !e.shiftKey : e.metaKey || e.ctrlKey;
      if (send) {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ta}
        rows={rows}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => detect(value, (e.target as HTMLTextAreaElement).selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className={cls(
          'w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100',
          className,
        )}
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="People to mention" className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
                className={cls('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === active && 'bg-amber-50 dark:bg-stone-800')}
              >
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-stone-500">{p.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/** The ids of people still named in the text as @Name. Longest names first, so "@Jo Ann" beats "@Jo". */
export function extractMentions(body: string, people: Person[]): string[] {
  const ids: string[] = [];
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  let text = body;
  for (const p of sorted) {
    const re = new RegExp(`@${escapeRe(p.name)}(?![\\w])`, 'i');
    if (re.test(text)) {
      ids.push(p.id);
      text = text.replace(new RegExp(re.source, 'gi'), ' ');
    }
  }
  return ids;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Message text with @mentions highlighted, links clickable and line breaks kept. */
export function RichText({ body, mentioned, people, meId }: { body: string; mentioned: string[]; people: Person[]; meId?: string }) {
  const names = people.filter((p) => mentioned.includes(p.id)).sort((a, b) => b.name.length - a.name.length);
  const parts: ReactNode[] = [];
  const pattern = new RegExp(
    [...names.map((p) => `@${escapeRe(p.name)}(?![\\w])`), 'https?://[^\\s<]+[^\\s<.,;:!?)\\]]'].join('|'),
    'gi',
  );
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('@')) {
      const p = names.find((n) => `@${n.name}`.toLowerCase() === tok.toLowerCase());
      parts.push(
        <span
          key={i++}
          className={cls(
            'rounded px-0.5 font-medium',
            p?.id === meId ? 'bg-amber-200 text-amber-950 dark:bg-amber-700/60 dark:text-amber-50' : 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
          )}
          title={p?.email}
        >
          {tok}
        </span>,
      );
    } else {
      parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer noopener" className="break-all text-amber-800 underline dark:text-amber-400">{tok}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}

const AVATAR_TONES = [
  'bg-amber-700', 'bg-emerald-700', 'bg-sky-700', 'bg-rose-700', 'bg-violet-700', 'bg-teal-700', 'bg-orange-700', 'bg-indigo-700',
];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cls(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        AVATAR_TONES[h % AVATAR_TONES.length],
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
      )}
    >
      {initials}
    </span>
  );
}
