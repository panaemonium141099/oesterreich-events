import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Technische Universität Graz Scraper
 * Server-rendered with calendar navigation. Date-based filtering via URL parameters.
 */
export class TUGrazScraper extends UniBaseScraper {
  readonly name = 'tu-graz';
  protected readonly shortName = 'TUGraz';
  protected readonly baseUrl = 'https://www.tugraz.at';
  protected readonly eventListUrl = 'https://www.tugraz.at/news/tu-graz-events/aktuelle-veranstaltungen';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0696;
  protected readonly defaultLng = 15.4504;
  private readonly MAX_PAGES = 3;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte TU Graz Scraping...');
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

    // TU Graz uses div.int-content-box containers with:
    //   div.eventfont > div.padd > a.url (title + link)
    //   div.event-description (description)
    //   div.event-bottom > div.default_catheader (date text)
    $('div.int-content-box').each((_, el) => {
      try {
        const $el = $(el);
        const $link = $el.find('a.url, a[href*="/eventdetails/"]').first();
        if (!$link.length) return;

        const title = $link.text().trim() || $link.attr('title')?.trim() || '';
        if (!title || title.length < 3) return;

        const href = $link.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from .default_catheader: "24. Februar 2026, 08:00 - 22. Mai 2026, 19:00"
        const dateText = $el.find('.default_catheader').text().trim();
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        // End date from "- DD. Month YYYY, HH:MM" part
        let endDate: string | undefined;
        const endMatch = dateText.match(/-\s+(\d{1,2}\.\s+\w+\s+\d{4}.*)/);
        if (endMatch) {
          endDate = this.parseDatetime(endMatch[1]) || this.parseDate(endMatch[1]) || undefined;
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.event-description').text().trim() || undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          endDate,
          description: desc,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: also try direct links to eventdetails
    $('a[href*="/eventdetails/article/"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.text().trim();
        if (!title || title.length < 3) return;

        const href = $el.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        if (events.some(e => e.source_id === this.makeSourceId(slug))) return;

        // Try to find date from surrounding context
        const parentBlock = $el.closest('.int-content-box, .eventfont, div');
        const blockText = parentBlock.find('.default_catheader').text().trim() || parentBlock.text();
        const startDate = this.parseDatetime(blockText) || this.parseDate(blockText);
        if (!startDate) return;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
