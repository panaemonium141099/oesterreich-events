import { describe, it, expect } from 'vitest';
import { normalizeDomain } from '@/lib/outreach/domain';

describe('normalizeDomain', () => {
  it('strips protocol, www, path, trailing slash, lowercases', () => {
    expect(normalizeDomain('https://www.Cobario.com/live-dates/')).toBe('cobario.com');
    expect(normalizeDomain('http://nextgeeker.com')).toBe('nextgeeker.com');
    expect(normalizeDomain('WWW.Beispiel.AT/x?y=1')).toBe('beispiel.at');
  });
  it('returns null for empty / junk', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain('not a url')).toBeNull();
  });
});
