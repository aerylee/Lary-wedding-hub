// Session, memberships, current wedding and the can() predicate (main spec §3, auth spec §7.2).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRole, Membership, Permission, Profile, Wedding } from './types';

export type MembershipWithWedding = Membership & { wedding: Pick<Wedding, 'id' | 'name' | 'archived_at'> };

type AuthValue = {
  /** true until the initial session check finishes */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  memberships: MembershipWithWedding[];
  membershipsLoaded: boolean;
  /** the wedding the shell is showing, set by WeddingLayout from the URL */
  weddingId: string | null;
  wedding: MembershipWithWedding['wedding'] | null;
  role: AppRole | null;
  permissions: Set<string>;
  permissionsLoaded: boolean;
  can: (p: Permission) => boolean;
  selectWedding: (id: string | null) => void;
  lastWeddingId: () => string | null;
  refreshMemberships: () => Promise<MembershipWithWedding[]>;
  refreshProfile: () => Promise<void>;
  signOut: (scope?: 'local' | 'global') => Promise<void>;
};

const AuthCtx = createContext<AuthValue | null>(null);

const lastKey = (uid: string) => `hub:last-wedding:${uid}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<MembershipWithWedding[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permTick, setPermTick] = useState(0);
  const uid = session?.user.id ?? null;
  const uidRef = useRef(uid);
  uidRef.current = uid;

  // ─── session ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // TOKEN_REFRESHED and USER_UPDATED keep the same user; SIGNED_OUT clears everything
      setSession(s);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setMemberships([]);
        setMembershipsLoaded(false);
        setPermissions(new Set());
        setWeddingId(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!uidRef.current) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', uidRef.current).maybeSingle();
    setProfile(data);
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (!uidRef.current) return [];
    const { data, error } = await supabase
      .from('memberships')
      .select('*, wedding:weddings(id, name, archived_at)')
      .eq('user_id', uidRef.current)
      .eq('status', 'active')
      .order('created_at');
    const rows = error ? [] : ((data ?? []).filter((m) => m.wedding) as unknown as MembershipWithWedding[]);
    setMemberships(rows);
    setMembershipsLoaded(true);
    return rows;
  }, []);

  useEffect(() => {
    if (!uid) return;
    refreshProfile();
    refreshMemberships();
    supabase.rpc('touch_last_seen').then(() => undefined);
    // a role change or removal takes effect immediately, not at the next token refresh
    const ch = supabase
      .channel(`memberships:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: `user_id=eq.${uid}` }, () => {
        refreshMemberships();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, refreshMemberships, refreshProfile]);

  // ─── permissions for the current wedding ─────────────────────────────────
  const membershipKey = memberships.map((m) => `${m.wedding_id}:${m.role}`).join(',');
  useEffect(() => {
    let cancelled = false;
    if (permTick === 0) setPermissionsLoaded(false);
    if (!uid || !weddingId) {
      setPermissions(new Set());
      return;
    }
    supabase.rpc('my_permissions', { w: weddingId }).then(({ data }) => {
      if (cancelled) return;
      setPermissions((prev) => {
        const next = new Set<string>(data ?? []);
        // keep the same object when nothing changed, so the store doesn't reload
        return prev.size === next.size && [...next].every((p) => prev.has(p)) ? prev : next;
      });
      setPermissionsLoaded(true);
    });
    try {
      localStorage.setItem(lastKey(uid), weddingId);
    } catch {
      /* storage unavailable — only a convenience */
    }
    return () => {
      cancelled = true;
    };
  }, [uid, weddingId, membershipKey, permTick]);

  // an owner editing the role matrix changes what everyone can do, straight away
  useEffect(() => {
    if (!uid || !weddingId) return;
    setPermTick(0);
    const ch = supabase
      .channel(`role-perms:${weddingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wedding_role_permissions', filter: `wedding_id=eq.${weddingId}` }, () => {
        setPermTick((t) => t + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, weddingId]);

  const current = memberships.find((m) => m.wedding_id === weddingId) ?? null;

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      profile,
      memberships,
      membershipsLoaded,
      weddingId,
      wedding: current?.wedding ?? null,
      role: current?.role ?? null,
      permissions,
      permissionsLoaded,
      can: (p: Permission) => permissions.has(p),
      selectWedding: setWeddingId,
      lastWeddingId: () => {
        if (!uid) return null;
        try {
          return localStorage.getItem(lastKey(uid));
        } catch {
          return null;
        }
      },
      refreshMemberships,
      refreshProfile,
      signOut: async (scope = 'local') => {
        await supabase.auth.signOut({ scope });
      },
    }),
    [loading, session, profile, memberships, membershipsLoaded, weddingId, current, permissions, permissionsLoaded, uid, refreshMemberships, refreshProfile],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: 'Owner',
  planner: 'Planner',
  collaborator: 'Collaborator',
  viewer: 'Viewer',
};

export const ROLE_BLURB: Record<AppRole, string> = {
  owner: 'Everything, including the team and deleting the wedding.',
  planner: 'By default: everything operational, including money. Cannot manage the team.',
  collaborator: 'By default: edits guests, seating, comms, run of show and travel. Cannot see the budget.',
  viewer: 'By default: reads everything except money, and can comment and chat.',
};
