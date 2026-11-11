'use client';

/**
 * Datumszeile des Zeitungskopfs (fn-30.5): Wiener Tag, Wetter heute in
 * Wien, gerundete Zahl der kommenden Events in Österreich.
 *
 * Client-Insel aus zwei Gründen: das Wetter kommt erst im Browser
 * (Open-Meteo, keyless), und der Tag wird nach Mitternacht neu gerechnet,
 * weil die Seite als ISR-Shell bis zu einer Stunde alt sein kann. Der
 * erste Client-Render zeigt exakt den Server-Tag (Prop), erst der Effekt
 * korrigiert; der neue Tag geht über `announceViennaDay` an die
 * Programmliste. Für das Wetter ist der Platz reserviert (min-width), die
 * Zeile springt beim Laden nicht.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { loadTodayWeather, RAIN_MM, type TodayWeather } from '@/lib/landing/weekend-weather';
import { announceViennaDay } from '@/lib/landing/vienna-day';
import { EVENT_TZ, viennaDayRange, viennaToday } from '@/lib/utils/event-time';

/** „über 88.000": auf volle Tausender abgerundet, unter 1.000 keine Zahl. */
export function roundCountryTotal(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const rounded = Math.floor(n / 1000) * 1000;
  return rounded > 0 ? rounded : null;
}

/**
 * „88.000" bzw. „88,000": Tausenderpunkt wie im Mockup und auf der Seite.
 * Nicht über Intl: ICU setzt für de-AT ein geschütztes Leerzeichen.
 */
export function formatThousands(n: number, locale: string): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'de' ? '.' : ',');
}

/** „Freitag, 30. Oktober" für einen Wiener Kalendertag (YYYY-MM-DD). */
export function formatViennaDay(day: string, locale: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(
    locale === 'de' ? 'de-AT' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: EVENT_TZ },
  );
}

export function weatherIcon(precipMm: number): string {
  return precipMm >= RAIN_MM ? '🌧' : precipMm > 0 ? '⛅' : '☀️';
}

const SEPARATOR = <span aria-hidden="true" className="px-1.5">·</span>;

export function DateLine({ today, countryTotal }: { today: string; countryTotal: number | null }) {
  const t = useTranslations('Landing.Masthead');
  const locale = useLocale();
  const [day, setDay] = useState(today);
  const [weather, setWeather] = useState<TodayWeather | null>(null);

  // Mitternacht: Tag neu rechnen, sobald der Wiener Tag wechselt. Der erste
  // Durchlauf gleicht eine ältere Ausgabe sofort ab (Seite von gestern).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      const now = new Date();
      const current = viennaToday(now);
      setDay(current);
      announceViennaDay(current);
      const wait = viennaDayRange(current).next.getTime() - now.getTime();
      timer = setTimeout(sync, Math.max(1_000, wait + 500));
    };
    sync();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    loadTodayWeather().then(w => { if (alive) setWeather(w); });
    return () => { alive = false; };
  }, []);

  const count = roundCountryTotal(countryTotal);

  return (
    <p className="m-0 mb-2.5 text-[13.5px] leading-snug text-[var(--v4-ink-50)]" data-testid="date-line">
      <b className="font-semibold text-[var(--v4-ink)]" data-testid="date-line-day">
        {formatViennaDay(day, locale)}
      </b>
      <span className="inline-block min-w-[9ch] whitespace-nowrap" data-testid="date-line-weather">
        {weather && (
          <>
            {SEPARATOR}
            <span aria-hidden="true">{weatherIcon(weather.precipMm)}</span>{' '}
            {t('weatherVienna', { temp: weather.tempMax })}
          </>
        )}
      </span>
      {count != null && (
        <span className="whitespace-nowrap" data-testid="date-line-count">
          {SEPARATOR}
          <b className="font-semibold text-[var(--v4-ink)]">{t('over', { count: formatThousands(count, locale) })}</b>
          {' '}
          {t('eventsCount')}
        </span>
      )}
    </p>
  );
}
