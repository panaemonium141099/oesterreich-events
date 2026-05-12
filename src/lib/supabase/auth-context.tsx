'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from './client';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  role: 'user' | 'business' | 'admin' | 'god';
  spotify_connected: boolean;
  spotify_user_id: string | null;
  facebook_connected: boolean;
  facebook_user_id: string | null;
  preferred_bundesland: string | null;
  preferred_categories: string[] | null;
  notification_enabled: boolean;
  agb_accepted_at: string | null;
  newsletter_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

// Import from shared utility and re-export for backwards compatibility
import { isProfileComplete } from '@/lib/utils/profile';
export { isProfileComplete };

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileComplete: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signInWithApple: (next?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, metadata: {
    first_name: string;
    last_name: string;
    birth_date: string;
    phone?: string;
    agb_accepted_at?: string;
    newsletter_opt_in?: boolean;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isGod: boolean;
  isAdmin: boolean;
  isBusiness: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Canonical site origin — avoids www/non-www cookie mismatch in OAuth PKCE flow */
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.warn('Profile fetch error:', error.message);
      }
      if (data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.warn('Failed to fetch profile:', e);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // Initial auth bootstrap — runs once per page load.
    //
    // We do TWO checks in sequence:
    //   1) `getSession()` reads the locally cached session (JWT from cookie).
    //      Instant — no network — so we can flip `loading` to false right
    //      away and render the shell with the user's cached identity.
    //   2) In parallel, verify the session is still valid server-side by
    //      checking the `profiles` row. Supabase JWTs are signature-valid
    //      for up to an hour, so a user deleted by an admin still appears
    //      "logged in" locally until the token expires. profiles row
    //      existence is the ground-truth (FK CASCADE from auth.users).
    //      If the profile is gone, treat this as a ghost session: clear
    //      local state + call signOut to wipe cookies + hard-reload so
    //      any stale React state (avatar, user-specific data) evaporates.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Fire the profile fetch — it doubles as the ghost-session probe.
        // fetchProfile sets `profile` when found; we explicitly handle the
        // missing case here so there's no silent logged-in-but-no-profile
        // state.
        //
        // CRITICAL: distinguish between "profile genuinely missing" (ghost
        // session — user was deleted) and "query failed" (network blip,
        // Supabase timeout, mobile flaky WiFi). Without the error check we
        // observed an infinite reload loop on mobile devices: every flaky
        // network = reload, reload runs the same flaky network call,
        // forever. The user sees a white-screen + reload loop.
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          // Network / Supabase error. NOT a ghost session — keep what we
          // have, leave the user logged in. The session can be re-checked
          // on next interaction without nuking local state. Worst case:
          // the user sees stale profile data for a few seconds.
          console.warn('[auth] profile probe failed (keeping session):', profileError.message);
          return;
        }

        if (!profileRow) {
          // Ghost session — user was deleted (probably by an admin). Nuke
          // everything local and bounce to the root so the next navigation
          // starts fresh. signOut({ scope: 'local' }) just wipes local
          // cookies/storage — we skip the /auth/v1/logout round-trip that
          // would fail anyway since refresh_tokens were CASCADED too.
          await supabase.auth.signOut({ scope: 'local' });
          setUser(null);
          setProfile(null);
          setSession(null);
          if (typeof window !== 'undefined') {
            // Hard reload — guarantees no in-memory client state leaks
            // from before the signOut.
            window.location.href = '/';
          }
          return;
        }

        setProfile(profileRow as Profile);
      }
    })();

    // Listen for auth changes (sign-in in another tab, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id); // non-blocking
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Safe same-origin redirect target (or undefined) → forwarded to the callback as ?next=
  const buildCallbackUrl = (next?: string) => {
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    return safeNext
      ? `${SITE_ORIGIN}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${SITE_ORIGIN}/auth/callback`;
  };

  const signInWithGoogle = async (next?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildCallbackUrl(next),
      },
    });
  };

  const signInWithApple = async (next?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: buildCallbackUrl(next),
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    metadata: { first_name: string; last_name: string; birth_date: string; phone?: string; agb_accepted_at?: string; newsletter_opt_in?: boolean }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${SITE_ORIGIN}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    // Full page reload to clear all in-memory React state
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      profileComplete: isProfileComplete(profile),
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
      isGod: profile?.role === 'god',
      isAdmin: profile?.role === 'admin' || profile?.role === 'god',
      isBusiness: profile?.role === 'business',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Default fallback context used when `useAuth` is called outside an
 * `<AuthProvider>` boundary. After fn-15.5 the root layout no longer
 * mounts AuthProvider — only authenticated route layouts do — so any
 * client component that lives on a public route (landing, blog,
 * impressum, datenschutz, gemeinde/stadt SEO pages …) is "anonymous"
 * by definition: there is no logged-in user, profile, or session.
 *
 * Returning a safe, no-op shape instead of throwing means:
 *  - Public routes don't crash when they happen to mount a client
 *    component that touches `useAuth` for UI-flavoring (e.g. the
 *    landing's profile pill that switches between "Anmelden" and
 *    user avatar). The component just sees `user: null` and renders
 *    the anonymous variant.
 *  - Authenticated routes continue to get the real provider value
 *    because they wrap their tree in `<AuthProvider>`.
 *  - Tests can mount components without a provider scaffold.
 */
const ANON_AUTH_CONTEXT: AuthContextType = {
  user: null,
  profile: null,
  session: null,
  loading: false,
  profileComplete: false,
  signInWithGoogle: async () => {
    throw new Error('signInWithGoogle requires <AuthProvider> in the route tree');
  },
  signInWithApple: async () => {
    throw new Error('signInWithApple requires <AuthProvider> in the route tree');
  },
  signInWithEmail: async () => ({ error: 'auth provider not mounted' }),
  signUpWithEmail: async () => ({ error: 'auth provider not mounted' }),
  signOut: async () => {
    if (typeof window !== 'undefined') window.location.href = '/';
  },
  refreshProfile: async () => {},
  isGod: false,
  isAdmin: false,
  isBusiness: false,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Public/anonymous route — no provider mounted. Return a safe
    // anonymous shape so consumers can render their unauthenticated
    // branch without try/catch boilerplate.
    return ANON_AUTH_CONTEXT;
  }
  return context;
}
