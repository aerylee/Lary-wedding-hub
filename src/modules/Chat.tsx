// Team chat: the hub's place for quick discussion, notes and files. Channels grouped
// into categories, threads, reactions, files and images, a shared note per channel,
// saved items, starred channels, search and a ⌘K switcher. Everything arrives live.
//
// The pieces live in ./chat; this file is the frame and the URL:
//   ?channel=<id>            the open channel
//   &message=<id>            scroll to (and flash) a message
//   &panel=notes             open the channel's notes
//   ?view=saved|files|search the cross-channel views (search reads ?q=)
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useCollab } from '@/lib/collab';
import type { ChatCategory, ChatChannel } from '@/lib/types';
import { cls } from '@/lib/util';
import { Button, Empty, Spinner } from '@/components/kit';
import { IconPlus } from '@/components/icons';
import { ChannelList, type ChatView } from './chat/ChannelList';
import { ChannelView } from './chat/ChannelView';
import { CategoryEditor, ChannelEditor } from './chat/Editors';
import { FilesView, QuickSwitcher, SavedView, SearchView } from './chat/Views';
import { keys, local } from './chat/shared';

export default function Chat() {
  const { weddingId } = useStore();
  const { can } = useAuth();
  const { loaded, channels, categories } = useCollab();
  const [params, setParams] = useSearchParams();
  const [editChannel, setEditChannel] = useState<Partial<ChatChannel> | null>(null);
  const [editCategory, setEditCategory] = useState<Partial<ChatCategory> | null>(null);
  const [mobileList, setMobileList] = useState(!params.get('channel') && !params.get('view'));
  const [switcher, setSwitcher] = useState(false);
  const [query, setQuery] = useState(params.get('q') ?? '');

  const view = (params.get('view') as ChatView | null) ?? 'channel';
  const live = channels.filter((c) => !c.archived_at);
  const requested = params.get('channel');
  const current =
    channels.find((c) => c.id === requested) ??
    channels.find((c) => c.id === local.get(keys.last(weddingId)) && !c.archived_at) ??
    live.find((c) => c.name === 'general') ??
    live[0] ??
    null;

  useEffect(() => {
    if (current) local.set(keys.last(weddingId), current.id);
  }, [current, weddingId]);

  // ⌘K / Ctrl+K opens the channel switcher
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSwitcher((s) => !s);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
    setMobileList(false);
  };
  const open = (c: ChatChannel) => {
    setSwitcher(false);
    go({ channel: c.id, message: null, view: null, panel: null });
  };
  const jump = (channelId: string, messageId: string) => go({ channel: channelId, message: messageId, view: null, panel: null });
  const setView = (v: ChatView) => go({ view: v === 'channel' ? null : v, message: null });
  const search = (q: string) => {
    setQuery(q);
    if (q.trim()) go({ view: 'search', q, message: null });
    else if (view === 'search') go({ view: null, q: null });
  };

  if (!can('chat:read')) {
    return <Empty title="Team chat isn't available to you" body="Your role on this wedding doesn't include the chat. Ask an owner if you need it." />;
  }
  if (!loaded) return <div className="py-16"><Spinner label="Loading the chat…" /></div>;

  const back = () => setMobileList(true);
  let main;
  if (view === 'saved') main = <SavedView onJump={jump} onBack={back} />;
  else if (view === 'files') main = <FilesView onJump={jump} onBack={back} />;
  else if (view === 'search' && query.trim()) main = <SearchView q={query.trim()} onJump={jump} onOpenNote={(id) => go({ channel: id, view: null, panel: 'notes' })} onBack={back} />;
  else if (current) main = <ChannelView key={current.id} channel={current} onBack={back} onEdit={() => setEditChannel(current)} />;
  else {
    main = (
      <Empty
        title="No channels yet"
        body="Channels keep conversations, notes and files about one thing in one place — the venue, the guest list, the band."
        action={can('chat:manage') ? <Button variant="primary" onClick={() => setEditChannel({})}><IconPlus size={14} /> Create a channel</Button> : undefined}
      />
    );
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-3.75rem)] min-h-[420px] overflow-hidden border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:mx-0 sm:my-0 sm:h-[calc(100dvh-7.5rem)] sm:rounded-xl sm:border sm:shadow-sm">
      <aside className={cls('w-full shrink-0 flex-col border-r border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950/40 md:flex md:w-64', mobileList ? 'flex' : 'hidden')}>
        <ChannelList
          channels={channels}
          categories={categories}
          currentId={current?.id ?? null}
          view={view === 'search' && !query.trim() ? 'channel' : view}
          query={query}
          onQuery={search}
          onView={setView}
          onOpen={open}
          onEditChannel={setEditChannel}
          onEditCategory={setEditCategory}
        />
      </aside>
      <section className={cls('min-w-0 flex-1 flex-col', mobileList ? 'hidden md:flex' : 'flex')}>{main}</section>

      {editChannel && <ChannelEditor channel={editChannel} categories={categories} onClose={() => setEditChannel(null)} onSaved={open} />}
      {editCategory && <CategoryEditor category={editCategory} onClose={() => setEditCategory(null)} />}
      {switcher && <QuickSwitcher onOpen={open} onClose={() => setSwitcher(false)} />}
    </div>
  );
}
