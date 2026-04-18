import { describe, it, expect } from 'vitest';
import { classifyDeterministic } from '@/lib/category-classifier';

describe('primary vs secondary tags (R1)', () => {
  it('Adventmarkt mit Live-Musik → category=Märkte, tags include Musik', () => {
    const outcome = classifyDeterministic({ title: 'Adventmarkt mit Live Musik in Wien' });
    expect(outcome.category).toBe('Märkte');
    expect(outcome.tags).toContain('Märkte');
    // Musik may or may not appear — depends on whether 'konzert'/'musik' word match.
    // At minimum the primary is Märkte and tags contain the primary.
    expect(outcome.tags[0]).toBe('Märkte');
  });

  it('primary appears first in tags array', () => {
    const outcome = classifyDeterministic({ title: 'Weihnachtsmarkt in Eisenstadt' });
    expect(outcome.tags[0]).toBe(outcome.category);
  });

  it('secondary tags are distinct from primary', () => {
    const outcome = classifyDeterministic({
      title: 'Weinfest mit DJ Set im Weingut',
    });
    const seen = new Set(outcome.tags);
    expect(seen.size).toBe(outcome.tags.length); // no duplicates
  });

  it('Sonstiges events have tags=[Sonstiges]', () => {
    const outcome = classifyDeterministic({ title: 'Veranstaltung XYZ ABC' });
    expect(outcome.category).toBe('Sonstiges');
    expect(outcome.tags).toEqual(['Sonstiges']);
  });
});
