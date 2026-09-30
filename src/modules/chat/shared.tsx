// Small pieces the chat screens share: storage helpers, the portal menu, emoji,
// reaction grouping and who can be tagged.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { usePeople } from '@/lib/collab';
import type { ChatReaction } from '@/lib/types';
import { cls } from '@/lib/util';
import { IconButton } from '@/components/kit';
import { IconMore } from '@/components/icons';
import type { Person } from '@/components/MentionInput';

export const keys = {
  last: (w: string) => `hub:chat:last:${w}`,
  folded: (w: string) => `hub:chat:folded:${w}`,
  draft: (w: string, where: string) => `hub:chat:draft:${w}:${where}`,
};

export const local = {
  get(k: string) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch { /* only a convenience */ }
  },
};

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** People who can read the chat, minus you: the ones worth @-mentioning. */
export function useChatPeople(): Person[] {
  const { roles } = useStore();
  const { session } = useAuth();
  const people = usePeople();
  return people.list.filter((p) => p.id !== session?.user.id && roles.matrix[p.role].has('chat:read'));
}

// ─── emoji ───────────────────────────────────────────────────────────────────
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '✅', '👀'];
export const EMOJI = [
  '👍', '❤️', '😂', '🎉', '✅', '👀', '🙏', '👏', '🙌', '😍', '🥹', '😮',
  '😢', '🔥', '💯', '✨', '🥂', '🍾', '💍', '💐', '🌸', '💒', '💃', '🕺',
  '🎂', '📸', '✈️', '🏡', '📅', '💶', '⏰', '❓', '❗', '🤔', '👌', '🤞',
];

export type ReactionGroup = { emoji: string; count: number; mine: boolean; who: string[] };

/** Reactions on one message, grouped by emoji in the order they were first used. */
export function groupReactions(rows: ChatReaction[], me: string, name: (id: string) => string): ReactionGroup[] {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out = new Map<string, ReactionGroup>();
  for (const r of sorted) {
    const g = out.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, who: [] };
    g.count++;
    g.mine ||= r.user_id === me;
    g.who.push(r.user_id === me ? 'You' : name(r.user_id));
    out.set(r.emoji, g);
  }
  return [...out.values()];
}

export function EmojiGrid({ onPick, label = 'Pick an emoji' }: { onPick: (e: string) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-8 gap-0.5 p-1.5">
      {EMOJI.map((e) => (
        <button key={e} type="button" onClick={() => onPick(e)} className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-stone-100 dark:hover:bg-stone-800" aria-label={e}>
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── a floating menu ─────────────────────────────────────────────────────────
// Rendered in a portal at fixed coordinates: inside a scrolling list it would be
// clipped, and painted under the rows that follow it.
export function Menu({ label, icon, children, width = 208, buttonClass, keepOpen }: {
  label: string; icon?: ReactNode; children: ReactNode; width?: number; buttonClass?: string; keepOpen?: boolean;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const h = menu.current?.offsetHeight ?? 0;
    const below = r.bottom + 4;
    setAt({ left, top: h && below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below });
  };

  useLayoutEffect(() => {
    if (at) place();
    // measure once the menu has a height, then flip above the button if it won't fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!at]);

  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setAt(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAt(null);
    };
    const dismiss = () => setAt(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [at]);

  return (
    <>
      <IconButton
        ref={button}
        label={label}
        className={cls(buttonClass ?? 'h-6 w-6', at && 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100')}
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={(e) => {
          e.stopPropagation();
          if (at) setAt(null);
          else {
            setAt({ top: -9999, left: -9999 });
            requestAnimationFrame(place);
          }
        }}
      >
        {icon ?? <IconMore size={14} />}
      </IconButton>
      {at &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            style={{ top: at.top, left: at.left, width }}
            className="fixed z-[60] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 text-sm text-stone-800 shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            onClick={() => !keepOpen && setAt(null)}
          >
            {keepOpen ? <div onClick={() => setAt(null)}>{children}</div> : children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ children, onClick, icon, disabled, danger }: { children: ReactNode; onClick: () => void; icon?: ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cls(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-stone-800',
        danger && 'text-rose-700 dark:text-rose-400',
      )}
    >
      {icon && <span className="text-stone-400">{icon}</span>}
      {children}
    </button>
  );
}

/** "Paola is typing…", "Paola and Jo are typing…", "Several people are typing…" */
export function typingText(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}
