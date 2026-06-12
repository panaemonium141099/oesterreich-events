'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, isProfileComplete } from '@/lib/supabase/auth-context';
import { trackEvent } from '@/lib/analytics';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signInWithGoogle, signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Safe same-origin redirect target (prevents open-redirect).
  const redirectTarget = useMemo(() => {
    const raw = searchParams.get('redirect');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/map';
  }, [searchParams]);

  // Preserve redirect when bouncing to complete-profile / register.
  const passthrough = redirectTarget === '/map' ? '' : `?redirect=${encodeURIComponent(redirectTarget)}`;

  // Redirect if already logged in — check profile completeness.
  // WICHTIG: hier NICHT trackEvent('login') — dieser Effect läuft bei jeder
  // user/profile/loading-Änderung erneut (6–9× pro Login) und feuert auch,
  // wenn ein bereits eingeloggter Nutzer /auth/login nur aufruft. Das Login
  // wird stattdessen beim tatsächlichen Anmelde-Vorgang getrackt (siehe unten).
  useEffect(() => {
    if (!loading && user) {
      if (profile && !isProfileComplete(profile)) {
        router.replace(`/auth/complete-profile${passthrough}`);
      } else if (profile) {
        router.replace(redirectTarget);
      }
      // If profile is still null (loading in background), wait for next render
    }
  }, [user, profile, loading, router, redirectTarget, passthrough]);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: authError } = await signInWithEmail(email, password);
    if (authError) {
      setError(authError);
      setSubmitting(false);
    } else {
      // Genau ein Event pro erfolgreichem Login.
      trackEvent('login', { method: 'email' });
    }
    // Redirect is handled by the useEffect that watches `user` state
  };

  // Don't render form while checking auth
  if (loading || user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Anmelden</h1>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { trackEvent('login', { method: 'google' }); signInWithGoogle(redirectTarget); }}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-gray-900 font-medium py-3 px-4 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <GoogleIcon />
          Mit Google anmelden
        </button>

        <div className="relative group">
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-white/10 text-white/30 font-medium py-3 px-4 cursor-not-allowed"
          >
            <AppleIcon />
            Mit Apple anmelden
          </button>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur text-white/60 text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Bald verfügbar
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-sm">oder</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-white/50 mb-1.5">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 px-4 py-3 outline-none focus:border-white/30 transition-colors"
            placeholder="name@beispiel.at"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-white/50 mb-1.5">
            Passwort
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 px-4 py-3 pr-12 outline-none focus:border-white/30 transition-colors"
              placeholder="Passwort eingeben"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm animate-shake">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl border border-white/20 bg-white/5 text-white font-medium py-3 px-4 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? <Spinner /> : 'Anmelden'}
        </button>
      </form>

      {/* Links */}
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/auth/forgot-password" className="text-white/40 hover:text-white/70 transition-colors">
          Passwort vergessen?
        </Link>
        <p className="text-white/30">
          Noch kein Konto?{' '}
          <Link href={`/auth/register${passthrough}`} className="text-white/70 hover:text-white transition-colors underline underline-offset-2">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ─── Inline Icons ─────────────────────────────────── */

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
