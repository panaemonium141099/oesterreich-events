import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * vorarlberg.travel Scraper
 * WordPress REST API for all of Vorarlberg (4 Bezirke).
 * ~200+ events.
 */
export class VorarlbergTravelScraper extends BaseScraper {
  readonly name = 'vorarlberg.travel';
  private readonly API_BASE = 'https://www.vorarlberg.travel/wp-json/vt/v1';
  private readonly MAX_PAGES = 20;
  private readonly PER_PAGE = 50;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte vorarlberg.travel API Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      try {
        const url = `${this.API_BASE}/events?page=${page}&per_page=${this.PER_PAGE}`;
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.userAgent,
          },
        });

        if (!response.ok) {
          if (page === 1) {
            this.log(`API v1 nicht verfügbar (${response.status}), versuche wp/v2...`);
            return this.scrapeWpV2();
          }
          break;
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : (data as Record<string, unknown>).events || (data as Record<string, unknown>).data || [];
        if (!Array.isArray(items) || items.length === 0) break;

        for (const item of items as Record<string, unknown>[]) {
          const ev = this.parseEvent(item);
          if (ev) allEvents.set(ev.source_id, ev);
        }

        this.log(`Seite ${page}: ${(items as unknown[]).length} Events (gesamt: ${allEvents.size})`);
        await this.sleep(500);
      } catch (err) {
        if (page === 1) {
          this.log(`API Fehler: ${err instanceof Error ? err.message : err}, versuche wp/v2...`);
          return this.scrapeWpV2();
        }
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseEvent(item: Record<string, unknown>): ScrapedEvent | null {
    const title = String(item.title || item.name || (item.title && typeof item.title === 'object' ? (item.title as Record<string, unknown>).rendered : '') || '').trim();
    if (!title) return null;

    const startDate = String(item.start_date || item.startDate || item.date || '').slice(0, 19);
    if (!startDate) return null;

    const id = item.id ? String(item.id) : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const slug = item.slug ? String(item.slug) : id;

    const location = item.location as Record<string, unknown> | undefined;
    const venue = item.venue as Record<string, unknown> | undefined;
    const loc = location || venue;

    let imageUrl: string | undefined;
    if (item.image) {
      if (typeof item.image === 'string') imageUrl = item.image;
      else if (typeof item.image === 'object') {
        const img = item.image as Record<string, unknown>;
        imageUrl = String(img.url || img.src || img.source_url || '');
      }
    }
    if (item.featured_media_url) imageUrl = String(item.featured_media_url);

    return {
      source_id: `vbg-travel-${id}`,
      source_name: this.name,
      source_url: item.link ? String(item.link) : `https://www.vorarlberg.travel/veranstaltung/${slug}/`,
      title,
      description: item.description || item.excerpt
        ? String(typeof item.description === 'string' ? item.description : (item.description as Record<string, unknown>)?.rendered || item.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 500)
        : undefined,
      start_date: startDate,
      end_date: item.end_date ? String(item.end_date).slice(0, 19) : undefined,
      location_name: loc?.name ? String(loc.name) : undefined,
      address: loc?.address ? String(loc.address) : undefined,
      latitude: loc?.latitude ? Number(loc.latitude) : (loc?.lat ? Number(loc.lat) : undefined),
      longitude: loc?.longitude ? Number(loc.longitude) : (loc?.lng ? Number(loc.lng) : undefined),
      bundesland: 'vorarlberg',
      category: categorizeEvent(title, item.description ? String(typeof item.description === 'string' ? item.description : '') : undefined),
      image_url: this.cleanImageUrl(imageUrl),
    };
  }

  // Fallback: standard WordPress REST API
  private async scrapeWpV2(): Promise<ScrapedEvent[]> {
    const allEvents = new Map<string, ScrapedEvent>();

    // Try tribe_events (The Events Calendar plugin) or custom post type
    const endpoints = [
      'https://www.vorarlberg.travel/wp-json/tribe/events/v1/events?per_page=50',
      'https://www.vorarlberg.travel/wp-json/wp/v2/events?per_page=50',
      'https://www.vorarlberg.travel/wp-json/wp/v2/tribe_events?per_page=50',
    ];

    for (const endpoint of endpoints) {
      try {
        for (let page = 1; page <= 10; page++) {
          const url = `${endpoint}&page=${page}`;
          const response = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': this.userAgent },
          });

          if (!response.ok) break;

          const data = await response.json();
          const items = Array.isArray(data) ? data : ((data as Record<string, unknown>).events as unknown[]) || [];
          if (!Array.isArray(items) || items.length === 0) break;

          for (const item of items as Record<string, unknown>[]) {
            const ev = this.parseEvent(item);
            if (ev) allEvents.set(ev.source_id, ev);
          }

          this.log(`WP API Seite ${page}: ${items.length} Events (gesamt: ${allEvents.size})`);
          await this.sleep(500);
        }

        if (allEvents.size > 0) break; // Found events, stop trying other endpoints
      } catch {
        continue;
      }
    }

    return Array.from(allEvents.values());
  }
}
