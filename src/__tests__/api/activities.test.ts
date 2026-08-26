import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { decodeActivityCursor, encodeActivityCursor } from '@/lib/activities/cursor';

// Mock environment variables before module loads
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Build a chainable query builder mock that tracks calls
function createChainableQuery(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainMethods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'or', 'not', 'is', 'contains',
    'order', 'limit', 'range', 'filter', 'match', 'single',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }

  builder.then = vi.fn().mockImplementation(
    (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(onFulfilled, onRejected),
  );

  return builder;
}

const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Import after mocks are set up
const { GET } = await import('@/app/api/activities/route');

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/activities');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function makeRows(count: number): Array<{ id: string; name: string; quality_score: number }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    name: `Aktivität ${String(i).padStart(3, '0')}`,
    quality_score: 90 - i,
  }));
}

describe('GET /api/activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert Aktivitaeten mit Default-Pagination und Anzeige-Filtern', async () => {
    const query = createChainableQuery({ data: makeRows(2), error: null });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('poi_activities');
    expect(body.activities).toHaveLength(2);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();

    // Anzeige-Bedingung: Basistabelle via Service-Role -> BEIDE explizit.
    expect(query.eq).toHaveBeenCalledWith('visible', true);
    expect(query.eq).toHaveBeenCalledWith('is_closed', false);

    // Fixe deterministische Sortierung: quality_score DESC, id ASC
    // (Ranking-Umbau 2026-08-26).
    expect(query.order).toHaveBeenNthCalledWith(1, 'quality_score', { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });

    // limit+1 fuer hasMore — KEIN count (weder exact noch planned).
    expect(query.limit).toHaveBeenCalledWith(51);
    const selectArgs = query.select.mock.calls[0];
    expect(selectArgs[1]).toBeUndefined();
  });

  it('wendet die eingefrorenen Wire-Filter an (gemeinde/bundesland/tag)', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    await GET(
      makeRequest({
        gemeinde: '7100-neusiedl-am-see',
        bundesland: 'Burgenland',
        tag: 'schwimmen',
      }),
    );

    expect(query.eq).toHaveBeenCalledWith('gemeinde_slug', '7100-neusiedl-am-see');
    // bundesland wird auf die kanonische lowercase-ID normalisiert
    expect(query.eq).toHaveBeenCalledWith('bundesland', 'burgenland');
    expect(query.contains).toHaveBeenCalledWith('tags', ['schwimmen']);
  });

  it('paginiert per (quality_score,id)-Cursor: limit+1, Slice, nextCursor aus letzter Row', async () => {
    const rows = makeRows(6); // limit 5 -> 6 Rows = hasMore
    const query = createChainableQuery({ data: rows, error: null });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest({ limit: '5' }));
    const body = await response.json();

    expect(query.limit).toHaveBeenCalledWith(6);
    expect(body.activities).toHaveLength(5);
    expect(body.hasMore).toBe(true);

    // nextCursor = raw-DB-Werte der LETZTEN zurueckgegebenen Row (Index 4)
    expect(decodeActivityCursor(body.nextCursor)).toEqual({
      q: rows[4].quality_score,
      id: rows[4].id,
    });
  });

  it('wendet die Cursor-Lookup-Regel als .or()-Filter an', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    const cursor = encodeActivityCursor({
      q: 42,
      id: '01234567-89ab-cdef-0123-456789abcdef',
    });
    await GET(makeRequest({ cursor }));

    expect(query.or).toHaveBeenCalledWith(
      'quality_score.lt.42,and(quality_score.eq.42,id.gt."01234567-89ab-cdef-0123-456789abcdef")',
    );
  });

  it('lehnt einen invaliden Cursor mit 400 ab (kein DB-Roundtrip)', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest({ cursor: 'kein-valider-cursor!!' }));

    expect(response.status).toBe(400);
    expect(query.then).not.toHaveBeenCalled();
  });

  it('clampt limit auf [1, 200]', async () => {
    const query = createChainableQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ limit: '9999' }));
    expect(query.limit).toHaveBeenCalledWith(201);

    vi.clearAllMocks();
    mockFrom.mockReturnValue(query);
    await GET(makeRequest({ limit: '0' }));
    expect(query.limit).toHaveBeenCalledWith(2);
  });

  it('gibt 500 bei Query-Fehler zurueck', async () => {
    const query = createChainableQuery({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });
});
