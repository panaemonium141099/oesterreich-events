import { describe, it, expect } from 'vitest';
import { normalizeTitle, extractDatePart, generateFingerprint } from '@/lib/dedup/fingerprint';

describe('normalizeTitle', () => {
  it('should lowercase and trim', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('hello world');
  });

  it('should strip punctuation', () => {
    expect(normalizeTitle('Pub-Quiz @ Flex!')).toBe('pub quiz flex');
  });

  it('should collapse whitespace', () => {
    expect(normalizeTitle('Pub   Quiz    Night')).toBe('pub quiz night');
  });

  it('should handle German umlauts', () => {
    expect(normalizeTitle('Frühschoppen Österreich')).toBe('frühschoppen österreich');
  });

  it('should normalize unicode (NFC)', () => {
    // e + combining acute vs. precomposed e-acute
    const decomposed = 'Caf\u0065\u0301';
    const composed = 'Caf\u00E9';
    expect(normalizeTitle(decomposed)).toBe(normalizeTitle(composed));
  });

  it('should return empty string for empty input', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('   ')).toBe('');
  });

  it('should keep digits', () => {
    expect(normalizeTitle('Event 2026')).toBe('event 2026');
  });
});

describe('extractDatePart', () => {
  it('should extract YYYY-MM-DD from ISO string', () => {
    expect(extractDatePart('2026-04-10T18:00:00Z')).toBe('2026-04-10');
  });

  it('should handle date-only strings', () => {
    expect(extractDatePart('2026-04-10')).toBe('2026-04-10');
  });

  it('should handle ISO string with timezone offset', () => {
    expect(extractDatePart('2026-04-10T20:00:00+02:00')).toBe('2026-04-10');
  });
});

describe('generateFingerprint', () => {
  it('should produce a 64-char hex string (sha256)', () => {
    const fp = generateFingerprint('Test Event', '2026-04-10T18:00:00Z');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be deterministic', () => {
    const fp1 = generateFingerprint('Test Event', '2026-04-10T18:00:00Z');
    const fp2 = generateFingerprint('Test Event', '2026-04-10T18:00:00Z');
    expect(fp1).toBe(fp2);
  });

  it('should normalize titles before hashing', () => {
    const fp1 = generateFingerprint('Pub Quiz @ Flex', '2026-04-10');
    const fp2 = generateFingerprint('pub quiz  flex', '2026-04-10');
    expect(fp1).toBe(fp2);
  });

  it('should differ for different dates', () => {
    const fp1 = generateFingerprint('Test Event', '2026-04-10');
    const fp2 = generateFingerprint('Test Event', '2026-04-11');
    expect(fp1).not.toBe(fp2);
  });

  it('should differ for different titles', () => {
    const fp1 = generateFingerprint('Test Event A', '2026-04-10');
    const fp2 = generateFingerprint('Test Event B', '2026-04-10');
    expect(fp1).not.toBe(fp2);
  });

  it('should ignore time portion of start_date', () => {
    const fp1 = generateFingerprint('Test', '2026-04-10T10:00:00Z');
    const fp2 = generateFingerprint('Test', '2026-04-10T22:00:00Z');
    expect(fp1).toBe(fp2);
  });

  it('should return null for empty title', () => {
    expect(generateFingerprint('', '2026-04-10')).toBeNull();
    expect(generateFingerprint('   ', '2026-04-10')).toBeNull();
  });

  it('should return null for empty start_date', () => {
    expect(generateFingerprint('Test', '')).toBeNull();
  });
});
