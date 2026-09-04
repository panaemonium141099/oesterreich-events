/**
 * Regression test: Gemeinde-Listing-Parser duerfen keinen Kontakt-Anchor
 * (mailto:/tel:) als Event-Titel abgreifen.
 *
 * Bug history (Prod-Befund 2026-09-04): 613 Events trugen eine reine
 * E-Mail-Adresse als `title` (z. B. "contact@tennis-henndorf.com"),
 * 605 davon published, 39 in der Zukunft und damit auf der Website
 * sichtbar. 604 der 613 hatten `source_url = "mailto:…"` — der Beleg,
 * dass der Titel aus einem Kontakt-Anchor stammte.
 *
 * Ursache: `$el.find('h2, h3, h4, a, strong, b').first()` liefert den
 * ersten Treffer in DOKUMENTreihenfolge, nicht in Selektorreihenfolge.
 * Steht in der Event-Kachel ein Vereins-Kontaktblock vor der Ueberschrift,
 * gewinnt der mailto:-Anchor.
 */
import { describe, it, expect } from 'vitest';
import { GenericGemeindeScraper } from '../../lib/scrapers/GenericGemeindeScraper';
import { GemeindeRegistryScraper } from '../../lib/scrapers/GemeindeRegistryScraper';
import { isContactHandleTitle } from '../../lib/scrapers/detail-extract/validate';

// Nachgebaute Gemeinde-Kachel: Kontaktzeile steht VOR der Ueberschrift.
const TILE_HTML = `<!doctype html><html><body><ul>
  <li>
    <div class="kontakt">
      Anmeldung:
      <a href="mailto:contact@tennis-henndorf.com">contact@tennis-henndorf.com</a>
      <a href="tel:+436645620676">+43 664 5620676</a>
    </div>
    <h3><a href="/veranstaltungen/tennis-clubmeisterschaft">Tennis-Clubmeisterschaft</a></h3>
    <span class="datum">15.11.2026</span>
  </li>
</ul></body></html>`;

// Gleiche Kachel ohne Ueberschrift: der Titel MUSS dann vom Inhalts-Anchor
// kommen, nicht von der Mailadresse davor.
const TILE_NO_HEADING_HTML = `<!doctype html><html><body><ul>
  <li>
    <a href="mailto:seniorenbund.henndorf@outlook.com">seniorenbund.henndorf@outlook.com</a>
    <a href="/veranstaltungen/seniorenausflug">Seniorenausflug nach Mariazell</a>
    <span class="datum">20.11.2026</span>
  </li>
</ul></body></html>`;

const PAGE = {
  gemeinde: {
    name: 'Henndorf', website: 'https://henndorf.at', plz: '5302',
    bezirk: 'Salzburg-Umgebung', bundesland: 'Salzburg',
    lat: 47.9, lng: 13.2,
  },
  eventPageUrl: 'https://henndorf.at/veranstaltungen',
  path: '/veranstaltungen', dateCount: 1, eventKeywords: 1, htmlSize: 1000,
};

const REGISTRY_ENTRY = {
  name: 'Henndorf', bundesland: 'Salzburg', plz: '5302',
  bezirk: 'Salzburg-Umgebung', lat: 47.9, lng: 13.2,
  eventUrl: 'https://henndorf.at/veranstaltungen',
  strategy: 'generic-dates', status: 'active',
};

describe('GenericGemeindeScraper generic parser', () => {
  const scraper = new GenericGemeindeScraper();

  it('prefers the heading over a preceding mailto anchor', () => {
    const events = (scraper as any).parseGenericEvents(
      require('cheerio').load(TILE_HTML), PAGE,
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Tennis-Clubmeisterschaft');
    expect(isContactHandleTitle(events[0].title)).toBe(false);
  });

  it('never uses a mailto:/tel: href as source_url', () => {
    const events = (scraper as any).parseGenericEvents(
      require('cheerio').load(TILE_HTML), PAGE,
    );
    expect(events[0].source_url).not.toMatch(/^(mailto|tel):/);
    expect(events[0].source_url).toContain('/veranstaltungen/tennis-clubmeisterschaft');
  });

  it('falls through to the content anchor when there is no heading', () => {
    const events = (scraper as any).parseGenericEvents(
      require('cheerio').load(TILE_NO_HEADING_HTML), PAGE,
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toBe('Seniorenausflug nach Mariazell');
    expect(events[0].source_url).not.toMatch(/^mailto:/);
  });
});

describe('GemeindeRegistryScraper generic-dates parser', () => {
  const scraper = new GemeindeRegistryScraper();

  it('prefers the heading over a preceding mailto anchor', () => {
    const events = (scraper as any).parseGenericDates(TILE_HTML, REGISTRY_ENTRY);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(isContactHandleTitle(e.title)).toBe(false);
      expect(e.source_url).not.toMatch(/^(mailto|tel):/);
    }
    expect(events.some((e: any) => e.title === 'Tennis-Clubmeisterschaft')).toBe(true);
  });

  it('falls through to the content anchor when there is no heading', () => {
    const events = (scraper as any).parseGenericDates(TILE_NO_HEADING_HTML, REGISTRY_ENTRY);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(isContactHandleTitle(e.title)).toBe(false);
    }
  });
});
