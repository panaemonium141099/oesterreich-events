import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH des BFI Wien Scraper
 * Events listing at /de/newsroom/events (also /en/pages/veranstaltungen).
 * Uses .event-wrapper containers with:
 *   - .date-time for date (format: "14.April 2026 18:00 UHR")
 *   - .event-title for title
 *   - p for location
 *   - .button-block > a for detail link
 * Event detail links: /de/events/{slug}
 */
export class FHBFIWienScraper extends UniBaseScraper {
  readonly name = 'fh-bfi-wien';
  protected readonly shortName = 'FH-BFI-Wien';
  protected readonly baseUrl = 'https://www.fh-vie.ac.at';
  protected readonly eventListUrl = 'https://www.fh-vie.ac.at/en/pages/veranstaltungen';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2136;
  protected readonly defaultLng = 16.3889;

  // German month names for date parsing
  private readonly deMonths: Record<string, string> = {
    'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH des BFI Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Primary: German events listing (has more events)
    try {
      const deUrl = 'https://www.fh-vie.ac.at/de/newsroom/events';
      const deHtml = await this.fetchPage(deUrl);

      const htmlEvents = this.parseHtml(deHtml);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
      this.log(`${allEvents.size} Events von DE-Seite`);
    } catch (err) {
      this.log(`DE-Seite Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Fallback: English events page
    try {
      await this.rateLimit();
      const html = await this.fetchPage(this.eventListUrl);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch (err) {
      this.log(`EN-Seite Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /**
   * Parse date in FH BFI format: "14.April 2026 18:00 UHR" or "07.April 2026 18:00-19:00 UHR"
   */
  private parseFHDate(text: string): string | null {
    // Match "DD.MonthName YYYY HH:MM" with optional time range
    const match = text.match(
      /(\d{1,2})\.?\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})(?:\s+(\d{1,2})[:\.](\d{2}))?/i
    );
    if (!match) return null;

    const day = match[1].padStart(2, '0');
    const month = this.deMonths[match[2].toLowerCase()];
    const year = match[3];
    if (!month) return null;

    let date = `${year}-${month}-${day}`;
    if (match[4] && match[5]) {
      date = `${date}T${match[4].padStart(2, '0')}:${match[5]}:00`;
    }
    return date;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Structure: .event-wrapper > .event > .event-text + .button-block
    $('.event-wrapper').each((_, el) => {
      try {
        const $wrapper = $(el);

        // Title from .event-title
        const title = $wrapper.find('.event-title').first().text().trim();
        if (!title || title.length < 3) return;

        // Date from .date-time
        const dateText = $wrapper.find('.date-time').first().text().trim();
        const startDate = this.parseFHDate(dateText)
          || this.parseDatetime(dateText)
          || this.parseDate(dateText);
        if (!startDate) return;

        // Detail link from .button-block > a or any event link
        const href = $wrapper.find('a[href*="/events/"]').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Extract slug from URL
        const slugMatch = href.match(/events\/([^/?]+)\/?$/);
        const slug = slugMatch
          ? slugMatch[1]
          : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Location from <p> in .event-text
        const locationText = $wrapper.find('.event-text p').first().text().trim();
        const locationName = locationText || undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          locationName,
          sourceUrl: sourceUrl || this.eventListUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
