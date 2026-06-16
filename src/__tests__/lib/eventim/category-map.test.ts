import { describe, it, expect } from 'vitest';
import { mapEventimCategory } from '@/lib/eventim/category-map';
import { PRIMARY_CATEGORY_SET, TAGS } from '@/lib/category-classifier/enrichment-taxonomy';

describe('mapEventimCategory', () => {
  it('maps Rock & Pop (1A) to Musik with genre tags', () => {
    expect(mapEventimCategory(['1A'])).toEqual({ category: 'Musik', tags: ['rock', 'pop'] });
  });

  it('maps Electronic & Dance (1D) to Nightlife & Party', () => {
    expect(mapEventimCategory(['1D']).category).toBe('Nightlife & Party');
  });

  it('maps Klassik (2A) to Musik but Oper (2B) to Kultur & Bühne', () => {
    expect(mapEventimCategory(['2A']).category).toBe('Musik');
    expect(mapEventimCategory(['2B']).category).toBe('Kultur & Bühne');
  });

  it('maps Messen (7E) to Wissen & Karriere', () => {
    expect(mapEventimCategory(['7E']).category).toBe('Wissen & Karriere');
  });

  it('merges genre tags from multiple codes (Rock+Metal)', () => {
    const r = mapEventimCategory(['1A', '1G']);
    expect(r.category).toBe('Musik');
    expect(r.tags).toEqual(expect.arrayContaining(['rock', 'pop', 'metal']));
  });

  it('emits only tags that exist in the canonical TAGS vocabulary', () => {
    const set = new Set<string>(TAGS);
    const codes = ['1A','1B','1D','1E','1G','1H','2A','2B','2C','2D','2E','2G','2H','2I','3A','3D','3E','3L','4A','5A','5B','6B','7C','7E','Ball'];
    for (const code of codes)
      for (const t of mapEventimCategory([code]).tags) expect(set.has(t)).toBe(true);
  });

  it('falls back to Sonstiges for unknown / empty codes', () => {
    expect(mapEventimCategory(['4F']).category).toBe('Sonstiges');
    expect(mapEventimCategory([]).category).toBe('Sonstiges');
  });

  it('only ever emits valid primary categories', () => {
    for (const code of ['1A', '1D', '2A', '2B', '3A', '4A', '4C', '5A', '6C', '7C', '7E', 'Ball', 'Podcast', 'ZZ']) {
      expect(PRIMARY_CATEGORY_SET.has(mapEventimCategory([code]).category)).toBe(true);
    }
  });
});
