'use client';

/**
 * Wetter für die Landing (Open-Meteo, keyless, CORS-offen).
 *
 * Zwei Abfragen, je einmal pro Seitenaufruf erzeugt:
 * - `loadWeekendWeather`: Prognose für den nächsten Wochenendtag am
 *   gespeicherten Standort (sonst Wien), geteilt zwischen Saisonkarte und
 *   Freizeit-Spur.
 * - `loadTodayWeather`: heute in Wien für die Datumszeile des Kopfs
 *   (fn-30.5), immer Wien, unabhängig vom gespeicherten Standort.
 */

import { getStoredLocation } from '@/lib/geolocation';
import { viennaWeekday } from '@/lib/utils/event-time';

export const VIENNA = { lat: 48.21, lng: 16.37 };
export const RAIN_MM = 3;
export const HEAT_C = 27;

export interface WeekendWeather {
  mode: 'rain' | 'heat' | null;
  /** YYYY-MM-DD des bewerteten Tages (heute, falls Sa/So, sonst kommender Samstag). */
  day: string;
  tempMax: number;
  precipMm: number;
  usedStoredLocation: boolean;
  loc: { lat: number; lng: number };
}

/** Wetter heute in Wien (Datumszeile). */
export interface TodayWeather {
  /** YYYY-MM-DD des Wiener Tags laut Open-Meteo. */
  day: string;
  tempMax: number;
  precipMm: number;
}

interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  precipitation_sum: number[];
}

/** Nächster Wochenendtag (heute, falls Sa/So, sonst kommender Samstag).
 *  Wien-Wochentag, passend zu Open-Meteo `timezone=Europe/Vienna`. */
function nextWeekendOffset(now: Date): number {
  const dow = viennaWeekday(now); // 0 So … 6 Sa
  if (dow === 6 || dow === 0) return 0;
  return 6 - dow;
}

export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

async function fetchDaily(loc: { lat: number; lng: number }, days: number): Promise<DailyForecast | null> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(loc.lat)}&longitude=${roundCoord(loc.lng)}` +
    `&daily=temperature_2m_max,precipitation_sum&timezone=Europe%2FVienna&forecast_days=${days}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { daily?: DailyForecast };
  return data.daily ?? null;
}

let pending: Promise<WeekendWeather | null> | null = null;

export function loadWeekendWeather(): Promise<WeekendWeather | null> {
  pending ??= (async () => {
    try {
      const stored = getStoredLocation();
      const loc = stored ?? VIENNA;
      const daily = await fetchDaily(loc, 7);
      if (!daily) return null;

      const idx = Math.min(nextWeekendOffset(new Date()), daily.time.length - 1);
      const tempMax = daily.temperature_2m_max[idx];
      const precipMm = daily.precipitation_sum[idx];
      if (typeof tempMax !== 'number' || typeof precipMm !== 'number') return null;

      let mode: WeekendWeather['mode'] = null;
      if (precipMm >= RAIN_MM) mode = 'rain';
      else if (tempMax >= HEAT_C) mode = 'heat';

      return {
        mode,
        day: daily.time[idx],
        tempMax: Math.round(tempMax),
        precipMm: Math.round(precipMm),
        usedStoredLocation: stored != null,
        loc,
      };
    } catch {
      // Wetter ist Bonus-Content, jeder Fehler lässt die Landing unverändert.
      return null;
    }
  })().then(r => {
    if (!r) pending = null; // Fehlschlag nicht für die ganze Sitzung merken
    return r;
  });
  return pending;
}

let pendingToday: Promise<TodayWeather | null> | null = null;

/** Heute in Wien, für die Datumszeile; null bei jedem Fehler. */
export function loadTodayWeather(): Promise<TodayWeather | null> {
  pendingToday ??= (async () => {
    try {
      const daily = await fetchDaily(VIENNA, 1);
      if (!daily) return null;
      const tempMax = daily.temperature_2m_max[0];
      const precipMm = daily.precipitation_sum[0];
      if (typeof tempMax !== 'number' || typeof precipMm !== 'number') return null;
      return { day: daily.time[0], tempMax: Math.round(tempMax), precipMm: Math.round(precipMm) };
    } catch {
      return null;
    }
  })().then(r => {
    if (!r) pendingToday = null;
    return r;
  });
  return pendingToday;
}
