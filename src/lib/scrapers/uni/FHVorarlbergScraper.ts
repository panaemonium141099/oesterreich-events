import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Vorarlberg Scraper
 * DEFERRED: Requires Puppeteer. The events page at /en/fh/the-fhv/events is a landing page
 * with no event listings in the server-rendered HTML. Event content is loaded dynamically via JS.
 * Contact info pages exist but no actual event cards/dates are rendered server-side.
 */
export class FHVorarlbergScraper extends UniBaseScraper {
  readonly name = 'fh-vorarlberg';
  protected readonly shortName = 'FHV';
  protected readonly baseUrl = 'https://www.fhv.at';
  protected readonly eventListUrl = 'https://www.fhv.at/en/fh/the-fhv/events';
  protected readonly city = 'Dornbirn';
  protected readonly bundesland = 'vorarlberg';
  protected readonly defaultLat = 47.4128;
  protected readonly defaultLng = 9.7400;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('FH Vorarlberg: DEFERRED - requires Puppeteer (JS-rendered events page)');
    return [];
  }
}
