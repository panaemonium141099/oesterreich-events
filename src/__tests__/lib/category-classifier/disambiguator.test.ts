import { describe, it, expect } from 'vitest';
import { DISAMBIGUATOR_PAIRS } from '@/lib/category-classifier/rules';

describe('disambiguator pairs (6 only)', () => {
  it('exactly the 6 designed pairs are registered', () => {
    expect(DISAMBIGUATOR_PAIRS).toHaveLength(6);
    const pairs = DISAMBIGUATOR_PAIRS.map(d => d.pair.slice().sort().join('|'));
    expect(pairs).toContain(['Musik', 'Nightlife'].sort().join('|'));
    expect(pairs).toContain(['Märkte', 'Wein & Kulinarik'].sort().join('|'));
    expect(pairs).toContain(['Bildung', 'Wirtschaft'].sort().join('|'));
    expect(pairs).toContain(['Kultur', 'Religion'].sort().join('|'));
    expect(pairs).toContain(['Musik', 'Religion'].sort().join('|'));
    expect(pairs).toContain(['Feste & Brauchtum', 'Märkte'].sort().join('|'));
  });

  it('resolvers are pure and side-effect free', () => {
    const ctx = { title: '', description: '', sourceName: '', organizer: '' };
    for (const d of DISAMBIGUATOR_PAIRS) {
      expect(d.resolve(ctx)).toBeNull();
    }
  });

  it('Nightlife/Musik: dj set → Nightlife', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Nightlife') && d.pair.includes('Musik'))!;
    expect(pair.resolve({ title: 'dj set nacht', description: '', sourceName: '', organizer: '' })).toBe('Nightlife');
  });

  it('Nightlife/Musik: orchester → Musik', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Nightlife') && d.pair.includes('Musik'))!;
    expect(pair.resolve({ title: 'orchester matinee', description: '', sourceName: '', organizer: '' })).toBe('Musik');
  });

  it('Märkte/Wein: "weihnachtsmarkt" → Märkte', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Märkte') && d.pair.includes('Wein & Kulinarik'))!;
    expect(pair.resolve({ title: 'weihnachtsmarkt', description: '', sourceName: '', organizer: '' })).toBe('Märkte');
  });

  it('Märkte/Wein: "weinverkostung" → Wein & Kulinarik', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Märkte') && d.pair.includes('Wein & Kulinarik'))!;
    expect(pair.resolve({ title: 'weinverkostung im weingut', description: '', sourceName: '', organizer: '' })).toBe('Wein & Kulinarik');
  });

  it('Bildung/Wirtschaft: "vortrag" → Bildung', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Bildung') && d.pair.includes('Wirtschaft'))!;
    expect(pair.resolve({ title: 'vortrag', description: '', sourceName: '', organizer: '' })).toBe('Bildung');
  });

  it('Bildung/Wirtschaft: "networking" → Wirtschaft', () => {
    const pair = DISAMBIGUATOR_PAIRS.find(d => d.pair.includes('Bildung') && d.pair.includes('Wirtschaft'))!;
    expect(pair.resolve({ title: 'networking event', description: '', sourceName: '', organizer: '' })).toBe('Wirtschaft');
  });
});
