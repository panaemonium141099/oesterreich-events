'use client';

import { useLocale, useTranslations } from 'next-intl';
import { V4EntdeckenTabs, type V4EntdeckenMode } from '@/components/Events/v4';
import { EVENT_TZ } from '@/lib/utils/event-time';

interface V4EntdeckenHeroProps {
  mode: V4EntdeckenMode;
  onModeChange: (next: V4EntdeckenMode) => void;
}

/**
 * Kopf von /entdecken (Variante „Regale", 2026-10-22): Titel, heutiges
 * Datum mit Geltungsbereich und der Modus-Umschalter Liste / Smart-Suche.
 * Die Region-Chips und die Regale folgen im Listen-Modus darunter.
 */
export function V4EntdeckenHero({ mode, onModeChange }: V4EntdeckenHeroProps) {
  const t = useTranslations('Discover');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const dateLine = new Date().toLocaleDateString(fmt, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: EVENT_TZ,
  });
  return (
    <section className="pt-7 pb-3 md:pt-9">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="m-0 text-[34px] md:text-[40px] font-extrabold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.05]">
            {t('title')}
          </h1>
          {/* Server und Browser können um Mitternacht verschiedene Tage sehen. */}
          <p suppressHydrationWarning className="mt-1.5 mb-0 text-[14px] text-[var(--v4-ink-50)]">
            {dateLine} · {t('scopeAll')}
          </p>
        </div>
        <V4EntdeckenTabs current={mode} onChange={onModeChange}/>
      </div>
    </section>
  );
}
