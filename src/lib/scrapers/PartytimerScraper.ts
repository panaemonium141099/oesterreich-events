import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { geocodeLocation } from '../geocoding';
import type { ScrapedEvent } from '@/types/events';

/**
 * PartyTimer.at Scraper
 * Laravel Livewire framework but SSR — initial data is in HTML.
 * Pagination via ?page=N. Primarily Wien nightlife/party events.
 */
export class PartytimerScraper extends BaseScraper {
  readonly name = 'partytimer';
  private readonly BASE = 'https://www.partytimer.at';
  private readonly MAX_PAGES = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte PartyTimer Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let emptyCount = 0;

    for (let pg = 1; pg <= this.MAX_PAGES; pg++) {
      const url = pg === 1 ? `${this.BASE}/events` : `${this.BASE}/events?page=${pg}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) {
          emptyCount++;
          if (emptyCount >= 2) {
            this.log(`${emptyCount} leere Seiten, stoppe.`);
            break;
          }
        } else {
          emptyCount = 0;
          for (const ev of events) {
            allEvents.set(ev.source_id, ev);
          }
        }

        this.log(`Seite ${pg}: ${events.length} Events (gesamt: ${allEvents.size})`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${pg} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 2) break;
      }
    }

    // Geocode unique venues
    const events = Array.from(allEvents.values());
    const venueCache = new Map<string, { lat: number; lon: number } | null>();

    for (const ev of events) {
      const key = ev.location_name || '';
      if (!key || key === 'Wien') continue;

      if (!venueCache.has(key)) {
        const coords = await geocodeLocation(`${key}, Wien`, 'Wien, Austria');
        venueCache.set(key, coords ? { lat: coords.latitude, lon: coords.longitude } : null);
        await this.sleep(1100);
      }
      const c = venueCache.get(key);
      if (c) {
        ev.latitude = c.lat;
        ev.longitude = c.lon;
      }
    }

    this.log(`${events.length} Events gescrapt, ${venueCache.size} Venues geocodiert`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // PartyTimer uses .Event class containers and /events/{id} links
    $('a[href*="/events/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Must be event detail: /events/{numeric-id}
        const idMatch = href.match(/\/events\/(\d+)/);
        if (!idMatch) return;
        const eventId = idMatch[1];

        // Get containing element
        const $container = $link.closest('.Event, article, li, div').first();
        if (!$container.length) return;

        const containerText = $container.text();

        // Title from heading or strong
        let title = $container.find('h2, h3, h4, strong').first().text().trim();
        if (!title) title = $link.text().trim();
        if (!title || title.length < 3) return;

        // Skip cancelled
        if (containerText.toLowerCase().includes('abgesagt')) return;

        // Date: "Fr 27.3." or "Sa 28.03.2026" with optional time
        const startDate = this.parseDate(containerText);
        if (!startDate) return;

        // Venue + postal code: "U4, 1120 Wien" or "Flex, 1010 Wien"
        let venue: string | undefined;
        let postalCode: string | undefined;
        const venueMatch = containerText.match(/([A-Za-zÄÖÜäöüß\s&.-]+),\s*(\d{4})\s*Wien/);
        if (venueMatch) {
          venue = venueMatch[1].trim();
          postalCode = venueMatch[2];
        }

        // Category from tags/badges
        let categoryTag: string | undefined;
        $container.find('[class*="badge"], [class*="tag"], [class*="category"]').each((_, t) => {
          if (!categoryTag) categoryTag = $(t).text().trim();
        });

        // Image
        let imageUrl: string | undefined;
        const $img = $container.find('img').first();
        const imgSrc = ($img.attr('src') || $img.attr('data-src') || '').trim();
        if (imgSrc && !imgSrc.startsWith('data:')) {
          const resolved = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
          imageUrl = this.cleanImageUrl(resolved);
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `partytimer-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: venue || 'Wien',
          postal_code: postalCode,
          bundesland: 'wien',
          latitude: 48.2082,
          longitude: 16.3738,
          category: categorizeEvent(title, undefined, categoryTag ? [categoryTag] : undefined),
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // "27.3." or "27.03.2026" with optional time
    const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (m) {
      const [, day, mo, year] = m;
      const y = year || new Date().getFullYear().toString();
      return `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
