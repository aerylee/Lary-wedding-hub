// Views across the whole chat: saved items, every file, search results, and the
// ⌘K channel switcher.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCollab, usePeople } from '@/lib/collab';
import type { ChatChannel } from '@/lib/types';
import { cls, timeAgo } from '@/lib/util';
import { IconButton } from '@/components/kit';
import { IconBookmark, IconChevronLeft, IconHash, IconImage, IconNote, IconSearch } from '@/components/icons';
import { Avatar } from '@/components/MentionInput';
import { FileCard, FileGallery } from './Files';
import { plainText } from './format';
import { excerpt, highlight, searchChat } from './search';

function ViewShell({ title, icon, sub, onBack, children }: { title: string; icon: ReactNode; sub?: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 px-3 dark:border-stone-800">
        <IconButton label="All channels" className="md:hidden" onClick={onBack}><IconChevronLeft size={18} /></IconButton>
        <span className="text-stone-400">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          {sub && <div className="truncate text-xs text-stone-500">{sub}</div>}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Mark({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((p, i) =>
        p.hit ? <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-700/60">{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

export function SavedView({ onJump, onBack }: { onJump: (channelId: string, messageId: string) => void; onBack: () => void }) {
  const { saved, messages, channels, toggleSaved } = useCollab();
  const people = usePeople();
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const items = [...saved].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((s) => ({ s, m: byId.get(s.message_id) })).filter((x) => x.m);
  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'channel';
  return (
    <ViewShell title="Saved items" icon={<IconBookmark size={16} />} sub="Only you can see what you've saved" onBack={onBack}>
      {items.length === 0 ? (
        <Empty icon={<IconBookmark size={22} />} title="Nothing saved yet" body="Hover a message and click the bookmark to keep it here — addresses, decisions, links you'll want again." />
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map(({ s, m }) => (
            <li key={s.message_id} className="group flex gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/40">
              <Avatar name={people.name(m!.author_id)} size="sm" />
              <button className="min-w-0 flex-1 text-left" onClick={() => onJump(m!.channel_id, m!.id)}>
                <div className="text-xs text-stone-500">
                  <span className="font-medium text-stone-800 dark:text-stone-200">{people.name(m!.author_id)}</span> in #{chName(m!.channel_id)} · {timeAgo(m!.created_at)}
                </div>
                <div className="mt-0.5 line-clamp-3 text-sm">{plainText(m!.body) || 'A file'}</div>
              </button>
              <button className="self-start text-xs text-stone-400 opacity-0 hover:text-stone-700 group-hover:opacity-100 dark:hover:text-stone-200" onClick={() => toggleSaved(m!.id).catch(() => undefined)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  );
}

export function FilesView({ onJump, onBack }: { onJump: (channelId: string, messageId: string) => void; onBack: () => void }) {
  const { files, channels } = useCollab();
  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'channel';
  return (
    <ViewShell title="All files" icon={<IconImage size={16} />} sub={`${files.length} shared across every channel`} onBack={onBack}>
      <FileGallery files={files} channelName={chName} empty="No files yet. Drop photos, quotes and contracts into any channel." onJump={(f) => onJump(f.channel_id, f.message_id)} />
    </ViewShell>
  );
}

export function SearchView({ q, onJump, onOpenNote, onBack }: {
  q: string; onJump: (channelId: string, messageId: string) => void; onOpenNote: (channelId: string) => void; onBack: () => void;
}) {
  const { messages, files, notes, channels } = useCollab();
  const people = usePeople();
  const hits = useMemo(() => searchChat(q, { messages, files, notes, channels }), [q, messages, files, notes, channels]);
  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'channel';
  const msgHits = hits.filter((h) => h.kind === 'message');
  const fileHits = hits.filter((h) => h.kind === 'file');
  const noteHits = hits.filter((h) => h.kind === 'note');
  return (
    <ViewShell title={`Results for “${q}”`} icon={<IconSearch size={16} />} sub={`${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`} onBack={onBack}>
      {hits.length === 0 ? (
        <Empty icon={<IconSearch size={22} />} title="No matches" body="Try fewer words, or a name, place or file name." />
      ) : (
        <div className="space-y-4 py-3">
          {noteHits.length > 0 && (
            <Group title="Channel notes">
              {noteHits.map((h) => h.kind === 'note' && (
                <li key={h.note.channel_id}>
                  <button className="flex w-full gap-3 px-4 py-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800/40" onClick={() => onOpenNote(h.note.channel_id)}>
                    <IconNote size={16} className="mt-0.5 shrink-0 text-stone-400" />
                    <span className="min-w-0">
                      <span className="block text-xs text-stone-500">Notes in #{chName(h.note.channel_id)}</span>
                      <span className="line-clamp-2 block text-sm"><Mark text={excerpt(h.text, q)} q={q} /></span>
                    </span>
                  </button>
                </li>
              ))}
            </Group>
          )}
          {msgHits.length > 0 && (
            <Group title="Messages">
              {msgHits.map((h) => h.kind === 'message' && (
                <li key={h.message.id}>
                  <button className="flex w-full gap-3 px-4 py-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800/40" onClick={() => onJump(h.message.channel_id, h.message.id)}>
                    <Avatar name={people.name(h.message.author_id)} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-xs text-stone-500">
                        <span className="font-medium text-stone-800 dark:text-stone-200">{people.name(h.message.author_id)}</span> in #{chName(h.message.channel_id)}{h.message.parent_id && ' (thread)'} · {timeAgo(h.message.created_at)}
                      </span>
                      <span className="line-clamp-2 block text-sm"><Mark text={excerpt(h.text, q)} q={q} /></span>
                    </span>
                  </button>
                </li>
              ))}
            </Group>
          )}
          {fileHits.length > 0 && (
            <Group title="Files">
              {fileHits.map((h) => h.kind === 'file' && (
                <li key={h.file.id} className="px-4 py-1">
                  <FileCard file={h.file} />
                  <button className="mt-0.5 pl-1 text-[11px] text-amber-700 hover:underline dark:text-amber-400" onClick={() => onJump(h.file.channel_id, h.file.message_id)}>
                    Show in #{chName(h.file.channel_id)}
                  </button>
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
    </ViewShell>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function Empty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400 dark:bg-stone-800">{icon}</div>
      <div className="mt-3 font-serif text-lg font-semibold">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{body}</p>
    </div>
  );
}

/** ⌘K / Ctrl+K: jump to any channel by typing a few letters. */
export function QuickSwitcher({ onOpen, onClose }: { onOpen: (c: ChatChannel) => void; onClose: () => void }) {
  const { channels, unread, starred } = useCollab();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return channels
      .filter((c) => !c.archived_at && words.every((w) => c.name.includes(w) || c.topic.toLowerCase().includes(w)))
      .sort((a, b) =>
        (unread.get(b.id) ?? 0 ? 1 : 0) - (unread.get(a.id) ?? 0 ? 1 : 0) ||
        (starred.has(b.id) ? 1 : 0) - (starred.has(a.id) ? 1 : 0) ||
        a.name.localeCompare(b.name),
      )
      .slice(0, 12);
  }, [channels, unread, starred, q]);
  useEffect(() => {
    setI(0);
  }, [q]);

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-stone-950/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Jump to a channel" className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-stone-900">
        <div className="flex items-center gap-2 border-b border-stone-100 px-3 dark:border-stone-800">
          <IconSearch size={16} className="text-stone-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter' && list[i]) { e.preventDefault(); onOpen(list[i]); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Jump to a channel…"
            aria-label="Channel name"
            className="h-12 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-400 dark:border-stone-700">esc</kbd>
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {list.map((c, k) => {
            const n = unread.get(c.id) ?? 0;
            return (
              <li key={c.id} role="option" aria-selected={k === i}>
                <button
                  onMouseEnter={() => setI(k)}
                  onClick={() => onOpen(c)}
                  className={cls('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', k === i && 'bg-amber-50 dark:bg-stone-800')}
                >
                  <IconHash size={14} className="text-stone-400" />
                  <span className={cls('font-medium', n > 0 && 'font-semibold')}>{c.name}</span>
                  {c.topic && <span className="truncate text-xs text-stone-400">{c.topic}</span>}
                  {n > 0 && <span className="ml-auto rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold text-white">{n}</span>}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-stone-500">No channel matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}
