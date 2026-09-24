'use client';

/**
 * Wetterzeile der Hero-Saisonkarte. Client-only, damit die Landing eine
 * statische ISR-Shell bleibt; bis die Prognose da ist, steht nur der
 * Saison-Kicker. Bei Regen oder Hitze wird die Zeile zum Link auf die
 * passenden Freizeitaktivitäten.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { loadWeekendWeather, type WeekendWeather } from '@/lib/landing/weekend-weather';

export function SeasonWeather() {
  const t = useTranslations('Landing.Season');
  const locale = useLocale();
  const [weather, setWeather] = useState<WeekendWeather | null>(null);

  useEffect(() => {
    let alive = true;
    loadWeekendWeather().then(w => { if (alive) setWeather(w); });
    return () => { alive = false; };
  }, []);

  if (!weather) return null;

  const day = new Date(weather.day + 'T12:00:00').toLocaleDateString(
    locale === 'de' ? 'de-AT' : 'en-GB',
    { weekday: 'long' },
  );
  const place = weather.usedStoredLocation ? t('weatherNearby') : t('weatherVienna');
  const icon = weather.mode === 'rain' ? '🌧' : weather.precipMm > 0 ? '⛅' : '☀️';
  const base = t('weatherLine', { temp: weather.tempMax, day, place });

  if (!weather.mode) {
    return (
      <p className="text-[12px] text-[var(--v4-ink-50)]" data-testid="season-weather">
        <span aria-hidden="true">{icon}</span> {base}
      </p>
    );
  }

  const href = weather.mode === 'rain' ? '/aktivitaeten?setting=indoor' : '/aktivitaeten?tag=schwimmen';
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--v4-match)] hover:underline underline-offset-2"
      data-track="landing_season_weather"
      data-testid="season-weather"
    >
      <span aria-hidden="true">{icon}</span>
      {weather.mode === 'rain' ? t('weatherRain', { day }) : t('weatherHeat', { temp: weather.tempMax, day })}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
