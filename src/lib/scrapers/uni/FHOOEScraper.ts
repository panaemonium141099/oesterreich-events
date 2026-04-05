import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Oberösterreich (FH OÖ) Scraper
 * Server-rendered event listing with pagination.
 * Campuses: Wels, Linz, Steyr, Hagenberg.
 * Event URLs follow pattern: /campus-{name}/events/{slug}
 */
export class FHOOEScraper extends UniBaseScraper {
  readonly name = 'fh-ooe';
  protected readonly shortName = 'FH-OOE';
  protected readonly baseUrl = 'https://fh-ooe.at';
  protected readonly eventListUrl = 'https://fh-ooe.at/events';
  protected readonly city = 'Wels';
  protected readonly bundesland = 'ooe';
  protected readonly defaultLat = 48.1575;
  protected readonly defaultLng = 14.0289;
  private readonly MAX_PAGES = 6;

  // Campus coordinates for more precise geocoding
  private readonly CAMPUS_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
    'hagenberg': { lat: 48.3685, lng: 14.5153, city: 'Hagenberg' },
    'linz': { lat: 48.3064, lng: 14.2858, city: 'Linz' },
    'steyr': { lat: 48.0378, lng: 14.4213, city: 'Steyr' },
    'wels': { lat: 48.1575, lng: 14.0289, city: 'Wels' },
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH OÖ Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        // Try JSON-LD first
        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        // HTML fallback
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

  /**
   * Detect campus from URL or location text and return coordinates.
   */
  private detectCampus(text: string): { lat: number; lng: number; city: string } | null {
    const lower = text.toLowerCase();
    for (const [campus, coords] of Object.entries(this.CAMPUS_COORDS)) {
      if (lower.includes(campus)) return coords;
    }
    return null;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // FH OOE events are in <li> elements. Each <li> contains multiple <a> tags:
    // 1. Title link with <h3> + location <p>
    // 2. Tag filter links (#Campus, #Online, etc.)
    // 3. Date link ("Datum des Events: DD.MM. ...")
    // 4. "Mehr erfahren" link
    $('li').each((_, el) => {
      try {
        const $li = $(el);

        // Find the main event link (the one with an h3 title)
        const $titleLink = $li.find('a[href*="/campus-"] h3, a[href*="/campus-"] h2').first().closest('a');
        if ($titleLink.length === 0) return;

        const href = $titleLink.attr('href') || '';
        if (!href.includes('/events/')) return;

        const title = $titleLink.find('h2, h3, h4').first().text().trim();
        if (!title || title.length < 3) return;

        // Extract location from "Ort des Events:" paragraph
        const locationText = $titleLink.find('p').text().trim();
        const locationMatch = locationText.match(/Ort des Events:\s*(.+)/);
        const locationName = locationMatch ? locationMatch[1].trim() : undefined;

        // Extract date from the full <li> text
        const liText = $li.text();
        const dateMatch = liText.match(/Datum des Events:\s*(\d{2})\.(\d{2})\.\s*(?:\w+)?\s*(?:·\s*(\d{1,2}):(\d{2}))?/);
        let startDate: string | null = null;
        if (dateMatch) {
          const day = dateMatch[1];
          const month = dateMatch[2];
          const now = new Date();
          let year = now.getFullYear();
          const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
          if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
            year++;
          }
          startDate = `${year}-${month}-${day}`;
          if (dateMatch[3] && dateMatch[4]) {
            startDate = `${startDate}T${dateMatch[3].padStart(2, '0')}:${dateMatch[4]}:00`;
          }
        }

        if (!startDate) {
          // Fallback: try DD.MM. pattern anywhere in the li
          const fallbackMatch = liText.match(/(\d{2})\.(\d{2})\.\s*(?:\w+)?\s*(?:·\s*(\d{1,2}):(\d{2}))?/);
          if (fallbackMatch) {
            const day = fallbackMatch[1];
            const month = fallbackMatch[2];
            const now = new Date();
            let year = now.getFullYear();
            const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
            if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
              year++;
            }
            startDate = `${year}-${month}-${day}`;
            if (fallbackMatch[3] && fallbackMatch[4]) {
              startDate = `${startDate}T${fallbackMatch[3].padStart(2, '0')}:${fallbackMatch[4]}:00`;
            }
          }
        }

        if (!startDate) {
          startDate = this.parseDatetime(liText) || this.parseDate(liText);
        }
        if (!startDate) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Detect campus from URL or location
        const campus = this.detectCampus(href) || (locationName ? this.detectCampus(locationName) : null);

        const imgSrc = $li.find('img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: locationName ? `Ort: ${locationName}` : undefined,
          locationName: campus?.city || locationName || this.city,
          sourceUrl,
          imageUrl,
          lat: campus?.lat,
          lng: campus?.lng,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
