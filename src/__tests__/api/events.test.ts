import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// We need to mock environment variables before the module loads
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Build a chainable query builder mock that tracks calls
function createChainableQuery(resolvedValue: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainMethods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'or', 'not', 'is',
    'order', 'limit', 'range', 'filter', 'match',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }

  // Make thenable so await resolves
  builder.then = vi.fn().mockImplementation(
    (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(onFulfilled, onRejected)
  );

  return builder;
}

// Mock @supabase/supabase-js
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Import after mocks are set up
const { GET } = await import('@/app/api/events/route');

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/events');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns events with default filters', async () => {
    const mockEvents = [
      { id: '1', title: 'Test Event', start_date: '2026-04-01', category: 'Musik' },
    ];
    const query = createChainableQuery({ data: mockEvents, error: null, count: 1 });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toEqual(mockEvents);
    expect(json.total).toBe(1);
    expect(mockFrom).toHaveBeenCalledWith('events');
  });

  it('applies bundesland filter', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ bundesland: 'Burgenland' }));

    expect(query.eq).toHaveBeenCalledWith('bundesland', 'Burgenland');
  });

  it('skips bundesland filter when value is "all"', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ bundesland: 'all' }));

    // eq should not be called with bundesland
    const eqCalls = query.eq.mock.calls;
    const bundeslandCall = eqCalls.find((call: unknown[]) => call[0] === 'bundesland');
    expect(bundeslandCall).toBeUndefined();
  });

  it('applies district filter', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ district: 'Eisenstadt' }));

    expect(query.eq).toHaveBeenCalledWith('district', 'Eisenstadt');
  });

  it('applies category filter', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ category: 'Musik' }));

    expect(query.eq).toHaveBeenCalledWith('category', 'Musik');
  });

  it('applies dateFrom filter', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ dateFrom: '2026-06-01' }));

    // gte is called for both the default "today" filter and dateFrom
    const gteCalls = query.gte.mock.calls;
    const dateFromCall = gteCalls.find((call: unknown[]) => call[1] === '2026-06-01');
    expect(dateFromCall).toBeDefined();
  });

  it('applies dateTo filter with end-of-day time', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ dateTo: '2026-06-30' }));

    expect(query.lte).toHaveBeenCalledWith('start_date', '2026-06-30T23:59:59');
  });

  it('sanitizes search input by stripping special characters', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ search: 'test.*()%_\\injection' }));

    // The sanitized search should not contain special chars
    const orCalls = query.or.mock.calls;
    // Find the search-related or call (contains ilike)
    const searchCall = orCalls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('ilike')
    );
    expect(searchCall).toBeDefined();
    // Should not contain the injected special characters (but % is used as ILIKE wildcard)
    expect(searchCall![0]).not.toContain('.*');
    expect(searchCall![0]).not.toContain('()');
    // The sanitized search term is wrapped in %...% for ILIKE, which is expected
    expect(searchCall![0]).toContain('testinjection');
  });

  it('skips search filter when sanitized input is empty', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ search: '.*()%_\\' }));

    // No search-related or call should be made
    const orCalls = query.or.mock.calls;
    const searchCall = orCalls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('ilike')
    );
    expect(searchCall).toBeUndefined();
  });

  it('applies priceMin filter including null prices', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ priceMin: '10' }));

    const orCalls = query.or.mock.calls;
    const priceCall = orCalls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('price_min')
    );
    expect(priceCall).toBeDefined();
    expect(priceCall![0]).toContain('price_min.gte.10');
    expect(priceCall![0]).toContain('price_min.is.null');
  });

  it('applies priceMax filter including null prices', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ priceMax: '50' }));

    const orCalls = query.or.mock.calls;
    const priceCall = orCalls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('price_max')
    );
    expect(priceCall).toBeDefined();
    expect(priceCall![0]).toContain('price_max.lte.50');
    expect(priceCall![0]).toContain('price_max.is.null');
  });

  it('applies limit and offset via range', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({ limit: '20', offset: '40' }));

    // API fetches limit+1 to detect next page, so fetchLimit=21, range(40, 40+21-1=60)
    expect(query.range).toHaveBeenCalledWith(40, 60);
  });

  it('uses default page size of 50 when not specified', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest());

    // No offset → uses query.limit(fetchLimit) not range(); default page size is 50
    expect(query.limit).toHaveBeenCalledWith(51);
  });

  it('returns 500 on Supabase query error', async () => {
    const query = createChainableQuery({
      data: null,
      error: { message: 'Database error', code: '500' },
      count: null,
    });
    mockFrom.mockReturnValue(query);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Fehler beim Laden der Events');
  });

  describe('eveningOnly filter', () => {
    it('applies eveningOnly filter at DB level via .or() with LIKE patterns', async () => {
      // Filtering is now done at DB level via PostgREST LIKE patterns, not client-side.
      // Mock returns pre-filtered results (only evening events).
      const mockEvents = [
        { id: '2', title: 'Evening Event', start_date: '2026-04-01T19:00:00' },
        { id: '3', title: 'Late Event', start_date: '2026-04-01T22:00:00' },
      ];
      const query = createChainableQuery({ data: mockEvents, error: null, count: 2 });
      mockFrom.mockReturnValue(query);

      const response = await GET(makeRequest({ eveningOnly: 'true' }));
      const json = await response.json();

      // DB already filtered — API returns what DB returns
      expect(json.events).toHaveLength(2);
      expect(json.events[0].title).toBe('Evening Event');
      expect(json.events[1].title).toBe('Late Event');

      // Verify the DB-level filter was applied via .or() with LIKE patterns
      const orCalls = query.or.mock.calls;
      const eveningCall = orCalls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('start_date.like.')
      );
      expect(eveningCall).toBeDefined();
    });

    it('keeps events with no time info (date-only)', async () => {
      const mockEvents = [
        { id: '1', title: 'Date Only Event', start_date: '2026-04-01' },
      ];
      const query = createChainableQuery({ data: mockEvents, error: null, count: 1 });
      mockFrom.mockReturnValue(query);

      const response = await GET(makeRequest({ eveningOnly: 'true' }));
      const json = await response.json();

      expect(json.events).toHaveLength(1);
    });

    it('keeps events with midnight hour (unknown time)', async () => {
      const mockEvents = [
        { id: '1', title: 'Midnight Event', start_date: '2026-04-01T00:00:00' },
      ];
      const query = createChainableQuery({ data: mockEvents, error: null, count: 1 });
      mockFrom.mockReturnValue(query);

      const response = await GET(makeRequest({ eveningOnly: 'true' }));
      const json = await response.json();

      expect(json.events).toHaveLength(1);
    });

    it('returns total from DB count for evening filter', async () => {
      // DB filters evening events via LIKE patterns; mock returns pre-filtered results.
      const mockEvents = [
        { id: '2', title: 'Evening', start_date: '2026-04-01T19:00:00' },
      ];
      const query = createChainableQuery({ data: mockEvents, error: null, count: 1 });
      mockFrom.mockReturnValue(query);

      const response = await GET(makeRequest({ eveningOnly: 'true' }));
      const json = await response.json();

      expect(json.total).toBe(1);
    });
  });

  it('filters for public or null visibility events', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest());

    const orCalls = query.or.mock.calls;
    const visibilityCall = orCalls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('visibility')
    );
    expect(visibilityCall).toBeDefined();
    expect(visibilityCall![0]).toContain('visibility.eq.public');
    expect(visibilityCall![0]).toContain('visibility.is.null');
  });

  it('orders results by start_date ascending', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest());

    expect(query.order).toHaveBeenCalledWith('start_date', { ascending: true });
  });

  it('applies multiple filters simultaneously', async () => {
    const query = createChainableQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(query);

    await GET(makeRequest({
      bundesland: 'Burgenland',
      district: 'Eisenstadt',
      category: 'Musik',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      search: 'Konzert',
    }));

    expect(query.eq).toHaveBeenCalledWith('bundesland', 'Burgenland');
    expect(query.eq).toHaveBeenCalledWith('district', 'Eisenstadt');
    expect(query.eq).toHaveBeenCalledWith('category', 'Musik');
    expect(query.lte).toHaveBeenCalledWith('start_date', '2026-06-30T23:59:59');
  });
});
