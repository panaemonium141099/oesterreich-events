/**
 * Bestandssanierung (fn-25 E): eine veraltete Backfill-Entscheidung darf
 * keinen neueren geprüften Stand überschreiben (Review §9 „Gleichzeitiger
 * Scrape während Backfill"). Geprüft am `updated_at`-Vergleich mit einem
 * Fake-Client; nichts geht in die DB.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inputFromStoredRow, reResolveStoredEvents, contractedDecision, publishChangeFor, repeatabilityOf, type StoredEventLocationRow } from '@/lib/location/re-resolve';
import { resolveEventLocation } from '@/lib/location/resolver';
import { locationBasisHash } from '@/lib/location/conservative-resolution';
import { districtForLocation } from '@/lib/plz-district';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

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
    row.district = districtForLocation(d.gemeinde, d.postal_code ?? row.postal_code, row.bundesland, row.district);
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

// Befund 2026-10-07: Altzeilen ohne Rohwerte tragen oft die Amts-PLZ ihrer
// Gemeinde aus dem früheren Koordinatenabgleich (Boudicca: Stadthalle
// „Roland-Rainer-Platz 1, 1150 Wien" mit PLZ 1010). Die Entscheidung hält sie
// für eine Quellangabe; über die PLZ stünde das Event im 1. Bezirk.
describe('Altzeilen ohne Rohwerte: die Amts-PLZ der Gemeinde belegt keinen Bezirk', () => {
  const legacyWien = (over: Partial<StoredEventLocationRow>): StoredEventLocationRow => ({
    ...baseRow(),
    location_name_raw: null,
    address_raw: null,
    postal_code_raw: null,
    bundesland: 'wien',
    latitude: null,
    longitude: null,
    geocoding_confidence: null,
    district: null,
    ...over,
  });

  it('Stadthalle mit Alt-PLZ 1010 kommt nicht in den 1. Bezirk', async () => {
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const row = legacyWien({ location_name: 'Stadthalle Wien', address: 'Roland-Rainer-Platz 1, 1150 Wien', postal_code: '1010' });
    await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(writes).toHaveLength(1);
    expect(writes[0].payload.district).toBeNull();
  });

  it('eine Alt-PLZ, die nicht die Amts-PLZ der Gemeinde ist, belegt den Bezirk', async () => {
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const row = legacyWien({ location_name: 'Theater in der Josefstadt', address: 'Josefstädter Straße 26', postal_code: '1080' });
    await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(writes[0].payload.district).toBe('8. josefstadt');
  });
});

describe('contractedDecision: Freigabevertrag gilt auch im Bestand (Galtür-Befund)', () => {
  it('Koordinate widerspricht dem deklarierten Bundesland, PLZ stützt das Bundesland → Konflikt ohne Position, verworfen protokolliert', () => {
    // Deklariert Tirol (Galtür, PLZ 6563), Koordinate liegt in Vorarlberg (Bielerhöhe).
    const row: StoredEventLocationRow = { ...baseRow(), bundesland: 'tirol', address: null, address_raw: null, postal_code: '6563', postal_code_raw: '6563', city_raw: 'Galtür', location_name_raw: 'Silvretta Bielerhöhe', latitude_raw: 46.9186, longitude_raw: 10.0968, coords_precision_raw: 'venue' };
    const pure = resolveEventLocation(inputFromStoredRow(row));
    expect(pure.status).toBe('address_confirmed');
    const d = contractedDecision(row, pure);
    expect(d.status).toBe('conflict');
    expect(d.latitude).toBeNull();
    expect(d.reasons).toContain('admission:drop_coordinates');
    expect((d as unknown as { revoked?: { latitude: number } }).revoked?.latitude).toBe(46.9186);
    expect(d.allowed.pin).toBe(false);
  });

  it('stimmige Zeile bleibt unverändert (Referenzgleichheit)', () => {
    const row = baseRow();
    const pure = resolveEventLocation(inputFromStoredRow(row));
    expect(contractedDecision(row, pure)).toBe(pure);
  });
});

describe('Veröffentlichungsregel bei erneuter Entscheidung (Review §6: Konflikt = zurückhalten)', () => {
  it('publishChangeFor: Konflikt nimmt die Veröffentlichung; nur wegen Ortskonflikt zurückgehaltene Zeilen kommen zurück', () => {
    expect(publishChangeFor({ publish_status: 'published', location_resolution: null }, { status: 'conflict' })).toEqual({ publish_status: 'needs_review' });
    expect(publishChangeFor({ publish_status: 'needs_review', location_resolution: { reasons: ['a6_pin_contradicts_postal_code:45km'] } }, { status: 'municipality_only' })).toEqual({ publish_status: 'published' });
    expect(publishChangeFor({ publish_status: 'needs_review', location_resolution: { reasons: ['admission:placeholder_location'] } }, { status: 'municipality_only' })).toEqual({ publish_status: 'published' });
    // Aus anderen Gründen zurückgehalten (z. B. Score/Qualität): bleibt.
    expect(publishChangeFor({ publish_status: 'needs_review', location_resolution: { reasons: ['gemeinde_centroid_from_plz'] } }, { status: 'municipality_only' })).toBeNull();
    expect(publishChangeFor({ publish_status: 'suppressed', location_resolution: null }, { status: 'conflict' })).toBeNull();
    expect(publishChangeFor({ publish_status: 'published', location_resolution: null }, { status: 'address_confirmed' })).toBeNull();
  });

  it('Konflikt-Zeile, die veröffentlicht ist, wird beim Re-Resolve auf needs_review gesetzt (auch wenn die Entscheidung unverändert ist)', async () => {
    // Deklariert Tirol, Koordinate in Vorarlberg, PLZ stützt Tirol → Vertragskonflikt.
    const row: StoredEventLocationRow = { ...baseRow(), bundesland: 'tirol', address: null, address_raw: null, postal_code: '6563', postal_code_raw: '6563', city_raw: 'Galtür', location_name_raw: 'Silvretta Bielerhöhe', latitude_raw: 46.9186, longitude_raw: 10.0968, coords_precision_raw: 'venue', publish_status: 'published' };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(res.decision.status).toBe('conflict');
    expect(res.publish_change).toBe('withheld');
    expect(writes[0].payload.publish_status).toBe('needs_review');
    expect(writes[0].payload.latitude).toBeNull();
  });
});

describe('Bundesland bei erneuter Entscheidung (Quellangabe statt abgeleiteter Spalte)', () => {
  it('Eingabe aus der Zeile: das Bundesland der Quelle steht im Protokoll, nicht in der Spalte', () => {
    // Die Spalte trägt seit 2026-10 auch das aus Gemeinde/PLZ abgeleitete Bundesland.
    const derived = { ...baseRow(), bundesland: 'oberoesterreich', location_resolution: { input_hash: 'x', evidence: ['plz:address_text:4020'] } };
    expect(inputFromStoredRow(derived).bundesland).toBeNull();
    const declared = { ...derived, location_resolution: { input_hash: 'x', evidence: ['plz:address_text:4020', 'bundesland:source:oberoesterreich'] } };
    expect(inputFromStoredRow(declared).bundesland).toBe('oberoesterreich');
    // Ohne gespeicherte Entscheidung (Altbestand) bleibt die Spalte der einzige Wert.
    expect(inputFromStoredRow({ ...derived, location_resolution: null }).bundesland).toBe('oberoesterreich');
  });

  it('Sync-Zeile ohne Bundesland der Quelle: Neu-Entscheidung kommt zum selben Ergebnis und schreibt nicht', async () => {
    const event = {
      source_name: 'boudicca:stadthallewien',
      source_id: 'a',
      source_url: 'https://example.at/a',
      title: 'Testkonzert',
      start_date: '2030-03-01T18:00:00.000Z',
      location_name: 'Wiener Stadthalle',
      address: 'Roland-Rainer-Platz 1, 1150 Wien',
    } as ScrapedEvent;
    const synced = toSupabaseRow(event, new Map(), new Map()).row as unknown as StoredEventLocationRow;
    expect(synced.bundesland).toBe('wien');
    const stored: StoredEventLocationRow = { ...synced, id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [stored], { phase: 'test' });
    expect(res.decision.input_hash).toBe(synced.location_resolution?.input_hash);
    expect(res.skipped_reason).toBe('unchanged');
    expect(writes).toHaveLength(0);
  });

  it('fehlendes Bundesland wird aus der belegten Gemeinde geschrieben', async () => {
    const row: StoredEventLocationRow = { ...baseRow(), bundesland: null, location_resolution: { evidence: [] } as StoredEventLocationRow['location_resolution'] };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(res.written).toBe(true);
    expect(writes[0].payload.bundesland).toBe('oberoesterreich');
  });

  it('vom Freigabevertrag korrigierte Quellangabe bleibt korrigiert (wie im Sync)', async () => {
    // Quelle sagt Salzburg, Koordinate und PLZ 4020 liegen in Oberösterreich → use_coordinate_region.
    const row: StoredEventLocationRow = {
      ...baseRow(),
      bundesland: 'oberoesterreich',
      latitude_raw: 48.3069,
      longitude_raw: 14.2858,
      coords_precision_raw: 'address',
      location_resolution: { evidence: ['bundesland:source:salzburg'] } as StoredEventLocationRow['location_resolution'],
    };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [row], { phase: 'test' });
    expect(res.decision.latitude).toBe(48.3069);
    expect(writes[0].payload.bundesland).toBe('oberoesterreich');
  });
});

describe('Land bei erneuter Entscheidung (Quellangabe statt abgeleiteter Spalte)', () => {
  it('Eingabe aus der Zeile: Land der Quelle aus country_raw, nicht aus der abgeleiteten Spalte', () => {
    const raw = { ...baseRow(), country: 'AT', country_raw: null };
    expect(inputFromStoredRow(raw).country).toBeNull();
    expect(inputFromStoredRow({ ...raw, country_raw: 'Deutschland' }).country).toBe('Deutschland');
    // Altbestand ohne Rohwerte: die Anzeigespalte ist der einzige Wert.
    expect(inputFromStoredRow({ ...raw, location_name_raw: null, address_raw: null }).country).toBe('AT');
  });

  it('Sync-Zeile einer Quelle ohne Länderangabe: Neu-Entscheidung hat denselben Eingabehash und schreibt nicht', async () => {
    const event = { source_name: 'meinbezirk', source_id: 'v', source_url: 'https://example.at/v', title: 'Vortrag', start_date: '2030-03-01T18:00:00.000Z', location_name: 'Pfarrhof', city: 'Gansbach' } as ScrapedEvent;
    const synced = toSupabaseRow(event, new Map(), new Map()).row as unknown as StoredEventLocationRow;
    expect(synced.country).toBe('AT');
    const stored: StoredEventLocationRow = { ...synced, id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' };
    const writes: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
    const sb = fakeClient([{ id: 'ev-1', updated_at: '2026-09-14T08:00:00Z' }], writes);
    const [res] = await reResolveStoredEvents(sb, [stored], { phase: 'test' });
    expect(res.decision.input_hash).toBe(synced.location_resolution?.input_hash);
    expect(res.skipped_reason).toBe('unchanged');
    expect(writes).toHaveLength(0);
  });

  it('Admin-Korrektur einer Quelle ohne Länderangabe überlebt den nächsten Scrape (Prod 2026-09-16: Pfarrhof Gansbach)', () => {
    const event = { source_name: 'meinbezirk', source_id: 'v', source_url: 'https://example.at/v', title: 'Vortrag', start_date: '2030-03-01T18:00:00.000Z', location_name: 'Pfarrhof', city: 'Gansbach' } as ScrapedEvent;
    const stored = { ...(toSupabaseRow(event, new Map(), new Map()).row as unknown as StoredEventLocationRow), id: 'ev-1', updated_at: '2026-09-16T06:00:00Z' };
    // So bindet /api/admin/ortsdaten/correction die Korrektur an den Quellenstand.
    const basis_hash = locationBasisHash(inputFromStoredRow(stored));
    const correction = { id: 'c1', latitude: 48.306529, longitude: 15.471689, precision: 'building' as const, venue_id: null, location_name: 'Pfarre, Gansbach', postal_code: '3122', basis_hash, corrected_by: 'admin:test' };
    const next = toSupabaseRow(event, new Map(), new Map(), undefined, { correction, correctionsLoaded: true, complete: true }).row as unknown as StoredEventLocationRow & { location_resolution: { reasons: string[] } };
    expect(next.location_resolution.reasons.filter(r => r.startsWith('correction_stale'))).toEqual([]);
    expect(next.latitude).toBe(48.306529);
    expect(next.geocoding_confidence).toBe('manual');
  });
});

describe('Wiederholbarkeit (Kennzahl location-audit): gleiche Eingabe, gleiche Entscheidung', () => {
  const synced = (e: Partial<ScrapedEvent>) => ({
    ...(toSupabaseRow({ source_name: 'boudicca:linz termine', source_id: 'w', source_url: 'https://example.at/w', title: 'Konzert', start_date: '2030-03-01T18:00:00.000Z', ...e } as ScrapedEvent, new Map(), new Map()).row as unknown as StoredEventLocationRow),
    id: 'ev-1',
    updated_at: '2026-10-07T08:00:00Z',
  });

  it('Sync-Zeile einer Quelle ohne Länderangabe ist vergleichbar und gleich', () => {
    const row = synced({ location_name: 'Posthof', address: 'Posthofstraße 43, 4020 Linz' });
    expect(repeatabilityOf(row, resolveEventLocation(inputFromStoredRow(row)))).toBe('same');
  });

  it('vom Vertrag gesetzter Status zählt nicht als Abweichung (drop_coordinates, Galtür-Muster)', () => {
    // Quelle: Tirol, PLZ 6563 Galtür, Koordinate auf der Bielerhöhe (Vorarlberg) → Vertrag verwirft die Koordinate.
    const row = synced({ bundesland: 'Tirol', postal_code: '6563', city: 'Galtür', location_name: 'Silvretta Bielerhöhe', latitude: 46.9186, longitude: 10.0968, coords_precision: 'venue' });
    expect(row.location_status).toBe('conflict');
    expect(resolveEventLocation(inputFromStoredRow(row)).status).toBe('address_confirmed');
    expect(repeatabilityOf(row, resolveEventLocation(inputFromStoredRow(row)))).toBe('same');
  });

  it('anderer Eingabehash: nicht vergleichbar; behaltene Altkoordinate: eigene Klasse; echte Abweichung: drift', () => {
    const row = synced({ location_name: 'Posthof', address: 'Posthofstraße 43, 4020 Linz' });
    const d = resolveEventLocation(inputFromStoredRow(row));
    expect(repeatabilityOf({ ...row, location_resolution: { ...row.location_resolution, input_hash: 'anders' } }, d)).toBe('not_comparable');
    expect(repeatabilityOf({ ...row, location_resolution: { ...row.location_resolution, reasons: ['legacy_coords_retained:scraper'] } }, d)).toBe('legacy');
    expect(repeatabilityOf({ ...row, latitude: 47.0 }, d)).toBe('drift');
  });
});
