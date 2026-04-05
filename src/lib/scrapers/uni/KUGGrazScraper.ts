import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Kunstuniversität Graz (KUG) Scraper
 * Main page at kug.ac.at/veranstaltungen
 * The full calendar is hosted externally on Ungerboeck (JS-rendered),
 * but the main KUG pages contain news items that announce events with
 * dates embedded in titles (e.g., "am 9. April 2026", "am 24.4.").
 * Scrapes both the veranstaltungen page and the homepage for news items.
 */
export class KUGGrazScraper extends UniBaseScraper {
  readonly name = 'kug-graz';
  protected readonly shortName = 'KUG';
  protected readonly baseUrl = 'https://www.kug.ac.at';
  protected readonly eventListUrl = 'https://www.kug.ac.at/veranstaltungen';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0707;
  protected readonly defaultLng = 15.4395;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte KUG Graz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape veranstaltungen page
    try {
      const html = await this.fetchPage(this.eventListUrl);
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
      this.parseNewsLinks(html, allEvents);
      this.log(`Veranstaltungen-Seite: ${allEvents.size} Events`);
    } catch (err) {
      this.log(`Veranstaltungen Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Scrape homepage for additional news items
    try {
      await this.rateLimit();
      const html = await this.fetchPage(this.baseUrl);
      const jsonLdEvents = this.parseJsonLdEvents(html, this.baseUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
      this.parseNewsLinks(html, allEvents);
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /**
   * Parse news-detail-start links from KUG pages.
   * News items about events typically have dates in titles like:
   * "am 9. April 2026", "am 10.4.", "am 24.4."
   * The "erstellt am:" / "aktualisiert am:" dates are article metadata, not event dates.
   */
  private parseNewsLinks(html: string, allEvents: Map<string, ScrapedEvent>): void {
    const $ = cheerio.load(html);

    $('a[href*="news-detail-start"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (!href) return;

        // KUG uses empty <a> tags with title in the `title` attribute
        // The visible title is in a sibling <h3 class="news-teaser__title">
        let title = $el.attr('title') || $el.text().trim();
        if (!title || title.length < 5) {
          // Try finding title from the parent news-teaser container
          const $teaser = $el.closest('.news-teaser, .news');
          title = $teaser.find('h3, .news-teaser__title').first().text().trim();
        }
        if (!title || title.length < 5) return;
        if (/^(mehr|weiterlesen|details)$/i.test(title)) return;

        // Extract the event date from the title text
        // Patterns: "am 9. April 2026", "am 10.4.", "am 24.4.", "Nächste Termine: 1.,10. & 11.04."
        let startDate = this.extractEventDateFromTitle(title);

        // If no date in title, try the teaser's <time> element but prefer future dates
        if (!startDate) {
          const $teaser = $el.closest('.news-teaser, .news');
          const timeEl = $teaser.find('time[datetime]').first();
          const datetime = timeEl.attr('datetime');
          if (datetime) {
            startDate = this.parseDate(datetime);
          }
        }

        if (!startDate) return;

        // Skip items that are clearly not events (statements, obituaries, solidarity)
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('statement') || lowerTitle.includes('solidarität')
          || lowerTitle.includes('offener brief') || lowerTitle.includes('trauert')) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const event = this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
        });

        if (!allEvents.has(event.source_id)) {
          allEvents.set(event.source_id, event);
        }
      } catch { /* skip */ }
    });
  }

  /**
   * Extract event dates from KUG news titles.
   * Examples: "am 9. April 2026", "am 10.4.", "am 24.4."
   */
  private extractEventDateFromTitle(title: string): string | null {
    // "am DD. Month YYYY"
    const fullMatch = title.match(/am\s+(\d{1,2})\.\s*(Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i);
    if (fullMatch) {
      const months: Record<string, string> = {
        'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
        'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
        'august': '08', 'september': '09', 'oktober': '10',
        'november': '11', 'dezember': '12',
      };
      const month = months[fullMatch[2].toLowerCase()];
      if (month) {
        return `${fullMatch[3]}-${month}-${fullMatch[1].padStart(2, '0')}`;
      }
    }

    // "am DD.MM." or "am DD.MM" (no year — assume current year)
    const shortMatch = title.match(/am\s+(\d{1,2})\.(\d{1,2})\.?(?:\s|$|,)/);
    if (shortMatch) {
      const now = new Date();
      let year = now.getFullYear();
      const day = shortMatch[1].padStart(2, '0');
      const month = shortMatch[2].padStart(2, '0');
      // If date is >2 months in the past, assume next year
      const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
      if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
        year++;
      }
      return `${year}-${month}-${day}`;
    }

    return null;
  }
}
