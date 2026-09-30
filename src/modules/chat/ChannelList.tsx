// The chat sidebar: search, saved items, files, starred channels, then channels by
// category (collapsible, reorderable), then the archive.
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useCollab } from '@/lib/collab';
import type { ChatCategory, ChatChannel } from '@/lib/types';
import { cls } from '@/lib/util';
import { IconButton } from '@/components/kit';
import { useConfirm } from '@/components/Confirm';
import {
  IconArchive, IconArrowDown, IconArrowUp, IconBookmark, IconCheck, IconChevronDown, IconChevronRight, IconFolder, IconHash, IconImage,
  IconPencil, IconPlus, IconSearch, IconStar, IconTrash, IconX,
} from '@/components/icons';
import { Menu, MenuItem, keys, local } from './shared';

export type ChatView = 'channel' | 'saved' | 'files' | 'search';

export function ChannelList({ channels, categories, currentId, view, query, onQuery, onView, onOpen, onEditChannel, onEditCategory }: {
  channels: ChatChannel[]; categories: ChatCategory[]; currentId: string | null; view: ChatView; query: string;
  onQuery: (q: string) => void; onView: (v: ChatView) => void; onOpen: (c: ChatChannel) => void;
  onEditChannel: (c: Partial<ChatChannel>) => void; onEditCategory: (c: Partial<ChatCategory>) => void;
}) {
  const { weddingId } = useStore();
  const { can } = useAuth();
  const { reorder, saveChannel, deleteCategory, deleteChannel, unread, starred, toggleStar, saved, files, markAllRead, totalUnread } = useCollab();
  const confirm = useConfirm();
  const manage = can('chat:manage');
  const [folded, setFolded] = useState<Set<string>>(() => new Set(JSON.parse(local.get(keys.folded(weddingId)) ?? '[]') as string[]));
  const [showArchived, setShowArchived] = useState(false);
  const toggleFold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      local.set(keys.folded(weddingId), JSON.stringify([...n]));
      return n;
    });

  const cats = [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const live = channels.filter((c) => !c.archived_at);
  const archived = channels.filter((c) => c.archived_at);
  const stars = live.filter((c) => starred.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
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

  const channelRow = (c: ChatChannel, i: number, list: ChatChannel[], inStars = false) => {
    const n = unread.get(c.id) ?? 0;
    const active = view === 'channel' && c.id === currentId;
    return (
      <li key={(inStars ? 's:' : '') + c.id} className="group/ch relative">
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
        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/ch:opacity-100">
          <Menu label={`#${c.name} options`}>
            <MenuItem icon={<IconStar size={13} />} onClick={() => toggleStar(c.id).catch(() => undefined)}>{starred.has(c.id) ? 'Unstar' : 'Star channel'}</MenuItem>
            {manage && !inStars && (
              <>
                <MenuItem icon={<IconPencil size={13} />} onClick={() => onEditChannel(c)}>Edit channel</MenuItem>
                <MenuItem icon={<IconArrowUp size={13} />} disabled={i === 0} onClick={() => moveChannel(c, -1)}>Move up</MenuItem>
                <MenuItem icon={<IconArrowDown size={13} />} disabled={i === list.length - 1} onClick={() => moveChannel(c, 1)}>Move down</MenuItem>
                {cats.filter((k) => k.id !== c.category_id).map((k) => (
                  <MenuItem key={k.id} icon={<IconFolder size={13} />} onClick={() => moveTo(c, k.id)}>Move to {k.name}</MenuItem>
                ))}
                {c.category_id && <MenuItem icon={<IconFolder size={13} />} onClick={() => moveTo(c, null)}>Remove from category</MenuItem>}
                <MenuItem icon={<IconArchive size={13} />} onClick={() => saveChannel({ id: c.id, archived_at: new Date().toISOString() }).catch(() => undefined)}>Archive</MenuItem>
              </>
            )}
          </Menu>
        </span>
      </li>
    );
  };

  const section = (key: string, title: string, list: ChatChannel[], cat?: ChatCategory, index = 0, isStars = false) => {
    const isFolded = folded.has(key);
    const unreadHidden = isFolded ? list.reduce((a, c) => a + (unread.get(c.id) ?? 0), 0) : 0;
    return (
      <div key={key} className="mb-2">
        <div className="group flex items-center gap-1 px-2">
          <button onClick={() => toggleFold(key)} className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100" aria-expanded={!isFolded}>
            {isFolded ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
            {isStars && <IconStar size={11} className="fill-amber-400 text-amber-500" />}
            <span className="truncate">{title}</span>
            {unreadHidden > 0 && <span className="ml-1 rounded-full bg-amber-600 px-1.5 text-[10px] text-white">{unreadHidden}</span>}
          </button>
          {manage && !isStars && (
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
            {list.map((c, i) => channelRow(c, i, list, isStars))}
            {list.length === 0 && <li className="px-2 py-1 text-xs text-stone-400">No channels</li>}
          </ul>
        )}
      </div>
    );
  };

  const navItem = (v: ChatView, label: string, icon: React.ReactNode, count?: number) => (
    <button
      onClick={() => onView(v)}
      className={cls(
        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
        view === v ? 'bg-amber-100 font-medium text-amber-950 dark:bg-amber-900/40 dark:text-amber-100' : 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800',
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {!!count && <span className="text-xs tabular-nums text-stone-400">{count}</span>}
    </button>
  );

  const loose = inCat(null);
  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-stone-200 px-4 dark:border-stone-800">
        <h1 className="font-serif text-lg font-semibold">Team chat</h1>
        <Menu label="Chat options" icon={manage ? <IconPlus size={16} /> : undefined} buttonClass="h-8 w-8">
          {manage && <MenuItem icon={<IconHash size={13} />} onClick={() => onEditChannel({})}>New channel</MenuItem>}
          {manage && <MenuItem icon={<IconFolder size={13} />} onClick={() => onEditCategory({})}>New category</MenuItem>}
          <MenuItem icon={<IconCheck size={13} />} disabled={!totalUnread} onClick={markAllRead}>Mark all as read</MenuItem>
        </Menu>
      </div>
      <div className="px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Search the chat</span>
          <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            role="searchbox"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search messages, files, notes"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-7 text-sm placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-900"
          />
          {query && (
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:text-stone-700" onClick={() => onQuery('')} aria-label="Clear search">
              <IconX size={13} />
            </button>
          )}
        </label>
        <div className="mt-1 text-right text-[10px] text-stone-400">⌘K to jump to a channel</div>
      </div>
      <nav aria-label="Channels" className="flex-1 overflow-y-auto pb-3 pt-1">
        <div className="mb-3 space-y-px px-2">
          {navItem('saved', 'Saved items', <IconBookmark size={14} />, saved.length)}
          {navItem('files', 'All files', <IconImage size={14} />, files.length)}
        </div>
        {stars.length > 0 && section('__stars', 'Starred', stars, undefined, 0, true)}
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
                    <button onClick={() => onOpen(c)} className={cls('flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pl-2 text-left text-sm text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800', c.id === currentId && view === 'channel' && 'bg-stone-200/70 dark:bg-stone-800')}>
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
                              if (await confirm({ title: `Delete #${c.name}?`, body: 'Every message and file in it goes too. This can’t be undone.', confirmLabel: 'Delete channel' }))
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
