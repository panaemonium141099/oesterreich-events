/**
 * Ein gespeichertes "Eintritt frei" aus der alten Text-Heuristik ("frei"
 * stand nur neben einem Betrag, z. B. für Kinder) hielt der Preis-Schutz
 * fest, weil ein neuer Lauf ohne Preis nichts überschreibt. Prod 2026-10-07:
 * 199 von 2.112 "Eintritt frei" mit Betrag im Text. Meldet die Quelle
 * `price_rejected`, fällt der Gratis-Anspruch samt Stufe und Flag.
 */
import { describe, it, expect } from 'vitest';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const event = (extra: Partial<ScrapedEvent> = {}) =>
  ({
    source_name: 'gem2go',
    source_id: 'gem2go-4742-1-2026-11-01',
    source_url: 'https://www.pram.at/Weg_1',
    title: 'Oktoberfest',
    description: 'Maß Bier nur 9,90 € Mit Dirndl oder Lederhose gibt’s a gratis Schnapserl!',
    start_date: '2026-11-01T18:00:00.000Z',
    location_name: 'Festzelt',
    ...extra,
  }) as ScrapedEvent;

const existing = (price: Record<string, unknown>) =>
  new Map([['gem2go::gem2go-4742-1-2026-11-01', { id: 'e1', source_name: 'gem2go', source_id: 'gem2go-4742-1-2026-11-01', ...price }]]) as never;

const free = { price_text: 'Eintritt frei', price_min: 0, price_max: 0, price_tier: 'gratis', price_flags: ['freier-eintritt', 'ohne-anmeldung'] };

describe('Schreibpfad: abgelehnter Gratis-Anspruch', () => {
  it('entfernt Preistext, Beträge, Stufe gratis und Flag freier-eintritt', () => {
    const { row } = toSupabaseRow(event({ price_rejected: 'unclear_free' }), existing(free), new Map());
    expect(row).toMatchObject({ price_text: null, price_min: null, price_max: null, price_tier: null });
    expect(row.price_flags).toEqual(['ohne-anmeldung']);
  });

  it('lässt einen gespeicherten Betrag stehen', () => {
    const paid = { price_text: '€ 12,–', price_min: 12, price_max: 12, price_tier: 'günstig', price_flags: [] };
    const { row } = toSupabaseRow(event({ price_rejected: 'unclear_free' }), existing(paid), new Map());
    expect(row.price_text).toBe('€ 12,–');
    expect(row).not.toHaveProperty('price_tier', null);
  });

  it('ohne Ablehnung bleibt der Preis-Schutz wie bisher', () => {
    const { row } = toSupabaseRow(event(), existing(free), new Map());
    expect(row.price_text).toBe('Eintritt frei');
    expect(row.price_flags).toContain('freier-eintritt');
  });
});
