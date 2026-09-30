// The right-hand column of a channel: a thread, or the channel's details (a shared
// note, pinned messages, files, about). On wide screens it sits beside the
// conversation; narrower, it covers only the conversation area, with a way back.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useCollab, usePeople, type PendingFile } from '@/lib/collab';
import type { ChatChannel, ChatFile, ChatMessage, ChatReaction } from '@/lib/types';
import { cls, fmtDate, timeAgo } from '@/lib/util';
import { IconButton, Segmented } from '@/components/kit';
import { IconChevronLeft, IconX } from '@/components/icons';
import { Avatar, type Person } from '@/components/MentionInput';
import { Composer } from './Composer';
import { FileGallery } from './Files';
import { Formatted, plainText } from './format';
import { MessageRow } from './MessageRow';

function PanelShell({ title, back, onClose, children }: { title: ReactNode; back: string; onClose: () => void; children: ReactNode }) {
  return (
    <aside
      className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-stone-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 xl:w-96"
      aria-label={typeof title === 'string' ? title : 'Details'}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-3 dark:border-stone-800">
        <button onClick={onClose} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 lg:hidden">
          <IconChevronLeft size={16} /> #{back}
        </button>
        <span className="truncate font-semibold">{title}</span>
        <IconButton label="Close" onClick={onClose}><IconX size={16} /></IconButton>
      </header>
      {children}
    </aside>
  );
}

// ─── thread ──────────────────────────────────────────────────────────────────
export function ThreadPane({ parent, channelName, replies, filesFor, reactionsFor, people, canPost, onClose }: {
  parent: ChatMessage; channelName: string; replies: ChatMessage[];
  filesFor: (id: string) => ChatFile[]; reactionsFor: (id: string) => ChatReaction[];
  people: Person[]; canPost: boolean; onClose: () => void;
}) {
  const { send } = useCollab();
  const { session } = useAuth();
  const [editing, setEditing] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...replies].sort((a, b) => a.created_at.localeCompare(b.created_at)), [replies]);
  // Keep the newest reply in view. Scroll only this pane, and never return a value from
  // an effect (newer browsers make scroll methods return promises).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length]);

  const lastMine = [...sorted].reverse().find((m) => m.author_id === session?.user.id);
  return (
    <PanelShell title="Thread" back={channelName} onClose={onClose}>
      <div ref={scroller} className="flex-1 overflow-y-auto py-2">
        <MessageRow m={parent} compact={false} replies={[]} files={filesFor(parent.id)} reactions={reactionsFor(parent.id)} threadSize={sorted.length} people={people} inThread />
        <div className="my-2 flex items-center gap-2 px-4 text-xs text-stone-400">
          {sorted.length ? `${sorted.length} ${sorted.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>
        {sorted.map((m, i) => {
          const prev = sorted[i - 1];
          const compact = !!prev && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
          return (
            <MessageRow
              key={m.id}
              m={m}
              compact={compact}
              replies={[]}
              files={filesFor(m.id)}
              reactions={reactionsFor(m.id)}
              people={people}
              inThread
              editing={editing === m.id}
              onEditStart={() => setEditing(m.id)}
              onEditEnd={() => setEditing(null)}
            />
          );
        })}
      </div>
      {canPost && (
        <Composer
          channelId={parent.channel_id}
          where={`thread:${parent.id}`}
          placeholder="Reply in thread…"
          people={people}
          compact
          onSend={(body, mentions, files: PendingFile[]) => send(parent.channel_id, body, mentions, parent.id, files)}
          onEditLast={lastMine ? () => setEditing(lastMine.id) : undefined}
        />
      )}
    </PanelShell>
  );
}

// ─── channel details ─────────────────────────────────────────────────────────
export type DetailsTab = 'notes' | 'pinned' | 'files' | 'about';

export function DetailsPanel({ channel, tab, onTab, pinned, files, people, onJump, onClose }: {
  channel: ChatChannel; tab: DetailsTab; onTab: (t: DetailsTab) => void; pinned: ChatMessage[]; files: ChatFile[];
  people: Person[]; onJump: (id: string) => void; onClose: () => void;
}) {
  const everyone = usePeople();
  const { session } = useAuth();
  return (
    <PanelShell title={`#${channel.name}`} back={channel.name} onClose={onClose}>
      <div className="border-b border-stone-200 px-3 py-2 dark:border-stone-800">
        <Segmented<DetailsTab>
          size="sm"
          value={tab}
          onChange={onTab}
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'pinned', label: 'Pinned', count: pinned.length || undefined },
            { value: 'files', label: 'Files', count: files.length || undefined },
            { value: 'about', label: 'About' },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === 'notes' && <NotesTab channel={channel} />}
        {tab === 'pinned' && (
          pinned.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">Nothing pinned. Pin decisions, addresses and links people keep asking for — use ⋯ on a message.</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {pinned.map((m) => (
                <li key={m.id}>
                  <button className="flex w-full gap-2.5 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50" onClick={() => onJump(m.id)}>
                    <Avatar name={everyone.name(m.author_id)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-stone-500"><span className="font-medium text-stone-800 dark:text-stone-200">{everyone.name(m.author_id)}</span> · {timeAgo(m.created_at)}</span>
                      <span className="line-clamp-3 block text-sm">{plainText(m.body) || 'A file'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
        {tab === 'files' && <FileGallery files={files} empty="No files yet. Attach, drop or paste them into the message box." onJump={(f) => onJump(f.message_id)} />}
        {tab === 'about' && (
          <dl className="space-y-4 px-4 py-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Topic</dt>
              <dd className="mt-0.5">{channel.topic || <span className="text-stone-400">No topic</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Created</dt>
              <dd className="mt-0.5">{fmtDate(channel.created_at.slice(0, 10), { year: true })}{channel.created_by && ` by ${everyone.name(channel.created_by)}`}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Who can see it</dt>
              <dd className="mt-1 space-y-1.5">
                {[...people, ...everyone.list.filter((p) => p.id === session?.user.id)].map((p) => (
                  <div key={p.id} className="flex items-center gap-2"><Avatar name={p.name} size="sm" /> <span>{p.name}</span><span className="text-xs text-stone-400">{p.email}</span></div>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </PanelShell>
  );
}

/** The channel's shared note: write freely, it saves itself. */
function NotesTab({ channel }: { channel: ChatChannel }) {
  const { notes, saveNote } = useCollab();
  const { can, session } = useAuth();
  const everyone = usePeople();
  const note = notes.find((n) => n.channel_id === channel.id) ?? null;
  const [text, setText] = useState(note?.body ?? '');
  const [mode, setMode] = useState<'edit' | 'view'>(note?.body ? 'view' : 'edit');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const dirty = useRef(false);
  const canWrite = can('chat:write');

  // someone else's edit arrives: take it unless you're mid-sentence
  useEffect(() => {
    if (!dirty.current) setText(note?.body ?? '');
  }, [note?.body]);

  // autosave a moment after you stop typing
  useEffect(() => {
    if (!dirty.current) return;
    setState('saving');
    const t = window.setTimeout(() => {
      saveNote(channel.id, text).then(
        () => {
          dirty.current = false;
          setState('saved');
        },
        () => setState('failed'),
      );
    }, 800);
    return () => window.clearTimeout(t);
  }, [text, channel.id, saveNote]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs text-stone-500">
        <span>
          {state === 'saving' ? 'Saving…' : state === 'failed' ? <span className="text-rose-600">Not saved — check your connection</span> : note?.updated_at ? (
            <>Edited by {note.updated_by === session?.user.id ? 'you' : everyone.name(note.updated_by)} · {timeAgo(note.updated_at)}</>
          ) : 'A shared note for this channel'}
        </span>
        {canWrite && (
          <div className="flex gap-1">
            <button className={cls('rounded px-1.5 py-0.5', mode === 'edit' ? 'bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100' : 'hover:bg-stone-100 dark:hover:bg-stone-800')} onClick={() => setMode('edit')}>Write</button>
            <button className={cls('rounded px-1.5 py-0.5', mode === 'view' ? 'bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100' : 'hover:bg-stone-100 dark:hover:bg-stone-800')} onClick={() => setMode('view')}>Preview</button>
          </div>
        )}
      </div>
      {mode === 'edit' && canWrite ? (
        <textarea
          value={text}
          onChange={(e) => {
            dirty.current = true;
            setText(e.target.value);
          }}
          maxLength={50000}
          aria-label={`Notes for #${channel.name}`}
          placeholder={'Things worth keeping in one place:\n\n- Addresses and door codes\n- Who is bringing what\n- Links to quotes and contracts\n\n**Bold**, _italic_, lists and links all work.'}
          className="m-3 min-h-[16rem] flex-1 resize-none rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-[13px] leading-relaxed text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
        />
      ) : (
        <div className="px-4 py-3 text-sm leading-relaxed">
          {text.trim() ? <Formatted body={text} mentioned={[]} people={[]} /> : <p className="text-stone-400">No notes yet.</p>}
        </div>
      )}
    </div>
  );
}
