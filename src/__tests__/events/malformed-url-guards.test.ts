/**
 * Repro für die zwei Stellen die bei Bot-Crawler-URLs mit %2F-encoded
 * Slashes einen 500 ausgelöst haben.
 *
 * Symptom in Vercel-Logs:
 *   Failed to handle /events/9220-klagenfurt%2F2026-07-27%2Fzirkuswoche-...
 *
 * Ursache: Next.js liefert solche URLs als ein einziges Path-Segment.
 * Unser legacy-Path-Parser extrahiert dann "9220-kla" als shortId,
 * baut daraus eine UUID-Range `'9220-kla-0000-0000-0000-000000000000'`,
 * Postgres antwortet mit "invalid input syntax for type uuid" → 500.
 *
 * Test isoliert die exakten Guard-Logiken (Page-Handler +
 * getEventByShortId-Validation) damit wir ohne Supabase-Mock testen
 * können. Der Code, den der Test prüft, ist 1:1 was im Handler steht.
 */

import { describe, it, expect } from 'vitest';

// ─── Page-Handler-Guard (siehe app/events/[...slug]/page.tsx) ────────
function isMalformed(slugArr: string[] | undefined | null): boolean {
  return !slugArr || slugArr.length === 0 || slugArr.some(s => !s || s.includes('/'));
}

// ─── ShortId-Guard (siehe lib/events/event-detail-loaders.ts) ────────
function isValidShortId(shortId: string): boolean {
  return /^[0-9a-f]{8}$/i.test(shortId);
}

describe('Bot-URL Guards — /events/[...slug]', () => {
  describe('isMalformed (Page-Handler)', () => {
    it('flags a segment containing a literal slash (decoded %2F)', () => {
      // Das ist was Next.js für `/events/9220-klagenfurt%2F2026-07-27%2F...`
      // an den Handler liefert — ein einzelnes Element mit echtem `/` drin.
      expect(isMalformed(['9220-klagenfurt/2026-07-27/zirkuswoche'])).toBe(true);
    });

    it('flags empty slug array', () => {
      expect(isMalformed([])).toBe(true);
    });

    it('flags empty string segments', () => {
      expect(isMalformed(['1010-wien', '', 'slug'])).toBe(true);
    });

    it('flags null/undefined slug', () => {
      expect(isMalformed(null)).toBe(true);
      expect(isMalformed(undefined)).toBe(true);
    });

    it('passes valid V2-3seg URL', () => {
      expect(isMalformed(['1010-wien', '2026-06-15', 'event-slug'])).toBe(false);
    });

    it('passes valid legacy single-segment', () => {
      expect(isMalformed(['abc12345-event-slug'])).toBe(false);
    });
  });

  describe('isValidShortId (getEventByShortId-Guard)', () => {
    it('rejects "9220-kla" (the actual mangled value from prod logs)', () => {
      // shortId.slice(0,8) eines mangled `9220-klagenfurt/2026-07-27/...`
      // war exakt das. Postgres ablehnte die daraus gebaute UUID-Range.
      expect(isValidShortId('9220-kla')).toBe(false);
    });

    it('rejects empty', () => {
      expect(isValidShortId('')).toBe(false);
    });

    it('rejects non-hex chars', () => {
      expect(isValidShortId('zzzzzzzz')).toBe(false);
    });

    it('rejects wrong length', () => {
      expect(isValidShortId('abc12')).toBe(false);
      expect(isValidShortId('abc123456')).toBe(false);
    });

    it('accepts valid 8-hex shortId', () => {
      expect(isValidShortId('abc12345')).toBe(true);
      expect(isValidShortId('00000000')).toBe(true);
      expect(isValidShortId('ffffffff')).toBe(true);
    });

    it('accepts uppercase hex', () => {
      expect(isValidShortId('ABCDEF12')).toBe(true);
    });
  });
});
