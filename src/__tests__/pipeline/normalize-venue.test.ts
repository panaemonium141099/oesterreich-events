import { describe, it, expect } from 'vitest';
import {
  normalizeVenueName,
  normalizeVenueNameCompact,
  isGenericVenueName,
  extractHost,
  haversineDistance,
} from '@/lib/pipeline/normalize-venue';

describe('normalizeVenueName', () => {
  it('lowercases and trims', () => {
    expect(normalizeVenueName('  FLEX Wien  ')).toBe('flex wien');
  });

  it('removes articles', () => {
    expect(normalizeVenueName('Das Flex')).toBe('flex');
    expect(normalizeVenueName('The Club')).toBe('club');
  });

  it('expands abbreviations', () => {
    expect(normalizeVenueName('Hauptstr. 5')).toBe('hauptstrasse 5');
  });

  it('removes punctuation', () => {
    expect(normalizeVenueName('Flex (Wien)')).toBe('flex wien');
  });

  it('handles unicode NFC', () => {
    expect(normalizeVenueName('Münchner Freiheit')).toBe('münchner freiheit');
  });
});

describe('normalizeVenueNameCompact', () => {
  it('strips city suffixes', () => {
    expect(normalizeVenueNameCompact('Flex Wien')).toBe('flex');
    expect(normalizeVenueNameCompact('Arena Vienna')).toBe('arena');
    expect(normalizeVenueNameCompact('Orpheum Graz')).toBe('orpheum');
  });

  it('handles name without city', () => {
    expect(normalizeVenueNameCompact('Flex')).toBe('flex');
  });
});

describe('isGenericVenueName', () => {
  it('detects generic names', () => {
    expect(isGenericVenueName('stadthalle')).toBe(true);
    expect(isGenericVenueName('pfarrsaal')).toBe(true);
    expect(isGenericVenueName('gemeindezentrum')).toBe(true);
    expect(isGenericVenueName('kulturhaus')).toBe(true);
  });

  it('allows specific names', () => {
    expect(isGenericVenueName('flex')).toBe(false);
    expect(isGenericVenueName('arena wien')).toBe(false);
    expect(isGenericVenueName('orpheum')).toBe(false);
  });

  it('detects generic even with city suffix', () => {
    expect(isGenericVenueName('stadthalle wien')).toBe(true);
  });
});

describe('extractHost', () => {
  it('extracts host from URL', () => {
    expect(extractHost('https://www.flex.at/events')).toBe('flex.at');
    expect(extractHost('https://arena.wien')).toBe('arena.wien');
  });

  it('strips www prefix', () => {
    expect(extractHost('https://www.example.com')).toBe('example.com');
  });

  it('returns null for invalid/empty', () => {
    expect(extractHost(null)).toBeNull();
    expect(extractHost('')).toBeNull();
  });
});

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(48.2, 16.3, 48.2, 16.3)).toBe(0);
  });

  it('returns reasonable distance for Wien to Graz (~145km)', () => {
    const dist = haversineDistance(48.2082, 16.3738, 47.0707, 15.4395);
    expect(dist).toBeGreaterThan(140000);
    expect(dist).toBeLessThan(150000);
  });

  it('returns small distance for nearby points', () => {
    // ~100m apart
    const dist = haversineDistance(48.2082, 16.3738, 48.2083, 16.3750);
    expect(dist).toBeLessThan(200);
  });
});
