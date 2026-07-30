/**
 * fn-18.6 — /api/search/semantic: Aktivitaets-Pfad + Event-Pfad-Regression.
 *
 * Schwerpunkt der Suite ist das PFAD-GATING (Epic E9): bei
 * contentTypes=['activity'] darf der Event-Retrieval-Pfad inklusive
 * Top-Score-Fallback nachweislich NICHT laufen — und umgekehrt darf der
 * neue Pfad den Event-Query-Aufbau nicht veraendern (Future-only-
 * Invariante auf start_date, Memory semantic_search_future_only).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// ── Supabase-Mock ───────────────────────────────────────────────────
function createChainableQuery(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'or', 'order', 'limit', 'ilike']) {
    builder[m] = vi.fn().mockImplementation(() => builder);
  }
  builder.then = vi.fn().mockImplementation(
    (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(onFulfilled, onRejected),
  );
  return builder;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

// ── Gemini-Mock ─────────────────────────────────────────────────────
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => ({
  // Muss ein echter Konstruktor sein — die Route ruft `new GoogleGenAI(...)`.
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
}));

const { POST } = await import('@/app/api/search/semantic/route');

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/search/semantic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function activityRow(over: Record<string, unknown> = {}) {
  return {
    id: 'poi-1',
    slug: 'mountaincart-fulseck-abc123def456',
    name: 'Mountaincart Fulseck',
    description: 'Rasante Abfahrt vom Fulseck ins Tal.',
    description_short: 'Rasante Abfahrt',
    tags: [],
    setting: 'outdoor',
    lat: 47.2,
    lng: 13.1,
    town: 'Dorfgastein',
    gemeinde_slug: '5632-dorfgastein',
    bundesland: 'salzburg',
    images: null,
    price_hint: null,
    online_bookable: false,
    name_similarity: 0.8,
    tag_hits: 0,
    distance_km: 1.2,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEMINI_API_KEY', '');
  mockRpc.mockResolvedValue({ data: [], error: null });
  mockFrom.mockReturnValue(createChainableQuery({ data: [], error: null }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Aktivitaets-Pfad (contentTypes=["activity"])', () => {
  it('"wo kann ich mountaincart fahren" liefert activityMatches mit dem Fulseck-POI', async () => {
    mockRpc.mockResolvedValue({ data: [activityRow()], error: null });

    const res = await POST(makeRequest({ query: 'wo kann ich mountaincart fahren' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activityMatches).toHaveLength(1);
    expect(body.activityMatches[0].name).toBe('Mountaincart Fulseck');
    expect(body.activityMatches[0].slug).toBe('mountaincart-fulseck-abc123def456');
    expect(body.parsed.content_types).toEqual(['activity']);

    // trgm-Term kommt deterministisch aus der Query (kein LLM im Spiel).
    expect(mockRpc).toHaveBeenCalledWith('search_activities', expect.objectContaining({
      q: 'mountaincart',
    }));
  });

  it('SPY: Event-Retrieval inkl. Top-Score-Fallback laeuft NICHT, matches=[]', async () => {
    mockRpc.mockResolvedValue({ data: [activityRow()], error: null });

    const res = await POST(makeRequest({ query: 'wo kann ich mountaincart fahren' }));
    const body = await res.json();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(body.matches).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.activityMatches.length).toBeGreaterThan(0);
  });

  it('Regen-Query: setting=indoor + Stadt-Radius gehen als RPC-Filter rein, q bleibt NULL', async () => {
    await POST(makeRequest({ query: 'was tun bei Regen in Graz' }));

    expect(mockFrom).not.toHaveBeenCalled();
    const args = mockRpc.mock.calls[0][1];
    // setting/Radius sind SQL-Filter der RPC und greifen damit VOR
    // Ranking und Result-Cap (sonst verdraengen Outdoor-Treffer die
    // Indoor-Matches aus der Shortlist).
    expect(args.setting_filter).toBe('indoor');
    expect(args.q).toBeNull();
    expect(args.center_lat).toBeCloseTo(47.07, 1);
    expect(args.center_lng).toBeCloseTo(15.44, 1);
    expect(args.radius_km).toBe(15);
    // Gemeinde-Radius ersetzt den groberen Bundesland-Filter.
    expect(args.bundesland_filter).toBeNull();
  });

  it('Gemeinde-Ausdruck wird aus dem trgm-Term gestrippt', async () => {
    await POST(makeRequest({ query: 'mountaincart dorfgastein' }));

    const args = mockRpc.mock.calls[0][1];
    expect(args.q).toBe('mountaincart');
    expect(args.center_lat).toBeCloseTo(47.24, 1);
  });

  it('RPC-Fehler killt die Response nicht', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const res = await POST(makeRequest({ query: 'wo kann ich mountaincart fahren' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activityMatches).toEqual([]);
  });
});

describe('No-AI-Pfade (Pflicht: deterministischer Klassifikator)', () => {
  it('ohne GEMINI_API_KEY wird die Aktivitaets-Query trotzdem erkannt', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    mockRpc.mockResolvedValue({ data: [activityRow()], error: null });

    const body = await (await POST(makeRequest({ query: 'wo kann ich mountaincart fahren' }))).json();

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(body.parsed.content_types).toEqual(['activity']);
    expect(body.activityMatches).toHaveLength(1);
  });

  it('bei Gemini-Timeout (4s) greift derselbe Klassifikator', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    mockGenerateContent.mockImplementation(() => new Promise(() => {})); // haengt
    mockRpc.mockResolvedValue({ data: [activityRow()], error: null });

    vi.useFakeTimers();
    const pending = POST(makeRequest({ query: 'wo kann ich mountaincart fahren' }));
    await vi.advanceTimersByTimeAsync(4100);
    const body = await (await pending).json();

    expect(body.parsed.content_types).toEqual(['activity']);
    expect(body.activityMatches).toHaveLength(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('LLM-contentTypes=["activity"] wird ebenfalls respektiert', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        categories: [], tags: [], audiences: [], occasions: [], vibes: [],
        searchTerms: ['Therme'], location: null, contentTypes: ['activity'],
      }),
    });
    mockRpc.mockResolvedValue({ data: [activityRow({ name: 'Therme Loipersdorf' })], error: null });

    const body = await (await POST(makeRequest({ query: 'therme fuer entspannten tag' }))).json();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(body.parsed.content_types).toEqual(['activity']);
    expect(body.activityMatches[0].name).toBe('Therme Loipersdorf');
  });
});

describe('Event-Pfad-Regression (unveraendert)', () => {
  it('"konzerte wien heute" laeuft nur ueber events, ohne RPC', async () => {
    const query = createChainableQuery({
      data: [{ id: 'e1', category: 'Musik', tags: null, audience: null, vibe: null, occasion_tags: null, event_score: 50 }],
      error: null,
    });
    mockFrom.mockReturnValue(query);

    const res = await POST(makeRequest({ query: 'konzerte wien heute' }));
    const body = await res.json();

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(body.parsed.content_types).toEqual(['event']);
    expect(body.count).toBeGreaterThan(0);
    expect(body.activityMatches).toEqual([]);
  });

  it('INVARIANTE: start_date-Filter ist nie in der Vergangenheit (future-only)', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    await POST(makeRequest({ query: 'konzerte wien heute' }));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const gteCall = query.gte.mock.calls.find(c => c[0] === 'start_date');
    expect(gteCall).toBeDefined();
    expect(new Date(gteCall![1]).getTime()).toBeGreaterThanOrEqual(startOfToday.getTime());
  });

  it('REGRESSION: Event-Query-Aufbau (Filter + Sortierung) unveraendert', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    await POST(makeRequest({ query: 'konzert in graz' }));

    expect(query.eq).toHaveBeenCalledWith('visibility', 'public');
    expect(query.in).toHaveBeenCalledWith('publish_status', ['published', 'published_low_confidence']);
    expect(query.eq).toHaveBeenCalledWith('bundesland', 'steiermark');
    expect(query.in).toHaveBeenCalledWith('district', ['graz (stadt)', 'graz-umgebung']);
    // SCORE_ORDER: nullsFirst:false ist Absicht (EXPLAIN-Kommentar in der Route).
    expect(query.order).toHaveBeenCalledWith('event_score', { ascending: false, nullsFirst: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('REGRESSION: Event-Query mit Aktivitaets-Vokabular behaelt ihre Suchbegriffe', async () => {
    // "wandern" ist ein Topic-Token → contentTypes wird ['event','activity'].
    // Der deterministische Keyword-Fallback des EVENT-Pfads muss trotzdem
    // laufen (haengt an intentHasNoFacets, nicht an intentIsEmpty).
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    const body = await (await POST(makeRequest({ query: 'wandern in tirol' }))).json();

    expect(body.parsed.content_types).toEqual(['event', 'activity']);
    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('title.ilike.%wandern%'));
    expect(mockRpc).toHaveBeenCalled();
  });

  it('Fallback-Pfad (kein Signal) holt weiterhin die Top-Score-Events', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    await POST(makeRequest({ query: 'heute in wien' }));

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(query.order).toHaveBeenCalledWith('event_score', { ascending: false, nullsFirst: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
