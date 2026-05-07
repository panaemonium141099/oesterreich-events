/**
 * Tests for the v2 Claude-batch enrichment validator (fn-14.3).
 *
 * Coverage:
 *   - top-level batch shape (array | {results:[]} | other)
 *   - per-event happy path (all fields valid)
 *   - per-axis vocabulary enforcement (TAGS, AUDIENCES, …)
 *   - description length envelope (DESC_MIN..DESC_MAX, null, HTML)
 *   - price_min numeric validation (negative, > 10000, NaN)
 *   - 3 new boolean facets (dog/wheelchair/outdoor)
 */
import { describe, it, expect } from 'vitest';
import {
  validateClaudeEnrichment,
  validateClaudeBatch,
  emptyResult,
  DESC_MIN,
  DESC_MAX,
} from '@/lib/category-classifier/enrichment-validate';

const longGoodDescription = 'a'.repeat(DESC_MIN);
const tooShortDescription = 'a'.repeat(DESC_MIN - 1);
const tooLongDescription = 'a'.repeat(DESC_MAX + 1);

const validRow = {
  primary_category: 'Musik',
  tags: ['pop', 'rock'],
  audience: ['junge-erwachsene'],
  vibe: ['laut'],
  occasion: ['fuer-den-abend'],
  setting: ['indoor', 'abendevent'],
  language: 'deutsch',
  price_tier: 'mittel',
  price_flags: ['unter-20-euro'],
  duration_type: 'abend',
  is_student_friendly: false,
  is_family_friendly: false,
  is_dog_friendly: false,
  is_wheelchair_accessible: false,
  is_outdoor: false,
  suggested_description: longGoodDescription,
  suggested_price_text: 'ab 25€',
  suggested_price_min: 25,
};

describe('validateClaudeEnrichment — happy path', () => {
  it('accepts a fully-valid v2 payload', () => {
    const r = validateClaudeEnrichment(validRow);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.primary_category).toBe('Musik');
      expect(r.value.tags).toEqual(['pop', 'rock']);
      expect(r.value.suggested_price_min).toBe(25);
      expect(r.value.suggested_description!.length).toBe(DESC_MIN);
    }
  });

  it('accepts null for optional suggested fields', () => {
    const r = validateClaudeEnrichment({
      ...validRow,
      suggested_description: null,
      suggested_price_text: null,
      suggested_price_min: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.suggested_description).toBeNull();
      expect(r.value.suggested_price_min).toBeNull();
    }
  });
});

describe('validateClaudeEnrichment — failure modes', () => {
  it('rejects non-object payload', () => {
    const r = validateClaudeEnrichment('not an object');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/payload/);
  });

  it('drops out-of-vocab tags but keeps the rest', () => {
    const r = validateClaudeEnrichment({
      ...validRow,
      tags: ['pop', 'NOT_A_REAL_TAG'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.partial.tags).toEqual(['pop']);
      expect(r.errors.some(e => e.includes('not_a_real_tag'))).toBe(true);
    }
  });

  it('rejects suggested_description below DESC_MIN', () => {
    const r = validateClaudeEnrichment({ ...validRow, suggested_description: tooShortDescription });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('suggested_description'))).toBe(true);
      expect(r.partial.suggested_description).toBeNull();
    }
  });

  it('rejects suggested_description above DESC_MAX', () => {
    const r = validateClaudeEnrichment({ ...validRow, suggested_description: tooLongDescription });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial.suggested_description).toBeNull();
  });

  it('rejects suggested_description with HTML tags', () => {
    const desc = '<p>' + 'a'.repeat(DESC_MIN) + '</p>';
    const r = validateClaudeEnrichment({ ...validRow, suggested_description: desc });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial.suggested_description).toBeNull();
  });

  it('rejects negative price_min', () => {
    const r = validateClaudeEnrichment({ ...validRow, suggested_price_min: -5 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('suggested_price_min'))).toBe(true);
      expect(r.partial.suggested_price_min).toBeNull();
    }
  });

  it('rejects non-finite price_min (NaN)', () => {
    const r = validateClaudeEnrichment({ ...validRow, suggested_price_min: NaN });
    expect(r.ok).toBe(false);
  });

  it('rejects price_min above 10000', () => {
    const r = validateClaudeEnrichment({ ...validRow, suggested_price_min: 15000 });
    expect(r.ok).toBe(false);
  });

  it('drops unknown primary_category', () => {
    const r = validateClaudeEnrichment({ ...validRow, primary_category: 'Sport (alte Kategorie)' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial.primary_category).toBeNull();
  });

  it('coerces booleans to false on non-boolean input', () => {
    const r = validateClaudeEnrichment({ ...validRow, is_dog_friendly: 'yes' as unknown });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial.is_dog_friendly).toBe(false);
  });
});

describe('validateClaudeEnrichment — 3 new boolean flags', () => {
  it('accepts all three new flags', () => {
    const r = validateClaudeEnrichment({
      ...validRow,
      is_dog_friendly: true,
      is_wheelchair_accessible: true,
      is_outdoor: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.is_dog_friendly).toBe(true);
      expect(r.value.is_wheelchair_accessible).toBe(true);
      expect(r.value.is_outdoor).toBe(true);
    }
  });

  it('defaults missing new flags to false', () => {
    const incomplete = { ...validRow };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (incomplete as any).is_dog_friendly;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (incomplete as any).is_wheelchair_accessible;
    const r = validateClaudeEnrichment(incomplete);
    // The empty case is "ok" because missing booleans coerce to false.
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.is_dog_friendly).toBe(false);
      expect(r.value.is_wheelchair_accessible).toBe(false);
    }
  });
});

describe('validateClaudeEnrichment — spende-erbeten flag', () => {
  it('accepts spende-erbeten in price_flags vocabulary', () => {
    const r = validateClaudeEnrichment({
      ...validRow,
      price_flags: ['spende-erbeten'],
      suggested_price_min: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.price_flags).toContain('spende-erbeten');
      expect(r.value.suggested_price_min).toBe(0);
    }
  });
});

describe('validateClaudeBatch', () => {
  it('accepts {results: [...]} envelope', () => {
    const b = validateClaudeBatch({ results: [validRow, validRow] });
    expect(b.ok).toBe(true);
    expect(b.items.length).toBe(2);
    expect(b.items[0].result.ok).toBe(true);
  });

  it('accepts bare array', () => {
    const b = validateClaudeBatch([validRow]);
    expect(b.ok).toBe(true);
    expect(b.items.length).toBe(1);
  });

  it('rejects non-array, non-{results:[]} payload', () => {
    const b = validateClaudeBatch({ random: 'object' });
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/expected array/);
  });

  it('preserves item indices through the batch', () => {
    const b = validateClaudeBatch([validRow, { primary_category: 'Sonstiges' }, validRow]);
    expect(b.items.map(i => i.index)).toEqual([0, 1, 2]);
  });

  it('returns per-item ok/fail mix when partial validation', () => {
    const b = validateClaudeBatch([
      validRow,
      { ...validRow, suggested_price_min: -5 },
      validRow,
    ]);
    expect(b.ok).toBe(true);
    expect(b.items[0].result.ok).toBe(true);
    expect(b.items[1].result.ok).toBe(false);
    expect(b.items[2].result.ok).toBe(true);
  });
});

describe('emptyResult', () => {
  it('returns the expected default shape', () => {
    const e = emptyResult();
    expect(e.primary_category).toBeNull();
    expect(e.tags).toEqual([]);
    expect(e.is_dog_friendly).toBe(false);
    expect(e.suggested_price_min).toBeNull();
  });
});
