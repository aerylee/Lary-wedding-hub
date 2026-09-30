// Team chat: channels grouped into categories, threads, pins, @mentions and unread
// counts. Anyone who can read the chat sees every channel; organising channels is
// chat:manage. Messages arrive live.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useCollab, usePeople } from '@/lib/collab';
import type { ChatCategory, ChatChannel, ChatMessage } from '@/lib/types';
import { cls, fmtDate, timeAgo } from '@/lib/util';
import { Button, Empty, Field, IconButton, Input, Modal, Select, Spinner } from '@/components/kit';
import { whyNot } from '@/components/Gate';
import { useConfirm } from '@/components/Confirm';
import {
  IconArchive, IconArrowDown, IconArrowUp, IconChevronDown, IconChevronLeft, IconChevronRight, IconFolder, IconHash, IconMore,
  IconPencil, IconPin, IconPlus, IconReply, IconTrash, IconX,
} from '@/components/icons';
import { Avatar, MentionInput, RichText, extractMentions, type Person } from '@/components/MentionInput';

const LAST_KEY = (w: string) => `hub:chat:last:${w}`;
const FOLD_KEY = (w: string) => `hub:chat:folded:${w}`;

const store = {
  get(k: string) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* only a convenience */ }
  },
};

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function Chat() {
  const { weddingId } = useStore();
  const { can } = useAuth();
  const { loaded, channels, categories, unread } = useCollab();
  const [params, setParams] = useSearchParams();
  const [editChannel, setEditChannel] = useState<Partial<ChatChannel> | null>(null);
  const [editCategory, setEditCategory] = useState<Partial<ChatCategory> | null>(null);
  const [mobileList, setMobileList] = useState(!params.get('channel'));

  const live = channels.filter((c) => !c.archived_at);
  const requested = params.get('channel');
  const current =
    channels.find((c) => c.id === requested) ??
    channels.find((c) => c.id === store.get(LAST_KEY(weddingId)) && !c.archived_at) ??
    live.find((c) => c.name === 'general') ??
    live[0] ??
    null;

  useEffect(() => {
    if (current) store.set(LAST_KEY(weddingId), current.id);
  }, [current, weddingId]);

  const open = (c: ChatChannel) => {
    const next = new URLSearchParams(params);
    next.set('channel', c.id);
    next.delete('message');
    setParams(next, { replace: true });
    setMobileList(false);
  };

  if (!can('chat:read')) {
    return <Empty title="Team chat isn't available to you" body="Your role on this wedding doesn't include the chat. Ask an owner if you need it." />;
  }
  if (!loaded) return <div className="py-16"><Spinner label="Loading the chat…" /></div>;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-3.75rem)] min-h-[420px] overflow-hidden border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:mx-0 sm:my-0 sm:h-[calc(100dvh-7.5rem)] sm:rounded-xl sm:border sm:shadow-sm">
      <aside className={cls('w-full shrink-0 flex-col border-r border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950/40 md:flex md:w-64', mobileList ? 'flex' : 'hidden')}>
        <ChannelList
          channels={channels}
          categories={categories}
          currentId={current?.id ?? null}
          unread={unread}
          onOpen={open}
          onEditChannel={setEditChannel}
          onEditCategory={setEditCategory}
        />
      </aside>
      <section className={cls('min-w-0 flex-1 flex-col', mobileList ? 'hidden md:flex' : 'flex')}>
        {current ? (
          <ChannelView key={current.id} channel={current} onBack={() => setMobileList(true)} onEdit={() => setEditChannel(current)} />
        ) : (
          <Empty
            title="No channels yet"
            body="Channels keep conversations about one thing in one place — the venue, the guest list, the band."
            action={can('chat:manage') ? <Button variant="primary" onClick={() => setEditChannel({})}><IconPlus size={14} /> Create a channel</Button> : undefined}
          />
        )}
      </section>

      {editChannel && <ChannelEditor channel={editChannel} categories={categories} onClose={() => setEditChannel(null)} onSaved={open} />}
      {editCategory && <CategoryEditor category={editCategory} onClose={() => setEditCategory(null)} />}
    </div>
  );
}

// ─── channel list ────────────────────────────────────────────────────────────
function ChannelList({ channels, categories, currentId, unread, onOpen, onEditChannel, onEditCategory }: {
  channels: ChatChannel[]; categories: ChatCategory[]; currentId: string | null; unread: Map<string, number>;
  onOpen: (c: ChatChannel) => void; onEditChannel: (c: Partial<ChatChannel>) => void; onEditCategory: (c: Partial<ChatCategory>) => void;
}) {
  const { weddingId } = useStore();
  const { can } = useAuth();
  const { reorder, saveChannel, deleteCategory, deleteChannel } = useCollab();
  const confirm = useConfirm();
  const manage = can('chat:manage');
  const [folded, setFolded] = useState<Set<string>>(() => new Set(JSON.parse(store.get(FOLD_KEY(weddingId)) ?? '[]') as string[]));
  const [showArchived, setShowArchived] = useState(false);
  const toggleFold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      store.set(FOLD_KEY(weddingId), JSON.stringify([...n]));
      return n;
    });

  const cats = [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const live = channels.filter((c) => !c.archived_at);
  const archived = channels.filter((c) => c.archived_at);
  const inCat = (id: string | null) =>
    live.filter((c) => (id ? c.category_id === id : !c.category_id || !categories.some((k) => k.id === c.category_id)))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const moveChannel = (c: ChatChannel, dir: -1 | 1) => {
    const list = inCat(c.category_id && categories.some((k) => k.id === c.category_id) ? c.category_id : null);
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const order = [...list];
    [order[i], order[j]] = [order[j], order[i]];
    reorder('chat_channels', order.map((x, k) => ({ id: x.id, position: k }))).catch(() => undefined);
  };
  const moveCategory = (c: ChatCategory, dir: -1 | 1) => {
    const i = cats.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const order = [...cats];
    [order[i], order[j]] = [order[j], order[i]];
    reorder('chat_categories', order.map((x, k) => ({ id: x.id, position: k }))).catch(() => undefined);
  };
  const moveTo = (c: ChatChannel, categoryId: string | null) =>
    reorder('chat_channels', [{ id: c.id, category_id: categoryId, position: inCat(categoryId).length }]).catch(() => undefined);

  const section = (key: string, title: string, list: ChatChannel[], cat?: ChatCategory, index = 0) => {
    const isFolded = folded.has(key);
    const unreadHidden = isFolded ? list.reduce((a, c) => a + (unread.get(c.id) ?? 0), 0) : 0;
    return (
      <div key={key} className="mb-2">
        <div className="group flex items-center gap-1 px-2">
          <button onClick={() => toggleFold(key)} className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100" aria-expanded={!isFolded}>
            {isFolded ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
            <span className="truncate">{title}</span>
            {unreadHidden > 0 && <span className="ml-1 rounded-full bg-amber-600 px-1.5 text-[10px] text-white">{unreadHidden}</span>}
          </button>
          {manage && (
            <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <IconButton label={`Add a channel to ${title}`} className="h-6 w-6" onClick={() => onEditChannel({ category_id: cat?.id ?? null })}><IconPlus size={12} /></IconButton>
              {cat && (
                <Menu label={`${title} options`}>
                  <MenuItem icon={<IconPencil size={13} />} onClick={() => onEditCategory(cat)}>Rename category</MenuItem>
                  <MenuItem icon={<IconArrowUp size={13} />} disabled={index === 0} onClick={() => moveCategory(cat, -1)}>Move up</MenuItem>
                  <MenuItem icon={<IconArrowDown size={13} />} disabled={index === cats.length - 1} onClick={() => moveCategory(cat, 1)}>Move down</MenuItem>
                  <MenuItem
                    icon={<IconTrash size={13} />}
                    danger
                    onClick={async () => {
                      if (await confirm({ title: `Delete the “${cat.name}” category?`, body: 'Its channels and their messages stay, listed under “Other channels”.' }))
                        deleteCategory(cat.id).catch(() => undefined);
                    }}
                  >
                    Delete category
                  </MenuItem>
                </Menu>
              )}
            </span>
          )}
        </div>
        {!isFolded && (
          <ul className="mt-0.5 space-y-px px-2">
            {list.map((c, i) => {
              const n = unread.get(c.id) ?? 0;
              const active = c.id === currentId;
              return (
                <li key={c.id} className="group/ch relative">
                  <button
                    onClick={() => onOpen(c)}
                    className={cls(
                      'flex w-full items-center gap-1.5 rounded-md py-1 pl-2 pr-8 text-left text-sm',
                      active ? 'bg-amber-100 font-medium text-amber-950 dark:bg-amber-900/40 dark:text-amber-100' : 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800',
                      n > 0 && !active && 'font-semibold text-stone-900 dark:text-white',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <IconHash size={14} className="shrink-0 opacity-60" />
                    <span className="truncate">{c.name}</span>
                    {n > 0 && !active && <span className="ml-auto rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold text-white">{n > 99 ? '99+' : n}</span>}
                  </button>
                  {manage && (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/ch:opacity-100">
                      <Menu label={`#${c.name} options`}>
                        <MenuItem icon={<IconPencil size={13} />} onClick={() => onEditChannel(c)}>Edit channel</MenuItem>
                        <MenuItem icon={<IconArrowUp size={13} />} disabled={i === 0} onClick={() => moveChannel(c, -1)}>Move up</MenuItem>
                        <MenuItem icon={<IconArrowDown size={13} />} disabled={i === list.length - 1} onClick={() => moveChannel(c, 1)}>Move down</MenuItem>
                        {cats.filter((k) => k.id !== c.category_id).map((k) => (
                          <MenuItem key={k.id} icon={<IconFolder size={13} />} onClick={() => moveTo(c, k.id)}>Move to {k.name}</MenuItem>
                        ))}
                        {c.category_id && <MenuItem icon={<IconFolder size={13} />} onClick={() => moveTo(c, null)}>Remove from category</MenuItem>}
                        <MenuItem icon={<IconArchive size={13} />} onClick={() => saveChannel({ id: c.id, archived_at: new Date().toISOString() }).catch(() => undefined)}>Archive</MenuItem>
                      </Menu>
                    </span>
                  )}
                </li>
              );
            })}
            {list.length === 0 && <li className="px-2 py-1 text-xs text-stone-400">No channels</li>}
          </ul>
        )}
      </div>
    );
  };

  const loose = inCat(null);
  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-stone-200 px-4 dark:border-stone-800">
        <h1 className="font-serif text-lg font-semibold">Team chat</h1>
        {manage && (
          <Menu label="Add" icon={<IconPlus size={16} />}>
            <MenuItem icon={<IconHash size={13} />} onClick={() => onEditChannel({})}>New channel</MenuItem>
            <MenuItem icon={<IconFolder size={13} />} onClick={() => onEditCategory({})}>New category</MenuItem>
          </Menu>
        )}
      </div>
      <nav aria-label="Channels" className="flex-1 overflow-y-auto py-3">
        {cats.map((k, i) => section(k.id, k.name, inCat(k.id), k, i))}
        {(loose.length > 0 || cats.length === 0) && section('__loose', cats.length ? 'Other channels' : 'Channels', loose)}
        {archived.length > 0 && (
          <div className="mt-3 border-t border-stone-200 px-2 pt-2 dark:border-stone-800">
            <button onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-1 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-700 dark:hover:text-stone-200">
              {showArchived ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />} Archived ({archived.length})
            </button>
            {showArchived && (
              <ul className="mt-0.5 space-y-px">
                {archived.map((c) => (
                  <li key={c.id} className="group/ar flex items-center">
                    <button onClick={() => onOpen(c)} className={cls('flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pl-2 text-left text-sm text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800', c.id === currentId && 'bg-stone-200/70 dark:bg-stone-800')}>
                      <IconHash size={14} className="shrink-0" /> <span className="truncate">{c.name}</span>
                    </button>
                    {manage && (
                      <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/ar:opacity-100">
                        <Menu label={`#${c.name} options`}>
                          <MenuItem icon={<IconArchive size={13} />} onClick={() => saveChannel({ id: c.id, archived_at: null }).catch(() => undefined)}>Unarchive</MenuItem>
                          <MenuItem
                            icon={<IconTrash size={13} />}
                            danger
                            onClick={async () => {
                              if (await confirm({ title: `Delete #${c.name}?`, body: 'Every message in it goes too. This can’t be undone.', confirmLabel: 'Delete channel' }))
                                deleteChannel(c.id).catch(() => undefined);
                            }}
                          >
                            Delete forever
                          </MenuItem>
                        </Menu>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>
    </>
  );
}

// ─── one channel ─────────────────────────────────────────────────────────────
function useChatPeople(): Person[] {
  const { roles } = useStore();
  const { session } = useAuth();
  const people = usePeople();
  return people.list.filter((p) => p.id !== session?.user.id && roles.matrix[p.role].has('chat:read'));
}

function ChannelView({ channel, onBack, onEdit }: { channel: ChatChannel; onBack: () => void; onEdit: () => void }) {
  const { messages, send, markRead, reads } = useCollab();
  const { can, session } = useAuth();
  const [params, setParams] = useSearchParams();
  const people = useChatPeople();
  const everyone = usePeople();
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
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
  const pinned = list.filter((m) => m.pinned);
  const firstNew = readMark ? list.find((m) => m.created_at > readMark && m.author_id !== session?.user.id)?.id : undefined;

  // reading the channel marks it read (and keeps it read while new messages arrive)
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(channel.id);
  }, [channel.id, list.length, markRead]);

  // stick to the bottom like a chat should, unless you've scrolled up to read history
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current && !focus) el.scrollTop = el.scrollHeight;
  }, [list.length, focus]);

  // a link to a specific message (from a mention) scrolls to it and opens its thread
  useEffect(() => {
    if (!focus) return;
    const m = messages.find((x) => x.id === focus);
    if (!m) return;
    if (m.parent_id) setThread(m.parent_id);
    const t = window.setTimeout(() => {
      document.getElementById(`msg-${m.parent_id ?? m.id}`)?.scrollIntoView({ block: 'center' });
      const next = new URLSearchParams(params);
      next.delete('message');
      setParams(next, { replace: true });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focus, messages, params, setParams]);

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    nearBottom.current = true;
    try {
      await send(channel.id, body, extractMentions(body, people));
    } catch {
      setDraft(body);
    }
  };

  const archived = !!channel.archived_at;
  const canPost = can('chat:write') && !archived;
  const openThread = thread ? list.find((m) => m.id === thread) ?? null : null;

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 px-3 dark:border-stone-800">
          <IconButton label="All channels" className="md:hidden" onClick={onBack}><IconChevronLeft size={18} /></IconButton>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 font-semibold"><IconHash size={15} className="opacity-60" /> <span className="truncate">{channel.name}</span>{archived && <span className="ml-1 text-xs font-normal text-stone-400">(archived)</span>}</div>
            {channel.topic && <div className="truncate text-xs text-stone-500">{channel.topic}</div>}
          </div>
          <button
            onClick={() => setShowPins((s) => !s)}
            className={cls('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', showPins ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800')}
            aria-pressed={showPins}
            title="Pinned messages"
          >
            <IconPin size={14} /> {pinned.length}
          </button>
          {can('chat:manage') && <IconButton label="Edit channel" onClick={onEdit}><IconPencil size={14} /></IconButton>}
        </header>

        {showPins && (
          <div className="max-h-48 shrink-0 overflow-y-auto border-b border-stone-200 bg-amber-50/50 px-4 py-2 dark:border-stone-800 dark:bg-amber-950/20">
            {pinned.length === 0 ? (
              <p className="text-xs text-stone-500">Nothing pinned. Pin decisions, addresses and links people keep asking for.</p>
            ) : (
              <ul className="space-y-1.5">
                {pinned.map((m) => (
                  <li key={m.id}>
                    <button className="w-full text-left text-sm hover:underline" onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
                      <span className="font-medium">{everyone.name(m.author_id)}:</span> <span className="text-stone-700 dark:text-stone-300">{m.body.slice(0, 140)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div
          ref={scroller}
          className="flex-1 overflow-y-auto py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {list.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><IconHash size={22} /></div>
              <div className="mt-3 font-serif text-xl font-semibold">Welcome to #{channel.name}</div>
              <p className="mt-1 text-sm text-stone-500">{channel.topic || 'This is the start of the channel.'}</p>
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
                  <MessageRow m={m} compact={compact} replies={replies.get(m.id) ?? []} people={people} onThread={() => setThread(m.id)} highlight={m.id === thread} />
                </Fragment>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t border-stone-200 p-3 dark:border-stone-800">
          {canPost ? (
            <>
              <MentionInput value={draft} onChange={setDraft} people={people} onSubmit={post} enterSends rows={2} placeholder={`Message #${channel.name}`} />
              <div className="mt-1 flex items-center justify-between text-[11px] text-stone-400">
                <span>Enter to send · Shift+Enter for a new line · @ to tag someone</span>
                <Button size="sm" variant="primary" onClick={post} disabled={!draft.trim()}>Send</Button>
              </div>
            </>
          ) : (
            <p className="py-2 text-center text-sm text-stone-500">{archived ? 'This channel is archived. Unarchive it to post again.' : whyNot('chat:write')}</p>
          )}
        </div>
      </div>

      {openThread && (
        <ThreadPane parent={openThread} channelName={channel.name} replies={replies.get(openThread.id) ?? []} people={people} canPost={canPost} onClose={() => setThread(null)} />
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
    <div className="my-3 flex items-center gap-3 px-4">
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-[11px] font-medium text-stone-500 dark:border-stone-700">{label}</span>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}

function MessageRow({ m, compact, replies, people, onThread, highlight, inThread, threadSize = replies.length }: {
  m: ChatMessage; compact: boolean; replies: ChatMessage[]; people: Person[]; onThread?: () => void; highlight?: boolean; inThread?: boolean;
  /** replies that go with this message if it's deleted (the thread pane passes them in) */
  threadSize?: number;
}) {
  const { editMessage, deleteMessage, setPinned } = useCollab();
  const confirm = useConfirm();
  const { session, can } = useAuth();
  const everyone = usePeople();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const mine = m.author_id === session?.user.id;
  const name = everyone.name(m.author_id);
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const saveEdit = () => editMessage(m.id, text.trim(), extractMentions(text, people)).then(() => setEditing(false)).catch(() => undefined);
  const lastReply = replies[replies.length - 1];
  const tagged = m.mentions.includes(session?.user.id ?? '');

  return (
    <div
      id={inThread ? undefined : `msg-${m.id}`}
      className={cls(
        'group relative flex gap-3 px-4 hover:bg-stone-50 dark:hover:bg-stone-800/40',
        compact ? 'py-0.5' : 'pt-2 pb-0.5',
        highlight && 'bg-amber-50 dark:bg-amber-950/30',
        tagged && 'border-l-2 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20',
      )}
    >
      <div className="w-8 shrink-0">
        {compact ? (
          <span className="invisible block pt-0.5 text-right text-[10px] text-stone-400 group-hover:visible">{time}</span>
        ) : (
          <Avatar name={name} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-[11px] text-stone-400" title={new Date(m.created_at).toLocaleString()}>{time}</span>
            {m.pinned && <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-400"><IconPin size={11} /> pinned</span>}
          </div>
        )}
        {editing ? (
          <div className="my-1 space-y-1.5">
            <MentionInput value={text} onChange={setText} people={people} rows={2} autoFocus enterSends onSubmit={saveEdit} />
            <div className="flex gap-1.5 text-xs">
              <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={saveEdit} disabled={!text.trim()}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">
            <RichText body={m.body} mentioned={m.mentions} people={everyone.list} meId={session?.user.id} />
            {m.edited_at && <span className="ml-1 text-[11px] text-stone-400">(edited)</span>}
            {compact && m.pinned && <span className="ml-1 inline-flex items-center text-amber-700 dark:text-amber-400" title="Pinned"><IconPin size={11} /></span>}
          </div>
        )}
        {!inThread && replies.length > 0 && (
          <button onClick={onThread} className="mt-1 inline-flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs hover:bg-white dark:hover:bg-stone-900">
            <span className="flex -space-x-1">{[...new Set(replies.map((r) => r.author_id))].slice(0, 3).map((a) => <Avatar key={a ?? 'x'} name={everyone.name(a)} size="sm" />)}</span>
            <span className="font-semibold text-amber-800 dark:text-amber-400">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
            <span className="text-stone-400">last {timeAgo(lastReply.created_at)}</span>
          </button>
        )}
      </div>

      {!editing && (
        <div className="absolute -top-3 right-3 hidden items-center rounded-lg border border-stone-200 bg-white shadow-sm group-hover:flex focus-within:flex dark:border-stone-700 dark:bg-stone-900">
          {!inThread && onThread && can('chat:write') && <IconButton label="Reply in thread" className="h-7 w-7" onClick={onThread}><IconReply size={14} /></IconButton>}
          {can('chat:write') && !m.parent_id && (
            <IconButton label={m.pinned ? 'Unpin' : 'Pin to channel'} className="h-7 w-7" onClick={() => setPinned(m.id, !m.pinned).catch(() => undefined)}>
              <IconPin size={14} className={m.pinned ? 'text-amber-600' : undefined} />
            </IconButton>
          )}
          {mine && <IconButton label="Edit" className="h-7 w-7" onClick={() => { setText(m.body); setEditing(true); }}><IconPencil size={13} /></IconButton>}
          {(mine || can('chat:manage')) && (
            <IconButton label="Delete" className="h-7 w-7" onClick={async () => {
              const ok = await confirm(
                m.parent_id
                  ? { title: 'Delete this reply?', body: 'This can’t be undone.' }
                  : threadSize
                    ? { title: 'Delete this message and its thread?', body: `Its ${threadSize} ${threadSize === 1 ? 'reply goes' : 'replies go'} too. This can’t be undone.` }
                    : { title: 'Delete this message?', body: 'This can’t be undone.' },
              );
              if (ok) deleteMessage(m.id).catch(() => undefined);
            }}>
              <IconTrash size={13} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadPane({ parent, channelName, replies, people, canPost, onClose }: {
  parent: ChatMessage; channelName: string; replies: ChatMessage[]; people: Person[]; canPost: boolean; onClose: () => void;
}) {
  const { send } = useCollab();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const sorted = [...replies].sort((a, b) => a.created_at.localeCompare(b.created_at));
  // Keep the newest reply in view. Scroll only this pane (scrollIntoView would also move
  // the page), and never return a value from an effect: newer browsers make
  // scrollIntoView return a promise, and React calls whatever an effect returns as cleanup.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length]);
  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await send(parent.channel_id, body, extractMentions(body, people), parent.id);
    } catch {
      setDraft(body);
    }
  };
  return (
    // wide screens: a column beside the conversation. Narrower: it takes over the
    // conversation area only — the app's navigation and header stay put.
    <aside className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-stone-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:border-l lg:border-stone-200 lg:dark:border-stone-800" aria-label="Thread">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-3 dark:border-stone-800">
        <button onClick={onClose} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 lg:hidden">
          <IconChevronLeft size={16} /> #{channelName}
        </button>
        <span className="font-semibold">Thread</span>
        <IconButton label="Close thread" onClick={onClose}><IconX size={16} /></IconButton>
      </header>
      <div ref={scroller} className="flex-1 overflow-y-auto py-2">
        <MessageRow m={parent} compact={false} replies={[]} threadSize={sorted.length} people={people} inThread />
        <div className="my-2 flex items-center gap-2 px-4 text-xs text-stone-400">
          {sorted.length ? `${sorted.length} ${sorted.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>
        {sorted.map((m, i) => {
          const prev = sorted[i - 1];
          const compact = !!prev && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
          return <MessageRow key={m.id} m={m} compact={compact} replies={[]} people={people} inThread />;
        })}
      </div>
      {canPost && (
        <div className="shrink-0 border-t border-stone-200 p-3 dark:border-stone-800">
          <MentionInput value={draft} onChange={setDraft} people={people} onSubmit={post} enterSends rows={2} placeholder="Reply in thread…" />
        </div>
      )}
    </aside>
  );
}

// ─── editors ─────────────────────────────────────────────────────────────────
function ChannelEditor({ channel, categories, onClose, onSaved }: { channel: Partial<ChatChannel>; categories: ChatCategory[]; onClose: () => void; onSaved: (c: ChatChannel) => void }) {
  const { saveChannel, channels } = useCollab();
  const [name, setName] = useState(channel.name ?? '');
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [category, setCategory] = useState(channel.category_id ?? '');
  const [busy, setBusy] = useState(false);
  const slug = slugify(name);
  const taken = channels.some((c) => c.name === slug && c.id !== channel.id);
  const save = async () => {
    if (!slug || taken) return;
    setBusy(true);
    try {
      const siblings = channels.filter((c) => (c.category_id ?? '') === category && !c.archived_at);
      const saved = await saveChannel({
        ...(channel.id ? { id: channel.id } : { position: siblings.length }),
        name: slug,
        topic: topic.trim(),
        category_id: category || null,
      });
      if (saved && !channel.id) onSaved(saved);
      onClose();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={channel.id ? `Edit #${channel.name}` : 'New channel'}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !slug || taken}>{channel.id ? 'Save' : 'Create channel'}</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" hint={taken ? 'There is already a channel with that name.' : slug && slug !== name ? `Will be #${slug}` : 'Lowercase, no spaces — like #flowers or #hen-weekend.'}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="flowers" maxLength={60} autoFocus />
        </Field>
        <Field label="Topic" hint="Optional: what this channel is for.">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Florist quotes, colours and the ceremony arch" maxLength={250} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {[...categories].sort((a, b) => a.position - b.position).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function CategoryEditor({ category, onClose }: { category: Partial<ChatCategory>; onClose: () => void }) {
  const { saveCategory, categories } = useCollab();
  const [name, setName] = useState(category.name ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveCategory({ ...(category.id ? { id: category.id } : { position: categories.length }), name: name.trim() });
      onClose();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={category.id ? 'Rename category' : 'New category'}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>{category.id ? 'Save' : 'Create category'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" hint="Categories group channels in the sidebar, like “Suppliers” or “Family”.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="Suppliers" />
        </Field>
      </form>
    </Modal>
  );
}

// ─── a tiny menu ─────────────────────────────────────────────────────────────
// Rendered in a portal at fixed coordinates: inside the channel list it would be
// clipped by the scrolling sidebar and painted under the rows that follow it.
const MENU_W = 208;

function Menu({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
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
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAt(null);
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
        className={cls('h-6 w-6', at && 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100')}
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={() => (at ? setAt(null) : (setAt({ top: -9999, left: -9999 }), requestAnimationFrame(place)))}
      >
        {icon ?? <IconMore size={14} />}
      </IconButton>
      {at &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            style={{ top: at.top, left: at.left, width: MENU_W }}
            className="fixed z-[60] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 text-sm text-stone-800 shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            onClick={() => setAt(null)}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({ children, onClick, icon, disabled, danger }: { children: ReactNode; onClick: () => void; icon?: ReactNode; disabled?: boolean; danger?: boolean }) {
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
