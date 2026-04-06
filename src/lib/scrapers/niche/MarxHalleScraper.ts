import * as cheerio from 'cheerio';
import type { ScrapedEvent } from '@/types/events';
import { BaseScraper } from '../BaseScraper';

/**
 * Marx Halle / Globe Wien Scraper
 *
 * Scrapes events from https://marxhalle.at — a major event venue in Vienna's
 * 3rd district hosting concerts, comedy, galas, trade shows, and cultural events.
 *
 * Strategy:
 * 1. Fetch the WordPress events-sitemap.xml to get all event URLs
 * 2. Scrape each individual event page with Cheerio (SSR-rendered by JetEngine)
 * 3. Extract: title, date, times, description, image, ticket link
 * 4. Only keep future events
 */
export class MarxHalleScraper extends BaseScraper {
  readonly name = 'marxhalle';
  private readonly BASE = 'https://marxhalle.at';
  private readonly SITEMAP_URL = 'https://marxhalle.at/events-sitemap.xml';

  // Fixed venue coordinates (Karl-Farkas-Gasse 19, 1030 Wien)
  private readonly LAT = 48.1872;
  private readonly LNG = 16.4095;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Marx Halle Scraping...');

    // Step 1: Get all event URLs from sitemap
    const eventUrls = await this.fetchEventUrls();
    this.log(`${eventUrls.length} Event-URLs in Sitemap gefunden`);

    // Step 2: Scrape each event page
    const events: ScrapedEvent[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const url of eventUrls) {
      try {
        const event = await this.scrapeEventPage(url);
        if (event && event.start_date >= today) {
          events.push(event);
        }
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Deduplicate by source_id
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);

    const result = Array.from(seen.values());
    this.log(`${result.length} zukünftige Events gescrapt`);
    return result;
  }

  /**
   * Fetches the events-sitemap.xml and extracts all event URLs.
   */
  private async fetchEventUrls(): Promise<string[]> {
    const xml = await this.fetchPage(this.SITEMAP_URL);
    const $ = cheerio.load(xml, { xmlMode: true });

    const urls: string[] = [];
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc.includes('/events/') && loc !== `${this.BASE}/events/`) {
        urls.push(loc);
      }
    });

    return urls;
  }

  /**
   * Scrapes a single event page and returns a ScrapedEvent or null if unparseable.
   */
  private async scrapeEventPage(url: string): Promise<ScrapedEvent | null> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    // Extract dynamic fields rendered by JetEngine
    const dynamicFields: string[] = [];
    $('.jet-listing-dynamic-field__content').each((_, el) => {
      const text = $(el).text().trim();
      if (text) dynamicFields.push(text);
    });

    // First field = title, second field = date (DD.MM.YYYY)
    // Fields may appear duplicated (desktop + mobile template), so use first occurrence
    const title = dynamicFields[0];
    const dateStr = dynamicFields.find(f => /^\d{2}\.\d{2}\.\d{4}$/.test(f));

    if (!title || !dateStr) {
      return null;
    }

    // Parse date: DD.MM.YYYY -> YYYY-MM-DD
    const startDate = this.parseDateDE(dateStr);
    if (!startDate) return null;

    // Extract slug for source_id
    const slug = url.replace(/\/$/, '').split('/').pop() || '';

    // Description from text-editor widgets
    let description = '';
    $('[class*="elementor-element"] .elementor-widget-text-editor p, [class*="elementor-element"] .elementor-text-editor p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !text.includes('Öffnungszeiten') && !text.includes('Veranstaltungsort')) {
        if (!description || text.length > description.length) {
          description = text;
        }
      }
    });

    // Also try jet-listing dynamic fields for longer description
    for (const field of dynamicFields) {
      if (field.length > 80 && field !== title && !/^\d{2}\.\d{2}\.\d{4}$/.test(field)) {
        if (!description || field.length > description.length) {
          description = field;
        }
      }
    }

    // Image from jet-listing-dynamic-image container
    let imageUrl: string | undefined;
    $('[class*="jet-listing-dynamic-image"] img').each((_, el) => {
      if (!imageUrl) {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.includes('wp-content/uploads')) {
          imageUrl = this.cleanImageUrl(src);
        }
      }
    });
    // Fallback: any wp-content image in the main content area
    if (!imageUrl) {
      const imgMatch = html.match(/class="jet-listing-dynamic-image[^"]*"[^>]*>[\s\S]*?src="([^"]+)"/);
      if (imgMatch) {
        imageUrl = this.cleanImageUrl(imgMatch[1]);
      }
    }
    // Fallback: OG image
    if (!imageUrl) {
      imageUrl = this.cleanImageUrl($('meta[property="og:image"]').attr('content'));
    }

    // Times: "Einlass ab HH:MM" / "Beginn HH:MM"
    const timesText = this.extractTimes($, html);

    // Ticket link
    const ticketUrl = this.extractTicketUrl($);

    // Location — check if event is at Globe Wien or Marx Halle
    const locationText = $('body').text();
    const isGlobeWien = locationText.includes('GLOBE WIEN') || locationText.includes('globe.wien');
    const locationName = isGlobeWien ? 'Globe Wien (Marx Halle)' : 'Marx Halle';

    // Build description with times if available
    const fullDesc = [description, timesText].filter(Boolean).join(' | ').slice(0, 500);

    return {
      source_id: `marxhalle-${slug}`,
      source_name: this.name,
      source_url: url,
      title: this.decodeHtmlEntities(title),
      description: fullDesc || undefined,
      start_date: startDate,
      location_name: locationName,
      address: 'Karl-Farkas-Gasse 19, 1030 Wien',
      postal_code: '1030',
      bundesland: 'wien',
      latitude: this.LAT,
      longitude: this.LNG,
      category: this.categorize(title, description),
      image_url: imageUrl,
      ticket_url: ticketUrl,
      tags: ['Wien', 'Marx Halle'],
    };
  }

  /**
   * Parses DD.MM.YYYY to YYYY-MM-DD.
   */
  private parseDateDE(dateStr: string): string | null {
    const m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    const [, day, month, year] = m;
    return `${year}-${month}-${day}`;
  }

  /**
   * Extracts opening times from the page.
   */
  private extractTimes($: cheerio.CheerioAPI, html: string): string {
    const times: string[] = [];
    const einlass = html.match(/Einlass\s+ab\s+[\d:]+\s*(?:Uhr)?/i);
    const beginn = html.match(/Beginn:?\s+[\d:]+\s*(?:Uhr)?/i);
    if (einlass) times.push(einlass[0].trim());
    if (beginn) times.push(beginn[0].trim());
    return times.join(', ');
  }

  /**
   * Finds ticket purchase URL.
   */
  private extractTicketUrl($: cheerio.CheerioAPI): string | undefined {
    // Look for links to ticketing platforms
    const ticketSelectors = [
      'a[href*="globe.wien/programm"]',
      'a[href*="oeticket"]',
      'a[href*="wien-ticket"]',
      'a[href*="ticket"]',
      'a[href*="ntry.at"]',
    ];

    for (const sel of ticketSelectors) {
      const link = $(sel).first().attr('href');
      if (link && link.startsWith('http')) return link;
    }

    return undefined;
  }

  /**
   * Simple category detection based on title/description keywords.
   */
  private categorize(title: string, desc: string): string {
    const text = `${title} ${desc}`.toLowerCase();
    if (/konzert|musik|band|live|dj|electronic|beats/i.test(text)) return 'Musik';
    if (/kabarett|comedy|stand.?up|schmäh|humor/i.test(text)) return 'Kultur';
    if (/messe|fair|expo|markt|market|design|craft/i.test(text)) return 'Business';
    if (/gala|ball|award|preis/i.test(text)) return 'Kultur';
    if (/theater|show|performance|aufführung/i.test(text)) return 'Kultur';
    if (/sport|lauf|marathon|fitness/i.test(text)) return 'Sport';
    return 'Sonstiges';
  }

  /**
   * Decodes HTML entities like &amp; &#8211; etc.
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&#8216;/g, '\u2018')
      .replace(/&#8217;/g, '\u2019')
      .replace(/&#8220;/g, '\u201C')
      .replace(/&#8221;/g, '\u201D')
      .replace(/&quot;/g, '"')
      .replace(/&#038;/g, '&')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—');
  }
}
