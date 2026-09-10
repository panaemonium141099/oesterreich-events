import { describe, it, expect } from 'vitest';
import { normalizeDate, toUtcInstant } from '@/lib/pipeline/normalize-date';

describe('normalizeDate', () => {
  it('parses ISO 8601 datetime as exact', () => {
    const result = normalizeDate('2026-06-14T20:00:00');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
    expect(result.startAt!.toISOString()).toContain('2026-06-14');
  });

  it('treats a naive ISO datetime as Europe/Vienna (20:00 CEST -> 18:00 UTC)', () => {
    const result = normalizeDate('2026-06-14T20:00:00');
    expect(result.startAt!.toISOString()).toBe('2026-06-14T18:00:00.000Z');
  });

  it('treats a Z-qualified ISO datetime as an absolute instant (no Vienna shift)', () => {
    // FeratelScraper now emits UTC like this; it must NOT be re-shifted.
    const result = normalizeDate('2026-06-14T18:00:00.000Z');
    expect(result.startPrecision).toBe('exact');
    expect(result.startAt!.toISOString()).toBe('2026-06-14T18:00:00.000Z');
  });

  it('honours an explicit +02:00 offset', () => {
    const result = normalizeDate('2026-06-14T20:00:00+02:00');
    expect(result.startAt!.toISOString()).toBe('2026-06-14T18:00:00.000Z');
  });

  it('parses ISO date-only as day_only', () => {
    const result = normalizeDate('2026-06-14');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
  });

  it('parses German date format with time as exact', () => {
    const result = normalizeDate('Freitag, 14. Juni 2026, 20 Uhr');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
  });

  it('parses German date format without time as day_only', () => {
    const result = normalizeDate('14. Juni 2026');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
  });

  it('parses short date format DD.MM.YYYY as day_only', () => {
    const result = normalizeDate('14.06.2026');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
  });

  it('uses Europe/Vienna midnight for day_only (not 00:00 UTC)', () => {
    // June is CEST = UTC+2, so midnight Vienna = 22:00 UTC previous day
    const result = normalizeDate('14.06.2026');
    expect(result.startAt!.getUTCHours()).toBe(22);
    expect(result.startAt!.getUTCDate()).toBe(13);
  });

  it('parses date range', () => {
    const result = normalizeDate('14.–16. Juni 2026');
    expect(result.startAt).not.toBeNull();
    expect(result.endAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
    expect(result.endPrecision).toBe('day_only');
  });

  it('returns null startAt for unparseable input', () => {
    const result = normalizeDate('TBD');
    expect(result.startAt).toBeNull();
    expect(result.startPrecision).toBeNull();
  });

  it('sets end_precision to missing when no end date', () => {
    const result = normalizeDate('14.06.2026');
    expect(result.endAt).toBeNull();
    expect(result.endPrecision).toBe('missing');
  });

  it('handles "ab 19:30" with date context as inferred', () => {
    const result = normalizeDate('ab 19:30', { dateContext: '2026-06-14' });
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('inferred');
  });

  it('returns null for "ab 19:30" without date context', () => {
    const result = normalizeDate('ab 19:30');
    expect(result.startAt).toBeNull();
  });

  it('handles empty string', () => {
    const result = normalizeDate('');
    expect(result.startAt).toBeNull();
    expect(result.startPrecision).toBeNull();
    expect(result.endPrecision).toBe('missing');
  });

  it('handles time with "20:30 Uhr" format', () => {
    const result = normalizeDate('14. Juni 2026, 20:30 Uhr');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
  });
});

describe('toUtcInstant', () => {
  it('reads a naive summer datetime as Vienna wall clock (11:00 CEST -> 09:00 UTC)', () => {
    // Prod-Fall 2026-09-10: meinbezirk lieferte "2026-10-04T11:00:00",
    // in der DB landete 11:00 UTC und die Seite zeigte 13:00 statt 11:00.
    expect(toUtcInstant('2026-10-04T11:00:00')).toBe('2026-10-04T09:00:00.000Z');
  });

  it('reads a naive winter datetime as Vienna wall clock (19:30 CET -> 18:30 UTC)', () => {
    expect(toUtcInstant('2027-01-15T19:30:00')).toBe('2027-01-15T18:30:00.000Z');
  });

  it('accepts a space separator and a missing seconds part', () => {
    expect(toUtcInstant('2026-07-01 20:00')).toBe('2026-07-01T18:00:00.000Z');
  });

  it('leaves a Z-qualified instant untouched', () => {
    expect(toUtcInstant('2026-10-04T09:00:00.000Z')).toBe('2026-10-04T09:00:00.000Z');
  });

  it('leaves an offset-qualified instant untouched', () => {
    expect(toUtcInstant('2026-10-04T11:00:00+02:00')).toBe('2026-10-04T11:00:00+02:00');
  });

  it('leaves a date-only value untouched (documented "time unknown" placeholder)', () => {
    // Der UTC-Tag dieser Form traegt den gemeinten Tag und bildet den
    // Datums-Slug der Event-URL — eine Verschiebung wuerde ihn brechen.
    expect(toUtcInstant('2026-10-04')).toBe('2026-10-04');
  });

  it('passes through empty and unparsable values', () => {
    expect(toUtcInstant('')).toBe('');
    expect(toUtcInstant(undefined)).toBeUndefined();
    expect(toUtcInstant('demnaechst')).toBe('demnaechst');
  });
});
