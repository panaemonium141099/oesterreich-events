import { describe, it, expect } from 'vitest';
import {
  normalizeEventCategory,
  getCategoryMeta,
  getCategoryBadgeClass,
  resolvePrimaryEventImage,
  resolveCategoryFallbackImage,
  resolveGenericFallbackImage,
  isUsableImageCandidate,
} from '@/lib/event-images';

// ─── normalizeEventCategory ─────────────────────────────────────────

describe('normalizeEventCategory', () => {
  it('returns Sonstiges for null/undefined/empty', () => {
    expect(normalizeEventCategory(null)).toBe('Sonstiges');
    expect(normalizeEventCategory(undefined)).toBe('Sonstiges');
    expect(normalizeEventCategory('')).toBe('Sonstiges');
  });

  it('passes through canonical categories unchanged', () => {
    expect(normalizeEventCategory('Musik')).toBe('Musik');
    expect(normalizeEventCategory('Nightlife')).toBe('Nightlife');
    expect(normalizeEventCategory('Märkte')).toBe('Märkte');
    expect(normalizeEventCategory('Feste & Brauchtum')).toBe('Feste & Brauchtum');
  });

  it('normalizes Rave to Nightlife', () => {
    expect(normalizeEventCategory('Rave')).toBe('Nightlife');
  });

  it('normalizes Maerkte/Markte to Märkte', () => {
    expect(normalizeEventCategory('Maerkte')).toBe('Märkte');
    expect(normalizeEventCategory('Markte')).toBe('Märkte');
  });

  it('returns Sonstiges for unknown categories', () => {
    expect(normalizeEventCategory('RandomCategory')).toBe('Sonstiges');
    expect(normalizeEventCategory('FooBar')).toBe('Sonstiges');
  });
});

// ─── getCategoryMeta ────────────────────────────────────────────────

describe('getCategoryMeta', () => {
  it('returns metadata for known categories', () => {
    const meta = getCategoryMeta('Musik');
    expect(meta.label).toBe('Musik');
    expect(meta.borderColor).toBe('#a855f7');
    expect(meta.fallbackSlug).toBe('musik');
    expect(meta.badgeLight).toContain('bg-purple');
  });

  it('returns Sonstiges meta for unknown input', () => {
    const meta = getCategoryMeta('Unknown');
    expect(meta.label).toBe('Sonstiges');
    expect(meta.fallbackSlug).toBe('default');
  });

  it('resolves aliases before lookup', () => {
    const meta = getCategoryMeta('Rave');
    expect(meta.label).toBe('Nightlife');
    expect(meta.fallbackSlug).toBe('rave');
  });

  it('resolves Märkte variants', () => {
    const a = getCategoryMeta('Märkte');
    const b = getCategoryMeta('Maerkte');
    const c = getCategoryMeta('Markte');
    expect(a.label).toBe('Märkte');
    expect(b.label).toBe('Märkte');
    expect(c.label).toBe('Märkte');
  });
});

// ─── getCategoryBadgeClass ──────────────────────────────────────────

describe('getCategoryBadgeClass', () => {
  it('returns light classes by default', () => {
    const cls = getCategoryBadgeClass('Sport');
    expect(cls).toContain('bg-blue-100');
  });

  it('returns dark classes when dark=true', () => {
    const cls = getCategoryBadgeClass('Sport', true);
    expect(cls).toContain('bg-blue-900');
  });
});

// ─── isUsableImageCandidate ─────────────────────────────────────────

describe('isUsableImageCandidate', () => {
  it('rejects null/undefined/empty', () => {
    expect(isUsableImageCandidate(null)).toBe(false);
    expect(isUsableImageCandidate(undefined)).toBe(false);
    expect(isUsableImageCandidate('')).toBe(false);
    expect(isUsableImageCandidate('   ')).toBe(false);
  });

  it('rejects data URIs', () => {
    expect(isUsableImageCandidate('data:image/png;base64,abc')).toBe(false);
  });

  it('rejects literal null/undefined strings', () => {
    expect(isUsableImageCandidate('null')).toBe(false);
    expect(isUsableImageCandidate('undefined')).toBe(false);
  });

  it('accepts valid HTTP URLs', () => {
    expect(isUsableImageCandidate('https://example.com/photo.jpg')).toBe(true);
    expect(isUsableImageCandidate('http://cdn.example.com/img.png')).toBe(true);
  });

  it('accepts local paths', () => {
    expect(isUsableImageCandidate('/images/categories/musik-1.jpg')).toBe(true);
  });
});

// ─── resolvePrimaryEventImage ───────────────────────────────────────

describe('resolvePrimaryEventImage', () => {
  it('returns imageUrl when provided and valid', () => {
    const result = resolvePrimaryEventImage({
      imageUrl: 'https://example.com/photo.jpg',
      category: 'Musik',
      title: 'Test Event',
    });
    expect(result).toBe('https://example.com/photo.jpg');
  });

  it('falls back to category image when imageUrl is empty', () => {
    const result = resolvePrimaryEventImage({
      imageUrl: '',
      category: 'Musik',
      title: 'Test Event',
    });
    expect(result).toMatch(/^\/images\/categories\/musik-\d\.jpg$/);
  });

  it('falls back to category image when imageUrl is null', () => {
    const result = resolvePrimaryEventImage({
      imageUrl: null,
      category: 'Sport',
      title: 'Test',
    });
    expect(result).toMatch(/^\/images\/categories\/sport-\d\.jpg$/);
  });

  it('falls back to default for unknown category', () => {
    const result = resolvePrimaryEventImage({
      imageUrl: null,
      category: 'UnknownCat',
      title: 'Test',
    });
    expect(result).toMatch(/^\/images\/categories\/default-\d\.jpg$/);
  });
});

// ─── resolveCategoryFallbackImage ───────────────────────────────────

describe('resolveCategoryFallbackImage', () => {
  it('returns category-specific paths', () => {
    expect(resolveCategoryFallbackImage('Musik', 'seed')).toMatch(/\/musik-\d\.jpg$/);
    expect(resolveCategoryFallbackImage('Sport', 'seed')).toMatch(/\/sport-\d\.jpg$/);
  });

  it('handles Märkte alias from Maerkte', () => {
    const a = resolveCategoryFallbackImage('Märkte', 'test');
    const b = resolveCategoryFallbackImage('Maerkte', 'test');
    expect(a).toBe(b);
    expect(a).toMatch(/\/maerkte-\d\.jpg$/);
  });

  it('produces varied results with different seeds', () => {
    const variants = new Set<string>();
    for (let i = 0; i < 50; i++) {
      variants.add(resolveCategoryFallbackImage('Musik', `event-title-${i}`));
    }
    expect(variants.size).toBeGreaterThan(1);
  });

  it('returns default for null category', () => {
    expect(resolveCategoryFallbackImage(null, 'test')).toMatch(/\/default-\d\.jpg$/);
  });
});

// ─── resolveGenericFallbackImage ────────────────────────────────────

describe('resolveGenericFallbackImage', () => {
  it('returns a valid default path', () => {
    expect(resolveGenericFallbackImage()).toBe('/images/categories/default-1.jpg');
  });
});

// ─── Compat wrapper ─────────────────────────────────────────────────

describe('categoryImages compat wrapper', () => {
  it('getEventImage returns event image when provided', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    expect(getEventImage('https://example.com/photo.jpg', 'Musik')).toBe('https://example.com/photo.jpg');
  });

  it('getEventImage falls back to category image', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(undefined, 'Musik', 'test');
    expect(result).toMatch(/\/images\/categories\/musik-\d\.jpg/);
  });

  it('getEventImage falls back to default for unknown category', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(undefined, 'UnknownCategory', 'test');
    expect(result).toMatch(/\/images\/categories\/default-\d\.jpg/);
  });

  it('getEventImage falls back to default for null category', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(null, null, 'test');
    expect(result).toMatch(/\/images\/categories\/default-\d\.jpg/);
  });

  it('getCategoryFallbackImage handles Maerkte alias', async () => {
    const { getCategoryFallbackImage } = await import('@/lib/categoryImages');
    const result = getCategoryFallbackImage('Märkte', 'test');
    expect(result).toMatch(/\/maerkte-/);
    const defaultResult = getCategoryFallbackImage(null, 'test');
    expect(defaultResult).toMatch(/\/default-/);
  });

  it('getCategoryFallbackImage produces varied results', async () => {
    const { getCategoryFallbackImage } = await import('@/lib/categoryImages');
    const variants = new Set<string>();
    for (let i = 0; i < 50; i++) {
      variants.add(getCategoryFallbackImage('Musik', `event-title-${i}`));
    }
    expect(variants.size).toBeGreaterThan(1);
  });
});
