import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Montanuniversität Leoben Scraper
 * Server-rendered, very few events (~2). Small university.
 */
export class MontanUniScraper extends UniBaseScraper {
  readonly name = 'montanuni-leoben';
  protected readonly shortName = 'MontanUni';
  protected readonly baseUrl = 'https://www.unileoben.ac.at';
  protected readonly eventListUrl = 'https://www.unileoben.ac.at/en/university/events/';
  protected readonly city = 'Leoben';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.3838;
  protected readonly defaultLng = 15.0903;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Montanuni Leoben Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      // Also try German page
      await this.rateLimit();
      try {
        const deUrl = 'https://www.unileoben.ac.at/universitaet/events/';
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

      this.log(`${allEvents.size} Events gefunden`);
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article, .event-item, [class*="event"], .veranstaltung, .news-list-item, .list-item').each((_, el) => {
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
