/**
 * Shared date formatting utilities for the Burgenland Events platform.
 *
 * Business rules:
 * - All formatting uses 'de-AT' locale
 * - Alles wird in Europe/Vienna formatiert (`EVENT_TZ`), nie in der Zeitzone
 *   der Runtime. Der Server läuft in UTC: ohne `timeZone` stand ein Konzert
 *   um 19:30 Wien in jeder Liste als "17:30", während die Detailseite
 *   (event-time.ts) korrekt 19:30 zeigte (Befund 2026-10-06, /thema/musik).
 * - Date-only strings (YYYY-MM-DD) are parsed as UTC noon, damit der
 *   Kalendertag in jeder Zeitzone derselbe bleibt
 * - Platzhalter-Uhrzeiten ("Uhrzeit unbekannt") werden ausgeblendet; die
 *   Erkennung ist dieselbe wie auf der Detailseite (`hasKnownStartTime`)
 */

import { EVENT_TZ, hasKnownStartTime, toViennaDate } from './event-time';

const LOCALE = 'de-AT';

/**
 * Parse a date string safely. Date-only strings (YYYY-MM-DD) become UTC noon,
 * which is the same calendar day in Vienna and in every browser zone.
 */
function parseDateSafe(dateStr: string): Date {
  const dateOnly = dateStr.length === 10 && !dateStr.includes('T');
  return dateOnly ? new Date(dateStr + 'T12:00:00Z') : new Date(dateStr);
}

/**
 * Format a date string for display in event cards (short format).
 * Example: "Mo., 15. Mär. 2026"
 */
export function formatDate(dateStr: string): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(LOCALE, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: EVENT_TZ,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string for display in event detail view (long format).
 * Example: "Montag, 15. März 2026"
 */
export function formatDateLong(dateStr: string, locale: string = LOCALE): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: EVENT_TZ,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date as a compact string (day + short month + year).
 * Example: "15. Mär. 2026"
 */
export function formatDateCompact(dateStr: string, locale: string = LOCALE): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: EVENT_TZ,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date as numeric (DD.MM.YYYY).
 * Example: "15.03.2026"
 */
export function formatDateNumeric(dateStr: string): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: EVENT_TZ,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date as short (day + short month, no year).
 * Example: "15. Mär."
 */
export function formatDateShort(dateStr: string): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'short',
      timeZone: EVENT_TZ,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Extract and format the time from a date string, in Vienna local time.
 * Returns null for date-only strings and for the "time unknown" placeholders.
 * Example: "14:30"
 */
export function formatTime(dateStr: string, locale: string = LOCALE): string | null {
  try {
    if (!dateStr || dateStr.length <= 10 || !dateStr.includes('T')) return null;
    if (!hasKnownStartTime({ start_date: dateStr })) return null;
    return new Date(dateStr).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: EVENT_TZ,
    });
  } catch {
    return null;
  }
}

/**
 * Format a date range (start - end) for display.
 * Shows end date only if it differs from start date.
 * Includes time if available.
 */
export function formatDateRange(startDate: string, endDate?: string | null): string {
  const startFormatted = formatDate(startDate);
  const startTime = formatTime(startDate);

  let result = startFormatted;
  if (startTime) {
    result += ` um ${startTime}`;
  }

  if (endDate) {
    const endTime = formatTime(endDate);
    const startDay = toViennaDate(parseDateSafe(startDate));
    const endDay = toViennaDate(parseDateSafe(endDate));

    if (startDay === endDay) {
      // Same day: only show end time
      if (endTime) {
        result += ` - ${endTime}`;
      }
    } else {
      // Different days: show full end date
      result += ` - ${formatDate(endDate)}`;
      if (endTime) {
        result += ` um ${endTime}`;
      }
    }
  }

  return result;
}

/**
 * Format a month header string for calendar views.
 * Example: "März 2026"
 */
export function formatMonthYear(year: number, month: number): string {
  // Monatsmitte in UTC: in keiner Zeitzone ein anderer Monat.
  return new Date(Date.UTC(year, month, 15)).toLocaleDateString(LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: EVENT_TZ,
  });
}
