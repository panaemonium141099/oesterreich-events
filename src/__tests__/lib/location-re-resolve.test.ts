/**
 * Bestandssanierung (fn-25 E): eine veraltete Backfill-Entscheidung darf
 * keinen neueren geprüften Stand überschreiben (Review §9 „Gleichzeitiger
 * Scrape während Backfill"). Geprüft am `updated_at`-Vergleich mit einem
 * Fake-Client; nichts geht in die DB.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inputFromStoredRow, reResolveStoredEvents, type StoredEventLocationRow } from '@/lib/location/re-resolve';
import { resolveEventLocation } from '@/lib/location/resolver';

interface DbEvent { id: string; updated_at: string | null }

function fakeClient(db: DbEvent[], writes: Array<{ id: unknown; payload: Record<string, unknown> }>): SupabaseClient {
  return {
    from(table: string) {
      const filters: Array<[string, string, unknown]> = [];
      let op: 'select' | 'update' = 'select';
      let payload: Record<string, unknown> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {
        select: () => b,
        update: (p: Record<string, unknown>) => { op = 'update'; payload = p; return b; },
        eq: (col: string, val: unknown) => { filters.push(['eq', col, val]); return b; },
        is: (col: string, val: unknown) => { filters.push(['is', col, val]); return b; },
        in: () => b,
        not: () => b,
        then(resolve: (v: unknown) => void) {
          if (table === 'events' && op === 'update') {
            const id = filters.find(f => f[1] === 'id')?.[2];
            const upd = filters.find(f => f[1] === 'updated_at');
            const row = db.find(r => r.id === id);
            const match = !!row && (upd?.[0] === 'is' ? row.updated_at === null : row.updated_at === upd?.[2]);
            if (match) {
              writes.push({ id, payload });
              row!.updated_at = '2026-09-14T09:00:00Z';
              resolve({ data: [{ id }], error: null });
            } else {
              resolve({ data: [], error: null });
            }
            return;
          }
          resolve({ data: [], error: null });
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const baseRow = (): StoredEventLocationRow => ({
  id: 'ev-1',
  title: 'Konzert',
  location_name: 'Haus der Frau',
  location_name_raw: 'Haus der Frau',
  address: 'Volksgartenstraße 18, 4020 Linz',
  address_raw: 'Volksgartenstraße 18, 4020 Linz',
  postal_code: '4020',
  postal_code_raw: null,
  city_raw: null,
  country: 'AT',
  country_raw: null,
  bundesland: 'oberoesterreich',
  latitude: 47.41,
  longitude: 13.77,
  latitude_raw: null,
  longitude_raw: null,
  coords_precision_raw: null,
  source_venue_id: null,
  geocoding_confidence: 'exact',
  location_status: null,
  location_resolution: null,
  updated_at: '2026-09-14T08:00:00Z',
});

describe('reResolveStoredEvents: Schutz vor Überrollen', () => {
  it('unveränderte Zeile wird mit der ganzen Entscheidung geschrieben', async () => {
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [baseRow()], { phase: 'test' });
    expect(res.written).toBe(true);
    expect(writes).toHaveLength(1);
    const p = writes[0].payload;
    expect(p.location_status).toBe('municipality_only');
    expect(p.geocoding_confidence).toBe('gemeinde-centroid');
    expect(p.latitude).not.toBe(47.41);
    expect((p.location_resolution as { phase: string }).phase).toBe('test');
    expect(p.location_provenance).toBeDefined();
  });

  it('Zeile wurde zwischenzeitlich vom Scrape geschrieben (anderes updated_at) → nicht überschrieben', async () => {
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    // Der Backfill hat die Zeile um 08:00 gelesen; der Scrape schrieb um 08:30.
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:30:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [baseRow()], { phase: 'test' });
    expect(res.written).toBe(false);
    expect(res.skipped_reason).toBe('concurrent_update');
    expect(writes).toHaveLength(0);
  });

  it('dry-run schreibt nichts', async () => {
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [baseRow()], { phase: 'test', dryRun: true });
    expect(res.written).toBe(false);
    expect(res.decision.status).toBe('municipality_only');
    expect(writes).toHaveLength(0);
  });

  it('gleiche Entscheidung wie gespeichert → kein Schreibzugriff (Wiederholbarkeit)', async () => {
    const row = baseRow();
    const d = resolveEventLocation(inputFromStoredRow(row));
    row.location_status = d.status;
    row.geocoding_confidence = d.geocoding_confidence;
    row.latitude = d.latitude;
    row.longitude = d.longitude;
    row.location_resolution = { input_hash: d.input_hash };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(res.skipped_reason).toBe('unchanged');
    expect(writes).toHaveLength(0);
    // Gleiche Position, aber altes Label (`exact`) → wird geschrieben, damit das Label der Entscheidung entspricht.
    const relabel = { ...row, geocoding_confidence: 'exact' };
    const [res2] = await reResolveStoredEvents(sb, [relabel], { phase: 'test' });
    expect(res2.written).toBe(true);
    expect(writes[0].payload.geocoding_confidence).toBe('gemeinde-centroid');
  });

  it('Eingabe aus der Zeile: Rohspalten vor Anzeigespalten, Event-ID für Korrekturen', () => {
    const row = { ...baseRow(), location_name_raw: 'Roh', address_raw: 'Rohstraße 1, 4020 Linz', latitude_raw: 48.3, longitude_raw: 14.29, coords_precision_raw: 'venue' };
    const inp = inputFromStoredRow(row);
    expect(inp.location_name).toBe('Roh');
    expect(inp.latitude).toBe(48.3);
    expect(inp.coords_precision).toBe('venue');
    expect(inp.event_id).toBe('ev-1');
    // Ohne Rohspalten zählen Anzeigekoordinaten nur, wenn sie von der Quelle stammen.
    const legacy = { ...baseRow(), location_name_raw: null, address_raw: null };
    expect(inputFromStoredRow(legacy).latitude).toBeNull();
    expect(inputFromStoredRow({ ...legacy, geocoding_confidence: 'scraper' }).coords_precision).toBe('unknown');
    expect(inputFromStoredRow({ ...legacy, geocoding_confidence: 'scraper' }).latitude).toBe(47.41);
  });
});
