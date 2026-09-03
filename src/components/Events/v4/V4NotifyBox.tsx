'use client';

/**
 * V4NotifyBox — „Nicht verpassen": Erinnerung zu diesem Event.
 *
 * Sitzt unter der jeweiligen Zustands-Box (Ticket / Frei / Abendkasse / …)
 * und deckt beide Nutzergruppen ab:
 *
 *   nicht eingeloggt → E-Mail eintragen, Zeitpunkte waehlen, doppeltes
 *     Opt-in per Bestaetigungsmail (POST /api/event-reminder/subscribe).
 *     Kein Konto noetig; genau das war bisher im V4AnonSaveDialog vergraben
 *     und damit nur zu finden, wenn man auf „Merken" geklickt hat.
 *   eingeloggt → der normale Weg: merken, Erinnerungen laufen ueber die
 *     Profil-Einstellungen. Hier steht dann der V4SaveButton statt eines
 *     zweiten, konkurrierenden E-Mail-Formulars.
 *
 * Die Zeitpunkte entsprechen den Fenstern, die der Cron send-reminders
 * kennt (Spalte event_email_reminders.windows): eine Woche vorher, zwei
 * Tage vorher, am Tag des Events.
 */

import { useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { V4SaveButton } from './V4SaveButton';
import { trackEvent } from '@/lib/analytics';

/** Muss mit ALLOWED_WINDOWS in /api/event-reminder/subscribe uebereinstimmen. */
const WINDOWS = [
  { key: '7d', label: 'Eine Woche vorher' },
  { key: '2d', label: 'Zwei Tage vorher' },
  { key: 'day', label: 'Am Tag des Events' },
] as const;

interface V4NotifyBoxProps {
  eventId: string;
  /** Vergangene Events bekommen keine Box — dort waere sie sinnlos. */
  startDate?: string | null;
}

export function V4NotifyBox({ eventId, startDate }: V4NotifyBoxProps) {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState<string[]>(['2d', 'day']);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (startDate && new Date(startDate) < new Date()) return null;

  const toggle = (key: string) =>
    setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (picked.length === 0) {
      setError('Bitte waehle mindestens einen Zeitpunkt.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/event-reminder/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventId, windows: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Eintragen fehlgeschlagen — bitte später erneut versuchen.');
        return;
      }
      trackEvent('event_reminder_subscribe', { id: eventId, windows: picked.join(',') });
      setDone(data.message ?? 'Fast geschafft — bitte bestätige den Link in deinem Postfach.');
    } catch {
      setError('Eintragen fehlgeschlagen — bitte später erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  // Solange die Session laedt, nichts rendern — sonst blitzt das
  // E-Mail-Formular kurz auf, obwohl der Besucher eingeloggt ist.
  if (authLoading) return null;

  return (
    <div
      data-v4-side-box="notify"
      className="mt-4 rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid var(--v4-hairline-2)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-accent, #c8553d)' }} />
      <div className="p-[20px_22px_22px]">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
          Nicht verpassen
        </p>

        {user ? (
          <>
            <p className="mt-2 text-[13px] text-[var(--v4-ink-70)] leading-snug">
              Merk dir das Event — du wirst rechtzeitig erinnert. Wann genau, stellst du
              in deinem Profil ein.
            </p>
            <div className="mt-3.5">
              <V4SaveButton eventId={eventId} fillRow />
            </div>
          </>
        ) : done ? (
          <p className="mt-2 text-[13px] text-[var(--v4-ink-70)] leading-snug">{done}</p>
        ) : (
          <form onSubmit={submit} className="mt-2">
            <p className="text-[13px] text-[var(--v4-ink-70)] leading-snug">
              Lass dich per E-Mail erinnern — ganz ohne Konto.
            </p>

            <fieldset className="mt-3.5">
              <legend className="text-[12px] font-semibold text-[var(--v4-ink-70)] mb-2">
                Wann sollen wir dich erinnern?
              </legend>
              <div className="flex flex-col gap-1.5">
                {WINDOWS.map((w) => (
                  <label key={w.key} className="flex items-center gap-2.5 text-[13px] text-[var(--v4-ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={picked.includes(w.key)}
                      onChange={() => toggle(w.key)}
                      className="h-4 w-4 shrink-0 accent-[#c8553d]"
                    />
                    {w.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="notify-email" className="sr-only">E-Mail-Adresse</label>
            <input
              id="notify-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.at"
              /* 16px: alles darunter loest auf iOS den Auto-Zoom aus. */
              className="mt-3.5 w-full rounded-full px-4 py-2.5 text-[16px] bg-[var(--v4-surface)] text-[var(--v4-ink)] border border-[var(--v4-hairline-3)] outline-none focus:border-[#c8553d]"
            />

            {error && (
              <p role="alert" className="mt-2 text-[12px] text-[#e0705a]">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              data-track="event_reminder_submit"
              data-track-id={eventId}
              className="press-haptic mt-3 w-full rounded-full px-4 py-2.5 text-[13px] font-semibold bg-[var(--v4-ink)] text-[#0a0a0c] disabled:opacity-60"
            >
              {busy ? 'Wird eingetragen …' : 'Erinnere mich'}
            </button>

            <p className="mt-2.5 text-[11px] text-[var(--v4-ink-50)] leading-snug">
              Du bekommst eine Bestätigungsmail. Abmelden geht jederzeit über den Link
              in jeder Erinnerung.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
