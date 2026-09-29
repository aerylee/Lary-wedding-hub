// The data layer (main spec §3). The only module that talks to the database: modules call
// get/put/putMany/remove/saveSettings and never import the Supabase client.
//
//  * Load: one select() per readable table, filtered by wedding_id (RLS enforces it too).
//  * Subscribe: postgres_changes per table, merged into the same in-memory collections.
//    Realtime checks each subscriber's SELECT policy, so a collaborator gets no budget events.
//  * Write optimistically, roll back on rejection, and say why in plain words.
//  * No localStorage: one writable backend, one permission model.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useToast } from '@/components/toast';
import {
  COLL_LABEL, READ_PERM, type ActivityEntry, type AppRole, type Attachment, type CollMap, type CollName,
  type Invitation, type Membership, type Profile, type Row, type WeddingSettings,
} from './types';

// Dynamic table names defeat the generated types; the view-model types take over at the edge.
const db = supabase as unknown as SupabaseClient;

export const COLLECTIONS: CollName[] = [
  'venues', 'tasks', 'budget_categories', 'budget_lines', 'payments', 'vendors', 'vendor_finance',
  'guests', 'guest_contacts', 'rsvps', 'events', 'rooms', 'legal_docs', 'decisions', 'seat_tables',
  'schedule_items', 'comms_rows', 'templates', 'correspondence', 'attachments', 'faqs',
];

const AUDIT = new Set(['created_at', 'updated_at', 'created_by', 'updated_by']);
const SETTINGS_KEYS = [
  'couple_a', 'couple_b', 'target_date', 'date_is_firm', 'fx_eur_usd', 'fx_set_on', 'fx_source',
  'guest_target', 'decide_venue_by', 'rsvp_by', 'website', 'candidate_countries',
] as const;

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_MIME = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'application/json',
  'message/rfc822', 'application/vnd.ms-outlook', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

export type Member = Membership & { profile: Profile | null };

type Data = { [K in CollName]: CollMap[K][] };

export type StoreValue = {
  ready: boolean;
  loadError: string | null;
  weddingId: string;
  settings: WeddingSettings;
  saveSettings: (patch: Partial<WeddingSettings>) => Promise<void>;
  get: <K extends CollName>(c: K) => CollMap[K][];
  put: (c: CollName, row: Row) => Promise<void>;
  putMany: (c: CollName, rows: Row[]) => Promise<void>;
  remove: (c: CollName, id: string) => Promise<void>;
  /** last rejected write, for a toast */
  error: string | null;
  members: Member[];
  activity: ActivityEntry[];
  reloadMembers: () => Promise<void>;
  /** a ref mirror for callbacks handed to an external runtime (the assistant) */
  snapshot: () => { data: Data; settings: WeddingSettings };
  files: {
    upload: (correspondenceId: string, file: File) => Promise<void>;
    signedUrl: (a: Attachment) => Promise<string>;
    remove: (a: Attachment) => Promise<void>;
  };
  team: {
    invitations: () => Promise<Invitation[]>;
    invite: (email: string, role: AppRole) => Promise<{ emailed: boolean; link: string }>;
    resend: (id: string) => Promise<{ emailed: boolean; link: string }>;
    revoke: (id: string) => Promise<void>;
    setRole: (membershipId: string, role: AppRole) => Promise<void>;
    removeMember: (membershipId: string) => Promise<void>;
  };
  invoke: <T = unknown>(fn: string, body: Record<string, unknown>) => Promise<T>;
};

const emptyData = (): Data => Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as Data;

const DEFAULT_SETTINGS: WeddingSettings = {
  wedding_id: '',
  couple_a: '',
  couple_b: '',
  target_date: new Date().toISOString().slice(0, 10),
  date_is_firm: false,
  fx_eur_usd: 1.08,
  fx_set_on: new Date().toISOString().slice(0, 10),
  fx_source: 'manual',
  guest_target: 60,
  decide_venue_by: null,
  rsvp_by: null,
  website: '',
  candidate_countries: ['Italy', 'France'],
  budget_ceiling_usd: null,
};

/** Turn a Postgres/PostgREST error into words a person can act on. */
export function explain(err: { code?: string; message?: string } | null | undefined, what: string): string {
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return `You don't have permission to change ${what}.`;
  if (code === '23505') return `That would create a duplicate in ${what}.`;
  if (code === '23503') return `That refers to something that no longer exists in ${what}.`;
  if (code === '23514' || code === '22P02' || code === '22007') return `That value isn't valid for ${what}.`;
  if (code === '23502') return `A required field is missing in ${what}.`;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return `Couldn't reach the server — your change to ${what} wasn't saved.`;
  return msg ? `Couldn't save ${what}: ${msg}` : `Couldn't save ${what}.`;
}

function payloadOf(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (AUDIT.has(k) || k.startsWith('_')) continue;
    out[k] = v === undefined ? null : v;
  }
  return out;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ weddingId, children }: { weddingId: string; children: ReactNode }) {
  const { can, permissions, permissionsLoaded } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Data>(emptyData);
  const [settings, setSettings] = useState<WeddingSettings>({ ...DEFAULT_SETTINGS, wedding_id: weddingId });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const dataRef = useRef(data);
  dataRef.current = data;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const permKey = [...permissions].sort().join(',');

  const reloadMembers = useCallback(async () => {
    const { data: rows } = await db
      .from('memberships')
      .select('*, profile:profiles!memberships_user_id_fkey(*)')
      .eq('wedding_id', weddingId)
      .order('created_at');
    setMembers((rows ?? []) as Member[]);
  }, [weddingId]);

  // ─── load + subscribe ────────────────────────────────────────────────────
  useEffect(() => {
    if (!permissionsLoaded) return;
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    const readable = COLLECTIONS.filter((c) => permissions.has(READ_PERM[c]));

    (async () => {
      const [settingsRes, budgetRes, ...results] = await Promise.all([
        db.from('wedding_settings').select('*').eq('wedding_id', weddingId).maybeSingle(),
        permissions.has('finance:read')
          ? db.from('budget_settings').select('budget_ceiling_usd').eq('wedding_id', weddingId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ...readable.map((c) => db.from(c).select('*').eq('wedding_id', weddingId).limit(5000)),
      ]);
      if (cancelled) return;
      const failed = [settingsRes, ...results].find((r) => r.error);
      if (failed?.error) {
        setLoadError(failed.error.message);
        return;
      }
      const next = emptyData();
      readable.forEach((c, i) => {
        (next as Record<CollName, unknown[]>)[c] = results[i].data ?? [];
      });
      setData(next);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(settingsRes.data ?? {}),
        wedding_id: weddingId,
        budget_ceiling_usd: budgetRes.data ? Number(budgetRes.data.budget_ceiling_usd) : null,
      });
      setReady(true);
    })();

    reloadMembers();
    db.from('activity_log')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('at', { ascending: false })
      .limit(60)
      .then(({ data: rows }) => !cancelled && setActivity((rows ?? []) as ActivityEntry[]));

    const filter = `wedding_id=eq.${weddingId}`;
    let channel = supabase.channel(`wedding:${weddingId}`);
    for (const c of readable) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: c, filter }, (p) => {
        setData((d) => {
          const list = d[c] as unknown as Row[];
          if (p.eventType === 'DELETE') {
            const id = (p.old as Row).id;
            return list.some((r) => r.id === id) ? { ...d, [c]: list.filter((r) => r.id !== id) } : d;
          }
          const row = p.new as Row;
          const i = list.findIndex((r) => r.id === row.id);
          const copy = [...list];
          if (i === -1) copy.push(row);
          else copy[i] = row;
          return { ...d, [c]: copy };
        });
      });
    }
    // DELETE events can't be filtered server-side; a delete for a row we never had is ignored above.
    channel = channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wedding_settings', filter }, (p) => {
        setSettings((s) => ({ ...s, ...(p.new as Partial<WeddingSettings>), budget_ceiling_usd: s.budget_ceiling_usd }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter }, (p) => {
        setActivity((a) => [p.new as ActivityEntry, ...a].slice(0, 60));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter }, () => {
        reloadMembers();
      });
    if (permissions.has('finance:read')) {
      channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'budget_settings', filter }, (p) => {
        setSettings((s) => ({ ...s, budget_ceiling_usd: Number((p.new as { budget_ceiling_usd: number }).budget_ceiling_usd) }));
      });
    }
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // permKey captures the permission set; `permissions` itself changes identity every load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId, permKey, permissionsLoaded, reloadMembers]);

  const fail = useCallback(
    (message: string): never => {
      setError(message);
      toast(message, 'error');
      throw new Error(message);
    },
    [toast],
  );

  // ─── writes ──────────────────────────────────────────────────────────────
  const put = useCallback(
    async (c: CollName, row: Row) => {
      const list = dataRef.current[c] as unknown as Row[];
      const id = row.id ?? crypto.randomUUID();
      const prev = list.find((r) => r.id === id);
      const optimistic = { ...(prev ?? {}), ...row, id, wedding_id: weddingId };
      setData((d) => {
        const l = d[c] as unknown as Row[];
        return { ...d, [c]: prev ? l.map((r) => (r.id === id ? optimistic : r)) : [...l, optimistic] };
      });
      const payload = payloadOf(optimistic);
      const q = prev ? db.from(c).update(payload).eq('id', id).select() : db.from(c).insert(payload).select();
      const { data: rows, error: err } = await q;
      if (err || !rows || rows.length === 0) {
        setData((d) => {
          const l = d[c] as unknown as Row[];
          return { ...d, [c]: prev ? l.map((r) => (r.id === id ? prev : r)) : l.filter((r) => r.id !== id) };
        });
        // an RLS-filtered update returns no error and no rows: that is a refusal too
        fail(explain(err ?? { code: '42501' }, COLL_LABEL[c]));
      }
      setError(null);
      setData((d) => {
        const l = d[c] as unknown as Row[];
        return { ...d, [c]: l.map((r) => (r.id === id ? (rows![0] as Row) : r)) };
      });
    },
    [weddingId, fail],
  );

  const putMany = useCallback(
    async (c: CollName, rows: Row[]) => {
      if (!rows.length) return;
      const before = dataRef.current[c] as unknown as Row[];
      const withIds = rows.map((r) => ({ ...r, id: r.id ?? crypto.randomUUID(), wedding_id: weddingId }));
      const byId = new Map(withIds.map((r) => [r.id, r]));
      setData((d) => {
        const l = d[c] as unknown as Row[];
        const merged = l.map((r) => (byId.has(r.id as string) ? { ...r, ...byId.get(r.id as string) } : r));
        const fresh = withIds.filter((r) => !l.some((x) => x.id === r.id));
        return { ...d, [c]: [...merged, ...fresh] };
      });
      const payload = withIds.map((r) => payloadOf({ ...(before.find((b) => b.id === r.id) ?? {}), ...r }));
      const { data: saved, error: err } = await db.from(c).upsert(payload, { onConflict: 'id' }).select();
      if (err || (saved ?? []).length !== payload.length) {
        setData((d) => ({ ...d, [c]: before }));
        fail(explain(err ?? { code: '42501' }, COLL_LABEL[c]));
      }
      setError(null);
      const savedById = new Map((saved as Row[]).map((r) => [r.id, r]));
      setData((d) => {
        const l = d[c] as unknown as Row[];
        return { ...d, [c]: l.map((r) => savedById.get(r.id) ?? r) };
      });
    },
    [weddingId, fail],
  );

  const remove = useCallback(
    async (c: CollName, id: string) => {
      const list = dataRef.current[c] as unknown as Row[];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return;
      const prev = list[idx];
      setData((d) => ({ ...d, [c]: (d[c] as unknown as Row[]).filter((r) => r.id !== id) }));
      const { data: rows, error: err } = await db.from(c).delete().eq('id', id).select('id');
      if (err || !rows || rows.length === 0) {
        setData((d) => {
          const l = [...(d[c] as unknown as Row[])];
          if (!l.some((r) => r.id === id)) l.splice(Math.min(idx, l.length), 0, prev);
          return { ...d, [c]: l };
        });
        fail(explain(err ?? { code: '42501' }, COLL_LABEL[c]));
      }
      setError(null);
    },
    [fail],
  );

  const saveSettings = useCallback(
    async (patch: Partial<WeddingSettings>) => {
      const before = settingsRef.current;
      setSettings((s) => ({ ...s, ...patch }));
      const main: Record<string, unknown> = {};
      for (const k of SETTINGS_KEYS) if (k in patch) main[k] = patch[k];
      const tasks: PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>[] = [];
      if (Object.keys(main).length) tasks.push(db.from('wedding_settings').update(main).eq('wedding_id', weddingId).select('wedding_id'));
      if ('budget_ceiling_usd' in patch)
        tasks.push(db.from('budget_settings').update({ budget_ceiling_usd: patch.budget_ceiling_usd }).eq('wedding_id', weddingId).select('wedding_id'));
      const results = await Promise.all(tasks);
      const bad = results.find((r) => r.error || !r.data || r.data.length === 0);
      if (bad) {
        setSettings(before);
        fail(explain(bad.error ?? { code: '42501' }, 'budget_ceiling_usd' in patch && !Object.keys(main).length ? 'the budget' : 'the wedding settings'));
      }
      setError(null);
    },
    [weddingId, fail],
  );

  // ─── files ───────────────────────────────────────────────────────────────
  const files = useMemo<StoreValue['files']>(
    () => ({
      upload: async (correspondenceId, file) => {
        if (file.size > ATTACHMENT_MAX_BYTES) fail(`${file.name} is over the 20 MB limit.`);
        const mime = file.type || 'application/octet-stream';
        if (!ATTACHMENT_MIME.has(mime)) fail(`${file.name}: that file type (${mime || 'unknown'}) can't be attached.`);
        const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
        const path = `${weddingId}/${correspondenceId}/${crypto.randomUUID()}-${safe}`;
        const up = await supabase.storage.from('attachments').upload(path, file, { contentType: mime, upsert: false });
        if (up.error) fail(explain({ message: up.error.message, code: /security|403|Unauthorized/i.test(up.error.message) ? '42501' : '' }, 'attachments'));
        try {
          await put('attachments', { correspondence_id: correspondenceId, storage_path: path, name: file.name, size: file.size, mime });
        } catch (e) {
          await supabase.storage.from('attachments').remove([path]);
          throw e;
        }
      },
      signedUrl: async (a) => {
        // short expiry, never a public URL
        const { data: signed, error: err } = await supabase.storage.from('attachments').createSignedUrl(a.storage_path, 60);
        if (err || !signed) fail(`Couldn't open ${a.name}: ${err?.message ?? 'no URL'}`);
        return signed!.signedUrl;
      },
      remove: async (a) => {
        await remove('attachments', a.id);
        // best effort; the purge queue catches anything left behind
        await supabase.storage.from('attachments').remove([a.storage_path]);
      },
    }),
    [weddingId, put, remove, fail],
  );

  // ─── team ────────────────────────────────────────────────────────────────
  const joinLink = (token: string) => `${window.location.origin}/join?token=${token}`;
  const sendInvite = async (inv: Invitation) => {
    if (inv.accepted_at) return { emailed: false, link: '' };
    const { error: err } = await supabase.functions.invoke('send-invite', { body: { invitation_id: inv.id, origin: window.location.origin } });
    return { emailed: !err, link: joinLink(inv.token) };
  };
  const team = useMemo<StoreValue['team']>(
    () => ({
      invitations: async () => {
        const { data: rows } = await db.from('invitations').select('*').eq('wedding_id', weddingId).is('accepted_at', null).order('created_at');
        return (rows ?? []) as Invitation[];
      },
      invite: async (email, role) => {
        const { data: inv, error: err } = await supabase.rpc('invite_member', { w: weddingId, p_email: email, p_role: role });
        if (err || !inv) fail(err?.message ?? 'Could not create the invitation.');
        await reloadMembers();
        return sendInvite(inv as Invitation);
      },
      resend: async (id) => {
        const { data: inv, error: err } = await supabase.rpc('resend_invitation', { p_id: id });
        if (err || !inv) fail(err?.message ?? 'Could not resend.');
        return sendInvite(inv as Invitation);
      },
      revoke: async (id) => {
        const { error: err } = await supabase.rpc('revoke_invitation', { p_id: id });
        if (err) fail(err.message);
      },
      setRole: async (membershipId, role) => {
        const { data: rows, error: err } = await db.from('memberships').update({ role }).eq('id', membershipId).select('id');
        if (err || !rows?.length) fail(err?.message ?? "You don't have permission to change roles.");
        await reloadMembers();
      },
      removeMember: async (membershipId) => {
        const { data: rows, error: err } = await db.from('memberships').delete().eq('id', membershipId).select('id');
        if (err || !rows?.length) fail(err?.message ?? "You don't have permission to remove people.");
        await reloadMembers();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weddingId, fail, reloadMembers],
  );

  const invoke = useCallback(async <T,>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const { data: out, error: err } = await supabase.functions.invoke(fn, { body: { wedding_id: weddingId, ...body } });
    if (err) {
      let detail = err.message;
      try {
        const ctx = (err as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') detail = (await ctx.json()).error ?? detail;
      } catch {
        /* keep the generic message */
      }
      throw new Error(detail);
    }
    return out as T;
  }, [weddingId]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      loadError,
      weddingId,
      settings,
      saveSettings,
      get: <K extends CollName>(c: K) => data[c] as CollMap[K][],
      put,
      putMany,
      remove,
      error,
      members,
      activity,
      reloadMembers,
      snapshot: () => ({ data: dataRef.current, settings: settingsRef.current }),
      files,
      team,
      invoke,
    }),
    [ready, loadError, weddingId, settings, saveSettings, data, put, putMany, remove, error, members, activity, reloadMembers, files, team, invoke],
  );

  // can() is referenced so the provider re-renders when permissions change
  void can;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
