import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Kärnten Scraper
 * Multiple campuses (Villach, Spittal, Klagenfurt, Feldkirchen).
 * Events spread across department pages.
 */
export class FHKaerntenScraper extends UniBaseScraper {
  readonly name = 'fh-kaernten';
  protected readonly shortName = 'FH-Kaernten';
  protected readonly baseUrl = 'https://www.fh-kaernten.at';
  protected readonly eventListUrl = 'https://www.fh-kaernten.at/aktuelles/veranstaltungen';
  protected readonly city = 'Villach';
  protected readonly bundesland = 'kaernten';
  protected readonly defaultLat = 46.6130;
  protected readonly defaultLng = 13.8489;
  private readonly MAX_PAGES = 3;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH Kärnten Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    // Also try the engineering workshops page
    try {
      await this.rateLimit();
      const workshopUrl = 'https://www.fh-kaernten.at/studium/engineering-it/workshops-und-veranstaltungen';
      const workshopHtml = await this.fetchPage(workshopUrl);
      const workshopEvents = this.parseHtml(workshopHtml);
      for (const ev of workshopEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article, .event-item, [class*="event"], .veranstaltung, .news-item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();
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
