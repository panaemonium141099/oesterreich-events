import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * graztourismus.at Scraper
 * Official Graz tourism event calendar. SSR with JSON-LD.
 * Pagination via page parameter, ~100+ events.
 */
export class GrazTourismusScraper extends BaseScraper {
  readonly name = 'graztourismus';
  private readonly BASE = 'https://www.graztourismus.at';
  private readonly LIST_URL = 'https://www.graztourismus.at/en/events/event-calendar';
  private readonly MAX_PAGES = 15;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte graztourismus.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1 ? this.LIST_URL : `${this.LIST_URL}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        // Try JSON-LD first
        const jsonLdEvents = this.parseJsonLd(html);
        const htmlEvents = this.parseHtml(html);
        const events = jsonLdEvents.length > 0 ? jsonLdEvents : htmlEvents;

        if (events.length === 0) break;

        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
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
          const location = item.location as Record<string, unknown> | undefined;

          events.push({
            source_id: `graz-${slug}`,
            source_name: this.name,
            source_url: item.url ? String(item.url) : this.LIST_URL,
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            location_name: location?.name ? String(location.name) : 'Graz',
            bundesland: 'steiermark',
            latitude: 47.0707,
            longitude: 15.4395,
            category: categorizeEvent(name, item.description ? String(item.description) : undefined),
            image_url: item.image ? String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '') : undefined,
          });
        }
      } catch {}
    });

    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="_evt_"], a[href*="/event/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const $card = $link.closest('div, article, li').first();

        let title = $card.find('h2, h3, h4').first().text().trim();
        if (!title) title = $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3) return;

        const idMatch = href.match(/_evt_(\d+)/);
        const eventId = idMatch ? idMatch[1] : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const cardText = $card.text();
        const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!dateMatch) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `graz-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
          bundesland: 'steiermark',
          latitude: 47.0707,
          longitude: 15.4395,
          category: categorizeEvent(title),
        });
      } catch {}
    });

    return events;
  }
}
