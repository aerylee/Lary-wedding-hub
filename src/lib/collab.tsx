// Comments, @mentions and team chat: loaded once per wedding, kept live over realtime.
// The database decides who sees what (a budget comment is as private as the budget);
// this layer only merges rows and turns refusals into sentences.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { explain, useStore } from './store';
import { useToast } from '@/components/toast';
import type { ChatCategory, ChatChannel, ChatMessage, ChatRead, Comment, Mention } from './types';

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
  send: (channelId: string, body: string, mentions: string[], parentId?: string | null) => Promise<void>;
  editMessage: (id: string, body: string, mentions: string[]) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  markRead: (channelId: string) => void;
  saveChannel: (c: Partial<ChatChannel> & { id?: string }) => Promise<ChatChannel | null>;
  deleteChannel: (id: string) => Promise<void>;
  saveCategory: (c: Partial<ChatCategory> & { id?: string }) => Promise<ChatCategory | null>;
  deleteCategory: (id: string) => Promise<void>;
  reorder: (table: 'chat_channels' | 'chat_categories', rows: { id: string; position: number; category_id?: string | null }[]) => Promise<void>;
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
      const [c, m, cat, ch, msg, rd] = await Promise.all([
        db.from('comments').select('*').eq('wedding_id', weddingId).order('created_at').limit(5000),
        db.from('mentions').select('*').eq('wedding_id', weddingId).eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
        canChat ? db.from('chat_categories').select('*').eq('wedding_id', weddingId) : Promise.resolve({ data: [] }),
        canChat ? db.from('chat_channels').select('*').eq('wedding_id', weddingId) : Promise.resolve({ data: [] }),
        canChat
          ? db.from('chat_messages').select('*').eq('wedding_id', weddingId).order('created_at', { ascending: false }).limit(3000)
          : Promise.resolve({ data: [] }),
        canChat ? db.from('chat_reads').select('*').eq('wedding_id', weddingId).eq('user_id', uid) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setComments((c.data ?? []) as Comment[]);
      setMentions((m.data ?? []) as Mention[]);
      setCategories((cat.data ?? []) as ChatCategory[]);
      setChannels((ch.data ?? []) as ChatChannel[]);
      setMessages(((msg.data ?? []) as ChatMessage[]).reverse());
      setReadRows((rd.data ?? []) as ChatRead[]);
      setLoaded(true);
    })();

    const filter = `wedding_id=eq.${weddingId}`;
    const merge = <T extends WithId>(set: React.Dispatch<React.SetStateAction<T[]>>) => (p: { eventType: string; new: unknown; old: unknown }) => {
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter }, merge<ChatMessage>(setMessages));
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
    async (channelId: string, body: string, m: string[], parentId?: string | null) => {
      const { data, error } = await db
        .from('chat_messages')
        .insert({ wedding_id: weddingId, channel_id: channelId, body, mentions: m, parent_id: parentId ?? null })
        .select()
        .single();
      if (error || !data) fail(error, 'the chat');
      setMessages((l) => upsertById(l, data as ChatMessage));
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
      const row: ChatRead = { wedding_id: weddingId, channel_id: channelId, user_id: uid, last_read_at: now };
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

  const value = useMemo<Collab>(
    () => ({
      loaded, comments, addComment, editComment, resolveComment, deleteComment, mentions, markMentionsRead,
      categories, channels, messages, reads, unread, totalUnread, send, editMessage, deleteMessage, setPinned, markRead,
      saveChannel, deleteChannel, saveCategory, deleteCategory, reorder,
    }),
    [loaded, comments, addComment, editComment, resolveComment, deleteComment, mentions, markMentionsRead, categories, channels, messages,
      reads, unread, totalUnread, send, editMessage, deleteMessage, setPinned, markRead, saveChannel, deleteChannel, saveCategory, deleteCategory, reorder],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollab(): Collab {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCollab outside CollabProvider');
  return v;
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
