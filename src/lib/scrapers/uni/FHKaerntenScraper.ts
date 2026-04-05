import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Kärnten Scraper
 * DEFERRED: Requires Puppeteer. The events page uses FullCalendar JS with monthEvents
 * populated dynamically. The server-rendered HTML has `monthEvents = []` (empty array).
 * URL changed from /aktuelles/veranstaltungen to /events.
 * Multiple campuses (Villach, Spittal, Klagenfurt, Feldkirchen).
 */
export class FHKaerntenScraper extends UniBaseScraper {
  readonly name = 'fh-kaernten';
  protected readonly shortName = 'FH-Kaernten';
  protected readonly baseUrl = 'https://www.fh-kaernten.at';
  protected readonly eventListUrl = 'https://www.fh-kaernten.at/events';
  protected readonly city = 'Villach';
  protected readonly bundesland = 'kaernten';
  protected readonly defaultLat = 46.6130;
  protected readonly defaultLng = 13.8489;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('FH Kärnten: DEFERRED - requires Puppeteer (FullCalendar JS-rendered events)');
    return [];
  }
}
