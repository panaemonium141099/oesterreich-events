import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Technikum Wien Scraper
 * Uses WordPress REST API at content.technikum-wien.at/wp-json/wp/v2/events
 * Events are rendered client-side, so we fetch directly from the API.
 */
export class FHTechnikumWienScraper extends UniBaseScraper {
  readonly name = 'fh-technikum-wien';
  protected readonly shortName = 'FH-Technikum-Wien';
  protected readonly baseUrl = 'https://technikum-wien.at';
  protected readonly eventListUrl = 'https://technikum-wien.at/events/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2392;
  protected readonly defaultLng = 16.3780;
  private readonly API_URL = 'https://content.technikum-wien.at/wp-json/wp/v2/events';
  private readonly PER_PAGE = 20;
  private readonly MAX_PAGES = 3;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH Technikum Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      try {
        const url = `${this.API_URL}?per_page=${this.PER_PAGE}&page=${page}&orderby=date&order=desc`;
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

        const data = await response.json() as WPEvent[];
        if (!Array.isArray(data) || data.length === 0) break;

        for (const item of data) {
          try {
            const event = this.parseWPEvent(item);
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

    // Also try the HTML page for JSON-LD
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

  private parseWPEvent(item: WPEvent): ScrapedEvent | null {
    const title = this.stripHtml(item.title?.rendered || '').trim();
    if (!title || title.length < 3) return null;

    const acf = item.acf || {};
    const startDate = acf.date || '';
    if (!startDate) return null;

    // Build ISO datetime
    let isoDate = startDate; // Already YYYY-MM-DD from ACF
    if (acf.time) {
      const timeParts = acf.time.match(/(\d{1,2}):(\d{2})/);
      if (timeParts) {
        isoDate = `${startDate}T${timeParts[1].padStart(2, '0')}:${timeParts[2]}:00`;
      }
    }

    let endDate: string | undefined;
    if (acf.dateTo) {
      endDate = acf.dateTo;
      if (acf.timeTo) {
        const timeParts = acf.timeTo.match(/(\d{1,2}):(\d{2})/);
        if (timeParts) {
          endDate = `${acf.dateTo}T${timeParts[1].padStart(2, '0')}:${timeParts[2]}:00`;
        }
      }
    }

    const slug = (item.slug || title.toLowerCase().replace(/\W+/g, '-')).slice(0, 60);
    const description = this.stripHtml(item.excerpt?.rendered || item.content?.rendered || '').trim();
    const locationName = acf.location ? String(acf.location).trim() : undefined;

    // Build source URL - prefer the public-facing URL
    const sourceUrl = item.link
      ? item.link.replace('content.technikum-wien.at', 'technikum-wien.at')
      : `${this.baseUrl}/events/${item.slug}/`;

    // Image from ACF featured_image
    let imageUrl: string | undefined;
    if (acf.featured_image?.url) {
      imageUrl = this.cleanImageUrl(String(acf.featured_image.url));
    }

    return this.buildEvent({
      slug,
      title,
      startDate: isoDate,
      endDate,
      description: description?.slice(0, 500) || undefined,
      locationName: locationName || 'FH Technikum Wien',
      sourceUrl,
      imageUrl,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ').trim();
  }
}

interface WPEvent {
  id?: number;
  slug?: string;
  link?: string;
  title?: { rendered: string };
  content?: { rendered: string };
  excerpt?: { rendered: string };
  acf?: {
    date?: string;
    time?: string;
    dateTo?: string;
    timeTo?: string;
    location?: string;
    featured_image?: { url?: string };
  };
}
