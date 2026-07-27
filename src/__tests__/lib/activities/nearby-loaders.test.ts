/**
 * fn-18 Task 4 — Nearby-Loader (Cross-Link-Flaechen).
 *
 * Kern-Invarianten:
 *   - poi_activities wird auf der BASISTABELLE gelesen -> BEIDE Filter
 *     (visible = true AND is_closed = false) muessen manuell gesetzt sein
 *     (plan-sync-Notiz fn-18.1/18.2: der View-Auto-Filter entfaellt).
 *   - bbox-Vorfilter + exakter haversine-Nachfilter (Radius), Distanz-Sort.
 *   - Events-Loader: NUR future (start_date >= heute) + published.
 *   - Fehler degradieren zu [] (Sektion faellt weg statt 500).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// unstable_cache pass-through: hier interessieren die Query-Filter, nicht
// das Cache-Verhalten (das prueft der Page-Test mit Memo-Mock).
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

interface Call {
  method: string;
  args: unknown[];
}

function createChainableQuery(resolvedValue: { data: unknown; error: unknown }, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'or', 'not', 'is', 'contains',
    'order', 'limit', 'range', 'filter', 'match',
  ];
  for (const method of chainMethods) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  return builder;
}

const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

const { loadNearbyActivitiesCached, loadNearbyFutureEventsCached } = await import(
  '@/lib/activities/nearby-loaders'
);

// Testzentrum (Burgenland) + Radius 10 km. bbox ~ ±0.09° lat / ±0.134° lng.
const LAT = 47.8;
const LNG = 16.5;
const RADIUS = 10;

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'freibad-testdorf-abcdef123456',
    name: 'Freibad Testdorf',
    tags: ['schwimmen'],
    town: 'Testdorf',
    lat: LAT + 0.01,
    lng: LNG + 0.01,
    price_hint: null,
    images: null,
    ...overrides,
  };
}

describe('loadNearbyActivitiesCached', () => {
  const calls: Call[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
  });

  it('setzt visible=true UND is_closed=false manuell (Basistabelle!)', async () => {
    mockFrom.mockReturnValue(createChainableQuery({ data: [], error: null }, calls));

    await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    expect(mockFrom).toHaveBeenCalledWith('poi_activities');
    const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqCalls).toContainEqual(['visible', true]);
    expect(eqCalls).toContainEqual(['is_closed', false]);
    // Duplikate (E11) defensiv ausgeschlossen (Review-Finding Runde 2).
    const isCalls = calls.filter((c) => c.method === 'is').map((c) => c.args);
    expect(isCalls).toContainEqual(['duplicate_of', null]);
  });

  it('bbox-Vorfilter auf lat/lng um das Zentrum', async () => {
    mockFrom.mockReturnValue(createChainableQuery({ data: [], error: null }, calls));

    await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    const gte = Object.fromEntries(calls.filter((c) => c.method === 'gte').map((c) => c.args as [string, number]));
    const lte = Object.fromEntries(calls.filter((c) => c.method === 'lte').map((c) => c.args as [string, number]));
    expect(gte.lat).toBeLessThan(LAT);
    expect(lte.lat).toBeGreaterThan(LAT);
    expect(gte.lng).toBeLessThan(LNG);
    expect(lte.lng).toBeGreaterThan(LNG);
  });

  it('haversine-Nachfilter wirft bbox-Ecken > Radius raus und sortiert nach Distanz', async () => {
    const near = activityRow({ id: 'near', lat: LAT + 0.02, lng: LNG + 0.02 }); // ~2.7 km
    const nearer = activityRow({ id: 'nearer', lat: LAT + 0.005, lng: LNG + 0.005 }); // ~0.7 km
    // bbox-Ecke: innerhalb des Rechtecks, aber ~13-14 km Luftlinie.
    const corner = activityRow({ id: 'corner', lat: LAT + 0.088, lng: LNG + 0.132 });
    mockFrom.mockReturnValue(createChainableQuery({ data: [near, nearer, corner], error: null }, calls));

    const result = await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    expect(result.map((a) => a.id)).toEqual(['nearer', 'near']);
    expect(result[0]._distance_km).toBeLessThan(result[1]._distance_km);
    expect(result.every((a) => a._distance_km <= RADIUS)).toBe(true);
  });

  it('Fehler degradiert zu []', async () => {
    mockFrom.mockReturnValue(createChainableQuery({ data: null, error: { message: 'boom' } }, calls));
    expect(await loadNearbyActivitiesCached(LAT, LNG, RADIUS)).toEqual([]);
  });

  it('Cap greift NACH Distanz-Sort: die 60 naechsten gewinnen, nicht die alphabetisch ersten', async () => {
    // 65 Rows im Radius, Distanz waechst mit dem Index — Namen absteigend,
    // damit ein alphabetischer Cap die FALSCHEN (fernsten) behalten wuerde.
    const rows = Array.from({ length: 65 }, (_, i) =>
      activityRow({
        id: `a-${i}`,
        name: `POI ${String(64 - i).padStart(2, '0')}`,
        lat: LAT + (i + 1) * 0.001,
        lng: LNG,
      }),
    );
    mockFrom.mockReturnValue(createChainableQuery({ data: rows, error: null }, calls));

    const result = await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    expect(result).toHaveLength(60);
    expect(result[0].id).toBe('a-0'); // naechster
    expect(result[59].id).toBe('a-59'); // 60.-naechster
    expect(result.some((a) => a.id === 'a-64')).toBe(false); // fernste raus
    const limitCall = calls.find((c) => c.method === 'limit');
    expect(limitCall!.args[0]).toBe(200); // groesserer Kandidaten-Pool
  });

  it('Pool-Ueberlauf (>200 in bbox): Shrink-Refetch findet die NAECHSTEN statt der alphabetisch ersten', async () => {
    // Fetch 1 (voller Radius): Pool exakt voll (200) — nur ferne Rows mit
    // alphabetisch fruehen Namen. Ein naiver Cap wuerde DIESE behalten.
    const farPool = Array.from({ length: 200 }, (_, i) =>
      activityRow({
        id: `far-${i}`,
        name: `AAA ${String(i).padStart(3, '0')}`,
        lat: LAT + 0.07, // ~7.8 km
        lng: LNG,
      }),
    );
    // Fetch 2 (halbierter Radius): kompletter Innenkreis (<200) mit 65
    // nahen Rows -> >= 60 im Innenkreis => nearest-60 beweisbar korrekt.
    const nearInner = Array.from({ length: 65 }, (_, i) =>
      activityRow({
        id: `near-${i}`,
        name: `ZZZ ${String(i).padStart(3, '0')}`,
        lat: LAT + (i + 1) * 0.0004, // 0.044 km-Schritte, max ~2.9 km
        lng: LNG,
      }),
    );
    mockFrom
      .mockReturnValueOnce(createChainableQuery({ data: farPool, error: null }, calls))
      .mockReturnValueOnce(createChainableQuery({ data: nearInner, error: null }, calls));

    const result = await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(60);
    expect(result[0].id).toBe('near-0');
    expect(result.every((a) => a.id.startsWith('near-'))).toBe(true);
    expect(result.every((a) => a._distance_km <= RADIUS)).toBe(true);
  });

  it('Innenkreis komplett aber duenn: Innen-Set bleibt erhalten + Ring-Backfill aus dem Pool (Runde 6)', async () => {
    const farPool = Array.from({ length: 200 }, (_, i) =>
      activityRow({ id: `far-${i}`, name: `AAA ${String(i).padStart(3, '0')}`, lat: LAT + 0.07, lng: LNG }),
    );
    // Innenkreis (r/2) komplett, aber nur 5 nahe Rows (< CAP 60).
    const nearInner = Array.from({ length: 5 }, (_, i) =>
      activityRow({ id: `near-${i}`, name: `ZZZ ${i}`, lat: LAT + (i + 1) * 0.0004, lng: LNG }),
    );
    mockFrom
      .mockReturnValueOnce(createChainableQuery({ data: farPool, error: null }, calls))
      .mockReturnValueOnce(createChainableQuery({ data: nearInner, error: null }, calls));

    const result = await loadNearbyActivitiesCached(LAT, LNG, RADIUS);

    // Die 5 garantierten nahen zuerst, dann Best-Effort-Ring — nie [].
    expect(result).toHaveLength(60);
    expect(result.slice(0, 5).map((a) => a.id)).toEqual(['near-0', 'near-1', 'near-2', 'near-3', 'near-4']);
    expect(result.slice(5).every((a) => a.id.startsWith('far-'))).toBe(true);
  });
});

describe('loadNearbyFutureEventsCached', () => {
  const calls: Call[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
  });

  function eventRow(overrides: Record<string, unknown> = {}) {
    return {
      id: '00000000-0000-4000-8000-00000000000e',
      title: 'Testkonzert',
      slug: 'testkonzert',
      start_date: '2027-01-01T19:00:00+00:00',
      location_name: 'Halle',
      address: null,
      postal_code: '7100',
      bundesland: 'burgenland',
      latitude: LAT + 0.01,
      longitude: LNG + 0.01,
      category: 'Musik',
      image_url: null,
      ...overrides,
    };
  }

  it('NUR future: gte(start_date, <voller Zeitstempel JETZT>) + published', async () => {
    mockFrom.mockReturnValue(createChainableQuery({ data: [], error: null }, calls));

    const before = Date.now();
    await loadNearbyFutureEventsCached(LAT, LNG, RADIUS);
    const after = Date.now();

    expect(mockFrom).toHaveBeenCalledWith('events');
    const startDateGte = calls.find((c) => c.method === 'gte' && c.args[0] === 'start_date');
    expect(startDateGte).toBeDefined();
    // Voller ISO-Zeitstempel (Review Runde 5): Datums-only wuerde heute
    // bereits gestartete Events bis Mitternacht als "kommend" durchlassen.
    expect(startDateGte!.args[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const cutoff = Date.parse(startDateGte!.args[1] as string);
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(after);

    const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqCalls).toContainEqual(['publish_status', 'published']);
    // Public-Surface-Guard (Review Runde 4): Service-Role-Pfad darf keine
    // nicht-oeffentlichen Events in den Cross-Link spuelen.
    expect(eqCalls).toContainEqual(['visibility', 'public']);

    // Kandidaten-Pool > Anzeige-Limit (Radius-Filter laeuft nach dem Fetch).
    const limitCall = calls.find((c) => c.method === 'limit');
    expect(limitCall!.args[0]).toBe(60);
  });

  it('filtert Rows ohne Koordinaten und ausserhalb des Radius', async () => {
    const ok = eventRow({ id: 'ok' });
    const noCoords = eventRow({ id: 'nocoords', latitude: null, longitude: null });
    const tooFar = eventRow({ id: 'far', latitude: LAT + 0.088, longitude: LNG + 0.132 });
    mockFrom.mockReturnValue(createChainableQuery({ data: [ok, noCoords, tooFar], error: null }, calls));

    const result = await loadNearbyFutureEventsCached(LAT, LNG, RADIUS);
    expect(result.map((e) => e.id)).toEqual(['ok']);
    expect(result[0]._distance_km).toBeGreaterThan(0);
  });

  it('behaelt die DB-Reihenfolge (event_score-Ranking) bei', async () => {
    const first = eventRow({ id: 'first' });
    const second = eventRow({ id: 'second', latitude: LAT + 0.001, longitude: LNG + 0.001 });
    mockFrom.mockReturnValue(createChainableQuery({ data: [first, second], error: null }, calls));

    const result = await loadNearbyFutureEventsCached(LAT, LNG, RADIUS);
    // "second" ist naeher — bleibt trotzdem hinter "first" (Score-Ranking,
    // kein Distanz-Sort beim Events-Loader).
    expect(result.map((e) => e.id)).toEqual(['first', 'second']);

    const orderCalls = calls.filter((c) => c.method === 'order').map((c) => c.args[0]);
    expect(orderCalls).toEqual(['event_score', 'start_date']);
  });

  it('Fehler degradiert zu []', async () => {
    mockFrom.mockReturnValue(createChainableQuery({ data: null, error: { message: 'boom' } }, calls));
    expect(await loadNearbyFutureEventsCached(LAT, LNG, RADIUS)).toEqual([]);
  });

  it('Backfill (Runde 6): voller Pool aus Ecken-Events -> Refetch mit einbeschriebener bbox', async () => {
    // Fetch 1: Pool voll (60), alles High-Score-Events in der bbox-Ecke
    // (~13.9 km) — nach dem Kreis-Filter bliebe die Sektion leer.
    const cornerPool = Array.from({ length: 60 }, (_, i) =>
      eventRow({ id: `corner-${i}`, latitude: LAT + 0.088, longitude: LNG + 0.132, event_score: 90 }),
    );
    const innerRows = [
      eventRow({ id: 'in-1', event_score: 40 }),
      eventRow({ id: 'in-2', event_score: 80 }),
    ];
    mockFrom
      .mockReturnValueOnce(createChainableQuery({ data: cornerPool, error: null }, calls))
      .mockReturnValueOnce(createChainableQuery({ data: innerRows, error: null }, calls));

    const result = await loadNearbyFutureEventsCached(LAT, LNG, RADIUS);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    // Score-Ranking bleibt auch im Merge erhalten.
    expect(result.map((e) => e.id)).toEqual(['in-2', 'in-1']);
  });

  it('kein Backfill-Refetch, wenn der Pool nicht voll war', async () => {
    const rows = [eventRow({ id: 'only' })];
    mockFrom.mockReturnValueOnce(createChainableQuery({ data: rows, error: null }, calls));

    const result = await loadNearbyFutureEventsCached(LAT, LNG, RADIUS);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(result.map((e) => e.id)).toEqual(['only']);
  });
});
