import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { applyJsonLd, applyOgMeta, applyVerticalTable, applyRegexFallbacks } from '../universal';
import type { DetailEnrichment } from '../types';

describe('applyJsonLd', () => {
  it('extracts address + price from Event JSON-LD', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      description: 'A concert',
      location: {
        name: 'Stadthalle',
        address: { streetAddress: 'Roland-Rainer-Platz 1', postalCode: '1150', addressLocality: 'Wien' },
      },
      offers: { '@type': 'Offer', price: 25, priceCurrency: 'EUR', name: 'Stehplatz' },
    })}</script></body></html>`;
    const out: DetailEnrichment = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.address).toBe('Roland-Rainer-Platz 1');
    expect(out.postal_code).toBe('1150');
    expect(out.address_locality).toBe('Wien');
    expect(out.location_name).toBe('Stadthalle');
    expect(out.price_min).toBe(25);
    expect(out.price_text).toContain('€');
  });

  it('handles @graph wrapping', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@graph': [{ '@type': 'Event', location: { name: 'X', address: { streetAddress: 'Hauptstraße 5' }}}],
    })}</script></body></html>`;
    const out: DetailEnrichment = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.address).toBe('Hauptstraße 5');
  });

  it('handles AggregateOffer with lowPrice/highPrice', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      offers: { '@type': 'AggregateOffer', lowPrice: 10, highPrice: 30, priceCurrency: 'EUR' },
    })}</script></body></html>`;
    const out: DetailEnrichment = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.price_min).toBe(10);
    expect(out.price_max).toBe(30);
    expect(out.price_text).toMatch(/10.*[-–].*30/);
  });

  it('returns silently when no Event JSON-LD is present', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'Organization', name: 'X',
    })}</script></body></html>`;
    const out: DetailEnrichment = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out).toEqual({});
  });
});

describe('applyOgMeta', () => {
  it('fills image_url and description from og:* when empty', () => {
    const html = `<html><head>
      <meta property="og:image" content="https://x/img.jpg">
      <meta property="og:description" content="A really nice event in Vienna that took place at our venue last weekend with lots of guests.">
    </head><body></body></html>`;
    const out: DetailEnrichment = {};
    applyOgMeta(cheerio.load(html), out);
    expect(out.image_url).toBe('https://x/img.jpg');
    expect(out.description).toContain('really nice');
  });

  it('does not overwrite a longer description', () => {
    const html = `<html><head>
      <meta property="og:description" content="Short">
    </head><body></body></html>`;
    const out: DetailEnrichment = { description: 'x'.repeat(120) };
    applyOgMeta(cheerio.load(html), out);
    expect(out.description!.length).toBe(120);
  });
});

describe('applyVerticalTable', () => {
  it('parses Ort/Veranstalter/Eintritt rows', () => {
    const html = `<html><body><table class="verticaltable">
      <tr><th>Ort</th><td>Kunsthotel Fuchspalast<br>Hauptstraße 7<br>4281 Mönchdorf</td></tr>
      <tr><th>Veranstalter</th><td>Musikschule Fröhlich</td></tr>
      <tr><th>Eintritt</th><td>€ 15,–</td></tr>
    </table></body></html>`;
    const out: DetailEnrichment = {};
    applyVerticalTable(cheerio.load(html), out);
    expect(out.location_name).toBe('Kunsthotel Fuchspalast');
    expect(out.address).toBe('Hauptstraße 7');
    expect(out.postal_code).toBe('4281');
    expect(out.address_locality).toBe('Mönchdorf');
    expect(out.organizer).toBe('Musikschule Fröhlich');
    expect(out.price_text).toContain('15');
  });
});

describe('applyRegexFallbacks', () => {
  it('finds labeled address in description', () => {
    const html = `<html><body><main>Adresse: Kirchgasse 12, 8010 Graz</main></body></html>`;
    const out: DetailEnrichment = { description: 'Adresse: Kirchgasse 12, 8010 Graz' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.address).toBe('Kirchgasse 12');
    expect(out.postal_code).toBe('8010');
    expect(out.address_locality).toBe('Graz');
  });

  it('finds "Eintritt frei" → price_min=0', () => {
    const html = `<html><body><main>${'x'.repeat(200)}</main></body></html>`;
    const out: DetailEnrichment = { description: 'Eintritt frei. Wir freuen uns auf euch!' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.price_min).toBe(0);
    expect(out.price_text?.toLowerCase()).toContain('frei');
  });

  it('rejects "Tisch 5" as address via validity guard', () => {
    const html = `<html><body><main>${'x'.repeat(200)}</main></body></html>`;
    const out: DetailEnrichment = { description: 'Adresse: Tisch 5' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.address).toBeUndefined();
  });
});
