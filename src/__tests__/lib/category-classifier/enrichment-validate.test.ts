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

describe('validateClaudeEnrichment — required singletons (fn-14.3 spec "genau 1")', () => {
  it('rejects missing primary_category', () => {
    const r = validateClaudeEnrichment({ ...validRow, primary_category: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => /primary_category.*missing|required/i.test(e))).toBe(true);
  });

  it('rejects empty-string primary_category', () => {
    const r = validateClaudeEnrichment({ ...validRow, primary_category: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rejects missing price_tier', () => {
    const r = validateClaudeEnrichment({ ...validRow, price_tier: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => /price_tier.*missing|required/i.test(e))).toBe(true);
  });

  it('rejects missing duration_type', () => {
    const r = validateClaudeEnrichment({ ...validRow, duration_type: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => /duration_type.*missing|required/i.test(e))).toBe(true);
  });

  it('rejects missing language', () => {
    const r = validateClaudeEnrichment({ ...validRow, language: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => /language.*missing|required/i.test(e))).toBe(true);
  });

  it('reports ALL missing-required-singleton errors at once (no early exit)', () => {
    const r = validateClaudeEnrichment({
      ...validRow,
      primary_category: null,
      price_tier: null,
      duration_type: null,
      language: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fields = ['primary_category', 'price_tier', 'duration_type', 'language'];
      for (const f of fields) {
        expect(r.errors.some(e => e.includes(f))).toBe(true);
      }
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
  // Helper: results must echo their `index` per the new contract.
  const withIndex = (row: typeof validRow, idx: number) => ({ ...row, index: idx });

  it('accepts {results: [...]} envelope with echoed indices', () => {
    const b = validateClaudeBatch({ results: [withIndex(validRow, 0), withIndex(validRow, 1)] });
    expect(b.ok).toBe(true);
    expect(b.items.length).toBe(2);
    expect(b.items[0].result.ok).toBe(true);
  });

  it('accepts bare array with echoed indices', () => {
    const b = validateClaudeBatch([withIndex(validRow, 0)]);
    expect(b.ok).toBe(true);
    expect(b.items.length).toBe(1);
  });

  it('rejects non-array, non-{results:[]} payload', () => {
    const b = validateClaudeBatch({ random: 'object' });
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/expected array/);
  });

  it('captures echoed indices on each item', () => {
    const b = validateClaudeBatch([
      withIndex(validRow, 0),
      withIndex({ ...validRow, primary_category: 'Sonstiges' }, 1),
      withIndex(validRow, 2),
    ]);
    expect(b.items.map(i => i.index)).toEqual([0, 1, 2]);
  });

  it('rejects items missing the echoed index field (always — even without expectedSize)', () => {
    const b = validateClaudeBatch([validRow]); // no index field
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/missing required "index" field/);
  });

  it('rejects items where index is not a non-negative integer', () => {
    const b = validateClaudeBatch([{ ...validRow, index: -1 }]);
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/non-negative integer/);
  });

  it('rejects items where index is a string', () => {
    const b = validateClaudeBatch([{ ...validRow, index: '0' }]);
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/non-negative integer/);
  });

  it('rejects items where index is fractional', () => {
    const b = validateClaudeBatch([{ ...validRow, index: 1.5 }]);
    expect(b.ok).toBe(false);
    expect(b.fatalError).toMatch(/non-negative integer/);
  });

  it('returns per-item ok/fail mix when partial validation', () => {
    const b = validateClaudeBatch([
      withIndex(validRow, 0),
      withIndex({ ...validRow, suggested_price_min: -5 }, 1),
      withIndex(validRow, 2),
    ]);
    expect(b.ok).toBe(true);
    expect(b.items[0].result.ok).toBe(true);
    expect(b.items[1].result.ok).toBe(false);
    expect(b.items[2].result.ok).toBe(true);
  });

  describe('expectedSize cross-item enforcement', () => {
    it('passes when every index is present exactly once', () => {
      const b = validateClaudeBatch(
        [withIndex(validRow, 0), withIndex(validRow, 1), withIndex(validRow, 2)],
        3,
      );
      expect(b.ok).toBe(true);
      expect(b.fatalError).toBeUndefined();
    });

    it('passes when results are reordered (matches by echoed index, not position)', () => {
      const b = validateClaudeBatch(
        [withIndex(validRow, 2), withIndex(validRow, 0), withIndex(validRow, 1)],
        3,
      );
      expect(b.ok).toBe(true);
      // Items kept in submission order; consumer remaps by echoed index.
      expect(b.items.map(i => i.index)).toEqual([2, 0, 1]);
    });

    it('rejects wrong total count', () => {
      const b = validateClaudeBatch([withIndex(validRow, 0), withIndex(validRow, 1)], 3);
      expect(b.ok).toBe(false);
      expect(b.fatalError).toMatch(/expected 3.*got 2/);
    });

    it('rejects duplicate index', () => {
      const b = validateClaudeBatch(
        [withIndex(validRow, 0), withIndex(validRow, 0)],
        2,
      );
      expect(b.ok).toBe(false);
      expect(b.fatalError).toMatch(/duplicate result index 0/);
    });

    it('rejects missing index (caught by per-item index check before expectedSize)', () => {
      const b = validateClaudeBatch([validRow, withIndex(validRow, 1)], 2);
      expect(b.ok).toBe(false);
      // Per-item index check fires first (always-on contract).
      expect(b.fatalError).toMatch(/missing required "index" field/);
    });

    it('rejects out-of-range index', () => {
      const b = validateClaudeBatch(
        [withIndex(validRow, 0), withIndex(validRow, 5)],
        2,
      );
      expect(b.ok).toBe(false);
      expect(b.fatalError).toMatch(/index 5 out of range/);
    });

    it('rejects gap in echoed indices', () => {
      const b = validateClaudeBatch(
        [withIndex(validRow, 0), withIndex(validRow, 2)],
        3,
      );
      expect(b.ok).toBe(false);
      expect(b.fatalError).toMatch(/expected 3.*got 2|missing result for input index 1/);
    });
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
