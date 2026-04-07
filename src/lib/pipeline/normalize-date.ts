import type { NormalizedDateResult, DatePrecision, EndDatePrecision } from './types';

const GERMAN_MONTHS: Record<string, number> = {
  'jänner': 0, 'januar': 0, 'jan': 0,
  'februar': 1, 'feb': 1,
  'märz': 2, 'mär': 2,
  'april': 3, 'apr': 3,
  'mai': 4,
  'juni': 5, 'jun': 5,
  'juli': 6, 'jul': 6,
  'august': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'oktober': 9, 'okt': 9,
  'november': 10, 'nov': 10,
  'dezember': 11, 'dez': 11,
};

function nullResult(): NormalizedDateResult {
  return { startAt: null, endAt: null, startPrecision: null, endPrecision: 'missing' };
}

/**
 * Get the UTC offset in minutes for Europe/Vienna at a given date.
 * Returns the offset such that local = UTC + offset.
 */
function getViennaOffsetMs(year: number, month: number, day: number): number {
  // Create a date at noon UTC to avoid DST boundary issues during offset calculation
  const utcNoon = new Date(Date.UTC(year, month, day, 12, 0, 0));

  // Format in Vienna timezone to get the local time components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcNoon);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const viennaYear = get('year');
  const viennaMonth = get('month') - 1;
  const viennaDay = get('day');
  const viennaHour = get('hour') === 24 ? 0 : get('hour');

  // Reconstruct Vienna time as if it were UTC
  const viennaAsUtc = new Date(Date.UTC(viennaYear, viennaMonth, viennaDay, viennaHour, get('minute'), get('second')));

  // Offset = Vienna local - UTC
  const offsetMs = viennaAsUtc.getTime() - utcNoon.getTime();
  return offsetMs;
}

/**
 * Convert a Vienna local datetime to a UTC Date.
 */
function viennaToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const offsetMs = getViennaOffsetMs(year, month, day);
  // local = UTC + offset => UTC = local - offset
  const localAsUtc = Date.UTC(year, month, day, hour, minute, 0);
  return new Date(localAsUtc - offsetMs);
}

function parseTime(text: string): { hour: number; minute: number } | null {
  // "20:30 Uhr", "20 Uhr", "20:30", "19:30"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(?:Uhr|uhr)?/);
  if (!timeMatch) return null;
  const hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function normalizeDate(input: string, context?: { dateContext?: string }): NormalizedDateResult {
  if (!input || !input.trim()) return nullResult();

  const trimmed = input.trim();

  // --- ISO 8601 with time: 2026-06-14T20:00:00 ---
  const isoDateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoDateTimeMatch) {
    const [, y, m, d, h, min] = isoDateTimeMatch.map(Number);
    const date = viennaToUtc(y, m - 1, d, h, min);
    return {
      startAt: date,
      endAt: null,
      startPrecision: 'exact',
      endPrecision: 'missing',
    };
  }

  // --- ISO date only: 2026-06-14 ---
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, y, m, d] = isoDateMatch.map(Number);
    const date = viennaToUtc(y, m - 1, d, 0, 0);
    return {
      startAt: date,
      endAt: null,
      startPrecision: 'day_only',
      endPrecision: 'missing',
    };
  }

  // --- "ab HH:MM" with dateContext ---
  const abMatch = trimmed.match(/^ab\s+(\d{1,2}):(\d{2})$/i);
  if (abMatch) {
    if (!context?.dateContext) return nullResult();
    const isoCtx = context.dateContext.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoCtx) return nullResult();
    const [, y, m, d] = isoCtx.map(Number);
    const hour = parseInt(abMatch[1], 10);
    const minute = parseInt(abMatch[2], 10);
    const date = viennaToUtc(y, m - 1, d, hour, minute);
    return {
      startAt: date,
      endAt: null,
      startPrecision: 'inferred',
      endPrecision: 'missing',
    };
  }

  // --- Date range: "14.–16. Juni 2026" or "14.-16. Juni 2026" ---
  const rangeMatch = trimmed.match(
    /^(\d{1,2})\.[\s]*[–\-][\s]*(\d{1,2})\.\s+([A-Za-zÄäÖöÜüß]+)\s+(\d{4})$/i
  );
  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1], 10);
    const endDay = parseInt(rangeMatch[2], 10);
    const monthName = rangeMatch[3].toLowerCase();
    const year = parseInt(rangeMatch[4], 10);
    const month = GERMAN_MONTHS[monthName];
    if (month === undefined) return nullResult();

    const startDate = viennaToUtc(year, month, startDay, 0, 0);
    const endDate = viennaToUtc(year, month, endDay, 0, 0);
    return {
      startAt: startDate,
      endAt: endDate,
      startPrecision: 'day_only',
      endPrecision: 'day_only',
    };
  }

  // --- Short date: DD.MM.YYYY ---
  const shortDateMatch = trimmed.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (shortDateMatch) {
    const [, d, m, y] = shortDateMatch.map(Number);
    const date = viennaToUtc(y, m - 1, d, 0, 0);
    return {
      startAt: date,
      endAt: null,
      startPrecision: 'day_only',
      endPrecision: 'missing',
    };
  }

  // --- German date with optional weekday and optional time ---
  // e.g. "Freitag, 14. Juni 2026, 20 Uhr" or "14. Juni 2026" or "14. Juni 2026, 20:30 Uhr"
  const germanMatch = trimmed.match(
    /^(?:[A-Za-zÄäÖöÜüß]+,\s*)?(\d{1,2})\.\s+([A-Za-zÄäÖöÜüß]+)\s+(\d{4})(?:,?\s+(.+))?$/i
  );
  if (germanMatch) {
    const day = parseInt(germanMatch[1], 10);
    const monthName = germanMatch[2].toLowerCase();
    const year = parseInt(germanMatch[3], 10);
    const timePart = germanMatch[4];
    const month = GERMAN_MONTHS[monthName];
    if (month === undefined) return nullResult();

    if (timePart) {
      const time = parseTime(timePart);
      if (time) {
        const date = viennaToUtc(year, month, day, time.hour, time.minute);
        return {
          startAt: date,
          endAt: null,
          startPrecision: 'exact',
          endPrecision: 'missing',
        };
      }
    }

    // No time found — day_only
    const date = viennaToUtc(year, month, day, 0, 0);
    return {
      startAt: date,
      endAt: null,
      startPrecision: 'day_only',
      endPrecision: 'missing',
    };
  }

  return nullResult();
}
