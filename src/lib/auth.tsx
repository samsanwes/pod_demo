import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserRole, UserRow } from './database.types';

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: UserRow | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLoadedUserId = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    // Deduplicate repeated calls for the same user (onAuthStateChange fires
    // for TOKEN_REFRESHED, USER_UPDATED, etc. — no need to re-fetch every time).
    if (lastLoadedUserId.current === userId) return;
    lastLoadedUserId.current = userId;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[auth] failed to load profile', error);
      setProfile(null);
      return;
    }
    setProfile(data ? (data as UserRow) : null);

    // Seed the audit-user session var so the DB trigger can attribute changes.
    // This is a fire-and-forget; don't block the UI on it.
    supabase.rpc('set_audit_user', { uid: userId }).then(
      () => {},
      (err) => console.warn('[auth] set_audit_user failed (non-fatal)', err)
    );
  }

  useEffect(() => {
    let cancelled = false;

    // Initial hydrate from cached session
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (cancelled) return;
      setSession(sess);
      if (sess?.user) {
        await loadProfile(sess.user.id);
      } else {
        lastLoadedUserId.current = null;
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      lastLoadedUserId.current = null;
      setProfile(null);
      await supabase.auth.signOut();
    },
    async refresh() {
      if (session?.user) {
        lastLoadedUserId.current = null;
        await loadProfile(session.user.id);
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
