'use client';

/**
 * NewsletterSignup — Wochen-Newsletter pro Region, OHNE Account (§8.2).
 * Client-Komponente (statisch-sicher für die ISR-Landing): E-Mail + Region
 * → POST /api/newsletter/subscribe → Double-Opt-in-Mail.
 */

import { useState } from 'react';

const REGIONS: Array<{ id: string; label: string }> = [
  { id: 'oesterreich', label: 'Ganz Österreich' },
  { id: 'wien', label: 'Wien' },
  { id: 'niederoesterreich', label: 'Niederösterreich' },
  { id: 'oberoesterreich', label: 'Oberösterreich' },
  { id: 'steiermark', label: 'Steiermark' },
  { id: 'salzburg', label: 'Salzburg' },
  { id: 'tirol', label: 'Tirol' },
  { id: 'kaernten', label: 'Kärnten' },
  { id: 'vorarlberg', label: 'Vorarlberg' },
  { id: 'burgenland', label: 'Burgenland' },
];

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('oesterreich');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        setState('done');
        setMessage(data.message ?? 'Bitte bestätige die Anmeldung in deinem Postfach.');
      } else {
        setState('error');
        setMessage(data.error ?? 'Anmeldung fehlgeschlagen — bitte später erneut versuchen.');
      }
    } catch {
      setState('error');
      setMessage('Netzwerkfehler — bitte erneut versuchen.');
    }
  }

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-10 md:py-14">
      <div className="rounded-[22px] border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-6 md:p-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          Jede Woche · kostenlos · jederzeit abbestellbar
        </p>
        <h2 className="text-[22px] md:text-[26px] font-bold leading-tight tracking-[-0.025em] mb-2 text-[var(--v4-ink)]">
          Die besten Events deiner Region — freitags im Postfach
        </h2>
        <p className="text-[13.5px] text-[var(--v4-ink-70)] mb-6 max-w-[560px]">
          Kein Account nötig. Wir schicken dir einmal pro Woche eine handverlesene
          Auswahl fürs Wochenende — und sonst nichts.
        </p>

        {state === 'done' ? (
          <div className="rounded-xl border border-[rgba(122,196,144,0.35)] bg-[rgba(122,196,144,0.10)] px-4 py-3 text-[13.5px] text-[var(--v4-ink)]">
            ✓ {message}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.at"
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] placeholder-[var(--v4-ink-30)] text-[14px] focus:outline-none focus:border-[var(--v4-hairline-3)]"
            />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Region wählen"
              className="px-4 py-3 rounded-xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[14px] focus:outline-none focus:border-[var(--v4-hairline-3)]"
            >
              {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button
              type="submit"
              disabled={state === 'loading' || !email}
              data-track="newsletter_subscribe"
              className="press-haptic px-6 py-3 rounded-xl bg-[var(--v4-ink)] text-[#0a0a0c] font-semibold text-[14px] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {state === 'loading' ? 'Einen Moment …' : 'Anmelden'}
            </button>
          </form>
        )}

        {state === 'error' && (
          <p className="mt-3 text-[13px] text-[var(--v4-alert)]">{message}</p>
        )}
        <p className="mt-4 text-[11px] text-[var(--v4-ink-30)] leading-relaxed">
          Double-Opt-in: Die Anmeldung wird erst nach Bestätigung per E-Mail aktiv.
          Abmeldung jederzeit mit einem Klick in jeder Mail. Details in der{' '}
          <a href="/datenschutz" className="underline underline-offset-2">Datenschutzerklärung</a>.
        </p>
      </div>
    </section>
  );
}
