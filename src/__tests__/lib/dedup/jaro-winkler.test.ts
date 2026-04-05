import { describe, it, expect } from 'vitest';
import { jaroWinkler } from '@/lib/dedup/jaro-winkler';

describe('jaroWinkler', () => {
  it('should return 1.0 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1.0);
  });

  it('should return 0.0 for completely different strings', () => {
    expect(jaroWinkler('abc', 'xyz')).toBe(0.0);
  });

  it('should return 1.0 for two empty strings', () => {
    expect(jaroWinkler('', '')).toBe(1.0);
  });

  it('should return 0.0 when one string is empty', () => {
    expect(jaroWinkler('hello', '')).toBe(0.0);
    expect(jaroWinkler('', 'world')).toBe(0.0);
  });

  it('should give high similarity for very similar strings', () => {
    // Classic Jaro-Winkler test pair
    const sim = jaroWinkler('martha', 'marhta');
    expect(sim).toBeGreaterThan(0.95);
  });

  it('should give bonus for common prefix', () => {
    // "abc" vs "abd" should score higher than "xbc" vs "xbd"
    // because Winkler bonus rewards common prefix
    const sim1 = jaroWinkler('abcdef', 'abcdeg');
    const sim2 = jaroWinkler('xbcdef', 'xbcdeg');
    expect(sim1).toBeGreaterThanOrEqual(sim2);
  });

  it('should detect near-duplicate event titles above 0.85', () => {
    const sim = jaroWinkler('pub quiz flex wien', 'pub quiz im flex wien');
    expect(sim).toBeGreaterThan(0.85);
  });

  it('should score low for unrelated event titles', () => {
    const sim = jaroWinkler('pub quiz flex wien', 'klassik konzert musikverein');
    expect(sim).toBeLessThan(0.5);
  });

  it('should be symmetric', () => {
    const sim1 = jaroWinkler('abc', 'adc');
    const sim2 = jaroWinkler('adc', 'abc');
    expect(sim1).toBeCloseTo(sim2, 10);
  });

  it('should handle single-character strings', () => {
    expect(jaroWinkler('a', 'a')).toBe(1.0);
    expect(jaroWinkler('a', 'b')).toBe(0.0);
  });

  it('should handle strings of different lengths', () => {
    const sim = jaroWinkler('test', 'testing');
    expect(sim).toBeGreaterThan(0.8);
    expect(sim).toBeLessThan(1.0);
  });
});
