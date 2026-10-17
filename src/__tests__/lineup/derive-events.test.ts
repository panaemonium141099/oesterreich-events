// Abgeleitete Lineup-Events („Künstler at Festival").
//
// Prod 2026-10-14: jede Nacht scheiterten alle 839 offenen Zeilen an
// events_bundesland_check, weil derive-events festivals.state als Anzeigename
// („Niederösterreich") in die Spalte schrieb. Der Schritt blieb grün.
//
// Prod 2026-10-17: danach standen alle 839 ohne Koordinate da (kein Festival
// hat ein Eltern-Event) und fielen aus Liste und Karte. Der Lauf las nur
// Zeilen mit derived_event_id IS NULL, ein Fix erreichte den Bestand nie, und
// last_seen_at blieb auf dem Anlagetag stehen.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveFestivalEvents, derivedEventLocation, derivedLocationChanged, type DerivedLocation } from '@/lib/lineup/derive-events';
import { lineupStepFailure, type OrchestratorStats } from '@/lib/lineup/orchestrator';
import { inputFromStoredRow, type StoredEventLocationRow } from '@/lib/location/re-resolve';
import { resolveEventLocation } from '@/lib/location/resolver';
import { generateEventSlug } from '@/lib/utils/slugify';
import { dedupDay } from '@/lib/pipeline/dedup-engine';
import type { EventRow } from '@/lib/pipeline/types';

/** Erlaubte Werte laut events_bundesland_check (aus der Migration gelesen). */
const ALLOWED_BUNDESLAND: string[] = (() => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260505100000_district_constraint_and_enum_checks.sql'),
    'utf8',
  );
  const m = sql.match(/events_bundesland_check\s+CHECK \(bundesland IS NULL OR bundesland IN\s*\(([^)]*)\)/);
  if (!m) throw new Error('events_bundesland_check nicht gefunden');
  return m[1].split(',').map(v => v.trim().replace(/'/g, ''));
})();

const region = (loc: DerivedLocation) => ({ bundesland: loc.bundesland, district: loc.district });

describe('derivedEventLocation: Bundesland und Bezirk', () => {
  it('kennt die neun Werte der Datenbank-Prüfung', () => {
    expect(ALLOWED_BUNDESLAND).toHaveLength(9);
  });

  it('nimmt ohne Eltern-Event die Gemeinde des Festival-Orts, nicht festivals.state', () => {
    // Nova Rock steht in festivals als Niederösterreich; Nickelsdorf liegt im Burgenland.
    expect(region(derivedEventLocation({ city: 'Nickelsdorf', state: 'Niederösterreich' }, null)))
      .toEqual({ bundesland: 'burgenland', district: 'neusiedl am see' });
    // Mondsee steht als Salzburg da, liegt aber in Oberösterreich.
    expect(region(derivedEventLocation({ city: 'Mondsee', state: 'Salzburg' }, null)))
      .toEqual({ bundesland: 'oberoesterreich', district: 'vöcklabruck' });
  });

  it('fällt ohne eindeutige Gemeinde auf festivals.state zurück, als ID', () => {
    // Die Gemeinde heißt amtlich „Klagenfurt am Wörthersee".
    expect(region(derivedEventLocation({ city: 'Klagenfurt', state: 'Kärnten' }, null)))
      .toEqual({ bundesland: 'kaernten', district: null });
    expect(region(derivedEventLocation({ city: 'verschiedene Orte', state: 'Niederoesterreich' }, null)))
      .toEqual({ bundesland: 'niederoesterreich', district: null });
    expect(region(derivedEventLocation({ city: null, state: 'Oberösterreich' }, null)))
      .toEqual({ bundesland: 'oberoesterreich', district: null });
  });

  it('gibt Wien keinen Gemeindebezirk ohne Adresse', () => {
    expect(region(derivedEventLocation({ city: 'Wien', state: 'Wien' }, null)))
      .toEqual({ bundesland: 'wien', district: null });
  });

  it('liefert für jeden Prod-Wert von festivals.state nur erlaubte Werte oder null', () => {
    // SELECT state, count(*) FROM festivals GROUP BY 1 (Prod 2026-10-14)
    const states = ['Niederösterreich', 'Steiermark', 'Oberösterreich', 'Wien', 'Salzburg', 'Burgenland',
      'Kärnten', 'Tirol', 'Vorarlberg', 'NÖ', 'Niederoesterreich', null];
    for (const state of states) {
      const { bundesland } = derivedEventLocation({ city: 'verschiedene Orte', state }, null);
      if (bundesland !== null) expect(ALLOWED_BUNDESLAND).toContain(bundesland);
      if (state && state !== 'NÖ') expect(bundesland).not.toBeNull();
    }
  });

  it('übernimmt mit Eltern-Event dessen Ortsentscheidung', () => {
    expect(region(derivedEventLocation(
      { city: 'Graz', state: 'Niederösterreich' },
      { bundesland: 'steiermark', district: 'graz (stadt)' },
    ))).toEqual({ bundesland: 'steiermark', district: 'graz (stadt)' });
  });

  it('leitet beim Eltern-Event ohne Bundesland aus dessen Gemeinde ab', () => {
    const parent = {
      bundesland: null,
      district: null,
      postal_code: null,
      location_resolution: { gemeinde: { name: 'Innsbruck', plz: '6020', bundesland: 'tirol', bezirk: 'Innsbruck-Stadt' } },
    };
    expect(derivedEventLocation({ city: 'Innsbruck', state: 'Wien' }, parent as never).bundesland).toBe('tirol');
  });
});

describe('derivedEventLocation: Position aus demselben Resolver wie der Sync', () => {
  it('setzt ohne Eltern-Event den Gemeinde-Mittelpunkt, ausdrücklich als Gebietsangabe ohne Pin', () => {
    const loc = derivedEventLocation({ city: 'Nickelsdorf', state: 'Niederösterreich' }, null, 'Volbeat at Nova Rock');
    expect(loc.latitude).toBeCloseTo(47.94, 1);
    expect(loc.longitude).toBeCloseTo(17.07, 1);
    expect(loc).toMatchObject({
      location_name: 'Nickelsdorf',
      postal_code: '2425',
      country: 'AT',
      location_status: 'municipality_only',
      location_precision: 'municipality',
      geocoding_confidence: 'gemeinde-centroid',
      geocoding_source: 'gemeinde-registry',
      city_raw: 'Nickelsdorf',
      country_raw: 'AT',
      venue_id: null,
    });
    const resolution = loc.location_resolution as { allowed: Record<string, boolean>; reasons: string[] };
    expect(resolution.allowed).toEqual({ pin: false, route: false, distance: false, municipality_page: true });
    expect(resolution.reasons).toContain('gemeinde_centroid_from_named_gemeinde');
    expect(loc.location_provenance).toMatchObject({ latitude: 'derived:plz', gemeinde: 'registry' });
  });

  it('nimmt den amtlichen Gemeindenamen als Anzeigeort', () => {
    expect(derivedEventLocation({ city: 'St.Pölten', state: 'Niederösterreich' }, null).location_name).toBe('St. Pölten');
  });

  it('setzt ohne eindeutige Gemeinde keine Position', () => {
    for (const city of ['Klagenfurt', 'verschiedene Orte', 'St. Lorenzen', null]) {
      const loc = derivedEventLocation({ city, state: 'Kärnten' }, null);
      expect(loc.latitude, String(city)).toBeNull();
      expect(loc.longitude, String(city)).toBeNull();
      expect(loc.location_status, String(city)).toBe('unresolved');
      expect(loc.geocoding_confidence, String(city)).toBeNull();
    }
    // Der Rohwert bleibt Anzeigeort.
    expect(derivedEventLocation({ city: 'verschiedene Orte', state: null }, null).location_name).toBe('verschiedene Orte');
  });

  it('ist aus der gespeicherten Zeile wiederholbar (inputFromStoredRow)', () => {
    const title = 'Volbeat at Nova Rock';
    const loc = derivedEventLocation({ city: 'Nickelsdorf', state: 'Niederösterreich' }, null, title);
    const row = {
      id: 'ev-1', source_name: 'festival-lineup', title,
      location_name: loc.location_name, location_name_raw: null, address: null, address_raw: null,
      postal_code: loc.postal_code, postal_code_raw: null, city_raw: loc.city_raw,
      country: loc.country, country_raw: loc.country_raw, bundesland: loc.bundesland,
      latitude: loc.latitude, longitude: loc.longitude, latitude_raw: null, longitude_raw: null,
      coords_precision_raw: null, source_venue_id: null, geocoding_confidence: loc.geocoding_confidence,
      location_status: loc.location_status, location_resolution: loc.location_resolution, updated_at: null,
    } as unknown as StoredEventLocationRow;
    const again = resolveEventLocation(inputFromStoredRow(row));
    expect(again.input_hash).toBe((loc.location_resolution as { input_hash: string }).input_hash);
    expect([again.status, again.latitude, again.longitude]).toEqual([loc.location_status, loc.latitude, loc.longitude]);
  });
});

// ── deriveFestivalEvents gegen einen Supabase-Ersatz ─────────────────────

const NOVA_ROCK = {
  id: 'f-1',
  canonical_name: 'Nova Rock',
  slug: 'nova-rock',
  website_url: 'https://www.novarock.at',
  lineup_url: null,
  city: 'Nickelsdorf',
  state: 'Niederösterreich',
  starts_at: '2026-06-11',
  ends_at: '2026-06-14',
  parent_event_id: null,
};

function artistRow(id: string, name: string, festival: Record<string, unknown> = NOVA_ROCK, derivedEventId: string | null = null) {
  return { id, festival_id: festival.id, artist_name_raw: name, day_label: null, stage_name: null, derived_event_id: derivedEventId, festivals: festival };
}

/** Gespeicherte Zeile, wie der Derive-Lauf sie liest (Spaltenauswahl STORED_COLUMNS). */
function storedRow(id: string, title: string, loc: DerivedLocation, extra: Record<string, unknown> = {}) {
  return {
    id, source_id: `lineup-${id}`, title, slug: 'bestehender-slug',
    location_name: loc.location_name, address: loc.address, postal_code: loc.postal_code,
    bundesland: loc.bundesland, district: loc.district, latitude: loc.latitude, longitude: loc.longitude,
    country: loc.country, city_raw: loc.city_raw, geocoding_confidence: loc.geocoding_confidence,
    geocoding_source: loc.geocoding_source, location_status: loc.location_status,
    location_precision: loc.location_precision, venue_id: loc.venue_id,
    stored_input_hash: (loc.location_resolution as { input_hash?: string } | null)?.input_hash ?? null,
    ...extra,
  };
}

/** Stand der 839 Prod-Zeilen vom 2026-10-14: Bundesland gesetzt, sonst kein Ort. */
function storedWithoutPosition(id: string, title: string) {
  return {
    id, source_id: `lineup-${id}`, title, slug: null,
    location_name: 'Nickelsdorf', address: null, postal_code: null, bundesland: 'burgenland', district: 'neusiedl am see',
    latitude: null, longitude: null, country: 'AT', city_raw: null, geocoding_confidence: null, geocoding_source: null,
    location_status: null, location_precision: null, venue_id: null, stored_input_hash: null,
  };
}

interface Call {
  table: string;
  op: 'select' | 'update' | 'upsert';
  values?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
}

/** Kettenfähiger Ersatz: liest seitenweise (range), protokolliert Schreibzugriffe. */
function fakeSupabase(opts: { artists: unknown[]; events?: unknown[]; upsertError?: string }) {
  const calls: Call[] = [];
  let upserted = 0;
  function builder(table: string) {
    const call: Call = { table, op: 'select', filters: [] };
    let range: [number, number] | null = null;
    const exec = () => {
      if (call.op === 'select') {
        const all = table === 'festival_artists' ? opts.artists : (opts.events ?? []);
        const [from, to] = range ?? [0, all.length - 1];
        return { data: all.slice(from, to + 1), error: null };
      }
      calls.push(call);
      if (call.op === 'upsert') {
        upserted++;
        return opts.upsertError
          ? { data: null, error: { message: opts.upsertError } }
          : { data: { id: `ev-new-${upserted}` }, error: null };
      }
      const idFilter = call.filters.find(f => f[1] === 'id');
      const ids = idFilter ? (Array.isArray(idFilter[2]) ? idFilter[2] : [idFilter[2]]) : [];
      return { data: ids.map(id => ({ id })), error: null };
    };
    const b = {
      select: () => b,
      eq: (col: string, val: unknown) => { call.filters.push(['eq', col, val]); return b; },
      in: (col: string, val: unknown) => { call.filters.push(['in', col, val]); return b; },
      order: () => b,
      range: (from: number, to: number) => { range = [from, to]; return b; },
      update: (values: Record<string, unknown>) => { call.op = 'update'; call.values = values; return b; },
      upsert: (values: Record<string, unknown>) => { call.op = 'upsert'; call.values = values; return b; },
      single: () => Promise.resolve(exec()),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(exec()).then(res, rej),
    };
    return b;
  }
  const writes = (table: string, op: Call['op']) => calls.filter(c => c.table === table && c.op === op);
  return { client: { from: builder } as unknown as SupabaseClient, calls, writes };
}

describe('deriveFestivalEvents: neue Lineup-Zeilen', () => {
  it('legt das Event mit Bundesland-ID, Gemeinde-Mittelpunkt, Slug und Sichtung an', async () => {
    const { client, writes } = fakeSupabase({ artists: [artistRow('fa-1', 'Volbeat')] });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.events_created).toBe(1);
    expect(result.events_backlinked).toBe(1);
    expect(writes('festival_artists', 'update')).toHaveLength(1);
    const row = writes('events', 'upsert')[0].values!;
    expect(row).toMatchObject({
      title: 'Volbeat at Nova Rock',
      source_type: 'derived',
      source_name: 'festival-lineup',
      bundesland: 'burgenland',
      district: 'neusiedl am see',
      start_date: '2026-06-11',
      location_name: 'Nickelsdorf',
      location_status: 'municipality_only',
      location_precision: 'municipality',
      geocoding_confidence: 'gemeinde-centroid',
      city_raw: 'Nickelsdorf',
      slug: generateEventSlug('Volbeat at Nova Rock', 'Nickelsdorf'),
    });
    expect(row.latitude).not.toBeNull();
    expect(row.longitude).not.toBeNull();
    expect(row.last_seen_at).toEqual(expect.any(String));
    expect(row.location_status_changed_at).toEqual(expect.any(String));
  });

  it('meldet abgewiesene Upserts als Fehler und verlinkt nichts', async () => {
    const msg = 'new row for relation "events" violates check constraint "events_bundesland_check"';
    const { client, writes } = fakeSupabase({ artists: [artistRow('fa-1', 'Volbeat'), artistRow('fa-2', 'Kraftklub')], upsertError: msg });
    const result = await deriveFestivalEvents(client);
    expect(result.events_created).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('events_bundesland_check');
    expect(writes('festival_artists', 'update')).toHaveLength(0);
  });

  it('zählt Festivals ohne Datum als übersprungen, nicht als Fehler', async () => {
    const tba = { ...NOVA_ROCK, id: 'f-2', slug: 'tba-fest', starts_at: null };
    const { client, writes } = fakeSupabase({ artists: [artistRow('fa-3', 'Bilderbuch', tba)] });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(writes('events', 'upsert')).toHaveLength(0);
  });

  it('verlinkt eine schon vorhandene Zeile (früher gescheiterter Rückverweis), statt sie zu überschreiben', async () => {
    // Erst den source_id-Wert ermitteln, den der Lauf für die Zeile bildet.
    const probe = fakeSupabase({ artists: [artistRow('fa-1', 'Volbeat')] });
    await deriveFestivalEvents(probe.client);
    const sourceId = probe.writes('events', 'upsert')[0].values!.source_id as string;

    const loc = derivedEventLocation(NOVA_ROCK, null, 'Volbeat at Nova Rock');
    const existing = { ...storedRow('ev-9', 'Volbeat at Nova Rock', loc), source_id: sourceId };
    const { client, writes } = fakeSupabase({ artists: [artistRow('fa-1', 'Volbeat')], events: [existing] });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(writes('events', 'upsert')).toHaveLength(0);
    expect(writes('festival_artists', 'update')[0].values).toMatchObject({ derived_event_id: 'ev-9' });
    expect(result.events_confirmed).toBe(1);
  });
});

describe('deriveFestivalEvents: bestehende Lineup-Zeilen', () => {
  it('zieht die 839 Zeilen ohne Ort nach: Position, Status, Slug, Sichtung; sonst nichts', async () => {
    const { client, writes } = fakeSupabase({
      artists: [artistRow('fa-1', 'Volbeat', NOVA_ROCK, 'ev-1')],
      events: [storedWithoutPosition('ev-1', 'Volbeat at Nova Rock')],
    });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.events_updated).toBe(1);
    expect(result.events_created).toBe(0);
    expect(writes('events', 'upsert')).toHaveLength(0);
    expect(writes('festival_artists', 'update')).toHaveLength(0);
    const [update] = writes('events', 'update');
    expect(update.filters).toContainEqual(['eq', 'id', 'ev-1']);
    expect(update.values).toMatchObject({
      location_status: 'municipality_only',
      location_precision: 'municipality',
      geocoding_confidence: 'gemeinde-centroid',
      postal_code: '2425',
      city_raw: 'Nickelsdorf',
      slug: generateEventSlug('Volbeat at Nova Rock', 'Nickelsdorf'),
    });
    expect(update.values!.latitude).not.toBeNull();
    expect(update.values!.location_status_changed_at).toEqual(expect.any(String));
    expect(update.values!.last_seen_at).toEqual(expect.any(String));
    // Kategorie, Tags, Veröffentlichung und Dedup-Verweise gehören anderen Schritten.
    for (const key of ['category', 'tags', 'publish_status', 'duplicate_of', 'title', 'start_date', 'source_id']) {
      expect(update.values, key).not.toHaveProperty(key);
    }
  });

  it('behält einen vorhandenen Slug, auch wenn sich der Ort ändert', async () => {
    const stale = { ...storedWithoutPosition('ev-1', 'Volbeat at Nova Rock'), slug: 'volbeat-at-nova-rock-2026' };
    const { client, writes } = fakeSupabase({ artists: [artistRow('fa-1', 'Volbeat', NOVA_ROCK, 'ev-1')], events: [stale] });
    await deriveFestivalEvents(client);
    const [update] = writes('events', 'update');
    expect(update.values).not.toHaveProperty('slug');
    expect(update.values!.location_status).toBe('municipality_only');
  });

  it('bestätigt unveränderte Zeilen nur über last_seen_at, ohne die Ortsangaben neu zu schreiben', async () => {
    const loc = derivedEventLocation(NOVA_ROCK, null, 'Volbeat at Nova Rock');
    const { client, writes } = fakeSupabase({
      artists: [artistRow('fa-1', 'Volbeat', NOVA_ROCK, 'ev-1')],
      events: [storedRow('ev-1', 'Volbeat at Nova Rock', loc)],
    });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.events_updated).toBe(0);
    expect(result.events_confirmed).toBe(1);
    const updates = writes('events', 'update');
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0].values!)).toEqual(['last_seen_at']);
    expect(updates[0].filters).toContainEqual(['in', 'id', ['ev-1']]);
  });

  it('liest über 1.000 Lineup-Zeilen seitenweise und bestätigt in Blöcken von höchstens 200', async () => {
    const artists = [];
    const events = [];
    for (let i = 0; i < 1119; i++) {
      const title = `Act ${i} at Nova Rock`;
      artists.push(artistRow(`fa-${i}`, `Act ${i}`, NOVA_ROCK, `ev-${i}`));
      events.push(storedRow(`ev-${i}`, title, derivedEventLocation(NOVA_ROCK, null, title)));
    }
    const { client, writes } = fakeSupabase({ artists, events });
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.events_confirmed).toBe(1119);
    const confirms = writes('events', 'update');
    for (const c of confirms) expect((c.filters.find(f => f[0] === 'in')![2] as string[]).length).toBeLessThanOrEqual(200);
  });
});

describe('derivedLocationChanged', () => {
  const loc = derivedEventLocation(NOVA_ROCK, null, 'Volbeat at Nova Rock');
  it('erkennt keinen Unterschied bei gleicher Entscheidung (Zeitstempel zählt nicht)', () => {
    expect(derivedLocationChanged(storedRow('ev-1', 'Volbeat at Nova Rock', loc), loc)).toBe(false);
    const later = derivedEventLocation(NOVA_ROCK, null, 'Volbeat at Nova Rock');
    expect(derivedLocationChanged(storedRow('ev-1', 'Volbeat at Nova Rock', loc), later)).toBe(false);
  });
  it('erkennt eine geänderte Position, einen anderen Status und eine andere Eingabe', () => {
    const base = storedRow('ev-1', 'Volbeat at Nova Rock', loc);
    expect(derivedLocationChanged({ ...base, latitude: 48.2 }, loc)).toBe(true);
    expect(derivedLocationChanged({ ...base, location_status: 'unresolved' }, loc)).toBe(true);
    expect(derivedLocationChanged({ ...base, stored_input_hash: 'anders' }, loc)).toBe(true);
  });
});

// ── Dedup: Acts eines Festivaltags auf demselben Gemeinde-Mittelpunkt ────

describe('Dedup mit Gemeinde-Mittelpunkt', () => {
  // Der alte Dedup (bis 2026-09-25) hatte 254 Lineup-Events eines
  // Festivaltags untereinander verschmolzen. Mit Koordinate teilen alle Acts
  // eines Festivals denselben Punkt; das darf sie nicht verbinden.
  const FOLK_ART = { ...NOVA_ROCK, id: 'f-3', canonical_name: 'folk.art Festival', slug: 'folk-art-festival', city: 'Graz', state: 'Steiermark' };
  function lineupRow(id: string, artist: string): EventRow {
    const title = `${artist} at folk.art Festival`;
    const loc = derivedEventLocation(FOLK_ART, null, title);
    return {
      id, title, start_date: '2026-10-21T00:00:00+00:00', source_name: 'festival-lineup', source_id: `lineup-folk-art-festival-${id}`,
      source_type: 'derived', location_name: loc.location_name, postal_code: loc.postal_code, bundesland: loc.bundesland,
      district: loc.district, latitude: loc.latitude, longitude: loc.longitude, location_precision: loc.location_precision,
      location_status: loc.location_status, publish_status: 'published', category: 'Musik',
    } as EventRow;
  }

  it('hält verschiedene Acts desselben Festivaltags getrennt', () => {
    const rows = [
      lineupRow('a0000001-0000-0000-0000-000000000000', 'Attwenger'),
      lineupRow('a0000002-0000-0000-0000-000000000000', 'Ernst Molden'),
      lineupRow('a0000003-0000-0000-0000-000000000000', 'Hotel Palindrone'),
    ];
    expect(rows[0].latitude).not.toBeNull();
    expect(rows[0].latitude).toBe(rows[1].latitude);
    expect(dedupDay(rows).clusters).toEqual([]);
  });
});

// ── Pipeline-Schritt ─────────────────────────────────────────────────────

function stats(derive_errors: string[]): OrchestratorStats {
  return {
    festivals_checked: 9, festivals_skipped_no_scraper: 0, festivals_skipped_unchanged: 6, festivals_changed: 0,
    festivals_errored: 3, artists_added: 0, artists_removed: 0, events_derived: 0, events_backlinked: 0,
    events_updated: 0, events_confirmed: 0, derive_errors, derive_skipped: 0, duration_ms: 0,
  };
}

describe('lineupStepFailure', () => {
  it('macht den Schritt bei Schreibfehlern rot, mit Anzahl und Beispiel', () => {
    const reason = lineupStepFailure(stats(['Upsert error for "Volbeat at Nova Rock": check', 'x']));
    expect(reason).toContain('2 abgeleitete Lineup-Events nicht geschrieben');
    expect(reason).toContain('Volbeat at Nova Rock');
  });

  it('bleibt grün ohne Schreibfehler, auch wenn einzelne Lineup-Seiten nicht erreichbar sind', () => {
    expect(lineupStepFailure(stats([]))).toBeNull();
  });
});

describe('Verdrahtung', () => {
  const pipeline = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
  const cli = readFileSync(join(process.cwd(), 'src/scripts/scrape-festival-lineups.ts'), 'utf8');
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/scrape-events.yml'), 'utf8');

  it('läuft als Pipeline-Schritt vor Bewertung, Rückzug und Dedup', () => {
    const idx = pipeline.indexOf("runStep('festival_lineups'");
    expect(idx).toBeGreaterThan(-1);
    expect(pipeline).toMatch(/execStep\([^)]*scrape-festival-lineups\.ts/);
    expect(idx).toBeLessThan(pipeline.indexOf("runStep('scoring'"));
    // Die Sichtung (last_seen_at) muss vor dem Rückzug stehen, sonst gilt die Quelle als tot.
    expect(idx).toBeLessThan(pipeline.indexOf("runStep('withdrawal'"));
    expect(idx).toBeLessThan(pipeline.indexOf("runStep('dedup'"));
  });

  it('meldet den Grund über reportStepReason und endet mit Exit 1', () => {
    expect(cli).toMatch(/reportStepReason\(failure\)/);
    expect(cli).toMatch(/process\.exit\(1\)/);
  });

  it('hat keinen eigenen Workflow-Schritt mit continue-on-error mehr', () => {
    expect(workflow).not.toMatch(/scrape-festival-lineups/);
  });
});
