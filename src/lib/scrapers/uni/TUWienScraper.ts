import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Technische Universität Wien Scraper
 * Server-rendered HTML, ~10 events per page, 81+ pages.
 * Very rich source with ~800 total events.
 */
export class TUWienScraper extends UniBaseScraper {
  readonly name = 'tu-wien';
  protected readonly shortName = 'TUWien';
  protected readonly baseUrl = 'https://www.tuwien.at';
  protected readonly eventListUrl = 'https://www.tuwien.at/en/tu-wien/news/events';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.1988;
  protected readonly defaultLng = 16.3696;
  private readonly MAX_PAGES = 20; // Cap at 20 pages to be polite

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte TU Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        if (jsonLdEvents.length > 0) {
          for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
        }

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        this.log(`Seite ${page}: ${allEvents.size} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article, .event-item, .news-list-item, [class*="event-list"] > *, .content-element').each((_, el) => {
      try {
        const $el = $(el);
        const $link = $el.find('a[href*="event"], a[href*="veranstaltung"]').first();
        if (!$link.length) {
          // Try any link within the element
          const anyLink = $el.find('a').first();
          if (!anyLink.length) return;
        }

        const title = $el.find('h2, h3, h4, .title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = ($link.length ? $link : $el.find('a').first()).attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();
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
