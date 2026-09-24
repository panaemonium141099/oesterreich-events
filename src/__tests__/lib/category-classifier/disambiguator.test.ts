import { describe, it, expect } from 'vitest';
import { DISAMBIGUATOR_PAIRS } from '@/lib/category-classifier/rules';

// Taxonomie v3: Bildung/Wirtschaft sind „Wissen & Karriere", Feste/Märkte sind
// „Märkte & Feste" — diese beiden früheren Paare gibt es nicht mehr.
const find = (a: string, b: string) => DISAMBIGUATOR_PAIRS.find(d => d.pair.includes(a as never) && d.pair.includes(b as never))!;
const ctx = (title: string) => ({ title, description: '', sourceName: '', organizer: '' });

describe('disambiguator pairs (v3)', () => {
  it('exactly the 4 designed pairs are registered', () => {
    expect(DISAMBIGUATOR_PAIRS).toHaveLength(4);
    const pairs = DISAMBIGUATOR_PAIRS.map(d => d.pair.slice().sort().join('|'));
    expect(pairs).toContain(['Musik', 'Nightlife & Party'].sort().join('|'));
    expect(pairs).toContain(['Märkte & Feste', 'Essen & Trinken'].sort().join('|'));
    expect(pairs).toContain(['Kultur & Bühne', 'Wellness & Spiritualität'].sort().join('|'));
    expect(pairs).toContain(['Musik', 'Wellness & Spiritualität'].sort().join('|'));
  });

  it('resolvers are pure and side-effect free', () => {
    for (const d of DISAMBIGUATOR_PAIRS) {
      expect(d.resolve(ctx(''))).toBeNull();
    }
  });

  it('Nightlife/Musik: dj set → Nightlife & Party', () => {
    expect(find('Nightlife & Party', 'Musik').resolve(ctx('dj set nacht'))).toBe('Nightlife & Party');
  });

  it('Nightlife/Musik: orchester → Musik', () => {
    expect(find('Nightlife & Party', 'Musik').resolve(ctx('orchester matinee'))).toBe('Musik');
  });

  it('Märkte/Essen: "weihnachtsmarkt" → Märkte & Feste', () => {
    expect(find('Märkte & Feste', 'Essen & Trinken').resolve(ctx('weihnachtsmarkt'))).toBe('Märkte & Feste');
  });

  it('Märkte/Essen: "weinverkostung" → Essen & Trinken', () => {
    expect(find('Märkte & Feste', 'Essen & Trinken').resolve(ctx('weinverkostung im weingut'))).toBe('Essen & Trinken');
  });

  it('Spiritualität/Kultur: "gottesdienst" → Wellness & Spiritualität, "vernissage" → Kultur & Bühne', () => {
    const p = find('Wellness & Spiritualität', 'Kultur & Bühne');
    expect(p.resolve(ctx('gottesdienst am sonntag'))).toBe('Wellness & Spiritualität');
    expect(p.resolve(ctx('vernissage im rathaus'))).toBe('Kultur & Bühne');
  });
});
