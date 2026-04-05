import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Kufstein Tirol Scraper
 * DEFERRED: Requires Puppeteer. The events page has a `.js-events` container that is empty
 * in the server-rendered HTML. Events are loaded dynamically via JS with a "mehr Events laden"
 * button triggering `js-load-more-events-trigger`.
 */
export class FHKufsteinScraper extends UniBaseScraper {
  readonly name = 'fh-kufstein';
  protected readonly shortName = 'FH-Kufstein';
  protected readonly baseUrl = 'https://www.fh-kufstein.ac.at';
  protected readonly eventListUrl = 'https://www.fh-kufstein.ac.at/service/events';
  protected readonly city = 'Kufstein';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.5833;
  protected readonly defaultLng = 12.1667;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('FH Kufstein: DEFERRED - requires Puppeteer (JS-loaded event cards)');
    return [];
  }
}
