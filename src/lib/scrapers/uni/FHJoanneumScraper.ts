import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Joanneum Scraper
 * DEFERRED: Requires Puppeteer. WordPress-based site where the events page
 * at /en/university/events/ contains no event data in server-rendered HTML.
 * No visible API endpoints or embedded JSON data. Events likely loaded via
 * WordPress template rendering after JS execution.
 * Campuses in Graz, Kapfenberg, Bad Gleichenberg.
 */
export class FHJoanneumScraper extends UniBaseScraper {
  readonly name = 'fh-joanneum';
  protected readonly shortName = 'FH-Joanneum';
  protected readonly baseUrl = 'https://www.fh-joanneum.at';
  protected readonly eventListUrl = 'https://www.fh-joanneum.at/en/university/events/';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0649;
  protected readonly defaultLng = 15.4472;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('FH Joanneum: DEFERRED - requires Puppeteer (WordPress JS-rendered events)');
    return [];
  }
}
