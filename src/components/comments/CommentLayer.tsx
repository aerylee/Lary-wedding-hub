// Comment on anything on the screen.
//
// Comment mode turns the page into a canvas: hover outlines what you'd pin to, a click
// opens a composer there, and existing threads show as pins. The panel lists every
// thread (this page, everywhere, or the ones you're tagged in), and a thread can be
// opened from a link: /w/:wedding/:page?comment=:id — which is what the email
// notifications will point at.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useCollab, usePeople, type Anchor } from '@/lib/collab';
import { pageReadPerms, roleCanAll } from '@/lib/permissions';
import type { Comment, Mention } from '@/lib/types';
import { cls, timeAgo } from '@/lib/util';
import { TAB_BY_KEY } from '@/modules/registry';
import { Button, IconButton, Segmented } from '@/components/kit';
import { IconAt, IconCheck, IconMessage, IconPencil, IconRefresh, IconTrash, IconX } from '@/components/icons';
import { Avatar, MentionInput, RichText, extractMentions, type Person } from '@/components/MentionInput';
import { computeAnchor, describe, pinTarget, resolveAnchor } from './anchor';

type Ui = {
  page: string;
  commentable: boolean;
  mode: boolean;
  setMode: (on: boolean) => void;
  panel: boolean;
  setPanel: (on: boolean) => void;
  openThread: (c: Comment) => void;
  unreadMentions: number;
  pageCount: number;
};

const UiCtx = createContext<Ui | null>(null);
export const useCommentUi = () => {
  const v = useContext(UiCtx);
  if (!v) throw new Error('useCommentUi outside CommentLayer');
  return v;
};

const ROOT = '[data-comment-root]';
const UI = '[data-comment-ui]';

function pageOf(pathname: string) {
  const m = /^\/w\/[^/]+\/([^/?#]+)/.exec(pathname);
  return m?.[1] ?? 'dashboard';
}

export function pageLabel(page: string) {
  if (page === 'account') return 'Account & team';
  if (page === 'chat') return 'Team chat';
  return TAB_BY_KEY.get(page)?.label ?? page;
}

type Composer = { anchor: Anchor; label: string; x: number; y: number };

export function CommentLayer({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const { weddingId } = useStore();
  const { comments, mentions } = useCollab();
  const page = pageOf(loc.pathname);
  const commentable = can('comments:write') && page !== 'chat';

  const [mode, setModeRaw] = useState(false);
  const [panel, setPanel] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [hover, setHover] = useState<DOMRect | null>(null);

  const setMode = useCallback((on: boolean) => {
    setModeRaw(on);
    if (!on) {
      setComposer(null);
      setHover(null);
    }
  }, []);

  // leaving a page closes what belonged to it
  useEffect(() => {
    setComposer(null);
    setHover(null);
    if (page === 'chat') setModeRaw(false);
  }, [page]);

  const threads = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const pageThreads = useMemo(() => threads.filter((c) => c.page === page), [threads, page]);
  const unreadMentions = mentions.filter((m) => !m.read_at).length;

  const openThread = useCallback(
    (c: Comment) => {
      const top = c.parent_id ? comments.find((x) => x.id === c.parent_id) ?? c : c;
      setComposer(null);
      setActive(top.id);
      if (top.page !== page) navigate(`/w/${weddingId}/${top.page}`);
      // bring it into view once the page has rendered
      setTimeout(() => {
        const root = document.querySelector(ROOT);
        const el = root && resolveAnchor(top.anchor as Anchor, root);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 350);
    },
    [comments, page, navigate, weddingId],
  );

  // ?comment=<id> opens that thread (links from notifications)
  const linked = params.get('comment');
  useEffect(() => {
    if (!linked) return;
    const c = comments.find((x) => x.id === linked);
    if (!c) return;
    openThread(c);
    params.delete('comment');
    setParams(params, { replace: true });
  }, [linked, comments, openThread, params, setParams]);

  // keyboard: C toggles comment mode, Esc leaves it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      if (e.key === 'Escape' && (mode || active)) {
        if (composer) setComposer(null);
        else if (active) setActive(null);
        else setMode(false);
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === 'C') && commentable && !document.querySelector('[role="dialog"]')) {
        setMode(!mode);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, active, composer, commentable, setMode]);

  // comment mode: hover outlines, click pins
  useEffect(() => {
    if (!mode) return;
    document.documentElement.setAttribute('data-comment-mode', '');
    const target = (e: Event) => {
      const t = e.target as Element | null;
      const root = document.querySelector(ROOT);
      if (!t || !root || t.closest(UI) || !root.contains(t)) return null;
      return { root, el: pinTarget(t, root) };
    };
    const onMove = (e: MouseEvent) => {
      const hit = target(e);
      setHover(hit?.el ? hit.el.getBoundingClientRect() : null);
    };
    const onClick = (e: MouseEvent) => {
      const hit = target(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (!hit.el) return;
      setActive(null);
      setComposer({ anchor: computeAnchor(hit.el, hit.root, e.clientX, e.clientY), label: describe(hit.el), x: e.clientX, y: e.clientY });
    };
    // swallow the press too, so buttons and links don't react underneath
    const swallow = (e: Event) => {
      if (target(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mousedown', swallow, true);
    document.addEventListener('pointerdown', swallow, true);
    document.addEventListener('submit', swallow, true);
    return () => {
      document.documentElement.removeAttribute('data-comment-mode');
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mousedown', swallow, true);
      document.removeEventListener('pointerdown', swallow, true);
      document.removeEventListener('submit', swallow, true);
      setHover(null);
    };
  }, [mode]);

  const ui = useMemo<Ui>(
    () => ({ page, commentable, mode, setMode, panel, setPanel, openThread, unreadMentions, pageCount: pageThreads.filter((c) => !c.resolved_at).length }),
    [page, commentable, mode, setMode, panel, openThread, unreadMentions, pageThreads],
  );

  useEffect(() => {
    if (!panel) return;
    document.documentElement.setAttribute('data-comments-open', '');
    return () => document.documentElement.removeAttribute('data-comments-open');
  }, [panel]);

  const activeThread = active ? threads.find((t) => t.id === active) ?? null : null;
  const showPins = mode || panel || !!activeThread;

  return (
    <UiCtx.Provider value={ui}>
      {children}
      <div data-comment-ui>
        {mode && hover && (
          <div
            className="pointer-events-none fixed z-40 rounded-md ring-2 ring-amber-500/80 ring-offset-1"
            style={{ left: hover.left - 2, top: hover.top - 2, width: hover.width + 4, height: hover.height + 4 }}
            aria-hidden="true"
          />
        )}
        {mode && (
          <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-stone-900 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900">
            <span>Click anything to comment on it</span>
            <button className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25 dark:bg-stone-900/10" onClick={() => setMode(false)}>
              Done <span className="opacity-60">Esc</span>
            </button>
          </div>
        )}
        {showPins && <Pins threads={pageThreads.filter((t) => !t.resolved_at || t.id === active)} active={active} onOpen={(c) => { setComposer(null); setActive(c.id === active ? null : c.id); }} />}
        {composer && <NewThread composer={composer} page={page} onClose={() => setComposer(null)} onPosted={(c) => { setComposer(null); setActive(c.id); }} />}
        {activeThread && <Thread thread={activeThread} onClose={() => setActive(null)} />}
      </div>
    </UiCtx.Provider>
  );
}

// ─── pins ────────────────────────────────────────────────────────────────────
function usePositions(threads: Comment[]) {
  const [pos, setPos] = useState<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const root = document.querySelector(ROOT);
      const next = new Map<string, { x: number; y: number }>();
      if (root) {
        for (const t of threads) {
          const el = resolveAnchor(t.anchor as Anchor, root);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          const a = t.anchor as Anchor;
          next.set(t.id, { x: r.left + (a.x ?? 1) * r.width, y: r.top + (a.y ?? 0) * r.height });
        }
      }
      setPos(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const timer = window.setInterval(schedule, 800);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threads]);
  return pos;
}

function Pins({ threads, active, onOpen }: { threads: Comment[]; active: string | null; onOpen: (c: Comment) => void }) {
  const pos = usePositions(threads);
  const { comments } = useCollab();
  const people = usePeople();
  return (
    <>
      {threads.map((t) => {
        const p = pos.get(t.id);
        if (!p) return null;
        const replies = comments.filter((c) => c.parent_id === t.id).length;
        const name = people.name(t.author_id);
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t)}
            aria-label={`Comment by ${name}: ${t.body.slice(0, 60)}`}
            title={`${name}: ${t.body.slice(0, 80)}`}
            className={cls(
              'fixed z-40 flex -translate-y-full items-center gap-1 rounded-full rounded-bl-none border-2 bg-white py-0.5 pl-0.5 pr-1.5 shadow-md transition-transform hover:scale-105 dark:bg-stone-900',
              t.id === active ? 'border-amber-600' : 'border-white dark:border-stone-700',
              t.resolved_at && 'opacity-60',
            )}
            style={{ left: p.x, top: p.y }}
          >
            <Avatar name={name} size="sm" />
            {replies > 0 && <span className="text-[11px] font-semibold tabular-nums text-stone-600 dark:text-stone-300">{replies + 1}</span>}
          </button>
        );
      })}
    </>
  );
}

// ─── popovers ────────────────────────────────────────────────────────────────
function Popover({ x, y, children, onClose, label }: { x: number; y: number; children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x, top: y });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // keep clear of the docked comments column (desktop only; on phones it's a drawer)
    const docked = window.innerWidth >= 1024 ? document.querySelector('[data-comment-sidebar]') : null;
    const right = docked ? docked.getBoundingClientRect().left : window.innerWidth;
    const left = Math.max(8, Math.min(x + 12, right - w - 8));
    const top = Math.max(8, Math.min(y + 12, window.innerHeight - h - 8));
    setPlace({ left, top });
  }, [x, y, children]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-50 w-[22rem] max-w-[calc(100vw-16px)] rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
      style={place}
      onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}
    >
      {children}
    </div>
  );
}

function useMentionable(page: string): Person[] {
  const { roles } = useStore();
  const { session } = useAuth();
  const people = usePeople();
  const perms = pageReadPerms(page);
  return people.list.filter((p) => p.id !== session?.user.id && roleCanAll(roles.matrix, p.role, perms));
}

function NewThread({ composer, page, onClose, onPosted }: { composer: Composer; page: string; onClose: () => void; onPosted: (c: Comment) => void }) {
  const { addComment } = useCollab();
  const people = useMentionable(page);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const c = await addComment({ page, anchor: composer.anchor, anchor_label: composer.label, body: body.trim(), mentions: extractMentions(body, people) });
      onPosted(c);
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover x={composer.x} y={composer.y} onClose={onClose} label="New comment">
      <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-stone-800">
        <div className="min-w-0 text-xs text-stone-500">
          Commenting on <span className="font-medium text-stone-800 dark:text-stone-200">{composer.label}</span>
        </div>
        <IconButton label="Cancel" onClick={onClose} className="-mr-1 -mt-1 h-7 w-7"><IconX size={14} /></IconButton>
      </div>
      <div className="space-y-2 p-3">
        <MentionInput value={body} onChange={setBody} people={people} onSubmit={post} rows={3} autoFocus placeholder="Add a comment — type @ to tag someone" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-stone-400">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to post</span>
          <Button size="sm" variant="primary" onClick={post} disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post'}</Button>
        </div>
        {people.length === 0 && <p className="text-[11px] text-stone-400">Nobody else on the team can see this page yet, so there's no one to tag.</p>}
      </div>
    </Popover>
  );
}

function Thread({ thread, onClose }: { thread: Comment; onClose: () => void }) {
  const { comments, addComment, resolveComment } = useCollab();
  const { can } = useAuth();
  const people = useMentionable(thread.page);
  const replies = comments.filter((c) => c.parent_id === thread.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number }>({ x: window.innerWidth / 2 - 176, y: 120 });

  // sit next to the pin when we can find it
  useEffect(() => {
    const place = () => {
      const root = document.querySelector(ROOT);
      const el = root && resolveAnchor(thread.anchor as Anchor, root);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const a = thread.anchor as Anchor;
      setAt({ x: r.left + (a.x ?? 1) * r.width, y: r.top + (a.y ?? 0) * r.height });
    };
    place();
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
    };
    const t = window.setTimeout(place, 400);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [thread]);

  const reply = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addComment({ page: thread.page, anchor: {}, anchor_label: '', body: body.trim(), mentions: extractMentions(body, people), parent_id: thread.id });
      setBody('');
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover x={at.x} y={at.y} onClose={onClose} label="Comment thread">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-stone-800">
        <div className="min-w-0 truncate text-xs text-stone-500" title={thread.anchor_label}>
          {pageLabel(thread.page)}{thread.anchor_label && <> · <span className="text-stone-700 dark:text-stone-300">{thread.anchor_label}</span></>}
        </div>
        <div className="flex shrink-0 items-center">
          {can('comments:write') && (
            <IconButton
              label={thread.resolved_at ? 'Reopen' : 'Resolve'}
              className="h-7 w-7"
              onClick={() => resolveComment(thread.id, !thread.resolved_at).then(() => !thread.resolved_at && onClose()).catch(() => undefined)}
            >
              {thread.resolved_at ? <IconRefresh size={14} /> : <IconCheck size={15} />}
            </IconButton>
          )}
          <IconButton label="Close" className="h-7 w-7" onClick={onClose}><IconX size={14} /></IconButton>
        </div>
      </div>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
        {thread.resolved_at && <div className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Resolved {timeAgo(thread.resolved_at)}</div>}
        {[thread, ...replies].map((c) => <CommentItem key={c.id} c={c} people={people} />)}
      </div>
      {can('comments:write') && (
        <div className="space-y-2 border-t border-stone-100 p-3 dark:border-stone-800">
          <MentionInput value={body} onChange={setBody} people={people} onSubmit={reply} rows={2} placeholder="Reply — type @ to tag someone" />
          <div className="flex justify-end">
            <Button size="sm" variant="primary" onClick={reply} disabled={busy || !body.trim()}>Reply</Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function CommentItem({ c, people }: { c: Comment; people: Person[] }) {
  const { editComment, deleteComment } = useCollab();
  const { session, can } = useAuth();
  const everyone = usePeople();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const mine = c.author_id === session?.user.id;
  const name = everyone.name(c.author_id);
  return (
    <div className="group flex gap-2">
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-[11px] text-stone-400" title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}{c.edited_at && ' · edited'}</span>
          <span className="ml-auto flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {mine && !editing && <IconButton label="Edit" className="h-6 w-6" onClick={() => { setText(c.body); setEditing(true); }}><IconPencil size={12} /></IconButton>}
            {(mine || can('members:manage')) && (
              <IconButton label="Delete" className="h-6 w-6" onClick={() => window.confirm(c.parent_id ? 'Delete this reply?' : 'Delete this comment and its replies?') && deleteComment(c.id).catch(() => undefined)}>
                <IconTrash size={12} />
              </IconButton>
            )}
          </span>
        </div>
        {editing ? (
          <div className="mt-1 space-y-1.5">
            <MentionInput value={text} onChange={setText} people={people} rows={2} autoFocus onSubmit={() => editComment(c.id, text.trim(), extractMentions(text, people)).then(() => setEditing(false)).catch(() => undefined)} />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => editComment(c.id, text.trim(), extractMentions(text, people)).then(() => setEditing(false)).catch(() => undefined)}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-stone-800 dark:text-stone-200"><RichText body={c.body} mentioned={c.mentions} people={everyone.list} meId={session?.user.id} /></div>
        )}
      </div>
    </div>
  );
}

// ─── the panel ───────────────────────────────────────────────────────────────
/**
 * The comments sidebar. The shell docks it on the right like the navigation on the
 * left, so it pushes the page over instead of covering it; on phones it's a drawer.
 */
export function CommentSidebar() {
  const { panel, setPanel, page, openThread } = useCommentUi();
  const { comments, mentions } = useCollab();
  const { session } = useAuth();
  const threads = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  if (!panel) return null;
  return (
    <>
      {/* below lg it's a drawer over the page, with a backdrop */}
      <div className="fixed inset-0 z-40 bg-stone-950/40 lg:hidden" onClick={() => setPanel(false)} aria-hidden="true" data-comment-ui />
      {/* from lg up it's a column beside the page, like the navigation on the left */}
      <aside
        aria-label="Comments"
        data-comment-ui
        data-comment-sidebar
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-stone-200 shadow-2xl dark:border-stone-800 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-80 lg:max-w-none lg:shrink-0 lg:shadow-none xl:w-96"
      >
        <CommentPanel page={page} threads={threads} mentions={mentions} meId={session?.user.id ?? ''} onClose={() => setPanel(false)} onOpen={openThread} />
      </aside>
    </>
  );
}

type PanelTab = 'page' | 'all' | 'mentions';

function CommentPanel({ page, threads, mentions, meId, onClose, onOpen }: {
  page: string; threads: Comment[]; mentions: Mention[]; meId: string; onClose: () => void; onOpen: (c: Comment) => void;
}) {
  const { comments, markMentionsRead, channels } = useCollab();
  const { weddingId } = useStore();
  const people = usePeople();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PanelTab>(page === 'chat' ? 'all' : 'page');
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const unread = mentions.filter((m) => !m.read_at).length;

  const list = threads
    .filter((t) => (tab === 'page' ? t.page === page : true))
    .filter((t) => (show === 'open' ? !t.resolved_at : !!t.resolved_at))
    .sort((a, b) => lastActivity(b, comments).localeCompare(lastActivity(a, comments)));

  const openMention = (m: Mention) => {
    markMentionsRead([m.id]);
    if (m.comment_id) {
      const c = comments.find((x) => x.id === m.comment_id);
      if (c) onOpen(c);
    } else if (m.message_id && m.channel_id) {
      const ch = channels.find((x) => x.id === m.channel_id);
      navigate(`/w/${weddingId}/chat?channel=${ch?.id ?? m.channel_id}&message=${m.message_id}`);
      onClose();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <h2 className="font-serif text-xl font-semibold">Comments</h2>
        <IconButton label="Close comments" onClick={onClose}><IconX size={16} /></IconButton>
      </div>
      <div className="space-y-2 border-b border-stone-100 px-4 py-2 dark:border-stone-800">
        <Segmented<PanelTab>
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            ...(page !== 'chat' ? [{ value: 'page' as const, label: pageLabel(page) }] : []),
            { value: 'all', label: 'All pages' },
            { value: 'mentions', label: <span className="inline-flex items-center gap-1"><IconAt size={12} /> For me</span>, count: unread || undefined },
          ]}
        />
        {tab !== 'mentions' && (
          <Segmented<'open' | 'resolved'> size="sm" value={show} onChange={setShow} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'mentions' ? (
          mentions.length === 0 ? (
            <PanelEmpty title="Nothing for you yet" body="When someone tags you with @ in a comment or the chat, it shows up here." />
          ) : (
            <>
              {unread > 0 && (
                <div className="flex justify-end px-4 pt-2">
                  <button className="text-xs text-amber-700 hover:underline dark:text-amber-400" onClick={() => markMentionsRead(mentions.map((m) => m.id))}>Mark all read</button>
                </div>
              )}
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {mentions.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => openMention(m)} className={cls('flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/60', !m.read_at && 'bg-amber-50/70 dark:bg-amber-950/30')}>
                      <Avatar name={people.name(m.author_id)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-stone-500">
                          <span className="font-medium text-stone-800 dark:text-stone-200">{people.name(m.author_id)}</span> tagged you in{' '}
                          {m.message_id ? `#${channels.find((c) => c.id === m.channel_id)?.name ?? 'chat'}` : pageLabel(m.page ?? '')} · {timeAgo(m.created_at)}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-sm">{m.excerpt}</span>
                      </span>
                      {!m.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-600" aria-label="unread" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : list.length === 0 ? (
          <PanelEmpty
            title={show === 'open' ? 'No open comments' : 'Nothing resolved yet'}
            body={show === 'open' ? 'Turn on comment mode and click anything on the page to start a thread.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {list.map((t) => {
              const replies = comments.filter((c) => c.parent_id === t.id);
              const tagged = t.mentions.includes(meId) || replies.some((r) => r.mentions.includes(meId));
              return (
                <li key={t.id}>
                  <button onClick={() => onOpen(t)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/60">
                    <Avatar name={people.name(t.author_id)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-stone-500">
                        {tab === 'all' && <span className="font-medium text-stone-700 dark:text-stone-300">{pageLabel(t.page)} · </span>}
                        {t.anchor_label || 'This page'}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm">
                        <span className="font-medium">{people.name(t.author_id)}:</span> {t.body}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
                        {timeAgo(lastActivity(t, comments))}
                        {replies.length > 0 && <span className="inline-flex items-center gap-0.5"><IconMessage size={11} /> {replies.length}</span>}
                        {tagged && <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400"><IconAt size={11} /> you</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function lastActivity(t: Comment, all: Comment[]) {
  return all.filter((c) => c.parent_id === t.id).reduce((a, c) => (c.created_at > a ? c.created_at : a), t.created_at);
}

function PanelEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <IconMessage size={24} className="mx-auto text-stone-300" />
      <div className="mt-2 font-serif text-lg font-semibold">{title}</div>
      {body && <p className="mt-1 text-sm text-stone-500">{body}</p>}
    </div>
  );
}
