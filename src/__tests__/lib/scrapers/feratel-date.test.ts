// Regression tests for FeratelScraper date handling.
//
// Bug 2026-06-23 (TVB Wipptal + Land Salzburg emails): the Deskline API returns
// naive Europe/Vienna wall-clock times with NO offset ("2026-06-25T19:00:00").
// They were written straight to a timestamptz column, so Postgres read them as
// UTC and every Feratel event displayed +1h (winter) / +2h (summer): a 19:00
// concert showed as 21:00. feratelLocalToUtcIso converts to a real UTC instant.
import { describe, it, expect } from 'vitest';
import { feratelLocalToUtcIso } from '@/lib/scrapers/FeratelScraper';

describe('feratelLocalToUtcIso', () => {
  it('converts summer (CEST, +02:00) local time to UTC', () => {
    // "Orchestra for the earth": 19:00 Vienna -> 17:00 UTC
    expect(feratelLocalToUtcIso('2026-06-25T19:00:00')).toBe('2026-06-25T17:00:00.000Z');
  });

  it('converts winter (CET, +01:00) local time to UTC', () => {
    expect(feratelLocalToUtcIso('2026-01-15T19:00:00')).toBe('2026-01-15T18:00:00.000Z');
  });

  it('handles the DST changeover day correctly (still CEST late March)', () => {
    expect(feratelLocalToUtcIso('2026-03-29T16:00:00')).toBe('2026-03-29T14:00:00.000Z');
  });

  it('returns null for an already-tz-qualified value (caller keeps original)', () => {
    expect(feratelLocalToUtcIso('2026-06-25T17:00:00.000Z')).toBeNull();
  });

  it('returns null for a date-only / unparseable value', () => {
    expect(feratelLocalToUtcIso('2026-06-25')).toBeNull();
    expect(feratelLocalToUtcIso('TBD')).toBeNull();
  });
});
