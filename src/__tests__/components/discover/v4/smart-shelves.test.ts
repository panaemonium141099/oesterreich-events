import { describe, it, expect } from 'vitest';
import { planSmartShelves, phaseOf } from '@/components/Discover/v4/smart-shelves';
import { buildConciergeLine, buildRefineChips } from '@/components/Discover/v4/smart-summary';

// Freitag 2026-10-23 12:00 Wien (CEST, UTC+2)
const NOW = new Date('2026-10-23T10:00:00Z');
const ev = (id: string, iso: string, extra: Record<string, unknown> = {}) => ({ id, start_date: iso, ...extra });

describe('planSmartShelves', () => {
  it('alles an einem Tag → Regale nach Tagesphase, Zeiten in Wiener Zeit', () => {
    const shelves = planSmartShelves([
      ev('nacht', '2026-10-23T21:00:00Z'),      // 23:00 Wien
      ev('abend', '2026-10-23T18:00:00Z'),      // 20:00 Wien
      ev('vormittag', '2026-10-23T07:00:00Z'),  // 09:00 Wien
      ev('nachmittag', '2026-10-23T13:30:00Z'), // 15:30 Wien
    ], NOW);
    expect(shelves.map(s => [s.title, s.events.map(e => e.id)])).toEqual([
      ['Vormittag', ['vormittag']],
      ['Nachmittag', ['nachmittag']],
      ['Abend', ['abend']],
      ['Nacht', ['nacht']],
    ]);
  });

  it('Events ohne bekannte Uhrzeit landen in einem eigenen Regal am Ende', () => {
    const shelves = planSmartShelves([
      ev('ganztag', '2026-10-23T00:00:00+02:00'),
      ev('abend', '2026-10-23T18:00:00Z'),
    ], NOW);
    expect(shelves.map(s => s.title)).toEqual(['Abend', 'Ohne feste Uhrzeit']);
    expect(shelves[1].events[0].id).toBe('ganztag');
  });

  it('mehrere Tage → ein Regal pro Tag, "Heute"/"Morgen", dann Datum, chronologisch', () => {
    const shelves = planSmartShelves([
      ev('so', '2026-10-25T10:00:00Z'),
      ev('heute', '2026-10-23T18:00:00Z'),
      ev('morgen', '2026-10-24T18:00:00Z'),
      ev('heute2', '2026-10-23T15:00:00Z'),
    ], NOW);
    expect(shelves.map(s => s.title)).toEqual(['Heute', 'Morgen', 'So., 25. Okt.']);
    expect(shelves[0].events.map(e => e.id)).toEqual(['heute2', 'heute']);
  });

  it('mehr als sieben Tage → Rest als "Später"', () => {
    const list = Array.from({ length: 9 }, (_, i) => ev(`d${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T18:00:00Z`));
    const shelves = planSmartShelves(list, NOW);
    expect(shelves).toHaveLength(8);
    expect(shelves[7].title).toBe('Später');
    expect(shelves[7].events).toHaveLength(2);
  });

  it('phaseOf: Grenzen 12/17/21', () => {
    expect(phaseOf(11)).toBe('vormittag');
    expect(phaseOf(12)).toBe('nachmittag');
    expect(phaseOf(17)).toBe('abend');
    expect(phaseOf(21)).toBe('nacht');
  });

  it('leere Liste → keine Regale', () => {
    expect(planSmartShelves([], NOW)).toEqual([]);
  });
});

describe('buildConciergeLine', () => {
  const chips = [{ key: 'date:today', label: 'Heute' }, { key: 'ort', label: 'Wien' }];

  it('nennt Treffer und die verstandenen Angaben', () => {
    const line = buildConciergeLine({ count: 12, activities: 0, chips, signals: ['intent:ai'], unmatchedTerms: [] });
    expect(line).toBe('12 Treffer für Heute · Wien. Mit + legst du dir Stopps in deinen Plan.');
  });

  it('ehrliche Leere: sagt, welcher Begriff nicht gefunden wurde', () => {
    const line = buildConciergeLine({ count: 8, activities: 0, chips: [{ key: 'ort', label: 'Niederösterreich' }], signals: ['intent:ai'], unmatchedTerms: ['Oldtimer'] });
    expect(line).toContain('Für „Oldtimer" habe ich nichts gefunden');
    expect(line).toContain('zu Niederösterreich');
  });

  it('nichts gefunden, ohne Begriff', () => {
    const line = buildConciergeLine({ count: 0, activities: 0, chips, signals: [], unmatchedTerms: [] });
    expect(line).toMatch(/^Nichts gefunden für Heute · Wien\./);
  });

  it('Fallback ohne KI wird benannt', () => {
    const line = buildConciergeLine({ count: 3, activities: 2, chips: [], signals: ['intent:fallback'], unmatchedTerms: [] });
    expect(line).toContain('3 Treffer und 2 Ausflugsziele.');
    expect(line).toContain('KI-Deutung war gerade nicht erreichbar');
  });
});

describe('buildRefineChips', () => {
  it('bietet nur an, was die Anfrage noch nicht festlegt', () => {
    const labels = buildRefineChips({ signals: ['today', 'price:günstig'], max_price_tier: 'günstig' }).map(c => c.label);
    expect(labels).not.toContain('Nur gratis');
    expect(labels).not.toContain('Heute');
    expect(labels).toContain('Lieber indoor');
    expect(labels).toContain('Mit Kindern');
  });

  it('ohne Angaben: Preis und Datum zuerst, höchstens sechs', () => {
    const chips = buildRefineChips({ signals: [] });
    expect(chips.map(c => c.label).slice(0, 4)).toEqual(['Nur gratis', 'Günstig', 'Heute', 'Am Wochenende']);
    expect(chips.length).toBeLessThanOrEqual(6);
    expect(chips[0].append).toBe('gratis');
  });
});
