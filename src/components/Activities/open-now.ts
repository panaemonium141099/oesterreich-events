/**
 * "Jetzt geoeffnet"-Auswertung (fn-18 Task 3, Epic E8) — pur, getestet.
 *
 * Liest AUSSCHLIESSLICH das normalisierte opening_times-Feld (E8-Vertrag):
 *   { from:'YYYY-MM-DD', to:'YYYY-MM-DD', timeFrom:'HH:MM', timeTo:'HH:MM',
 *     weekdays:<Bitmaske Mo=1..So=64>|null (null = alle Tage) }
 *   - timeFrom == timeTo == '00:00'  -> durchgehend geoeffnet
 *   - timeTo < timeFrom              -> Fenster ueber Mitternacht (der
 *     Morgen-Teil zaehlt auf den Wochentag des VORTAGS)
 *   - timeFrom == timeTo != '00:00'  -> Null-Laenge, nie geoeffnet
 *
 * Zeitzone Europe/Vienna via Intl (client- und node-seitig identisch) —
 * die ISR-Seite bleibt statisch korrekt, der Badge rechnet im Browser.
 */

import type { NormalizedOpeningWindow } from '@/lib/activities/opening';

/** Lokale Vienna-Sicht eines Zeitpunkts. */
export interface ViennaInstant {
  /** 'YYYY-MM-DD' lokal in Europe/Vienna. */
  date: string;
  /** Minuten seit lokal Mitternacht (0..1439). */
  minutes: number;
  /** Wochentags-Bit Mo=1..So=64 (E8-Bitmaske). */
  weekdayBit: number;
}

const WEEKDAY_NAME_TO_BIT: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 4, Thu: 8, Fri: 16, Sat: 32, Sun: 64,
};

/** Projiziert einen Date-Zeitpunkt in die lokale Europe/Vienna-Sicht. */
export function toViennaInstant(now: Date): ViennaInstant {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekdayBit: WEEKDAY_NAME_TO_BIT[parts.weekday] ?? 1,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function dayMatches(mask: number | null, weekdayBit: number): boolean {
  return mask == null || (mask & weekdayBit) !== 0;
}

function inSeason(date: string, w: NormalizedOpeningWindow): boolean {
  return date >= w.from && date <= w.to;
}

/** 'YYYY-MM-DD' des Vortags (UTC-Arithmetik, Input ist reines Datum). */
function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  const mm = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(prev.getUTCDate()).padStart(2, '0');
  return `${prev.getUTCFullYear()}-${mm}-${dd}`;
}

/** Bit des Vortags in der Mo=1..So=64-Maske (zyklisch). */
function previousWeekdayBit(bit: number): number {
  return bit === 1 ? 64 : bit >> 1;
}

/**
 * True, wenn irgendein Fenster den Zeitpunkt abdeckt. Leeres/fehlendes
 * Feld -> false (der Badge wird dann gar nicht gerendert).
 */
export function isOpenAt(
  windows: NormalizedOpeningWindow[] | null | undefined,
  instant: ViennaInstant,
): boolean {
  if (!windows || windows.length === 0) return false;

  for (const w of windows) {
    const allDay = w.timeFrom === '00:00' && w.timeTo === '00:00';
    const fromMin = toMinutes(w.timeFrom);
    const toMin = toMinutes(w.timeTo);

    // Heute gestartete Abdeckung (Saison + Wochentag von heute).
    if (inSeason(instant.date, w) && dayMatches(w.weekdays, instant.weekdayBit)) {
      if (allDay) return true;
      if (toMin > fromMin && instant.minutes >= fromMin && instant.minutes < toMin) return true;
      if (toMin < fromMin && instant.minutes >= fromMin) return true; // Abend-Teil
    }

    // Morgen-Teil eines Mitternachts-Fensters: zaehlt auf den Vortag.
    if (!allDay && toMin < fromMin && instant.minutes < toMin) {
      const prevDate = previousDay(instant.date);
      if (inSeason(prevDate, w) && dayMatches(w.weekdays, previousWeekdayBit(instant.weekdayBit))) {
        return true;
      }
    }
  }
  return false;
}

/** Convenience fuer den Badge: jetzt geoeffnet? */
export function isOpenNow(
  windows: NormalizedOpeningWindow[] | null | undefined,
  now: Date = new Date(),
): boolean {
  return isOpenAt(windows, toViennaInstant(now));
}
