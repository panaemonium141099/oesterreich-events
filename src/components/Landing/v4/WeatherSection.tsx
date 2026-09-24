'use client';

/**
 * WeatherSection — wetter-reaktive Landing-Sektion (fn-19 "kreativ").
 *
 * Holt die Wochenend-Prognose von Open-Meteo (kostenlos, keyless, CORS-
 * offen) fuer den gespeicherten User-Standort (geteilter user_location-
 * Store) bzw. Wien als Default und reagiert nur auf ECHTE Wetterlagen:
 *
 *   Regen (>= 3 mm am naechsten Wochenendtag)  → Indoor-Programm
 *   Hitze (>= 27 °C)                           → Wasser-Programm
 *   sonst                                      → rendert NICHTS
 *
 * Die Vorschlaege kommen aus /api/activities/nearby (setting=indoor bzw.
 * tag=schwimmen) — das ist der Micro-freundliche, CDN-gecachte Pfad, und
 * das setting-Feld der 10,5k Deskline-POIs hat sonst niemand.
 *
 * Client-only wie PersonalizedMatches: die Landing bleibt eine statische
 * ISR-Shell, anonyme Erst-Besucher ohne Standort sehen die Sektion mit
 * Wien-Wetter — Wien ist das groesste Publikum, und der Standort-Opt-in
 * lebt bereits auf /aktivitaeten.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ActivityCardImage } from '@/components/Activities/ActivityCardImage';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { loadWeekendWeather, roundCoord } from '@/lib/landing/weekend-weather';

interface NearbyActivity {
  id: string;
  slug: string;
  name: string;
  tags: string[] | null;
  town: string | null;
  images: unknown;
  distance_km: number;
}

interface WeatherState {
  mode: 'rain' | 'heat';
  /** Wochentag-Label des bewerteten Tages, z. B. "Samstag". */
  dayLabel: string;
  tempMax: number;
  precipMm: number;
  usedStoredLocation: boolean;
  activities: NearbyActivity[];
}

export function WeatherSection() {
  const t = useTranslations('Landing.Weather');
  const locale = useLocale();
  const [state, setState] = useState<WeatherState | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const weather = await loadWeekendWeather();
      if (!weather || !weather.mode || !alive) return; // normales Wetter → Sektion bleibt unsichtbar
      const { mode, loc } = weather;
      try {
        const filter = mode === 'rain' ? 'setting=indoor' : 'tag=schwimmen';
        const actRes = await fetch(
          `/api/activities/nearby?lat=${roundCoord(loc.lat)}&lng=${roundCoord(loc.lng)}&limit=8&${filter}`,
        );
        if (!actRes.ok || !alive) return;
        const actBody = (await actRes.json()) as { activities?: NearbyActivity[] };
        if (!actBody.activities || actBody.activities.length < 3) return;

        const dayLabel = new Date(weather.day + 'T12:00:00').toLocaleDateString(
          locale === 'de' ? 'de-AT' : 'en-GB',
          { weekday: 'long' },
        );
        setState({
          mode,
          dayLabel,
          tempMax: weather.tempMax,
          precipMm: weather.precipMm,
          usedStoredLocation: weather.usedStoredLocation,
          activities: actBody.activities,
        });
      } catch {
        // Wetter ist Bonus-Content — jeder Fehler laesst die Landing unveraendert.
      }
    })();
    return () => { alive = false; };
  }, [locale]);

  if (!state) return null;

  const title =
    state.mode === 'rain'
      ? t('rainTitle', { day: state.dayLabel })
      : t('heatTitle', { day: state.dayLabel, temp: state.tempMax });
  const kicker =
    state.mode === 'rain'
      ? t('rainKicker', { mm: state.precipMm })
      : t('heatKicker');

  return (
    <section id="wetter" className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10 scroll-mt-20" data-testid="weather-section">
      <div className="mb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          {state.mode === 'rain' ? '🌧' : '☀️'} {kicker}
          {!state.usedStoredLocation && ` · ${t('viennaFallback')}`}
        </p>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--v4-ink)] tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-flow-col auto-cols-[70%] sm:auto-cols-[45%] lg:auto-cols-[24%] gap-4 overflow-x-auto pb-2 snap-x">
        {state.activities.map((a) => (
          <Link
            key={a.id}
            href={`/aktivitaet/${a.slug}`}
            className="press-haptic rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block snap-start"
            data-track="landing_weather_card"
          >
            <ActivityCardImage
              images={a.images}
              alt={a.name}
              fallbackLabel={a.tags?.[0] ? activityTagLabel(a.tags[0]) : t('cardFallback')}
              creditPrefix={t('imageCredit')}
              aspectClass="aspect-[4/3]"
            />
            <div className="p-3">
              <div className="font-semibold leading-snug line-clamp-2 mb-1 text-[var(--v4-ink)]">{a.name}</div>
              <div className="text-xs text-[var(--v4-ink-50)]">
                {a.distance_km.toLocaleString('de-AT')} km
                {a.town ? ` · ${a.town}` : ''}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <Link
          href="/aktivitaeten"
          className="text-sm font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] transition-colors"
          data-track="landing_weather_more"
        >
          {t('moreLink')} →
        </Link>
      </div>
    </section>
  );
}
