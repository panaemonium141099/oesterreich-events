import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität Mozarteum Salzburg Scraper
 * Server-rendered. 143 events, 10 pages. Very rich source.
 */
export class MozarteumScraper extends UniBaseScraper {
  readonly name = 'mozarteum-salzburg';
  protected readonly shortName = 'Mozarteum';
  protected readonly baseUrl = 'https://www.moz.ac.at';
  protected readonly eventListUrl = 'https://www.moz.ac.at/de/veranstaltungen';
  protected readonly city = 'Salzburg';
  protected readonly bundesland = 'salzburg';
  protected readonly defaultLat = 47.8015;
  protected readonly defaultLng = 13.0427;
  private readonly MAX_PAGES = 12;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Mozarteum Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?tx_moznews_news%5B%40widget_0%5D%5BcurrentPage%5D=${page}&cHash=dummy`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

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

    $('article, .event-item, .news-item, [class*="event"], .veranstaltung, li.news').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title, .news-header').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"], .news-date').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p, .news-body').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src');
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
