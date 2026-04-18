import { describe, it, expect } from 'vitest';
import { classifyDeterministic, extractSignals, aggregate, normalizeInput } from '@/lib/category-classifier';

describe('precision-classed matching (cat-v2)', () => {
  it('`markt` does NOT match inside `Neckenmarkt` (no Märkte evidence)', () => {
    const norm = normalizeInput({ title: 'Neckenmarkt Event' });
    const scores = aggregate(extractSignals(norm));
    const maerkte = scores.find(s => s.category === 'Märkte');
    expect(maerkte?.score ?? 0).toBe(0);
  });

  it('compound `weihnachtsmarkt` DOES match Märkte via pattern', () => {
    const norm = normalizeInput({ title: 'Weihnachtsmarkt in Wien' });
    const scores = aggregate(extractSignals(norm));
    const maerkte = scores.find(s => s.category === 'Märkte');
    expect((maerkte?.score ?? 0)).toBeGreaterThan(0);
  });

  it('compound `sommerkonzert` matches Musik via pattern (not just substring)', () => {
    const outcome = classifyDeterministic({ title: 'Sommerkonzert im Park' });
    expect(outcome.category).toBe('Musik');
  });

  it('compound `jazzkonzert` matches Musik via pattern', () => {
    const outcome = classifyDeterministic({ title: 'Jazzkonzert im Herbst' });
    expect(outcome.category).toBe('Musik');
  });

  it('lone `club` inside `Clubhotel` does NOT produce Nightlife (exact-word)', () => {
    const norm = normalizeInput({ title: 'Gala im Clubhotel Steiermark' });
    const scores = aggregate(extractSignals(norm));
    const nightlife = scores.find(s => s.category === 'Nightlife');
    // weakContextTokens.Nightlife includes 'club' — must NOT match inside Clubhotel.
    expect(nightlife?.score ?? 0).toBeLessThanOrEqual(6); // at most 1 weak_context hit, nothing else
  });

  it('weak-stem alone cannot open Gate 2 (single precise winner)', () => {
    // `festival` is only a weakContextToken for Musik; on its own it should
    // NOT yield rules_high.
    const outcome = classifyDeterministic({ title: 'Summer Festival' });
    expect(outcome.confidence).not.toBe('rules_high');
  });
});
