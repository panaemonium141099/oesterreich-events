'use client';

/**
 * V4AnonSaveDialog — erscheint, wenn ein NICHT eingeloggter User „Merken"
 * drückt (User-Auftrag 2026-07-15). Zwei Wege:
 *   1. Einloggen/Registrieren (voller Merken-Flow mit Konto)
 *   2. E-Mail-Erinnerung ohne Konto: Adresse eintragen → Double-Opt-in-
 *      Mail → Erinnerung 2 Tage vorher + am Event-Tag
 *      (POST /api/event-reminder/subscribe, Muster wie Newsletter).
 *
 * Vorher schob der Merken-Button Anonyme kommentarlos auf /auth/login —
 * gefühlt „nichts passiert" und der halbe Funnel sprang ab.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface V4AnonSaveDialogProps {
  eventId: string;
  /** Ziel nach Login — aktueller Event-Pfad. */
  nextPath: string;
  onClose: () => void;
}

export function V4AnonSaveDialog({ eventId, nextPath, onClose }: V4AnonSaveDialogProps) {
  const t = useTranslations('EventDetail');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/event-reminder/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('anonErrorFallback'));
        return;
      }
      setDone(data.message ?? t('anonDoneFallback'));
    } catch {
      setError(t('anonErrorFallback'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('anonTitle')}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#141416] text-white p-6 shadow-2xl shadow-black/60">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/70 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-[18px] font-bold mb-1.5">{t('anonTitle')}</h2>

        {done ? (
          <div className="py-4">
            <p className="text-[14px] leading-relaxed text-emerald-300">{done}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              {t('anonOk')}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13.5px] text-white/50 leading-relaxed mb-5">
              {t('anonIntro')}
            </p>

            <a
              href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
              data-track="anon_save_login"
              className="block w-full text-center py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              {t('anonLogin')}
            </a>

            <div className="flex items-center gap-3 my-5">
              <span className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">{t('anonOr')}</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={submit}>
              <label htmlFor="anon-reminder-email" className="block text-[13px] font-semibold text-white/70 mb-2">
                {t('anonEmailLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="anon-reminder-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t('anonEmailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3 text-[16px] sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={busy}
                  data-track="anon_save_reminder"
                  data-track-id={eventId}
                  className="px-4 py-3 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {busy ? t('anonSubmitting') : t('anonSubmit')}
                </button>
              </div>
              {error && <p className="mt-2 text-[12.5px] text-red-400">{error}</p>}
              <p className="mt-3 text-[11.5px] text-white/35 leading-relaxed">
                {t('anonPrivacy')}{' '}
                <a href="/datenschutz" className="underline underline-offset-2 text-white/50">{t('anonPrivacyLink')}</a>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
