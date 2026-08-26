import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SITEMAP_URLSET_HARD_LIMIT } from '@/lib/seo/sitemap-xml';
import { SITEMAP_EVENTS_SHARD_COUNT, sitemapEventsShardPath } from '@/lib/seo/sitemap-events-shard';

// Mock environment variables before module loads
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

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

const { GET: getIndex } = await import('@/app/sitemap.xml/route');
const { GET: getActivities } = await import('@/app/sitemap-activities.xml/route');
const { GET: getEvents } = await import('@/app/sitemap-events.xml/route');

describe('GET /sitemap.xml (Sitemap-INDEX, Epic E12)', () => {
  it('ist ein gueltiger <sitemapindex> auf die drei Kind-Sitemaps', async () => {
    const response = await getIndex();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(body).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-core.xml</loc>');
    // Alle Event-Shards (2026-08-26): Shard 0 unter dem alten Pfad, Rest -2..-N
    for (let shard = 0; shard < SITEMAP_EVENTS_SHARD_COUNT; shard++) {
      expect(body).toContain(`<loc>https://lasstreffen.at${sitemapEventsShardPath(shard)}</loc>`);
    }
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-events.xml</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-events-2.xml</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-activities.xml</loc>');
    // Ein Index enthaelt KEINE <url>-Eintraege
    expect(body).not.toContain('<urlset');
    expect(body).not.toContain('<url>');
  });
});

describe('GET /sitemap-activities.xml (Epic E7/E12/E13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const indexableRow = {
    slug: 'mountaincart-fulseck-abc123def456',
    description: 'x'.repeat(250),
    images: null,
    opening_times: null,
    updated_at: '2026-07-20T10:00:00Z',
  };
  const thinRow = {
    slug: 'thin-poi-000000000000',
    description: 'zu kurz',
    images: null,
    opening_times: null,
    updated_at: null,
  };
  const imageOpeningRow = {
    slug: 'freibad-neusiedl-111111111111',
    description: null,
    images: [{ urls: ['https://cdn.deskline.net/x.jpg'], copyright: '© TVB', license: null, author: null }],
    opening_times: [{ from: '2026-05-01', to: '2026-09-30', timeFrom: '09:00', timeTo: '19:00', weekdays: null }],
    updated_at: '2026-07-01T00:00:00Z',
  };

  it('enthaelt NUR indexierbare URLs (Noindex-Gate E7) und filtert visible/is_closed', async () => {
    const query = createChainableQuery({ data: [indexableRow, thinRow, imageOpeningRow], error: null });
    mockFrom.mockReturnValue(query);

    const response = await getActivities();
    const body = await response.text();

    expect(mockFrom).toHaveBeenCalledWith('poi_activities');
    // Anzeige-Bedingung explizit auf der Basistabelle (Service-Role!)
    expect(query.eq).toHaveBeenCalledWith('visible', true);
    expect(query.eq).toHaveBeenCalledWith('is_closed', false);

    expect(body).toContain('<loc>https://lasstreffen.at/aktivitaet/mountaincart-fulseck-abc123def456</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/aktivitaet/freibad-neusiedl-111111111111</loc>');
    // Thin-POI faellt raus
    expect(body).not.toContain('thin-poi-000000000000');
    expect(response.headers.get('X-Sitemap-Entries')).toBe('2');
  });

  it('ist DE-only (E13): keine /en-URLs, keine xhtml:link-Alternates', async () => {
    const query = createChainableQuery({ data: [indexableRow], error: null });
    mockFrom.mockReturnValue(query);

    const body = await (await getActivities()).text();

    expect(body).not.toContain('xhtml:link');
    expect(body).not.toContain('lasstreffen.at/en/aktivitaet');
    expect(body).toContain('<lastmod>2026-07-20</lastmod>');
  });

  it('failt bei DB-Fehler mit 500 statt eine truncierte Sitemap zu liefern', async () => {
    const query = createChainableQuery({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(query);

    const response = await getActivities();

    // 5xx -> Google behaelt die letzte bekannte Version; eine kurze
    // 200-Datei wuerde tausende URLs als "entfernt" signalisieren.
    expect(response.status).toBe(500);
  });
});

describe('GET /sitemap-events.xml — URL-Cap zaehlt emittierte URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeTranslatedEvents(count: number, pageTag: string) {
    return Array.from({ length: count }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      slug: `event-${pageTag}-${i}`,
      start_date: '2026-09-15',
      updated_at: '2026-07-01T00:00:00Z',
      quality_score: 80,
      postal_code: '7100',
      address: null,
      bundesland: 'Burgenland',
      location_name: 'Neusiedl am See',
      title_en: `Event ${i} (EN)`,
    }));
  }

  it('ein Shard ueber Googles 50k-Grenze failt LAUT mit 500 statt zu truncieren (R2+R3)', async () => {
    // Mock liefert unbegrenzt volle 1000er-Seiten komplett uebersetzter
    // Events (2 URLs/Row) — ein realer Shard dieser Groesse hiesse
    // SITEMAP_EVENTS_SHARD_COUNT ist zu klein. Seit dem Shard-Split gibt
    // es keinen stillen Cap mehr: die Route muss laut scheitern.
    const query = createChainableQuery({ data: makeTranslatedEvents(1000, 'p'), error: null });
    mockFrom.mockReturnValue(query);

    const response = await getEvents();

    expect(response.status).toBe(500);
    expect(SITEMAP_URLSET_HARD_LIMIT).toBeLessThan(50000);
  });

  it('emittiert DE- und /en-URL als Paar mit xhtml:link-Alternates (fn-17-Paritaet)', async () => {
    const query = createChainableQuery({ data: makeTranslatedEvents(2, 'x'), error: null });
    mockFrom.mockReturnValue(query);

    const body = await (await getEvents()).text();

    // Prefix kommt aus der PLZ-Registry (7100 -> eisenstadt), nicht aus
    // location_name — hier zaehlt nur: DE- und /en-URL erscheinen als Paar.
    expect(body).toContain('<loc>https://lasstreffen.at/events/7100-eisenstadt/2026-09-15/event-x-0</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/en/events/7100-eisenstadt/2026-09-15/event-x-0</loc>');
    expect(body).toContain('xhtml:link rel="alternate" hreflang="de-AT"');
    expect(body).toContain('xhtml:link rel="alternate" hreflang="en"');
    expect(body).toContain('xhtml:link rel="alternate" hreflang="x-default"');
  });

  it('failt bei DB-Fehler mit 500 statt eine truncierte Sitemap zu liefern', async () => {
    const query = createChainableQuery({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(query);

    const response = await getEvents();
    expect(response.status).toBe(500);
  });
});

describe('GET /sitemap-core.xml — Paritaet + fail loudly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enthaelt alle verschobenen Sektionen inkl. Blog + i18n-Alternates + Venues', async () => {
    const { GET: getCore } = await import('@/app/sitemap-core.xml/route');
    const query = createChainableQuery({
      data: [{ venue_id: 'venue-123' }, { venue_id: 'venue-123' }, { venue_id: null }],
      error: null,
    });
    mockFrom.mockReturnValue(query);

    const response = await getCore();
    const body = await response.text();

    expect(response.status).toBe(200);
    // Statisch + fn-17-Alternates
    expect(body).toContain('<loc>https://lasstreffen.at</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/en</loc>');
    expect(body).toContain('xhtml:link rel="alternate" hreflang="de-AT"');
    // Blog-Sektion (Index + Posts) lebt jetzt in core
    expect(body).toContain('<loc>https://lasstreffen.at/blog</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/blog/');
    // Hubs
    expect(body).toContain('<loc>https://lasstreffen.at/burgenland</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/thema/');
    expect(body).toContain('<loc>https://lasstreffen.at/gemeinde/');
    expect(body).toContain('<loc>https://lasstreffen.at/studenten</loc>');
    // Venues (dedupliziert aus der Mock-Query)
    expect(body).toContain('<loc>https://lasstreffen.at/venues/venue-123</loc>');
    // Kind-Datei bleibt unter dem Google-Limit
    expect(Number(response.headers.get('X-Sitemap-Entries'))).toBeLessThanOrEqual(SITEMAP_URLSET_HARD_LIMIT);
  });

  it('failt bei Venue-Query-Fehler mit 500 statt Sitemap ohne Venues', async () => {
    const { GET: getCore } = await import('@/app/sitemap-core.xml/route');
    const query = createChainableQuery({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(query);

    const response = await getCore();
    expect(response.status).toBe(500);
  });
});
