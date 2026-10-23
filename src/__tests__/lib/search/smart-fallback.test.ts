import { describe, it, expect } from 'vitest';
import { pickFallbackTerms, collapseSeries } from '@/lib/search/smart-fallback';

describe('pickFallbackTerms (Wort-Fallback ohne LLM-Intent)', () => {
  it('"von" ist kein Suchbegriff, Künstlername schlägt Gattungswort', () => {
    // 2026-10-23: `Konzert` AND `von` fand Senta Berger und John Williams.
    expect(pickFallbackTerms('Konzert von Pizzera & Jaus')).toEqual(['Pizzera', 'Jaus']);
  });

  it('Bindestriche trennen, Gattungswort fällt weg, wenn Spezifisches bleibt', () => {
    expect(pickFallbackTerms('Techno-Party')).toEqual(['Techno']);
  });

  it('Gattungswort bleibt, wenn sonst nichts da ist', () => {
    expect(pickFallbackTerms('Konzert')).toEqual(['Konzert']);
    expect(pickFallbackTerms('Party')).toEqual(['Party']);
  });

  it('Zielgruppen- und Füllwörter sind keine Pflicht-Treffer', () => {
    // "billig" und "heute abend" hat parseQuery schon als Filter entfernt.
    expect(pickFallbackTerms('Student saufen gehen')).toEqual(['saufen']);
    expect(pickFallbackTerms('was kann man unternehmen')).toEqual([]);
  });

  it('höchstens zwei Begriffe, längere zuerst', () => {
    expect(pickFallbackTerms('oldtimer treffen niederösterreich')).toEqual(['niederösterreich', 'oldtimer']);
    expect(pickFallbackTerms('jazz')).toEqual(['jazz']);
  });

  it('dedupliziert unabhängig von Groß-/Kleinschreibung', () => {
    expect(pickFallbackTerms('Jazz jazz Blues')).toEqual(['Blues', 'Jazz']);
  });
});

describe('collapseSeries (Serien auf eine Karte)', () => {
  const row = (id: string, title: string, venue: string | null, date: string) =>
    ({ id, title, location_name: venue, start_date: date, _similarity: 0.5 });

  it('gleicher Titel + Ort → eine Zeile mit series_count und übrigen Terminen', () => {
    const out = collapseSeries([
      row('b', 'Weihnachtsmarkt am Mirabellplatz', 'Mirabellplatz', '2026-11-21T09:00:00Z'),
      row('a', 'Weihnachtsmarkt am Mirabellplatz', 'Mirabellplatz', '2026-11-20T09:00:00Z'),
      row('c', 'Weihnachtsmarkt am Mirabellplatz', 'Mirabellplatz', '2026-11-19T09:00:00Z'),
      row('d', 'Krampuslauf', 'Hauptplatz', '2026-12-05T17:00:00Z'),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('c'); // frühester Termin
    expect(out[0].series_count).toBe(3);
    expect(out[0].series_dates).toEqual(['2026-11-20T09:00:00Z', '2026-11-21T09:00:00Z']);
    expect(out[1].id).toBe('d');
    expect(out[1].series_count).toBeUndefined();
  });

  it('Reihenfolge der Rangliste bleibt (erstes Vorkommen der Serie)', () => {
    const out = collapseSeries([
      row('x', 'A', 'V', '2026-11-02T00:00:00Z'),
      row('y', 'B', 'V', '2026-11-01T00:00:00Z'),
      row('z', 'A', 'V', '2026-11-01T00:00:00Z'),
    ]);
    expect(out.map(r => r.id)).toEqual(['z', 'y']);
  });

  it('gleicher Titel an anderem Ort bleibt getrennt; ohne Titel keine Serie', () => {
    const out = collapseSeries([
      row('1', 'Flohmarkt', 'Genussquelle', '2026-10-25T09:00:00Z'),
      row('2', 'Flohmarkt', 'EZE', '2026-10-24T07:00:00Z'),
      row('3', '', null, '2026-10-24T07:00:00Z'),
      row('4', '', null, '2026-10-25T07:00:00Z'),
    ]);
    expect(out).toHaveLength(4);
  });
});
