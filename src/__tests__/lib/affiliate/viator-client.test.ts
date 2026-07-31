/**
 * Viator-Client (fn-18 Task 5):
 *  - Deeplink-Builder inkl. pid (konfigurierbar, nie geraten)
 *  - Graceful degradation ohne VIATOR_API_KEY (leere Ergebnisse, KEIN Throw)
 *  - defensives Parsen der Produkt-Responses
 *  - Mapping auf den affiliate_product-Contract aus Task 1
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildViatorDeeplink,
  createViatorClient,
  deeplinkFromEnv,
  isViatorConfigured,
  parseViatorProduct,
  toAffiliateProduct,
  VIATOR_DEEPLINK_TEMPLATE_DEFAULT,
  MASTER_DATA_TTL_HOURS,
  PRICE_TTL_HOURS,
} from '@/lib/affiliate/viator-client';
import { parseAffiliateProduct } from '@/lib/affiliate/viator-types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('buildViatorDeeplink', () => {
  it('nutzt das Default-Template und haengt die pid an', () => {
    const url = buildViatorDeeplink({ productCode: '5010SYDNEY', partnerId: 'P123' });
    expect(url).toContain('https://www.viator.com/tours/5010SYDNEY');
    expect(new URL(url).searchParams.get('pid')).toBe('P123');
  });

  it('bevorzugt ein von der API geliefertes productUrl', () => {
    const url = buildViatorDeeplink({
      productCode: 'ABC',
      productUrl: 'https://www.viator.com/de-AT/tours/Wien/Fiaker/d454-ABC',
      partnerId: 'P1',
    });
    expect(url).toContain('/de-AT/tours/Wien/Fiaker/d454-ABC');
    expect(new URL(url).searchParams.get('pid')).toBe('P1');
  });

  it('ohne partnerId entsteht ein gueltiger Link OHNE pid (nie ein kaputter)', () => {
    const url = buildViatorDeeplink({ productCode: 'ABC' });
    expect(url).toBe(VIATOR_DEEPLINK_TEMPLATE_DEFAULT.replace('{productCode}', 'ABC'));
    expect(url).not.toContain('pid=');
  });

  it('erlaubt eigenen pid-Parameternamen und Zusatzparameter (Format ist nicht verifiziert)', () => {
    const url = buildViatorDeeplink({
      productCode: 'ABC',
      partnerId: 'P9',
      pidParam: 'partner',
      extraParams: '?mcid=42383&medium=api',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('partner')).toBe('P9');
    expect(parsed.searchParams.get('mcid')).toBe('42383');
    expect(parsed.searchParams.get('medium')).toBe('api');
  });

  it('faellt bei kaputtem Template auf das Default zurueck statt zu werfen', () => {
    const url = buildViatorDeeplink({ productCode: 'ABC', template: 'nicht-mal-eine-url' });
    expect(url).toContain('https://www.viator.com/tours/ABC');
  });

  it('deeplinkFromEnv liest die Konfiguration aus der Env', () => {
    vi.stubEnv('VIATOR_PARTNER_ID', 'ENVPID');
    vi.stubEnv('VIATOR_DEEPLINK_TEMPLATE', 'https://example.test/x/{productCode}');
    const url = deeplinkFromEnv({ productCode: 'C1', productUrl: null });
    expect(url).toBe('https://example.test/x/C1?pid=ENVPID');
  });
});

describe('createViatorClient ohne API-Key', () => {
  it('isViatorConfigured meldet false', () => {
    expect(isViatorConfigured({})).toBe(false);
    expect(isViatorConfigured({ VIATOR_API_KEY: '  ' })).toBe(false);
    expect(isViatorConfigured({ VIATOR_API_KEY: 'k' })).toBe(true);
  });

  it('liefert leere Ergebnisse und wirft NICHT — und macht keinen Request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = createViatorClient({ apiKey: '' });

    expect(client.enabled).toBe(false);
    await expect(client.searchProducts({ searchTerm: 'Rafting Imst' })).resolves.toEqual([]);
    await expect(client.getProduct('ABC')).resolves.toBeNull();
    await expect(client.getPriceFrom('ABC')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('createViatorClient mit API-Key', () => {
  it('schickt den exp-api-key-Header und parst Suchtreffer', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            products: {
              results: [
                {
                  productCode: 'P1',
                  title: 'Rafting Imst',
                  description: 'Wildwasser',
                  images: [{ variants: [{ url: 'https://img/small.jpg', width: 100 }, { url: 'https://img/big.jpg', width: 800 }] }],
                  pricing: { summary: { fromPrice: 59 }, currency: 'EUR' },
                  reviews: { combinedAverageRating: 4.7, totalReviews: 210 },
                  destination: { name: 'Imst' },
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createViatorClient({ apiKey: 'secret', fetchImpl: fetchSpy as unknown as typeof fetch });
    const products = await client.searchProducts({ searchTerm: 'Rafting Imst' });

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productCode: 'P1',
      title: 'Rafting Imst',
      priceFrom: 59,
      currency: 'EUR',
      rating: 4.7,
      reviewCount: 210,
      locationText: 'Imst',
    });
    // Groesste Bildvariante gewinnt.
    expect(products[0]!.imageUrl).toBe('https://img/big.jpg');

    const headers = (fetchSpy.mock.calls[0]![1] ?? {}).headers as Record<string, string>;
    expect(headers['exp-api-key']).toBe('secret');
  });

  it('liefert null statt zu werfen, wenn die API 500 antwortet', async () => {
    const fetchSpy = vi.fn(async () => new Response('boom', { status: 500 }));
    const client = createViatorClient({
      apiKey: 'secret',
      fetchImpl: fetchSpy as unknown as typeof fetch,
      sleep: async () => {},
    });
    await expect(client.getProduct('P1')).resolves.toBeNull();
  });

  it('behandelt 404 als "kein Produkt" (Refresh entfernt das Angebot)', async () => {
    const fetchSpy = vi.fn(async () => new Response('', { status: 404 }));
    const client = createViatorClient({
      apiKey: 'secret',
      fetchImpl: fetchSpy as unknown as typeof fetch,
      sleep: async () => {},
    });
    await expect(client.getProduct('P1')).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // kein Retry bei 404
  });
});

describe('parseViatorProduct / toAffiliateProduct', () => {
  it('ignoriert Rohdaten ohne productCode', () => {
    expect(parseViatorProduct(null)).toBeNull();
    expect(parseViatorProduct({ title: 'ohne code' })).toBeNull();
  });

  it('mappt auf den affiliate_product-Contract und bleibt parsebar', () => {
    const product = parseViatorProduct({
      productCode: 'P1',
      title: 'Fiakerfahrt Wien',
      description: 'Rundfahrt',
      pricing: { summary: { fromPrice: 80 }, currency: 'EUR' },
    })!;

    const affiliate = toAffiliateProduct(product, {
      url: 'https://www.viator.com/tours/P1?pid=X',
      matchedAt: '2026-07-31T10:00:00.000Z',
      refreshedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(affiliate).toMatchObject({
      product_code: 'P1',
      title: 'Fiakerfahrt Wien',
      price_from: 80,
      currency: 'EUR',
      matched_at: '2026-07-31T10:00:00.000Z',
      refreshed_at: '2026-08-01T10:00:00.000Z',
    });
    // Round-trip durch die defensive Verengung der Anzeige-Seite.
    expect(parseAffiliateProduct(affiliate)).not.toBeNull();
  });
});

describe('Caching-Politik', () => {
  it('dokumentiert TTLs als Konstanten (Stammdaten + Preise taeglich)', () => {
    expect(MASTER_DATA_TTL_HOURS).toBe(24);
    expect(PRICE_TTL_HOURS).toBe(24);
  });
});
