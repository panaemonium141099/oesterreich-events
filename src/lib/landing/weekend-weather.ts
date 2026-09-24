'use client';

/**
 * Wochenend-Prognose für die Landing (Open-Meteo, keyless, CORS-offen).
 *
 * Geteilt zwischen der Wetterzeile der Hero-Saisonkarte und der
 * WeatherSection weiter unten: das Promise wird pro Seitenaufruf nur
 * einmal erzeugt, beide lesen dasselbe Ergebnis.
 */

import { getStoredLocation } from '@/lib/geolocation';

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

/** Nächster Wochenendtag (heute, falls Sa/So, sonst kommender Samstag). */
function nextWeekendOffset(now: Date): number {
  const dow = now.getDay(); // 0 So … 6 Sa
  if (dow === 6 || dow === 0) return 0;
  return 6 - dow;
}

export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

let pending: Promise<WeekendWeather | null> | null = null;

export function loadWeekendWeather(): Promise<WeekendWeather | null> {
  pending ??= (async () => {
    try {
      const stored = getStoredLocation();
      const loc = stored ?? VIENNA;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(loc.lat)}&longitude=${roundCoord(loc.lng)}` +
        '&daily=temperature_2m_max,precipitation_sum&timezone=Europe%2FVienna&forecast_days=7',
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        daily?: { time: string[]; temperature_2m_max: number[]; precipitation_sum: number[] };
      };
      const daily = data.daily;
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
