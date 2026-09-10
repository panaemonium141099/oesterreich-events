/**
 * Regressionsschutz fuer den Zeitzonen-Bug vom 2026-09-10.
 *
 * Die Scraper bauen ihre Datums-Strings jeder fuer sich und geben
 * ueberwiegend nackte Wiener Wandzeit aus. `syncEventsToSupabase` ist die
 * einzige Stelle, durch die alle Scraper-Schreibvorgaenge laufen, also muss
 * die Umrechnung dort passieren - sonst liest Postgres die Wandzeit als UTC
 * und die Seite zeigt sie um den Wiener Offset zu spaet.
 */
import { describe, it, expect } from 'vitest';
import { normalizeEventTimestamps } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const base: ScrapedEvent = {
  source_id: 'x',
  source_name: 'test',
  source_url: 'https://example.at/x',
  title: 'Testevent',
  start_date: '2026-10-04T11:00:00',
};

describe('normalizeEventTimestamps', () => {
  it('dreht die nackte Sommer-Wandzeit auf den richtigen Instant', () => {
    // Der konkrete Prod-Fall: meinbezirk lieferte 11:00, die Seite zeigte 13:00.
    const [out] = normalizeEventTimestamps([base]);
    expect(out.start_date).toBe('2026-10-04T09:00:00.000Z');
  });

  it('dreht die nackte Winter-Wandzeit um genau eine Stunde', () => {
    const [out] = normalizeEventTimestamps([{ ...base, start_date: '2027-01-15T19:30:00' }]);
    expect(out.start_date).toBe('2027-01-15T18:30:00.000Z');
  });

  it('normalisiert end_date mit', () => {
    const [out] = normalizeEventTimestamps([
      { ...base, end_date: '2026-10-04T13:00:00' },
    ]);
    expect(out.end_date).toBe('2026-10-04T11:00:00.000Z');
  });

  it('laesst zonen-behaftete Werte unveraendert', () => {
    // Eventim-Feed und Feratel liefern bereits eindeutige Instants.
    const [a] = normalizeEventTimestamps([{ ...base, start_date: '2026-09-01T20:00:00.000+02:00' }]);
    const [b] = normalizeEventTimestamps([{ ...base, start_date: '2026-06-14T18:00:00.000Z' }]);
    expect(a.start_date).toBe('2026-09-01T20:00:00.000+02:00');
    expect(b.start_date).toBe('2026-06-14T18:00:00.000Z');
  });

  it('laesst reine Datums-Werte unveraendert', () => {
    // Diese Form ist der "Uhrzeit unbekannt"-Platzhalter; ihr UTC-Tag
    // bildet den Datums-Slug der Event-URL.
    const [out] = normalizeEventTimestamps([{ ...base, start_date: '2026-10-04' }]);
    expect(out.start_date).toBe('2026-10-04');
  });

  it('gibt unveraenderte Events als dieselbe Referenz zurueck', () => {
    const untouched = { ...base, start_date: '2026-10-04' };
    expect(normalizeEventTimestamps([untouched])[0]).toBe(untouched);
  });
});
