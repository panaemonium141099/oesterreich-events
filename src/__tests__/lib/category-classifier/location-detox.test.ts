import { describe, it, expect } from 'vitest';
import { stripLocationTails } from '@/lib/category-classifier';

describe('stripLocationTails (GeoNames-backed)', () => {
  it('strips a known trailing Austrian place after a preposition', () => {
    expect(stripLocationTails('dorffest in neckenmarkt')).toBe('dorffest');
    expect(stripLocationTails('vortrag - linz')).toBe('vortrag');
    expect(stripLocationTails('lesung in wiener neustadt')).toBe('lesung');
  });

  it('does NOT strip when the trailing word is NOT a known place', () => {
    expect(stripLocationTails('konzert im park')).toBe('konzert im park');
    expect(stripLocationTails('jazz bei kerzenschein')).toBe('jazz bei kerzenschein');
  });

  it('does NOT strip when there is nothing before the preposition (pure place title)', () => {
    // "in Graz" alone is just a place phrase; we don't want to destroy it
    // entirely. The function returns the input unchanged when stripping would
    // leave nothing.
    expect(stripLocationTails('in graz')).toBe('in graz');
  });

  it('returns input unchanged when shorter than prefix+preposition+place', () => {
    expect(stripLocationTails('')).toBe('');
    expect(stripLocationTails('fest')).toBe('fest');
    expect(stripLocationTails('in wien')).toBe('in wien');
  });

  it('does not strip mid-title mentions (only trailing segments)', () => {
    // Middle-of-title "in <place>" stays intact.
    expect(stripLocationTails('dorffest in neckenmarkt mit live musik'))
      .toBe('dorffest in neckenmarkt mit live musik');
  });
});
