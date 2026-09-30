// Comments, @mentions and team chat: loaded once per wedding, kept live over realtime.
// The database decides who sees what (a budget comment is as private as the budget);
// this layer only merges rows and turns refusals into sentences.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME, explain, useStore } from './store';
import { useToast } from '@/components/toast';
import type { ChatCategory, ChatChannel, ChatFile, ChatMessage, ChatNote, ChatReaction, ChatRead, ChatSaved, Comment, Mention } from './types';

const db = supabase as unknown as SupabaseClient;

export type Anchor = {
  /** child-index path from the page root to the element */
  path?: number[];
  /** a stable key when the element carries data-comment-key */
  key?: string;
  tag?: string;
  /** the element's text when the comment was made, to find it again if the page moved */
  text?: string;
  /** where on the element, as fractions of its box */
  x?: number;
  y?: number;
};

/** A file uploaded to storage and waiting to be sent with a message. */
export type PendingFile = { path: string; name: string; size: number; mime: string; width: number | null; height: number | null };

/** Chat files can also be videos; everything else follows the attachment rules. */
export const CHAT_FILE_MIME = new Set([...ATTACHMENT_MIME, 'video/mp4', 'video/quicktime']);

export type NewComment = { page: string; anchor: Anchor; anchor_label: string; body: string; mentions: string[]; parent_id?: string | null };

type Collab = {
  loaded: boolean;
  comments: Comment[];
  addComment: (c: NewComment) => Promise<Comment>;
  editComment: (id: string, body: string, mentions: string[]) => Promise<void>;
  resolveComment: (id: string, resolved: boolean) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;

  mentions: Mention[];
  markMentionsRead: (ids: string[]) => Promise<void>;

  categories: ChatCategory[];
  channels: ChatChannel[];
  messages: ChatMessage[];
  reads: Map<string, string>;
  unread: Map<string, number>;
  totalUnread: number;
  send: (channelId: string, body: string, mentions: string[], parentId?: string | null, files?: PendingFile[]) => Promise<void>;
  editMessage: (id: string, body: string, mentions: string[]) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  markRead: (channelId: string) => void;
  saveChannel: (c: Partial<ChatChannel> & { id?: string }) => Promise<ChatChannel | null>;
  deleteChannel: (id: string) => Promise<void>;
  saveCategory: (c: Partial<ChatCategory> & { id?: string }) => Promise<ChatCategory | null>;
  deleteCategory: (id: string) => Promise<void>;
  reorder: (table: 'chat_channels' | 'chat_categories', rows: { id: string; position: number; category_id?: string | null }[]) => Promise<void>;

  reactions: ChatReaction[];
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  files: ChatFile[];
  uploadFile: (channelId: string, file: File) => Promise<PendingFile>;
  discardUpload: (path: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  signedUrl: (path: string) => Promise<string>;
  notes: ChatNote[];
  saveNote: (channelId: string, body: string) => Promise<void>;
  saved: ChatSaved[];
  toggleSaved: (messageId: string) => Promise<void>;
  starred: Set<string>;
  toggleStar: (channelId: string) => Promise<void>;
  markAllRead: () => void;
  /** who is typing where ("channel id" or "thread:<message id>") */
  typing: Map<string, string[]>;
  notifyTyping: (key: string) => void;
};

const Ctx = createContext<Collab | null>(null);

type WithId = { id: string };
function upsertById<T extends WithId>(list: T[], row: T): T[] {
  const i = list.findIndex((r) => r.id === row.id);
  if (i === -1) return [...list, row];
  const copy = [...list];
  copy[i] = row;
  return copy;
}

export function CollabProvider({ children }: { children: ReactNode }) {
  const { weddingId } = useStore();
  const { session, can, permissions } = useAuth();
  const toast = useToast();
  const uid = session?.user.id ?? '';
  const canChat = can('chat:read');
  const permKey = [...permissions].sort().join(',');

  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readRows, setReadRows] = useState<ChatRead[]>([]);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [saved, setSaved] = useState<ChatSaved[]>([]);
  const [typingRaw, setTypingRaw] = useState<Map<string, Map<string, number>>>(new Map());

  const fail = useCallback(
    (err: { code?: string; message?: string } | null, what: string): never => {
      const msg = explain(err ?? { code: '42501' }, what);
      toast(msg, 'error');
      throw new Error(msg);
    },
    [toast],
  );

  // ─── load + subscribe ────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const none = Promise.resolve({ data: [] });
      const [c, m, cat, ch, msg, rd, rx, fl, nt, sv] = await Promise.all([
        db.from('comments').select('*').eq('wedding_id', weddingId).order('created_at').limit(5000),
        db.from('mentions').select('*').eq('wedding_id', weddingId).eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
        canChat ? db.from('chat_categories').select('*').eq('wedding_id', weddingId) : Promise.resolve({ data: [] }),
        canChat ? db.from('chat_channels').select('*').eq('wedding_id', weddingId) : Promise.resolve({ data: [] }),
        canChat
          ? db.from('chat_messages').select('*').eq('wedding_id', weddingId).order('created_at', { ascending: false }).limit(3000)
          : Promise.resolve({ data: [] }),
        canChat ? db.from('chat_reads').select('*').eq('wedding_id', weddingId).eq('user_id', uid) : none,
        canChat ? db.from('chat_reactions').select('*').eq('wedding_id', weddingId).limit(10000) : none,
        canChat ? db.from('chat_files').select('*').eq('wedding_id', weddingId).order('created_at', { ascending: false }).limit(3000) : none,
        canChat ? db.from('chat_channel_notes').select('*').eq('wedding_id', weddingId) : none,
        canChat ? db.from('chat_saved').select('*').eq('wedding_id', weddingId).eq('user_id', uid) : none,
      ]);
      if (cancelled) return;
      setComments((c.data ?? []) as Comment[]);
      setMentions((m.data ?? []) as Mention[]);
      setCategories((cat.data ?? []) as ChatCategory[]);
      setChannels((ch.data ?? []) as ChatChannel[]);
      setMessages(((msg.data ?? []) as ChatMessage[]).reverse());
      setReadRows((rd.data ?? []) as ChatRead[]);
      setReactions((rx.data ?? []) as ChatReaction[]);
      setFiles((fl.data ?? []) as ChatFile[]);
      setNotes((nt.data ?? []) as ChatNote[]);
      setSaved((sv.data ?? []) as ChatSaved[]);
      setLoaded(true);
    })();

    const filter = `wedding_id=eq.${weddingId}`;
    type Change = { eventType: string; new: unknown; old: unknown };
    // DELETE events carry only the primary key; the key function must work on that alone
    const mergeBy = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, key: (r: T) => string) => (p: Change) => {
      if (p.eventType === 'DELETE') {
        const k = key(p.old as T);
        set((l) => (l.some((r) => key(r) === k) ? l.filter((r) => key(r) !== k) : l));
      } else {
        const row = p.new as T;
        const k = key(row);
        set((l) => {
          const i = l.findIndex((r) => key(r) === k);
          if (i === -1) return [...l, row];
          const copy = [...l];
          copy[i] = row;
          return copy;
        });
      }
    };
    const merge = <T extends WithId>(set: React.Dispatch<React.SetStateAction<T[]>>) => (p: Change) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as WithId).id;
        set((l) => (l.some((r) => r.id === id) ? l.filter((r) => r.id !== id) : l));
      } else set((l) => upsertById(l, p.new as T));
    };
    let channel = supabase
      .channel(`collab:${weddingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, merge<Comment>(setComments))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentions', filter: `user_id=eq.${uid}` }, (p) => {
        if ((p.new as Mention | undefined)?.wedding_id && (p.new as Mention).wedding_id !== weddingId) return;
        merge<Mention>(setMentions)(p);
      });
    if (canChat) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_categories', filter }, merge<ChatCategory>(setCategories))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels', filter }, merge<ChatChannel>(setChannels))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter }, merge<ChatMessage>(setMessages))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions', filter }, mergeBy<ChatReaction>(setReactions, reactionKey))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_files', filter }, merge<ChatFile>(setFiles))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channel_notes', filter }, mergeBy<ChatNote>(setNotes, (n) => n.channel_id));
    }
    channel.subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId, uid, canChat, permKey]);

  // ─── comments ────────────────────────────────────────────────────────────
  const addComment = useCallback(
    async (c: NewComment) => {
      const { data, error } = await db
        .from('comments')
        .insert({ wedding_id: weddingId, page: c.page, anchor: c.anchor, anchor_label: c.anchor_label.slice(0, 200), body: c.body, mentions: c.mentions, parent_id: c.parent_id ?? null })
        .select()
        .single();
      if (error || !data) fail(error, 'comments');
      setComments((l) => upsertById(l, data as Comment));
      return data as Comment;
    },
    [weddingId, fail],
  );

  const patchComment = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const { data, error } = await db.from('comments').update(patch).eq('id', id).select();
      if (error || !data?.length) fail(error, 'comments');
      setComments((l) => upsertById(l, data![0] as Comment));
    },
    [fail],
  );

  const editComment = useCallback((id: string, body: string, m: string[]) => patchComment(id, { body, mentions: m }), [patchComment]);
  const resolveComment = useCallback(
    (id: string, resolved: boolean) => patchComment(id, { resolved_at: resolved ? new Date().toISOString() : null }),
    [patchComment],
  );
  const deleteComment = useCallback(
    async (id: string) => {
      const { data, error } = await db.from('comments').delete().eq('id', id).select('id');
      if (error || !data?.length) fail(error, 'this comment');
      setComments((l) => l.filter((c) => c.id !== id && c.parent_id !== id));
    },
    [fail],
  );

  const markMentionsRead = useCallback(
    async (ids: string[]) => {
      const unreadIds = ids.filter((id) => mentions.some((m) => m.id === id && !m.read_at));
      if (!unreadIds.length) return;
      const now = new Date().toISOString();
      setMentions((l) => l.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m)));
      await db.from('mentions').update({ read_at: now }).in('id', unreadIds);
    },
    [mentions],
  );

  // ─── chat ────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (channelId: string, body: string, m: string[], parentId?: string | null, attach: PendingFile[] = []) => {
      const { data, error } = await db
        .from('chat_messages')
        .insert({ wedding_id: weddingId, channel_id: channelId, body, mentions: m, parent_id: parentId ?? null })
        .select()
        .single();
      if (error || !data) fail(error, 'the chat');
      const msg = data as ChatMessage;
      setMessages((l) => upsertById(l, msg));
      if (attach.length) {
        const { data: rows, error: fErr } = await db
          .from('chat_files')
          .insert(attach.map((f) => ({
            wedding_id: weddingId, channel_id: msg.channel_id, message_id: msg.id, storage_path: f.path,
            name: f.name, size: f.size, mime: f.mime, width: f.width, height: f.height,
          })))
          .select();
        if (fErr || !rows) fail(fErr, 'the chat');
        setFiles((l) => [...(rows as ChatFile[]), ...l.filter((f) => !(rows as ChatFile[]).some((r) => r.id === f.id))]);
      }
    },
    [weddingId, fail],
  );

  const patchMessage = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const { data, error } = await db.from('chat_messages').update(patch).eq('id', id).select();
      if (error || !data?.length) fail(error, 'this message');
      setMessages((l) => upsertById(l, data![0] as ChatMessage));
    },
    [fail],
  );
  const editMessage = useCallback((id: string, body: string, m: string[]) => patchMessage(id, { body, mentions: m }), [patchMessage]);
  const setPinned = useCallback((id: string, pinned: boolean) => patchMessage(id, { pinned }), [patchMessage]);
  const deleteMessage = useCallback(
    async (id: string) => {
      const { data, error } = await db.from('chat_messages').delete().eq('id', id).select('id');
      if (error || !data?.length) fail(error, 'this message');
      setMessages((l) => l.filter((x) => x.id !== id && x.parent_id !== id));
    },
    [fail],
  );

  const readsRef = useRef(readRows);
  readsRef.current = readRows;
  const markRead = useCallback(
    (channelId: string) => {
      const now = new Date().toISOString();
      const prev = readsRef.current.find((r) => r.channel_id === channelId);
      // don't write on every render; a few seconds of slack is fine for an unread badge
      if (prev && Date.parse(prev.last_read_at) > Date.now() - 3000) return;
      const row: ChatRead = { wedding_id: weddingId, channel_id: channelId, user_id: uid, last_read_at: now, starred: prev?.starred ?? false };
      setReadRows((l) => [...l.filter((r) => r.channel_id !== channelId), row]);
      db.from('chat_reads').upsert(row, { onConflict: 'channel_id,user_id' }).then(() => undefined);
    },
    [weddingId, uid],
  );

  const saveChannel = useCallback(
    async (c: Partial<ChatChannel> & { id?: string }) => {
      const { id, ...rest } = c;
      const q = id
        ? db.from('chat_channels').update(rest).eq('id', id).select()
        : db.from('chat_channels').insert({ ...rest, wedding_id: weddingId }).select();
      const { data, error } = await q;
      if (error || !data?.length) {
        if (error?.code === '23505') fail({ message: 'There is already a channel with that name.' }, 'channels');
        fail(error, 'channels');
      }
      setChannels((l) => upsertById(l, data![0] as ChatChannel));
      return data![0] as ChatChannel;
    },
    [weddingId, fail],
  );
  const deleteChannel = useCallback(
    async (id: string) => {
      const { data, error } = await db.from('chat_channels').delete().eq('id', id).select('id');
      if (error || !data?.length) fail(error, 'channels');
      setChannels((l) => l.filter((c) => c.id !== id));
      setMessages((l) => l.filter((m) => m.channel_id !== id));
    },
    [fail],
  );
  const saveCategory = useCallback(
    async (c: Partial<ChatCategory> & { id?: string }) => {
      const { id, ...rest } = c;
      const q = id
        ? db.from('chat_categories').update(rest).eq('id', id).select()
        : db.from('chat_categories').insert({ ...rest, wedding_id: weddingId }).select();
      const { data, error } = await q;
      if (error || !data?.length) fail(error, 'channel categories');
      setCategories((l) => upsertById(l, data![0] as ChatCategory));
      return data![0] as ChatCategory;
    },
    [weddingId, fail],
  );
  const deleteCategory = useCallback(
    async (id: string) => {
      const { data, error } = await db.from('chat_categories').delete().eq('id', id).select('id');
      if (error || !data?.length) fail(error, 'channel categories');
      setCategories((l) => l.filter((c) => c.id !== id));
      setChannels((l) => l.map((c) => (c.category_id === id ? { ...c, category_id: null } : c)));
    },
    [fail],
  );
  const reorder = useCallback(
    async (table: 'chat_channels' | 'chat_categories', rows: { id: string; position: number; category_id?: string | null }[]) => {
      const apply = <T extends WithId>(l: T[]) =>
        l.map((r) => {
          const x = rows.find((y) => y.id === r.id);
          return x ? { ...r, ...x } : r;
        });
      if (table === 'chat_channels') setChannels(apply);
      else setCategories(apply);
      const results = await Promise.all(rows.map(({ id, ...patch }) => db.from(table).update(patch).eq('id', id).select('id')));
      const bad = results.find((r) => r.error || !r.data?.length);
      if (bad) fail(bad.error, table === 'chat_channels' ? 'channels' : 'channel categories');
    },
    [fail],
  ) as Collab['reorder'];

  // ─── reactions ───────────────────────────────────────────────────────────
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const mine = reactionsRef.current.find((r) => r.message_id === messageId && r.user_id === uid && r.emoji === emoji);
      const key = reactionKey({ message_id: messageId, user_id: uid, emoji });
      if (mine) {
        setReactions((l) => l.filter((r) => reactionKey(r) !== key));
        const { error } = await db.from('chat_reactions').delete().eq('message_id', messageId).eq('user_id', uid).eq('emoji', emoji);
        if (error) {
          setReactions((l) => [...l, mine]);
          fail(error, 'reactions');
        }
      } else {
        const row: ChatReaction = { wedding_id: weddingId, message_id: messageId, user_id: uid, emoji, created_at: new Date().toISOString() };
        setReactions((l) => [...l.filter((r) => reactionKey(r) !== key), row]);
        const { error } = await db.from('chat_reactions').insert({ wedding_id: weddingId, message_id: messageId, emoji });
        if (error && error.code !== '23505') {
          setReactions((l) => l.filter((r) => reactionKey(r) !== key));
          fail(error, 'reactions');
        }
      }
    },
    [weddingId, uid, fail],
  );

  // ─── files ───────────────────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (channelId: string, file: File): Promise<PendingFile> => {
      if (file.size > ATTACHMENT_MAX_BYTES) fail({ message: `${file.name} is over the 20 MB limit.` }, 'the chat');
      const mime = file.type || 'application/octet-stream';
      if (!CHAT_FILE_MIME.has(mime)) fail({ message: `${file.name}: that type of file (${mime || 'unknown'}) can't be shared.` }, 'the chat');
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
      const path = `${weddingId}/chat/${channelId}/${crypto.randomUUID()}-${safe}`;
      const dims = mime.startsWith('image/') ? await imageSize(file) : null;
      const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: mime, upsert: false });
      if (error) fail({ message: error.message, code: /security|403|Unauthorized/i.test(error.message) ? '42501' : '' }, 'the chat');
      return { path, name: file.name, size: file.size, mime, width: dims?.width ?? null, height: dims?.height ?? null };
    },
    [weddingId, fail],
  );
  const discardUpload = useCallback(async (path: string) => {
    await supabase.storage.from('attachments').remove([path]);
  }, []);
  const deleteFile = useCallback(
    async (id: string) => {
      const { data, error } = await db.from('chat_files').delete().eq('id', id).select('id');
      if (error || !data?.length) fail(error, 'this file');
      setFiles((l) => l.filter((f) => f.id !== id));
    },
    [fail],
  );
  const urlCache = useRef(new Map<string, { url: string; until: number }>());
  const signedUrl = useCallback(async (path: string) => {
    const hit = urlCache.current.get(path);
    if (hit && hit.until > Date.now()) return hit.url;
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
    if (error || !data) throw new Error(error?.message ?? 'Could not open the file');
    urlCache.current.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 });
    return data.signedUrl;
  }, []);

  // ─── notes, saved, stars ─────────────────────────────────────────────────
  const saveNote = useCallback(
    async (channelId: string, body: string) => {
      const { data, error } = await db
        .from('chat_channel_notes')
        .upsert({ channel_id: channelId, wedding_id: weddingId, body }, { onConflict: 'channel_id' })
        .select()
        .single();
      if (error || !data) fail(error, 'the channel note');
      setNotes((l) => [...l.filter((n) => n.channel_id !== channelId), data as ChatNote]);
    },
    [weddingId, fail],
  );

  const savedRef = useRef(saved);
  savedRef.current = saved;
  const toggleSaved = useCallback(
    async (messageId: string) => {
      const had = savedRef.current.find((x) => x.message_id === messageId);
      if (had) {
        setSaved((l) => l.filter((x) => x.message_id !== messageId));
        const { error } = await db.from('chat_saved').delete().eq('message_id', messageId).eq('user_id', uid);
        if (error) {
          setSaved((l) => [...l, had]);
          fail(error, 'saved items');
        }
      } else {
        const row: ChatSaved = { user_id: uid, message_id: messageId, wedding_id: weddingId, created_at: new Date().toISOString() };
        setSaved((l) => [...l, row]);
        const { error } = await db.from('chat_saved').insert({ message_id: messageId, wedding_id: weddingId });
        if (error && error.code !== '23505') {
          setSaved((l) => l.filter((x) => x.message_id !== messageId));
          fail(error, 'saved items');
        }
      }
    },
    [weddingId, uid, fail],
  );

  const toggleStar = useCallback(
    async (channelId: string) => {
      const prev = readsRef.current.find((r) => r.channel_id === channelId);
      const starredNow = !prev?.starred;
      const row: ChatRead = { wedding_id: weddingId, channel_id: channelId, user_id: uid, last_read_at: prev?.last_read_at ?? new Date().toISOString(), starred: starredNow };
      setReadRows((l) => [...l.filter((r) => r.channel_id !== channelId), row]);
      const { error } = await db.from('chat_reads').upsert(row, { onConflict: 'channel_id,user_id' });
      if (error) {
        setReadRows((l) => [...l.filter((r) => r.channel_id !== channelId), ...(prev ? [prev] : [])]);
        fail(error, 'starred channels');
      }
    },
    [weddingId, uid, fail],
  );

  // ─── typing (a broadcast; nothing is stored) ─────────────────────────────
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!uid || !canChat) return;
    const ch = supabase.channel(`typing:${weddingId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const { key, userId } = (payload ?? {}) as { key?: string; userId?: string };
      if (!key || !userId || userId === uid) return;
      setTypingRaw((m) => {
        const next = new Map(m);
        const inner = new Map(next.get(key) ?? []);
        inner.set(userId, Date.now() + 5000);
        next.set(key, inner);
        return next;
      });
    }).subscribe();
    typingChannel.current = ch;
    // forget people who stopped typing
    const prune = window.setInterval(() => {
      setTypingRaw((m) => {
        const now = Date.now();
        let changed = false;
        const next = new Map<string, Map<string, number>>();
        for (const [k, inner] of m) {
          const kept = new Map([...inner].filter(([, until]) => until > now));
          if (kept.size !== inner.size) changed = true;
          if (kept.size) next.set(k, kept);
        }
        return changed ? next : m;
      });
    }, 1000);
    return () => {
      window.clearInterval(prune);
      typingChannel.current = null;
      supabase.removeChannel(ch);
    };
  }, [weddingId, uid, canChat]);

  const lastTyping = useRef(new Map<string, number>());
  const notifyTyping = useCallback(
    (key: string) => {
      const last = lastTyping.current.get(key) ?? 0;
      if (Date.now() - last < 3000) return;
      lastTyping.current.set(key, Date.now());
      typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { key, userId: uid } }).catch(() => undefined);
    },
    [uid],
  );
  const typing = useMemo(() => new Map([...typingRaw].map(([k, inner]) => [k, [...inner.keys()]])), [typingRaw]);

  // ─── unread ──────────────────────────────────────────────────────────────
  const reads = useMemo(() => new Map(readRows.map((r) => [r.channel_id, r.last_read_at])), [readRows]);
  const unread = useMemo(() => {
    const u = new Map<string, number>();
    for (const m of messages) {
      if (m.author_id === uid || m.parent_id) continue;
      const last = reads.get(m.channel_id);
      if (!last || m.created_at > last) u.set(m.channel_id, (u.get(m.channel_id) ?? 0) + 1);
    }
    return u;
  }, [messages, reads, uid]);
  const live = useMemo(() => new Set(channels.filter((c) => !c.archived_at).map((c) => c.id)), [channels]);
  const totalUnread = [...unread.entries()].reduce((a, [id, n]) => a + (live.has(id) ? n : 0), 0);
  const starred = useMemo(() => new Set(readRows.filter((r) => r.starred).map((r) => r.channel_id)), [readRows]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    const rows: ChatRead[] = [...live].map((id) => ({
      wedding_id: weddingId, channel_id: id, user_id: uid, last_read_at: now,
      starred: readsRef.current.find((r) => r.channel_id === id)?.starred ?? false,
    }));
    if (!rows.length) return;
    setReadRows((l) => [...l.filter((r) => !live.has(r.channel_id)), ...rows]);
    db.from('chat_reads').upsert(rows, { onConflict: 'channel_id,user_id' }).then(() => undefined);
  }, [live, weddingId, uid]);

  // unread messages show in the browser tab, like any chat app
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = totalUnread ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${base}` : base;
  }, [totalUnread]);
  useEffect(() => {
    return () => {
      document.title = document.title.replace(/^\(\d+\) /, '');
    };
  }, []);

  const value = useMemo<Collab>(
    () => ({
      loaded, comments, addComment, editComment, resolveComment, deleteComment, mentions, markMentionsRead,
      categories, channels, messages, reads, unread, totalUnread, send, editMessage, deleteMessage, setPinned, markRead,
      saveChannel, deleteChannel, saveCategory, deleteCategory, reorder,
      reactions, toggleReaction, files, uploadFile, discardUpload, deleteFile, signedUrl, notes, saveNote, saved, toggleSaved,
      starred, toggleStar, markAllRead, typing, notifyTyping,
    }),
    [loaded, comments, addComment, editComment, resolveComment, deleteComment, mentions, markMentionsRead, categories, channels, messages,
      reads, unread, totalUnread, send, editMessage, deleteMessage, setPinned, markRead, saveChannel, deleteChannel, saveCategory, deleteCategory, reorder,
      reactions, toggleReaction, files, uploadFile, discardUpload, deleteFile, signedUrl, notes, saveNote, saved, toggleSaved,
      starred, toggleStar, markAllRead, typing, notifyTyping],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollab(): Collab {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCollab outside CollabProvider');
  return v;
}

function reactionKey(r: Pick<ChatReaction, 'message_id' | 'user_id' | 'emoji'>) {
  return `${r.message_id}|${r.user_id}|${r.emoji}`;
}

/** An image's pixel size, so thumbnails can reserve space before they load. */
function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Display names for the people on this wedding. */
export function usePeople() {
  const { members } = useStore();
  return useMemo(() => {
    const byId = new Map(
      members.map((m) => [
        m.user_id,
        { id: m.user_id, role: m.role, name: m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Someone', email: m.profile?.email ?? '' },
      ]),
    );
    return { list: [...byId.values()], byId, name: (id: string | null | undefined) => (id && byId.get(id)?.name) || 'Someone' };
  }, [members]);
}
