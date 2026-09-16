import { describe, expect, it, vi } from 'vitest';
import { load } from 'cheerio';
import { extractMeinBezirkLocation } from '../../lib/scrapers/meinbezirk-location';
import { MeinBezirkScraper } from '../../lib/scrapers/MeinBezirkScraper';
import type { ScrapedEvent } from '../../types/events';

const json = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const row = (label: string) => `<div class="eventitem-dates-container"><table><tr>
  <td><i class="fa fa-map-marked"></i></td><td><span title="${label}">${label}</span></td>
  </tr></table></div>`;
const event = (city = 'Amstetten', code = '3300') => ({
  '@type': 'Event', location: [{ '@type': 'Place', name: 'Hauptplatz', address: {
    '@type': 'PostalAddress', streetAddress: 'Hauptplatz', postalCode: code, addressLocality: city,
  } }], organizer: { address: { postalCode: '1010', addressLocality: 'Wien' } },
});

describe('MeinBezirk event location', () => {
  it.each([['Amstetten', '3300'], ['Gemeinde Bruck an der Leitha', '2460']])('reads structured address for %s', (city, code) => {
    const locality = city.replace(/^Gemeinde /, '');
    expect(extractMeinBezirkLocation(load(json(event(city, code))))).toEqual({
      locationName: 'Hauptplatz', address: `Hauptplatz, ${code} ${locality}`, postalCode: code, city: locality,
    });
  });

  it('supports graph/object locations and excludes organizer/footer addresses', () => {
    const data = event();
    expect(extractMeinBezirkLocation(load(json({ '@graph': [
      { '@type': 'Organization', address: { postalCode: '1010' } },
      { ...data, location: data.location[0] },
    ] }) + '<footer>1010 Wien</footer>'))).toMatchObject({ postalCode: '3300', city: 'Amstetten' });
  });

  it.each(['Hauptplatz, Hauptplatz, 3300 Amstetten', 'Hauptplatz, Hauptplatz, 2460 Gemeinde Bruck an der Leitha'])('reads full visible labels: %s', label => {
    const result = extractMeinBezirkLocation(load('<script type="application/ld+json">broken</script>' + row(label)));
    expect(result.address).toMatch(/^Hauptplatz, (3300 Amstetten|2460 Gemeinde Bruck an der Leitha)$/);
    expect(result.city).not.toMatch(/^Gemeinde /);
  });

  it('keeps Pfarrhof/Gansbach as venue/locality without inventing a street or PLZ', () => {
    expect(extractMeinBezirkLocation(load(row('Pfarrhof, Gansbach').replace('fa-map-marked', 'fa-map') + '<footer>3390 Melk</footer>'))).toEqual({
      locationName: 'Pfarrhof', city: 'Gansbach',
    });
  });

  it('does not turn a year or unrelated address into an event postcode', () => {
    expect(extractMeinBezirkLocation(load('<body>2026 September <div itemprop="address">1010 Wien</div></body>'))).toEqual({});
  });

  it('prefers event address over sidebar and recommendations', () => {
    const url = 'https://www.meinbezirk.at/event/amstetten/c-fest/test_e123';
    expect(extractMeinBezirkLocation(load(json([
      { ...event('Wien', '1010'), url: 'https://www.meinbezirk.at/event/wien/other_e456' },
      { ...event(), url },
    ]) + row('Pfarrhof, Gansbach')), url)).toMatchObject({ city: 'Amstetten', postalCode: '3300' });
  });

  it('does not promote a Bundesland to a venue', () => {
    expect(extractMeinBezirkLocation(load(row('Tirol'))).locationName).toBeUndefined();
  });
});

describe('MeinBezirk detail enrichment', () => {
  it('uses listing locality rather than editorial district when detail fetch fails', () => {
    const scraper = new MeinBezirkScraper() as unknown as { parsePage(html: string): ScrapedEvent[] };
    const events = scraper.parsePage(`<article><div class="content-card-wrap">
      <ul class="content-card-date-location"><li>18. September 2026 um 19:00</li><li>Pfarrhof</li><li>Gansbach</li></ul>
      <h3><a href="/event/melk/c-kultur/vortrag_e123">Vortrag</a></h3>
      <ul class="content-card-meta"><li>NÖ</li><li>Melk</li></ul>
    </div></article>`);
    expect(events[0]).toMatchObject({ city: 'Gansbach', location_name: 'Pfarrhof', district: 'melk' });
  });

  it('enriches beyond event 500, replaces listing venue, retains failures and limits concurrency', async () => {
    const scraper = new MeinBezirkScraper();
    const internal = scraper as unknown as {
      fetchPage(url: string): Promise<string>;
      sleep(ms: number): Promise<void>;
      enrichWithDetails(events: ScrapedEvent[]): Promise<void>;
    };
    let active = 0;
    let peak = 0;
    vi.spyOn(internal, 'sleep').mockResolvedValue();
    const fetch = vi.spyOn(internal, 'fetchPage').mockImplementation(async url => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (url.endsWith('/0')) throw new Error('Unavailable');
      return json(event());
    });
    const events: ScrapedEvent[] = Array.from({ length: 502 }, (_, i) => ({
      source_id: `${i}`, source_name: 'meinbezirk', source_url: `https://www.meinbezirk.at/${i}`,
      title: 'Test', start_date: '2026-09-18', location_name: 'NÖ',
    }));
    await internal.enrichWithDetails(events);
    expect(fetch).toHaveBeenCalledTimes(502);
    expect(peak).toBeLessThanOrEqual(3);
    expect(events[0].location_name).toBe('NÖ');
    expect(events[501]).toMatchObject({ location_name: 'Hauptplatz', city: 'Amstetten', postal_code: '3300', address: 'Hauptplatz, 3300 Amstetten' });
  });
});
