'use client';

/**
 * Newsletter als eine Zeile (fn-30.6, Mockup D `.rowline`): links Titel und
 * Satz, rechts E-Mail, Region und Knopf, darunter der Datenschutzhinweis
 * (DSGVO, bleibt). Logik wie der frühere NewsletterSignup: POST
 * /api/newsletter/subscribe, Double-Opt-in-Mail, Erfolg ersetzt das Formular.
 *
 * Wortwahl „einmal pro Woche" statt „freitags": der Versandplan des Timers
 * `lt-cron@newsletter-weekly` liegt auf dem Server, nicht im Repo, und ist
 * von hier nicht zu bestätigen.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';

/** Regionen des Newsletters; 'oesterreich' heißt im Text t('regionAll'). */
export const NEWSLETTER_REGION_IDS = [
  'oesterreich', 'wien', 'niederoesterreich', 'oberoesterreich', 'steiermark',
  'salzburg', 'tirol', 'kaernten', 'vorarlberg', 'burgenland',
] as const;

const FIELD = 'h-11 min-w-0 rounded-[10px] border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] px-3.5 text-[var(--v4-ink)] focus:border-[var(--v4-hairline-3)] focus:outline-none';

export function NewsletterRow() {
  const t = useTranslations('Landing.Newsletter');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState<string>('oesterreich');
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
        setMessage(data.message ?? t('doneFallback'));
      } else {
        setState('error');
        setMessage(data.error ?? t('errorFallback'));
      }
    } catch {
      setState('error');
      setMessage(t('networkError'));
    }
  }

  return (
    <section
      className="mt-11 grid gap-3.5 border-t border-[var(--v4-hairline-2)] py-[22px] md:grid-cols-[1.1fr_1fr] md:items-center md:gap-6"
      data-testid="newsletter-row"
    >
      <div>
        <h2 className="m-0 mb-1 text-[19px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{t('title')}</h2>
        <p className="m-0 text-[13.5px] text-[var(--v4-ink-50)]">{t('text')}</p>
      </div>
      <div>
        {state === 'done' ? (
          <div className="rounded-[10px] border border-[rgba(122,196,144,0.35)] bg-[rgba(122,196,144,0.10)] px-4 py-3 text-[13.5px] text-[var(--v4-ink)]" role="status">
            ✓ {message}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-wrap gap-2 sm:flex-nowrap">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              aria-label={t('emailPlaceholder')}
              className={`${FIELD} flex-[1_1_160px] text-[16px] placeholder-[var(--v4-ink-30)] md:text-[14px]`}
            />
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              aria-label={t('regionAria')}
              className={`${FIELD} flex-[1_1_120px] text-[14px] sm:flex-[0_0_150px]`}
            >
              {NEWSLETTER_REGION_IDS.map(id => (
                <option key={id} value={id}>{id === 'oesterreich' ? t('regionAll') : bundeslandDisplayName(id, locale)}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={state === 'loading' || !email}
              data-track="newsletter_subscribe"
              className="press-haptic h-11 whitespace-nowrap rounded-[10px] bg-white px-[18px] text-[14px] font-bold text-[#0a0a0c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === 'loading' ? t('submitting') : t('submit')}
            </button>
          </form>
        )}
        {state === 'error' && <p className="mb-0 mt-2 text-[13px] text-[var(--v4-alert)]">{message}</p>}
        <p className="mb-0 mt-2 text-[11px] leading-relaxed text-[var(--v4-ink-30)]" data-testid="newsletter-privacy">
          {t('privacyNote')}{' '}
          <a href="/datenschutz" className="underline underline-offset-2">{t('privacyLink')}</a>.
        </p>
      </div>
    </section>
  );
}
