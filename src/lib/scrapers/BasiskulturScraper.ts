import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * basiskultur.at Scraper (Wien)
 * WordPress with FacetWP — uses WP REST API for paginated event loading.
 * ~201+ events across all 23 Wiener Bezirke.
 */
export class BasiskulturScraper extends BaseScraper {
  readonly name = 'basiskultur';
  private readonly BASE = 'https://www.basiskultur.at';
  private readonly API = 'https://www.basiskultur.at/wp-json/facetwp/v1/refresh';
  private readonly PER_PAGE = 15;
  private readonly MAX_PAGES = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte basiskultur.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // First: load the initial page to get the nonce
    let nonce: string | undefined;
    try {
      const html = await this.fetchPage(`${this.BASE}/veranstaltungen/`);
      const nonceMatch = html.match(/"nonce"\s*:\s*"([a-f0-9]+)"/);
      if (nonceMatch) nonce = nonceMatch[1];

      // Parse events from initial page HTML
      const events = this.parseHtml(html);
      for (const ev of events) allEvents.set(ev.source_id, ev);
      this.log(`Seite 1 (initial): ${events.length} Events`);
    } catch (err) {
      this.log(`Initial page fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    }

    // Then paginate via FacetWP REST API
    for (let page = 2; page <= this.MAX_PAGES; page++) {
      await this.rateLimit();
      try {
        const html = await this.fetchFacetPage(page, nonce);
        if (!html) break;

        const events = this.parseHtml(html);
        if (events.length === 0) break;

        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private async fetchFacetPage(page: number, nonce?: string): Promise<string | null> {
    const body: Record<string, unknown> = {
      action: 'facetwp_refresh',
      data: {
        facets: {},
        frozen_facets: {},
        http_params: {
          get: {},
          uri: 'veranstaltungen',
          url_vars: {},
        },
        template: 'wp',
        extras: {},
        soft_refresh: 0,
        is_bfcache: 0,
        first_load: 0,
        paged: page,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Referer': `${this.BASE}/veranstaltungen/`,
    };
    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }

    const response = await fetch(this.API, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`FacetWP API HTTP ${response.status}`);
    }

    const json = await response.json() as { template?: string; settings?: { pager?: { total_rows?: number } } };
    return json.template || null;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // FacetWP renders event cards inside the template
    // Look for event links pointing to /bk-events/ or general event card patterns
    $('a[href*="/bk-events/"], a[href*="/veranstaltung"], article, .event-card, .event-item').each((_, el) => {
      try {
        const $el = $(el);

        // Find the link
        let href: string;
        let $card = $el;

        if ($el.is('a')) {
          href = $el.attr('href') || '';
        } else {
          const $link = $el.find('a[href*="/bk-events/"], a[href*="/veranstaltung"]').first();
          href = $link.attr('href') || '';
        }

        if (!href || href === '#') return;

        // Extract event ID from URL
        const idMatch = href.match(/\/bk-events\/(\d+)\/?/) || href.match(/\/(\d+)\/?$/);
        const eventId = idMatch ? idMatch[1] : href.replace(/\W+/g, '-').slice(0, 60);

        // Title
        const title = (
          $card.find('h2, h3, h4, .event-title, .entry-title').first().text().trim() ||
          $card.find('strong').first().text().trim() ||
          $card.text().trim().split('\n')[0].trim()
        );
        if (!title || title.length < 3) return;

        // Date
        const cardText = $card.text();
        const startDate = this.parseDate(cardText);
        if (!startDate) return;

        // Image
        const $img = $card.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
        const imageUrl = this.cleanImageUrl(
          imgSrc.startsWith('http') ? imgSrc : imgSrc.startsWith('/') ? `${this.BASE}${imgSrc}` : undefined
        );

        // Description
        const $desc = $card.find('p, .event-description, .entry-content, .excerpt').first();
        const description = $desc.text().trim().slice(0, 500) || undefined;

        // District / Bezirk from card text
        const bezirkMatch = cardText.match(/(\d{4})\s+Wien/);
        const postalCode = bezirkMatch ? bezirkMatch[1] : undefined;
        const district = postalCode ? this.postalCodeToDistrict(postalCode) : undefined;

        // Location
        const locationName = $card.find('.event-location, .location, .venue').first().text().trim() || undefined;

        // Category / Genre
        const genre = $card.find('.event-category, .genre, .category, .tag, .badge').first().text().trim() || undefined;

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `basiskultur-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          description,
          start_date: startDate,
          location_name: locationName,
          postal_code: postalCode,
          district,
          bundesland: 'wien',
          category: categorizeEvent(title, description, genre ? [genre] : undefined),
          image_url: imageUrl,
        });
      } catch { /* skip invalid entries */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    // Try DD.MM.YYYY
    const dotDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotDate) {
      return `${dotDate[3]}-${dotDate[2].padStart(2, '0')}-${dotDate[1].padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD
    const isoDate = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
    }

    return null;
  }

  private postalCodeToDistrict(plz: string): string | undefined {
    // Wien PLZ: 1010 = 1. Bezirk, 1020 = 2. Bezirk, etc.
    if (plz.startsWith('1') && plz.length === 4) {
      const bezirk = parseInt(plz.slice(1, 3), 10);
      if (bezirk >= 1 && bezirk <= 23) {
        return `${bezirk}. Bezirk`;
      }
    }
    return undefined;
  }
}
