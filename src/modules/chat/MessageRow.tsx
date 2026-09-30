// One message: author, formatted text, files, reactions, thread summary and actions.
// Actions show on hover, on keyboard focus, and on tap for touch screens.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useCollab, usePeople } from '@/lib/collab';
import type { ChatFile, ChatMessage, ChatReaction } from '@/lib/types';
import { cls, timeAgo } from '@/lib/util';
import { Button, IconButton } from '@/components/kit';
import { useConfirm } from '@/components/Confirm';
import { useToast } from '@/components/toast';
import { IconBookmark, IconCopy, IconPencil, IconPin, IconReply, IconTrash } from '@/components/icons';
import { Avatar, MentionInput, extractMentions, type Person } from '@/components/MentionInput';
import { Formatted } from './format';
import { MessageFiles } from './Files';
import { EmojiGrid, Menu, MenuItem, QUICK_REACTIONS, groupReactions } from './shared';

const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

export function MessageRow({
  m, compact, replies, files, reactions, people, onThread, inThread, threadSize = replies.length, flash, editing, onEditStart, onEditEnd,
}: {
  m: ChatMessage;
  compact: boolean;
  replies: ChatMessage[];
  files: ChatFile[];
  reactions: ChatReaction[];
  people: Person[];
  onThread?: () => void;
  inThread?: boolean;
  /** replies that go with this message if it's deleted (the thread pane passes them in) */
  threadSize?: number;
  flash?: boolean;
  editing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const { editMessage, deleteMessage, setPinned, toggleReaction, saved, toggleSaved } = useCollab();
  const { weddingId } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { session, can } = useAuth();
  const everyone = usePeople();
  const [text, setText] = useState(m.body);
  const [tapped, setTapped] = useState(false);
  const me = session?.user.id ?? '';
  const mine = m.author_id === me;
  const name = everyone.name(m.author_id);
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const full = new Date(m.created_at).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const lastReply = replies[replies.length - 1];
  const tagged = m.mentions.includes(me);
  const isSaved = saved.some((s) => s.message_id === m.id);
  const groups = groupReactions(reactions, me, (id) => everyone.name(id));
  const canWrite = can('chat:write');

  const startEdit = () => {
    setText(m.body);
    onEditStart?.();
  };
  const saveEdit = () => {
    if (!text.trim() && !files.length) return;
    editMessage(m.id, text.trim(), extractMentions(text, people)).then(() => onEditEnd?.()).catch(() => undefined);
  };
  const link = `${window.location.origin}/w/${weddingId}/chat?channel=${m.channel_id}&message=${m.id}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied', 'ok');
    } catch {
      window.prompt('Copy the link:', link);
    }
  };
  const remove = async () => {
    const ok = await confirm(
      m.parent_id
        ? { title: 'Delete this reply?', body: 'This can’t be undone.' }
        : threadSize
          ? { title: 'Delete this message and its thread?', body: `Its ${threadSize} ${threadSize === 1 ? 'reply goes' : 'replies go'} too${files.length ? ', and so do its files' : ''}. This can’t be undone.` }
          : { title: 'Delete this message?', body: files.length ? 'Its files go too. This can’t be undone.' : 'This can’t be undone.' },
    );
    if (ok) deleteMessage(m.id).catch(() => undefined);
  };

  return (
    <div
      id={inThread ? undefined : `msg-${m.id}`}
      data-message={m.id}
      onClick={touch ? () => setTapped((t) => !t) : undefined}
      className={cls(
        'group relative flex gap-3 px-4 hover:bg-stone-50 dark:hover:bg-stone-800/40',
        compact ? 'py-0.5' : 'pb-0.5 pt-2',
        tagged && 'border-l-2 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20',
        flash && 'animate-flash',
        tapped && 'bg-stone-50 dark:bg-stone-800/40',
      )}
    >
      <div className="w-8 shrink-0">
        {compact ? (
          <span className="invisible block pt-0.5 text-right text-[10px] text-stone-400 group-hover:visible" title={full}>{time}</span>
        ) : (
          <Avatar name={name} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-[11px] text-stone-400" title={full}>{time}</span>
            {m.pinned && <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-400"><IconPin size={11} /> pinned</span>}
            {isSaved && <span className="inline-flex items-center gap-0.5 text-[11px] text-sky-700 dark:text-sky-400"><IconBookmark size={11} /> saved</span>}
          </div>
        )}
        {editing ? (
          <div className="my-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <MentionInput
              value={text}
              onChange={setText}
              people={people}
              rows={2}
              autoFocus
              enterSends
              onSubmit={saveEdit}
              onKeyDownExtra={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onEditEnd?.();
                  return true;
                }
                return false;
              }}
            />
            <div className="flex items-center gap-1.5 text-xs">
              <Button size="sm" variant="subtle" onClick={() => onEditEnd?.()}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={saveEdit} disabled={!text.trim() && !files.length}>Save</Button>
              <span className="text-stone-400">Esc to cancel · Enter to save</span>
            </div>
          </div>
        ) : (
          m.body && (
            <div className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">
              <Formatted body={m.body} mentioned={m.mentions} people={everyone.list} meId={me} onHubLink={(href) => navigate(new URL(href).pathname + new URL(href).search)} />
              {m.edited_at && <span className="text-[11px] text-stone-400">(edited)</span>}
            </div>
          )
        )}
        <MessageFiles files={files} />
        {groups.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {groups.map((g) => (
              <button
                key={g.emoji}
                type="button"
                disabled={!canWrite}
                onClick={() => toggleReaction(m.id, g.emoji).catch(() => undefined)}
                title={`${g.who.join(', ')} reacted with ${g.emoji}`}
                aria-pressed={g.mine}
                className={cls(
                  'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums disabled:cursor-default',
                  g.mine
                    ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300',
                )}
              >
                <span className="text-sm leading-none">{g.emoji}</span> {g.count}
              </button>
            ))}
            {canWrite && (
              <Menu label="Add reaction" icon={<span className="text-xs">＋🙂</span>} buttonClass="h-6 w-9 rounded-full border border-stone-200 dark:border-stone-700" width={296}>
                <EmojiGrid onPick={(e) => toggleReaction(m.id, e).catch(() => undefined)} label="React with" />
              </Menu>
            )}
          </div>
        )}
        {!inThread && replies.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onThread?.(); }} className="mt-1 inline-flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs hover:bg-white dark:hover:bg-stone-900">
            <span className="flex -space-x-1">{[...new Set(replies.map((r) => r.author_id))].slice(0, 3).map((a) => <Avatar key={a ?? 'x'} name={everyone.name(a)} size="sm" />)}</span>
            <span className="font-semibold text-amber-800 dark:text-amber-400">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
            <span className="text-stone-400">last {timeAgo(lastReply.created_at)}</span>
          </button>
        )}
      </div>

      {!editing && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cls(
            'absolute -top-3 right-3 z-10 items-center rounded-lg border border-stone-200 bg-white shadow-sm focus-within:flex dark:border-stone-700 dark:bg-stone-900',
            tapped ? 'flex' : 'hidden group-hover:flex',
          )}
        >
          {canWrite && QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-sm hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => toggleReaction(m.id, e).catch(() => undefined)} aria-label={`React with ${e}`} title={`React with ${e}`}>
              {e}
            </button>
          ))}
          {canWrite && (
            <Menu label="More reactions" icon={<span className="text-sm">🙂</span>} buttonClass="h-7 w-7" width={296}>
              <EmojiGrid onPick={(e) => toggleReaction(m.id, e).catch(() => undefined)} label="React with" />
            </Menu>
          )}
          {!inThread && onThread && canWrite && <IconButton label="Reply in thread" className="h-7 w-7" onClick={onThread}><IconReply size={14} /></IconButton>}
          <IconButton label={isSaved ? 'Remove from saved' : 'Save for later'} className="h-7 w-7" onClick={() => toggleSaved(m.id).catch(() => undefined)}>
            <IconBookmark size={13} className={isSaved ? 'text-sky-600' : undefined} />
          </IconButton>
          <Menu label="More actions" buttonClass="h-7 w-7">
            <MenuItem icon={<IconCopy size={13} />} onClick={copyLink}>Copy link</MenuItem>
            {canWrite && !m.parent_id && (
              <MenuItem icon={<IconPin size={13} />} onClick={() => setPinned(m.id, !m.pinned).catch(() => undefined)}>{m.pinned ? 'Unpin from channel' : 'Pin to channel'}</MenuItem>
            )}
            {mine && <MenuItem icon={<IconPencil size={13} />} onClick={startEdit}>Edit message</MenuItem>}
            {(mine || can('chat:manage')) && <MenuItem icon={<IconTrash size={13} />} danger onClick={remove}>Delete message</MenuItem>}
          </Menu>
        </div>
      )}
    </div>
  );
}
