/**
 * Tagesbeschriftungen der Startseite (fn-30.6): Kalendertag-Parameter für
 * /entdecken, Kurzform „Fr 30. Okt.", Festival-Zeitraum.
 */
import { describe, it, expect } from 'vitest';
import { dayRangeLabel, isoDayParam, shortDateWithYear, shortViennaDay, weekdayLabel } from '@/lib/landing/day-labels';

const join = (from: string, to: string) => `${from} bis ${to}`;

describe('isoDayParam', () => {
  it('nimmt nur gültige Kalendertage', () => {
    expect(isoDayParam('2026-10-30')).toBe('2026-10-30');
    expect(isoDayParam('2026-02-30')).toBeNull();
    expect(isoDayParam('2026-10-30T18:00:00Z')).toBeNull();
    expect(isoDayParam('heute')).toBeNull();
    expect(isoDayParam(null)).toBeNull();
    expect(isoDayParam('')).toBeNull();
  });
});

describe('shortViennaDay / weekdayLabel / shortDateWithYear', () => {
  it('formatiert Kalendertage unabhängig von der Runtime-Zone', () => {
    expect(shortViennaDay('2026-10-30', 'de')).toBe('Fr 30. Okt.');
    expect(shortViennaDay('2026-11-01', 'de')).toBe('So 1. Nov.');
    expect(shortViennaDay('2026-10-30', 'en')).toBe('Fri 30 Oct');
    expect(weekdayLabel('2026-10-30', 'de')).toBe('Freitag');
    expect(weekdayLabel('2026-10-30', 'en')).toBe('Friday');
    expect(shortDateWithYear('2026-10-21', 'de')).toBe('21. Okt. 2026');
    expect(shortDateWithYear('2026-10-21T00:00:00Z', 'en')).toBe('21 Oct 2026');
  });
});

describe('dayRangeLabel', () => {
  it('Zeitraum, ein Tag, kein Beginn', () => {
    expect(dayRangeLabel('2027-06-04', '2027-06-06', 'de', join)).toBe('Fr 4. Juni bis So 6. Juni');
    expect(dayRangeLabel('2027-06-04', '2027-06-04', 'de', join)).toBe('Fr 4. Juni');
    expect(dayRangeLabel('2027-06-04', null, 'de', join)).toBe('Fr 4. Juni');
    expect(dayRangeLabel(null, '2027-06-06', 'de', join)).toBe('');
    expect(dayRangeLabel('2027-06-04T00:00:00+02:00', '2027-06-06T00:00:00+02:00', 'en', join)).toBe('Fri 4 Jun bis Sun 6 Jun');
  });
});
