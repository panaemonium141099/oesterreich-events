import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('GET /sitemap.xml (Sitemap-INDEX, Epic E12)', () => {
  it('ist ein gueltiger <sitemapindex> auf die drei Kind-Sitemaps', async () => {
    const response = await getIndex();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(body).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-core.xml</loc>');
    expect(body).toContain('<loc>https://lasstreffen.at/sitemap-events.xml</loc>');
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

  it('liefert ein leeres <urlset> bei DB-Fehler statt zu werfen', async () => {
    const query = createChainableQuery({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(query);

    const response = await getActivities();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('<urlset');
    expect(response.headers.get('X-Sitemap-Entries')).toBe('0');
  });
});
