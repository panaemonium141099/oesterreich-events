import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Hochschule Burgenland (FH Burgenland) Scraper
 * German events overview at /ueber-uns/events/uebersicht/
 * Uses .toggle-box items with data-categories, .event-toggle-list buttons.
 * Date format: DDMM in .date-numbers, Zeit/Ort in event details.
 * Campuses in Eisenstadt and Pinkafeld.
 */
export class FHBurgenlandScraper extends UniBaseScraper {
  readonly name = 'fh-burgenland';
  protected readonly shortName = 'FH-Burgenland';
  protected readonly baseUrl = 'https://hochschule-burgenland.at';
  protected readonly eventListUrl = 'https://hochschule-burgenland.at/ueber-uns/events/uebersicht/';
  protected readonly city = 'Eisenstadt';
  protected readonly bundesland = 'burgenland';
  protected readonly defaultLat = 47.8457;
  protected readonly defaultLng = 16.5286;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Hochschule Burgenland Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

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

    // FH Burgenland uses .toggle-box items with data-categories attribute
    // Each has: .date-numbers (DDMM), h3 title, Zeit/Ort in body
    $('.toggle-box').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3, h4, h2').first().text().trim();
        if (!title || title.length < 3) return;

        // Date is in .date-numbers as DDMM format (e.g. "0904" = April 9)
        const dateNumbers = $el.find('.date-numbers').first().text().trim();
        let startDate: string | null = null;

        if (dateNumbers && dateNumbers.length === 4) {
          const day = dateNumbers.slice(0, 2);
          const month = dateNumbers.slice(2, 4);
          const year = new Date().getFullYear();
          startDate = `${year}-${month}-${day}`;

          // Check for time in the event body (Zeit: DD.MM.YYYY, HH:MM)
          const bodyText = $el.text();
          const timeMatch = bodyText.match(/(\d{1,2})[:\.](\d{2})\s*(Uhr|–|-)/);
          if (timeMatch) {
            startDate = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
          }

          // Also try full date from body text for year accuracy
          const fullDateMatch = bodyText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (fullDateMatch) {
            const fullDate = `${fullDateMatch[3]}-${fullDateMatch[2].padStart(2, '0')}-${fullDateMatch[1].padStart(2, '0')}`;
            if (timeMatch) {
              startDate = `${fullDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
            } else {
              startDate = fullDate;
            }
          }
        } else {
          // Fallback: parse from full text
          const text = $el.text();
          startDate = this.parseDatetime(text) || this.parseDate(text);
        }

        if (!startDate) return;

        // Extract location from Ort: field
        const bodyText = $el.text();
        const ortMatch = bodyText.match(/Ort:\s*([^\n]+)/);
        const locationName = ortMatch ? ortMatch[1].trim() : undefined;

        // Find link in the event
        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href && href.startsWith('http')
          ? href
          : href
            ? `${this.baseUrl}${href}`
            : this.eventListUrl;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          locationName,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: generic selectors if .toggle-box not found
    if (events.length === 0) {
      $('article, .event-item, [class*="event"], .veranstaltung').each((_, el) => {
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

          events.push(this.buildEvent({
            slug,
            title,
            startDate,
            description: desc || undefined,
            sourceUrl,
          }));
        } catch { /* skip */ }
      });
    }

    return events;
  }
}
