import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Vorarlberg Scraper
 * Server-rendered with JSON-LD schema.
 * Portal page directing to specific event types.
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
    this.log('Starte FH Vorarlberg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Also try German URL
    try {
      await this.rateLimit();
      const deUrl = 'https://www.fhv.at/fh/die-fhv/veranstaltungen';
      const deHtml = await this.fetchPage(deUrl);
      const deEvents = this.parseJsonLdEvents(deHtml, deUrl);
      for (const ev of deEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
      const deHtmlEvents = this.parseHtml(deHtml);
      for (const ev of deHtmlEvents) {
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
