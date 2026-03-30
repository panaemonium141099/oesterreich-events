import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * events.tt.com Scraper (Tiroler Tageszeitung)
 * REST API for all of Tirol. Covers all 9 Bezirke.
 * ~500+ events.
 */
export class EventsTTScraper extends BaseScraper {
  readonly name = 'events.tt';
  private readonly API_BASE = 'https://events.tt.com/api/v1';
  private readonly MAX_PAGES = 30;
  private readonly PER_PAGE = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte events.tt.com API Scraping (ganz Tirol)...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      try {
        const url = `${this.API_BASE}/events?page=${page}&per_page=${this.PER_PAGE}&region=tirol`;
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.userAgent,
          },
        });

        if (!response.ok) {
          // Try alternative API format
          if (page === 1) {
            this.log(`API v1 nicht verfügbar (${response.status}), versuche alternatives Format...`);
            return this.scrapeAlternative();
          }
          break;
        }

        const data = await response.json() as Record<string, unknown>;
        const events = this.parseApiResponse(data);

        if (events.length === 0) break;
        for (const ev of events) allEvents.set(ev.source_id, ev);

        if (page % 5 === 0) this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
        await this.sleep(500);
      } catch (err) {
        if (page === 1) {
          this.log(`API Fehler: ${err instanceof Error ? err.message : err}, versuche Alternative...`);
          return this.scrapeAlternative();
        }
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseApiResponse(data: Record<string, unknown>): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const items = (data.data || data.events || data.results || data) as Record<string, unknown>[];
    if (!Array.isArray(items)) return events;

    for (const item of items) {
      try {
        const title = String(item.title || item.name || '').trim();
        if (!title) continue;

        const startDate = String(item.start_date || item.startDate || item.date || '').slice(0, 19);
        if (!startDate) continue;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const id = item.id ? String(item.id) : slug;

        const location = item.location as Record<string, unknown> | undefined;
        const venue = item.venue as Record<string, unknown> | undefined;
        const loc = location || venue;

        events.push({
          source_id: `events-tt-${id}`,
          source_name: this.name,
          source_url: item.url ? String(item.url) : `https://events.tt.com/event/${id}`,
          title,
          description: item.description ? String(item.description).slice(0, 500) : undefined,
          start_date: startDate,
          end_date: item.end_date || item.endDate ? String(item.end_date || item.endDate).slice(0, 19) : undefined,
          location_name: loc?.name ? String(loc.name) : undefined,
          address: loc?.address ? String(loc.address) : undefined,
          latitude: loc?.latitude ? Number(loc.latitude) : (loc?.lat ? Number(loc.lat) : undefined),
          longitude: loc?.longitude ? Number(loc.longitude) : (loc?.lng ? Number(loc.lng) : undefined),
          bundesland: 'tirol',
          category: categorizeEvent(title, item.description ? String(item.description) : undefined),
          image_url: item.image ? this.cleanImageUrl(String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '')) : undefined,
        });
      } catch { /* skip */ }
    }

    return events;
  }

  // Fallback: scrape HTML if API is not available
  private async scrapeAlternative(): Promise<ScrapedEvent[]> {
    const cheerio = await import('cheerio');
    const allEvents = new Map<string, ScrapedEvent>();

    const url = 'https://events.tt.com';
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      $('a[href*="/event/"]').each((_, el) => {
        try {
          const $link = $(el);
          const href = $link.attr('href') || '';
          if (!href.match(/\/event\/[a-z0-9-]/i)) return;

          const $card = $link.closest('div, article, li').first();
          let title = $card.find('h2, h3, h4').first().text().trim();
          if (!title) title = $link.text().trim().split('\n')[0].trim();
          if (!title || title.length < 3) return;

          const cardText = $card.text();
          const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (!dateMatch) return;

          const slug = href.split('/').filter(Boolean).pop() || title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

          const sourceUrl = href.startsWith('http') ? href : `https://events.tt.com${href}`;

          allEvents.set(slug, {
            source_id: `events-tt-${slug}`,
            source_name: this.name,
            source_url: sourceUrl,
            title,
            start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
            bundesland: 'tirol',
            category: categorizeEvent(title),
          });
        } catch { /* skip */ }
      });
    } catch (err) {
      this.log(`Alternative auch fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    }

    return Array.from(allEvents.values());
  }
}
