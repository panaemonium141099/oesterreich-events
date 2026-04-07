import { describe, it, expect } from 'vitest';
import { normalizeDate } from '@/lib/pipeline/normalize-date';

describe('normalizeDate', () => {
  it('parses ISO 8601 datetime as exact', () => {
    const result = normalizeDate('2026-06-14T20:00:00');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
    expect(result.startAt!.toISOString()).toContain('2026-06-14');
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
