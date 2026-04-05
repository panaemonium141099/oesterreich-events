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
  protected readonly eventListUrl = 'https://www.tuwien.at/tu-wien/aktuelles/veranstaltungskalender';
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
        const prevSize = allEvents.size;
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
        if (page > 1 && allEvents.size === prevSize) break;
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

    // TU Wien uses article.wpListItem with h3 > a.wpListItemEventLink
    // Dates in p.visually-hidden: "01 Dezember 2025 bis 04 September 2026"
    $('article.wpListItem, article[aria-labelledby]').each((_, el) => {
      try {
        const $el = $(el);
        const $link = $el.find('a.wpListItemEventLink, a[href*="veranstaltungskalender/news/"]').first();
        if (!$link.length) return;

        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        const href = $link.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from visually-hidden paragraph: "01 Dezember 2025 bis 04 September 2026"
        const dateText = $el.find('p.visually-hidden').first().text().trim();
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        // End date from "bis" part
        let endDate: string | undefined;
        const bisMatch = dateText.match(/bis\s+(.+)/);
        if (bisMatch) {
          endDate = this.parseDatetime(bisMatch[1]) || this.parseDate(bisMatch[1]) || undefined;
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const eventType = $el.find('.wpTypeTag').text().trim();
        const location = $el.find('.wpLocation').text().trim();
        const desc = [eventType, location].filter(Boolean).join(' - ') || undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          endDate,
          description: desc,
          sourceUrl,
          locationName: location || undefined,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
