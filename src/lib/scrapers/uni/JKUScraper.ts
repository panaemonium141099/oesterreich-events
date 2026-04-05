import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Johannes Kepler Universität Linz (JKU) Scraper
 * Server-rendered with Schema.org structured data. 8 per page, 7+ pages.
 */
export class JKUScraper extends UniBaseScraper {
  readonly name = 'jku-linz';
  protected readonly shortName = 'JKU';
  protected readonly baseUrl = 'https://www.jku.at';
  protected readonly eventListUrl = 'https://www.jku.at/veranstaltungsmanagement/';
  protected readonly city = 'Linz';
  protected readonly bundesland = 'oberoesterreich';
  protected readonly defaultLat = 48.3372;
  protected readonly defaultLng = 14.3196;
  private readonly MAX_PAGES = 10;
  private readonly eventsUrl = 'https://www.jku.at/news-events/events/';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte JKU Linz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape from the events listing pages
    const urls = [this.eventListUrl, this.eventsUrl];
    for (const baseUrl of urls) {
      for (let page = 1; page <= this.MAX_PAGES; page++) {
        const url = page === 1
          ? baseUrl
          : `${baseUrl}?page=${page}`;
        try {
          const html = await this.fetchPage(url);

          const prevSize = allEvents.size;

          const jsonLdEvents = this.parseJsonLdEvents(html, url);
          for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

          const htmlEvents = this.parseHtml(html);
          for (const ev of htmlEvents) {
            if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
          }

          if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
          // Break if no new events found (same content on every page)
          if (page > 1 && allEvents.size === prevSize) break;
          this.log(`${baseUrl} Seite ${page}: ${allEvents.size} Events`);
          await this.rateLimit();
        } catch (err) {
          this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
          break;
        }
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // JKU events: links to /news-events/events/detail/news/... or /zirkus-des-wissens/...
    $('a[href*="/events/detail/"], a[href*="/projekte/"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3, h4').first().text().trim() || $el.text().trim();
        if (!title || title.length < 3) return;

        const href = $el.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from nearby span or preceding element
        const parentBlock = $el.parent();
        const dateText = parentBlock.find('span, time, .date').first().text().trim()
          || parentBlock.prev().text().trim();
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = parentBlock.find('p').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    // Also try generic selectors for event cards
    $('article, .event-item, [class*="event"], .news-list-item, .list-item, .card').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title, .card-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"], span').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        if (events.some(e => e.source_id === this.makeSourceId(slug))) return;

        const desc = $el.find('.teaser, .description, p, .card-text').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
