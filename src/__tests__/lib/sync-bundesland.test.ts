/**
 * Der Schreibpfad setzt das Bundesland aus der Ortsentscheidung, wenn die
 * Quelle keines nennt. Bis 2026-09-24 füllte ein DB-Trigger die Lücke aus
 * der PLZ; fn-27 entfernte ihn, der Sync übernahm die Aufgabe aber nicht.
 * Prod 2026-10-07: 4.181 künftige Events mit belegter Gemeinde und leerem
 * events.bundesland (Boudicca, ntry.at, burgenland.info, …), unsichtbar für
 * jeden Bundesland-Filter.
 */
import { describe, it, expect } from 'vitest';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const base = {
  source_name: 'boudicca:stadthallewien',
  source_id: 'a',
  source_url: 'https://example.at/a',
  title: 'Testkonzert',
  start_date: '2030-03-01T18:00:00.000Z',
} as ScrapedEvent;

type Row = { bundesland: string | null; location_resolution: { gemeinde: { bundesland: string } | null } };
const rowOf = (e: Partial<ScrapedEvent>) => toSupabaseRow({ ...base, ...e } as ScrapedEvent, new Map(), new Map()).row as unknown as Row;

describe('Schreibpfad: Bundesland aus der Ortsentscheidung', () => {
  it('Quelle ohne Bundesland, Gemeinde aus der Adresse belegt → Bundesland der Gemeinde', () => {
    const row = rowOf({ location_name: 'Wiener Stadthalle', address: 'Roland-Rainer-Platz 1, 1150 Wien' });
    expect(row.location_resolution.gemeinde?.bundesland).toBe('wien');
    expect(row.bundesland).toBe('wien');
  });

  it('Gemeinde nicht eindeutig, aber alle Gemeinden der PLZ im selben Bundesland → Bundesland der PLZ', () => {
    const row = rowOf({ location_name: 'Messehalle', postal_code: '4240' });
    expect(row.location_resolution.gemeinde).toBeNull();
    expect(row.bundesland).toBe('oberoesterreich');
  });

  it('die Angabe der Quelle bleibt', () => {
    expect(rowOf({ location_name: 'Festspielhaus', address: 'Hofstallgasse 1, 5020 Salzburg', bundesland: 'Salzburg' }).bundesland).toBe('salzburg');
  });

  it('Ausland: eine gleichlautende PLZ macht kein österreichisches Bundesland (6900 Lugano ≠ Bregenz)', () => {
    const row = rowOf({ location_name: 'Palazzo dei Congressi', postal_code: '6900', city: 'Lugano', country: 'CH' });
    expect(row.bundesland).toBeNull();
  });
});
