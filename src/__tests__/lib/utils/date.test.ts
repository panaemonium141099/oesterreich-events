import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateLong,
  formatDateCompact,
  formatDateNumeric,
  formatDateShort,
  formatTime,
  formatDateRange,
  formatMonthYear,
} from '@/lib/utils/date';

describe('formatDate', () => {
  it('formats a date-only string in de-AT short format', () => {
    const result = formatDate('2026-03-15');
    // de-AT locale: weekday short, 2-digit day, short month, numeric year
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('formats a datetime string', () => {
    const result = formatDate('2026-07-04T14:30:00');
    expect(result).toContain('04');
    expect(result).toContain('2026');
  });

  it('returns Invalid Date for unparseable input', () => {
    // toLocaleDateString on an invalid Date returns 'Invalid Date'
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });

  it('handles date-only strings without UTC timezone shift', () => {
    // Date-only strings get T12:00:00 appended to avoid date shift
    const result = formatDate('2026-01-01');
    expect(result).toContain('01');
    expect(result).toContain('2026');
  });
});

describe('formatDateLong', () => {
  it('formats with long weekday and month', () => {
    const result = formatDateLong('2026-03-15');
    // de-AT long format: full weekday, day, full month, year
    expect(result).toContain('15');
    expect(result).toContain('2026');
    // Should have a long month name (not abbreviated)
    expect(result).toContain('März');
  });
});

describe('formatDateCompact', () => {
  it('formats day + short month + year', () => {
    const result = formatDateCompact('2026-12-25');
    expect(result).toContain('25');
    expect(result).toContain('2026');
  });
});

describe('formatDateNumeric', () => {
  it('formats as DD.MM.YYYY', () => {
    const result = formatDateNumeric('2026-03-15');
    // de-AT numeric format uses dots
    expect(result).toMatch(/15\.\s*0?3\.\s*2026/);
  });
});

describe('formatDateShort', () => {
  it('formats day + short month without year', () => {
    const result = formatDateShort('2026-03-15');
    expect(result).toContain('15');
    expect(result).not.toContain('2026');
  });
});

describe('formatTime', () => {
  it('returns formatted time for a datetime with real time', () => {
    const result = formatTime('2026-03-15T14:30:00');
    expect(result).toBe('14:30');
  });

  it('returns null for date-only strings (no time component)', () => {
    expect(formatTime('2026-03-15')).toBeNull();
  });

  it('returns null for midnight (00:00) — indicates no real time set', () => {
    // Construct a date that resolves to local midnight
    const midnight = new Date(2026, 2, 15, 0, 0, 0);
    const isoStr = midnight.toISOString();
    expect(formatTime(isoStr)).toBeNull();
  });

  it('returns null for 01:00 — CET offset artifact for midnight', () => {
    const oneAm = new Date(2026, 2, 15, 1, 0, 0);
    const isoStr = oneAm.toISOString();
    expect(formatTime(isoStr)).toBeNull();
  });

  it('returns time for 01:30 (not a midnight artifact)', () => {
    const oneThirty = new Date(2026, 2, 15, 1, 30, 0);
    const isoStr = oneThirty.toISOString();
    expect(formatTime(isoStr)).toBe('01:30');
  });

  it('returns time for evening hours', () => {
    const result = formatTime('2026-03-15T20:00:00');
    expect(result).toBe('20:00');
  });

  it('returns null for empty string', () => {
    expect(formatTime('')).toBeNull();
  });

  it('returns null for short strings without T separator', () => {
    expect(formatTime('2026-03')).toBeNull();
  });
});

describe('formatDateRange', () => {
  it('formats a single date without time', () => {
    const result = formatDateRange('2026-03-15');
    expect(result).toContain('15');
    expect(result).toContain('2026');
    expect(result).not.toContain('um');
  });

  it('includes time when present', () => {
    const result = formatDateRange('2026-03-15T14:30:00');
    expect(result).toContain('um');
    expect(result).toContain('14:30');
  });

  it('shows only end time for same-day range', () => {
    const result = formatDateRange('2026-03-15T14:00:00', '2026-03-15T18:00:00');
    expect(result).toContain('14:00');
    expect(result).toContain('18:00');
    // Should have a dash separator
    expect(result).toContain('-');
  });

  it('shows full end date for multi-day range', () => {
    const result = formatDateRange('2026-03-15', '2026-03-17');
    // Both dates should appear
    expect(result).toContain('15');
    expect(result).toContain('17');
  });

  it('handles null end date', () => {
    const result = formatDateRange('2026-03-15', null);
    expect(result).toContain('15');
  });

  it('handles undefined end date', () => {
    const result = formatDateRange('2026-03-15');
    expect(result).toContain('15');
  });
});

describe('formatMonthYear', () => {
  it('formats month and year in de-AT locale', () => {
    const result = formatMonthYear(2026, 2); // month 2 = March (0-indexed)
    expect(result).toContain('März');
    expect(result).toContain('2026');
  });

  it('formats January correctly', () => {
    const result = formatMonthYear(2026, 0);
    expect(result).toContain('Jänner');
    expect(result).toContain('2026');
  });

  it('formats December correctly', () => {
    const result = formatMonthYear(2026, 11);
    expect(result).toContain('Dezember');
    expect(result).toContain('2026');
  });
});
