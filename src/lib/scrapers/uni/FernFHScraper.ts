import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Ferdinand Porsche FernFH Scraper
 * DEFERRED: Requires Puppeteer. WordPress site using Bricks Builder + WP Grid Builder plugin.
 * The events at /veranstaltungen are loaded dynamically via WPGB facets (data-facet, data-grid).
 * The server-rendered HTML contains only CSS class definitions (ffh-slider__news-slide, etc.)
 * but no actual event data. Events use wpgb-card wrappers populated by JS.
 * Distance learning FH based in Wiener Neustadt.
 */
export class FernFHScraper extends UniBaseScraper {
  readonly name = 'fernfh-wien-neustadt';
  protected readonly shortName = 'FernFH';
  protected readonly baseUrl = 'https://www.fernfh.ac.at';
  protected readonly eventListUrl = 'https://www.fernfh.ac.at/veranstaltungen';
  protected readonly city = 'Wiener Neustadt';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 47.8142;
  protected readonly defaultLng = 16.2433;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('FernFH: DEFERRED - requires Puppeteer (WP Grid Builder JS-rendered events)');
    return [];
  }
}
