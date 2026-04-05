import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Alpen-Adria-Universität Klagenfurt (AAU) Scraper
 * JSP-based campus event system at campus.aau.at/va/va_liste.jsp.
 * Lists events chronologically with DD.MM.YYYY dates. No JSON-LD.
 * Detail links: /va/ctl/details/{ID}
 */
export class AAUScraper extends UniBaseScraper {
  readonly name = 'aau-klagenfurt';
  protected readonly shortName = 'AAU';
  protected readonly baseUrl = 'https://campus.aau.at';
  protected readonly eventListUrl = 'https://campus.aau.at/va/va_liste.jsp';
  protected readonly city = 'Klagenfurt';
  protected readonly bundesland = 'kaernten';
  protected readonly defaultLat = 46.6175;
  protected readonly defaultLng = 14.2643;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte AAU Klagenfurt Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);
      const events = this.parseHtml(html);
      for (const ev of events) allEvents.set(ev.source_id, ev);
      this.log(`${allEvents.size} Events von Hauptseite`);
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

    // The JSP page uses <li> items or <a> links with /va/ctl/details/ paths
    // Each event has: date "DD.MM.YYYY, HH:MMh", category, title link
    $('a[href*="/va/ctl/details/"]').each((_, el) => {
      try {
        const $link = $(el);
        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        const href = $link.attr('href') || '';
        // Strip jsessionid from URL
        const cleanHref = href.replace(/;jsessionid=[^?]*/g, '');
        const sourceUrl = cleanHref.startsWith('http')
          ? cleanHref
          : `${this.baseUrl}${cleanHref}`;

        // Extract event ID from URL for source_id
        const idMatch = cleanHref.match(/details\/(\d+)/);
        const eventId = idMatch ? idMatch[1] : '';

        // Find the surrounding text content for date parsing
        // The date is typically in a text node before the link, in the parent <li>
        const $parent = $link.closest('li, tr, div');
        const parentText = $parent.length ? $parent.text() : '';

        // Parse date from parent text (DD.MM.YYYY, HH:MMh)
        const dateTimeMatch = parentText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2})[:\.](\d{2})h?/);
        let startDate: string | null = null;
        if (dateTimeMatch) {
          const [, day, month, year, hour, minute] = dateTimeMatch;
          startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`;
        } else {
          // Fallback: just date without time
          startDate = this.parseDate(parentText);
        }
        if (!startDate) return;

        const slug = eventId
          ? `${eventId}-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 50)}`
          : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

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
