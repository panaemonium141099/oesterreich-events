import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * CAMPUS 02 FH der Wirtschaft Scraper
 * DEFERRED: Requires Puppeteer. Elementor-based WordPress page where the events section
 * at /en/news-events/events/ contains only CSS/styling in the server-rendered HTML.
 * No event data, REST API endpoints, or AJAX calls visible in the page source.
 * Events are rendered client-side by Elementor.
 * Graz location.
 */
export class Campus02Scraper extends UniBaseScraper {
  readonly name = 'campus02-graz';
  protected readonly shortName = 'Campus02';
  protected readonly baseUrl = 'https://www.campus02.at';
  protected readonly eventListUrl = 'https://www.campus02.at/en/news-events/events/';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0678;
  protected readonly defaultLng = 15.4417;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('CAMPUS 02: DEFERRED - requires Puppeteer (Elementor JS-rendered events)');
    return [];
  }
}
