/**
 * Shared date formatting utilities for the Burgenland Events platform.
 *
 * Business rules:
 * - All formatting uses 'de-AT' locale
 * - Date-only strings (YYYY-MM-DD) are parsed with T12:00:00 to avoid UTC timezone shift
 * - Times of 00:00 and 01:00 are hidden (indicate no real time was set;
 *   01:00 appears due to UTC+1 CET timezone offset for midnight dates)
 */

const LOCALE = 'de-AT';

/**
 * Parse a date string safely, handling date-only strings (YYYY-MM-DD)
 * by appending T12:00:00 to avoid UTC timezone shift issues.
 */
function parseDateSafe(dateStr: string): Date {
  const dateOnly = dateStr.length === 10 && !dateStr.includes('T');
  return dateOnly ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
}

/**
 * Check whether a date string has a meaningful time component.
 * Returns false for date-only strings or times that represent "no time set".
 *
 * We check the RAW STRING (not parsed Date) to avoid timezone issues:
 * "2026-04-12T00:00:00Z" stored as midnight UTC would show as 02:00 in
 * Europe/Vienna (CEST, UTC+2) if we relied on getHours().
 */
function hasRealTime(dateStr: string): boolean {
  if (!dateStr || dateStr.length <= 10 || !dateStr.includes('T')) return false;
  // Extract the time portion from the ISO string (after 'T', before timezone)
  const timePart = dateStr.split('T')[1]?.replace(/[Z+\-].*$/, '') || '';
  // "00:00:00" or "00:00" = no real time was set
  if (timePart === '00:00:00' || timePart === '00:00' || timePart.startsWith('00:00:00.')) return false;
  return true;
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
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string for display in event detail view (long format).
 * Example: "Montag, 15. März 2026"
 */
export function formatDateLong(dateStr: string): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(LOCALE, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date as a compact string (day + short month + year).
 * Example: "15. Mär. 2026"
 */
export function formatDateCompact(dateStr: string): string {
  try {
    const date = parseDateSafe(dateStr);
    return date.toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
    });
  } catch {
    return dateStr;
  }
}

/**
 * Extract and format the time from a date string.
 * Returns null if no meaningful time is present.
 * Example: "14:30"
 */
export function formatTime(dateStr: string): string | null {
  try {
    if (!hasRealTime(dateStr)) return null;
    const date = new Date(dateStr);
    return date.toLocaleTimeString(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
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
    const startDay = parseDateSafe(startDate).toDateString();
    const endDay = parseDateSafe(endDate).toDateString();

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
  return new Date(year, month).toLocaleDateString(LOCALE, {
    month: 'long',
    year: 'numeric',
  });
}
