// One channel: header, the conversation, the composer, and the thread or details column.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useCollab } from '@/lib/collab';
import type { ChatChannel, ChatFile, ChatMessage, ChatReaction } from '@/lib/types';
import { cls, fmtDate } from '@/lib/util';
import { IconButton } from '@/components/kit';
import { whyNot } from '@/components/Gate';
import { IconArrowDown, IconChevronLeft, IconHash, IconInfo, IconPencil, IconPin, IconStar, IconUpload } from '@/components/icons';
import { Composer, type ComposerHandle } from './Composer';
import { MessageRow } from './MessageRow';
import { DetailsPanel, ThreadPane, type DetailsTab } from './Panels';
import { useChatPeople } from './shared';

type Side = { kind: 'thread'; id: string } | { kind: 'details'; tab: DetailsTab } | null;

export function ChannelView({ channel, onBack, onEdit }: { channel: ChatChannel; onBack: () => void; onEdit: () => void }) {
  const { messages, send, markRead, reads, files, reactions, starred, toggleStar } = useCollab();
  const { can, session } = useAuth();
  const [params, setParams] = useSearchParams();
  const people = useChatPeople();
  const me = session?.user.id ?? '';
  // ?panel=notes (from a search result) opens the channel with its notes showing
  const [side, setSide] = useState<Side>(() => (params.get('panel') === 'notes' ? { kind: 'details', tab: 'notes' } : null));
  useEffect(() => {
    if (!params.get('panel')) return;
    const next = new URLSearchParams(params);
    next.delete('panel');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const nearBottom = useRef(true);
  const [readMark] = useState(() => reads.get(channel.id) ?? null);
  const focus = params.get('message');

  const list = useMemo(
    () => messages.filter((m) => m.channel_id === channel.id && !m.parent_id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, channel.id],
  );
  const replies = useMemo(() => {
    const r = new Map<string, ChatMessage[]>();
    for (const m of messages) if (m.channel_id === channel.id && m.parent_id) r.set(m.parent_id, [...(r.get(m.parent_id) ?? []), m]);
    return r;
  }, [messages, channel.id]);
  const channelFiles = useMemo(() => files.filter((f) => f.channel_id === channel.id), [files, channel.id]);
  const filesByMessage = useMemo(() => {
    const r = new Map<string, ChatFile[]>();
    for (const f of [...channelFiles].sort((a, b) => a.created_at.localeCompare(b.created_at))) r.set(f.message_id, [...(r.get(f.message_id) ?? []), f]);
    return r;
  }, [channelFiles]);
  const reactionsByMessage = useMemo(() => {
    const r = new Map<string, ChatReaction[]>();
    for (const x of reactions) r.set(x.message_id, [...(r.get(x.message_id) ?? []), x]);
    return r;
  }, [reactions]);
  const filesFor = useCallback((id: string) => filesByMessage.get(id) ?? [], [filesByMessage]);
  const reactionsFor = useCallback((id: string) => reactionsByMessage.get(id) ?? [], [reactionsByMessage]);

  const pinned = list.filter((m) => m.pinned);
  const firstNew = readMark ? list.find((m) => m.created_at > readMark && m.author_id !== me)?.id : undefined;
  const isStarred = starred.has(channel.id);

  // reading the channel marks it read (and keeps it read while new messages arrive)
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(channel.id);
  }, [channel.id, list.length, markRead]);

  // stick to the bottom like a chat should, unless you've scrolled up to read history;
  // then count what arrives instead of yanking you down
  const seen = useRef(list.length);
  useLayoutEffect(() => {
    const el = scroller.current;
    const added = list.slice(seen.current);
    seen.current = list.length;
    if (!el || focus) return;
    if (nearBottom.current || added.some((m) => m.author_id === me)) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else if (added.length) {
      setUnseen((n) => n + added.length);
    }
  }, [list, focus, me]);

  const scrollToMessage = useCallback((id: string) => {
    const el = scroller.current;
    const row = el?.querySelector<HTMLElement>(`[data-message="${id}"]`);
    if (!el || !row) return;
    el.scrollTop = Math.max(0, row.offsetTop - el.clientHeight / 3);
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 2000);
  }, []);

  // a link to a specific message (a mention, a search result, a copied link)
  useEffect(() => {
    if (!focus) return;
    const m = messages.find((x) => x.id === focus);
    if (!m) return;
    if (m.parent_id) setSide({ kind: 'thread', id: m.parent_id });
    const t = window.setTimeout(() => {
      scrollToMessage(m.parent_id ?? m.id);
      const next = new URLSearchParams(params);
      next.delete('message');
      setParams(next, { replace: true });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focus, messages, params, setParams, scrollToMessage]);

  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    setUnseen(0);
  };

  const archived = !!channel.archived_at;
  const canPost = can('chat:write') && !archived;
  const openThread = side?.kind === 'thread' ? list.find((m) => m.id === side.id) ?? null : null;
  const lastMine = [...list].reverse().find((m) => m.author_id === me);

  const onDrag = (e: DragEvent) => {
    if (!canPost || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    if (!canPost) return;
    e.preventDefault();
    setDragging(false);
    const dropped = [...e.dataTransfer.files];
    if (dropped.length) composer.current?.addFiles(dropped);
  };

  return (
    <div className="relative flex h-full min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col" onDragEnter={onDrag} onDragOver={onDrag}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 px-3 dark:border-stone-800">
          <IconButton label="All channels" className="md:hidden" onClick={onBack}><IconChevronLeft size={18} /></IconButton>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 font-semibold">
              <IconHash size={15} className="opacity-60" /> <span className="truncate">{channel.name}</span>
              {archived && <span className="ml-1 text-xs font-normal text-stone-400">(archived)</span>}
              <IconButton label={isStarred ? 'Unstar channel' : 'Star channel'} className="ml-0.5 h-6 w-6" onClick={() => toggleStar(channel.id).catch(() => undefined)}>
                <IconStar size={14} className={isStarred ? 'fill-amber-400 text-amber-500' : undefined} />
              </IconButton>
            </div>
            {channel.topic && <div className="truncate text-xs text-stone-500">{channel.topic}</div>}
          </div>
          <button
            onClick={() => setSide(side?.kind === 'details' && side.tab === 'pinned' ? null : { kind: 'details', tab: 'pinned' })}
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 sm:inline-flex"
            title="Pinned messages"
          >
            <IconPin size={14} /> {pinned.length}
          </button>
          <IconButton
            label="Channel details, notes and files"
            className={cls(side?.kind === 'details' && 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100')}
            onClick={() => setSide(side?.kind === 'details' ? null : { kind: 'details', tab: 'notes' })}
          >
            <IconInfo size={16} />
          </IconButton>
          {can('chat:manage') && <IconButton label="Edit channel" onClick={onEdit}><IconPencil size={14} /></IconButton>}
        </header>

        <div
          ref={scroller}
          className="relative flex-1 overflow-y-auto py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            nearBottom.current = near;
            setAtBottom(near);
            if (near) setUnseen(0);
          }}
        >
          {list.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><IconHash size={22} /></div>
              <div className="mt-3 font-serif text-xl font-semibold">Welcome to #{channel.name}</div>
              <p className="mt-1 text-sm text-stone-500">{channel.topic || 'This is the start of the channel.'}</p>
              <p className="mt-3 text-xs text-stone-400">Share notes, photos and files here — drop them in, or keep a running note in <button className="text-amber-700 underline dark:text-amber-400" onClick={() => setSide({ kind: 'details', tab: 'notes' })}>the channel’s notes</button>.</p>
            </div>
          ) : (
            list.map((m, i) => {
              const prev = list[i - 1];
              const newDay = !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
              const compact = !!prev && !newDay && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000 && m.id !== firstNew;
              return (
                <Fragment key={m.id}>
                  {newDay && <DayDivider iso={m.created_at} />}
                  {m.id === firstNew && (
                    <div className="relative my-2 flex items-center px-4" aria-label="New messages">
                      <div className="h-px flex-1 bg-rose-400" />
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-rose-600">New</span>
                    </div>
                  )}
                  <MessageRow
                    m={m}
                    compact={compact}
                    replies={replies.get(m.id) ?? []}
                    files={filesFor(m.id)}
                    reactions={reactionsFor(m.id)}
                    people={people}
                    onThread={() => setSide({ kind: 'thread', id: m.id })}
                    flash={flash === m.id || (side?.kind === 'thread' && side.id === m.id)}
                    editing={editing === m.id}
                    onEditStart={() => setEditing(m.id)}
                    onEditEnd={() => setEditing(null)}
                  />
                </Fragment>
              );
            })
          )}
        </div>

        {!atBottom && (
          <button
            onClick={toBottom}
            className="absolute bottom-28 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
          >
            <IconArrowDown size={13} /> {unseen ? `${unseen} new message${unseen === 1 ? '' : 's'}` : 'Jump to latest'}
          </button>
        )}

        {canPost ? (
          <Composer
            ref={composer}
            key={channel.id}
            channelId={channel.id}
            where={channel.id}
            placeholder={`Message #${channel.name}`}
            people={people}
            onSend={(body, mentions, attach) => send(channel.id, body, mentions, null, attach)}
            onEditLast={lastMine ? () => { setEditing(lastMine.id); scrollToMessage(lastMine.id); } : undefined}
          />
        ) : (
          <p className="shrink-0 border-t border-stone-200 py-4 text-center text-sm text-stone-500 dark:border-stone-800">
            {archived ? 'This channel is archived. Unarchive it to post again.' : whyNot('chat:write')}
          </p>
        )}

        {dragging && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-amber-50/90 dark:bg-stone-950/90"
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
            onDrop={onDrop}
          >
            <div className="pointer-events-none rounded-2xl border-2 border-dashed border-amber-500 px-10 py-8 text-center">
              <IconUpload size={28} className="mx-auto text-amber-600" />
              <div className="mt-2 font-semibold">Drop to share in #{channel.name}</div>
              <div className="text-xs text-stone-500">Photos, PDFs, documents — up to 20 MB each</div>
            </div>
          </div>
        )}
      </div>

      {openThread && (
        <ThreadPane
          parent={openThread}
          channelName={channel.name}
          replies={replies.get(openThread.id) ?? []}
          filesFor={filesFor}
          reactionsFor={reactionsFor}
          people={people}
          canPost={canPost}
          onClose={() => setSide(null)}
        />
      )}
      {side?.kind === 'details' && (
        <DetailsPanel
          channel={channel}
          tab={side.tab}
          onTab={(tab) => setSide({ kind: 'details', tab })}
          pinned={pinned}
          files={channelFiles}
          people={people}
          onJump={(id) => {
            if (window.innerWidth < 1024) setSide(null);
            window.setTimeout(() => scrollToMessage(id), 50);
          }}
          onClose={() => setSide(null)}
        />
      )}
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  const d = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : fmtDate(d, { weekday: true, year: true });
  return (
    <div className="sticky top-0 z-[5] my-3 flex items-center gap-3 px-4">
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-stone-500 dark:border-stone-700 dark:bg-stone-900">{label}</span>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}
