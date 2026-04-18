import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { geocodeLocation } from '../geocoding';
import type { ScrapedEvent } from '@/types/events';

const MONTHS: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mar': '03', 'mär': '03', 'apr': '04',
  'may': '05', 'mai': '05', 'jun': '06', 'jul': '07',
  'aug': '08', 'sep': '09', 'oct': '10', 'okt': '10',
  'nov': '11', 'dec': '12', 'dez': '12',
};

/**
 * events.at Scraper
 * Scrapes Wien events from events.at — uses JSON-LD (Events Calendar plugin)
 * with HTML fallback. Covers multiple month pages.
 */
export class EventsAtScraper extends BaseScraper {
  readonly name = 'events.at';
  private readonly BASE = 'https://events.at';
  private readonly MAX_MONTHS = 6;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte events.at Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape current month + next N months
    const today = new Date();
    for (let i = 0; i < this.MAX_MONTHS; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const url = `${this.BASE}/fortgehen-wien?monat/${monthStr}/`;

      try {
        const html = await this.fetchPage(url);

        // Try JSON-LD first (best data quality)
        const jsonLdEvents = this.parseJsonLd(html);
        if (jsonLdEvents.length > 0) {
          for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
          this.log(`${monthStr}: ${jsonLdEvents.length} Events via JSON-LD`);
        } else {
          // Fallback to HTML parsing
          const htmlEvents = this.parseHtml(html);
          for (const ev of htmlEvents) allEvents.set(ev.source_id, ev);
          this.log(`${monthStr}: ${htmlEvents.length} Events via HTML`);
        }

        await this.rateLimit();
      } catch (err) {
        this.log(`${monthStr} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Geocode unique venues
    const venueCache = new Map<string, { lat: number; lon: number } | null>();
    const events = Array.from(allEvents.values());

    for (const ev of events) {
      if (ev.latitude && ev.latitude !== 48.2082) continue;
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

  private parseJsonLd(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] || [json];

        for (const item of items) {
          if (item['@type'] !== 'Event') continue;

          const name = String(item.name || '').trim();
          if (!name) continue;

          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;

          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

          // Location from JSON-LD
          const location = item.location;
          let venueName: string | undefined;
          let address: string | undefined;
          if (location) {
            venueName = location.name || undefined;
            if (location.address) {
              address = typeof location.address === 'string'
                ? location.address
                : location.address.streetAddress || undefined;
            }
          }

          events.push({
            source_id: `events-at-${slug}`,
            source_name: this.name,
            source_url: String(item.url || `${this.BASE}/event/${slug}`),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: venueName || 'Wien',
            address,
            latitude: 48.2082,
            longitude: 16.3738,
            bundesland: 'wien',
            category: categorizeEvent(name, item.description),
            image_url: item.image ? (typeof item.image === 'string' ? item.image : String((item.image as Record<string, unknown>).url || '')) : undefined,
          });
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="/event/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        if (!href.match(/\/event\/[a-z0-9-]+\/?$/i)) return;
        if (href.includes('/event/list') || href.includes('/event/search')) return;

        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        const slugMatch = href.match(/\/event\/([a-z0-9-]+)\/?$/i);
        if (!slugMatch) return;
        const slug = slugMatch[1];

        const $parent = $link.parent();
        const $grandparent = $parent.parent();
        const contextText = $grandparent.text();

        const startDate = this.parseDate(contextText);
        if (!startDate) return;

        let venue: string | undefined;
        $grandparent.find('a[href*="/venue/"]').each((_, v) => {
          if (!venue) venue = $(v).text().trim();
        });

        let imageUrl: string | undefined;
        const $img = $grandparent.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && imgSrc.startsWith('http')) imageUrl = imgSrc;

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `events-at-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: venue || 'Wien',
          latitude: 48.2082,
          longitude: 16.3738,
          category: categorizeEvent(title),
          image_url: imageUrl,
          bundesland: 'wien',
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // "27 Mar 2026" or "27 Mar - 28 Mar 2026"
    const m = text.match(/(\d{1,2})\s+([A-Za-zä]+)\s+(\d{4})/);
    if (m) {
      const [, day, month, year] = m;
      const mo = MONTHS[month.toLowerCase().slice(0, 3)];
      if (!mo) return null;
      return `${year}-${mo}-${day.padStart(2, '0')}`;
    }

    // "27.03.2026"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) {
      const [, day, mo, year] = n;
      return `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
