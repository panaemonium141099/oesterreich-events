import { describe, it, expect } from 'vitest';
import { normalizeUrl, hashUrl } from '@/lib/pipeline/normalize-url';

describe('normalizeUrl', () => {
  it('removes tracking parameters', () => {
    expect(normalizeUrl('https://example.com/event?utm_source=google&id=123'))
      .toBe('https://example.com/event?id=123');
  });

  it('removes fbclid and gclid', () => {
    expect(normalizeUrl('https://example.com/event?fbclid=abc&gclid=def'))
      .toBe('https://example.com/event');
  });

  it('upgrades http to https', () => {
    expect(normalizeUrl('http://example.com/event'))
      .toBe('https://example.com/event');
  });

  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/event/'))
      .toBe('https://example.com/event');
  });

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/event#section'))
      .toBe('https://example.com/event');
  });

  it('preserves www', () => {
    expect(normalizeUrl('https://www.example.com/event'))
      .toBe('https://www.example.com/event');
  });

  it('preserves functional parameters', () => {
    expect(normalizeUrl('https://example.com/event?id=123&page=2'))
      .toBe('https://example.com/event?id=123&page=2');
  });

  it('returns null for empty string', () => {
    expect(normalizeUrl('')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(normalizeUrl('://missing-scheme')).toBeNull();
  });

  it('preserves root path trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('handles multiple tracking params mixed with functional', () => {
    expect(normalizeUrl('https://example.com/e?id=5&utm_source=fb&utm_medium=cpc&page=2'))
      .toBe('https://example.com/e?id=5&page=2');
  });
});

describe('hashUrl', () => {
  it('produces consistent SHA256 hash', () => {
    const hash1 = hashUrl('https://example.com/event');
    const hash2 = hashUrl('https://example.com/event');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different URLs', () => {
    expect(hashUrl('https://a.com')).not.toBe(hashUrl('https://b.com'));
  });
});
