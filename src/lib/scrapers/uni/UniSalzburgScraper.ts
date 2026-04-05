import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Paris-Lodron-Universität Salzburg (PLUS) Scraper
 * Events are loaded via AJAX on the page, so we use the WP REST API directly.
 * REST endpoint: /?rest_route=/wp/v2/plus_events_dn_at
 */
export class UniSalzburgScraper extends UniBaseScraper {
  readonly name = 'uni-salzburg';
  protected readonly shortName = 'UniSalzburg';
  protected readonly baseUrl = 'https://www.plus.ac.at';
  protected readonly eventListUrl = 'https://plus.ac.at/veranstaltungen/';
  protected readonly city = 'Salzburg';
  protected readonly bundesland = 'salzburg';
  protected readonly defaultLat = 47.7953;
  protected readonly defaultLng = 13.0444;
  private readonly API_URL = 'https://www.plus.ac.at/?rest_route=/wp/v2/plus_events_dn_at';
  private readonly PER_PAGE = 20;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Uni Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      try {
        const url = `${this.API_URL}&per_page=${this.PER_PAGE}&page=${page}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EventScraper/1.0)',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 400) break; // No more pages
          this.log(`API Seite ${page} fehlgeschlagen: ${response.status}`);
          break;
        }

        const data = await response.json() as PLUSEvent[];
        if (!Array.isArray(data) || data.length === 0) break;

        for (const item of data) {
          try {
            const event = this.parsePLUSEvent(item);
            if (event) allEvents.set(event.source_id, event);
          } catch { /* skip */ }
        }

        this.log(`API Seite ${page}: ${allEvents.size} Events`);
        if (data.length < this.PER_PAGE) break;
        await this.rateLimit();
      } catch (err) {
        this.log(`API Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    // Also try the HTML page for JSON-LD as fallback
    try {
      await this.rateLimit();
      const html = await this.fetchPage(this.eventListUrl);
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePLUSEvent(item: PLUSEvent): ScrapedEvent | null {
    const title = this.stripHtml(item.title?.rendered || '').trim();
    if (!title || title.length < 3) return null;

    const acf = item.acf || {};
    const startEnd = acf.event_start_end_group || {};
    const startDate = startEnd.event_start || '';
    if (!startDate) return null;

    // Parse the start date - may be in various formats
    let isoDate = this.parseDatetime(startDate) || this.parseDate(startDate);
    if (!isoDate) {
      // Try direct ISO format
      const isoMatch = startDate.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) isoDate = isoMatch[1];
    }
    if (!isoDate) return null;

    let endDate: string | undefined;
    if (startEnd.event_end) {
      endDate = this.parseDatetime(startEnd.event_end) || this.parseDate(startEnd.event_end) || undefined;
    }

    const slug = (item.slug || title.toLowerCase().replace(/\W+/g, '-')).slice(0, 60);

    // Description from ACF
    const description = acf.event_description
      ? this.stripHtml(String(acf.event_description)).trim()
      : undefined;

    // Location
    const loc = acf.event_location_group || {};
    const locationParts = [loc.event_location_name, loc.event_address_street, loc.event_address_city]
      .filter(Boolean).map(s => String(s).trim());
    const locationName = locationParts.join(', ') || this.city;

    // Source URL
    const sourceUrl = acf.event_url || item.link || `${this.baseUrl}/veranstaltungen/`;

    return this.buildEvent({
      slug,
      title,
      startDate: isoDate,
      endDate,
      description: description?.slice(0, 500) || undefined,
      locationName,
      sourceUrl,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ').trim();
  }
}

interface PLUSEvent {
  id?: number;
  slug?: string;
  link?: string;
  title?: { rendered: string };
  acf?: {
    event_start_end_group?: {
      event_start?: string;
      event_end?: string;
    };
    event_description?: string;
    event_url?: string;
    event_location_group?: {
      event_location_name?: string;
      event_address_street?: string;
      event_address_city?: string;
    };
  };
}
