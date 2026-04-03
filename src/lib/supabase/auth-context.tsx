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
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
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

    // Get initial session — set loading false IMMEDIATELY after getting user
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // IMMEDIATELY — don't wait for profile
      // Fetch profile in background (non-blocking)
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
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

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithApple = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
