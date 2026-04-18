import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { geocodeLocation } from '../geocoding';
import type { ScrapedEvent } from '@/types/events';

/**
 * Falter.at Events Scraper
 * Scrapes Wien events from falter.at/events/suche?region=wien
 * Server-rendered HTML with pagination — no JavaScript needed.
 */
export class FalterScraper extends BaseScraper {
  readonly name = 'falter';
  private readonly BASE = 'https://www.falter.at';
  private readonly MAX_PAGES = 60; // ~960 events max (16 per page)

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Falter.at Wien-Events Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let page = 1;
    let hasMore = true;

    const today = new Date();
    const dateFrom = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const dateTo = new Date(today);
    dateTo.setMonth(dateTo.getMonth() + 6);
    const dateTo6m = `${dateTo.getFullYear()}-${(dateTo.getMonth() + 1).toString().padStart(2, '0')}-${dateTo.getDate().toString().padStart(2, '0')}`;

    while (hasMore && page <= this.MAX_PAGES) {
      const url = `${this.BASE}/events/suche?region=wien&span=${dateFrom}:${dateTo6m}&page=${page}`;
      try {
        const html = await this.fetchPage(url);
        const { events, hasNextPage } = this.parsePage(html);

        for (const ev of events) {
          allEvents.set(ev.source_id, ev);
        }

        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
        hasMore = hasNextPage && events.length > 0;
        page++;
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        hasMore = false;
      }
    }

    // Geocode unique venue names
    const venueCache = new Map<string, { lat: number; lon: number } | null>();
    const events = Array.from(allEvents.values());

    for (const ev of events) {
      if (ev.latitude && ev.latitude !== 48.2082) continue; // already geocoded
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

  private parsePage(html: string): { events: ScrapedEvent[]; hasNextPage: boolean } {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Falter event cards: <a href="https://www.falter.at/event/ID/slug">
    $('a[href*="/event/"]').each((_, el) => {
      try {
        const href = $(el).attr('href') || '';
        // Must be a full event URL like /event/12345/slug
        if (!href.match(/\/event\/\d+\/[^/]+/)) return;

        // Title — <h2> inside the card
        const title = $(el).find('h2, h3').first().text().trim();
        if (!title) return;

        // Venue — first <div> with tracking-wider class (Falter-specific)
        let venue = '';
        $(el).find('div').each((_, d) => {
          const cls = $(d).attr('class') || '';
          if (cls.includes('tracking-wider') && !venue) {
            venue = $(d).text().replace(/\s+/g, ' ').trim();
          }
        });

        // Date — from <time> element text "Freitag, 27.03.2026 00:00" or "Samstag, 28.03.2026 19:30"
        const timeEl = $(el).find('time').first();
        const timeText = timeEl.text().trim();
        const startDate = this.parseFalterDate(timeText);
        if (!startDate) return;

        // Image
        const imgSrc = $(el).find('img').first().attr('src')
          || $(el).find('img').first().attr('data-src') || '';
        const imageUrl = imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`) : undefined;

        // Extract ID from URL
        const idMatch = href.match(/\/event\/(\d+)\//);
        const eventId = idMatch ? idMatch[1] : href.replace(/\W+/g, '-');
        const eventUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `falter-${eventId}`,
          source_name: this.name,
          source_url: eventUrl,
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

    // Check for next page: Livewire handles pagination but URL param page=N works
    const hasNextPage = html.includes('page=') && $('a[href*="page="]').length > 0;

    return { events, hasNextPage };
  }

  private parseFalterDate(raw: string): string | null {
    if (!raw) return null;

    // ISO format
    if (raw.match(/^\d{4}-\d{2}-\d{2}/)) return raw.slice(0, 19);

    // German: "27. März 2026 19:00"
    const MONTHS: Record<string, string> = {
      'jän': '01', 'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03',
      'apr': '04', 'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'okt': '10', 'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12',
    };
    const m = raw.toLowerCase().match(/(\d{1,2})\.\s*([a-züäö]+)\.?\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const [, d, month, y, h, min] = m;
      const mo = MONTHS[month.slice(0, 3)];
      if (!mo) return null;
      const dateStr = `${y}-${mo}-${d.padStart(2, '0')}`;
      return h ? `${dateStr}T${h.padStart(2, '0')}:${min}:00` : dateStr;
    }

    // Numeric German: "27.3.2026"
    const n = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (n) {
      const [, d, mo, y, h, min] = n;
      const dateStr = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      return h ? `${dateStr}T${h.padStart(2, '0')}:${min}:00` : dateStr;
    }

    return null;
  }
}
