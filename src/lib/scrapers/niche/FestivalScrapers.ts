/**
 * Festival Scrapers
 *
 * Sources:
 * - festival.at: Austria-wide festival listing portal
 * - festivalguide.at: Austrian festival guide with structured data
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * festival.at — Austria-wide festival listing portal.
 * Scrapes the events list which uses a standard HTML structure.
 */
export class FestivalAtScraper extends BaseScraper {
  readonly name = 'festival.at';
  private readonly BASE = 'https://www.festival.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte festival.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/festivals`,
      `${this.BASE}/festivals?page=2`,
      `${this.BASE}/festivals?page=3`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, html, url);
        events.push(...pageEvents);
        this.log(`${url}: ${pageEvents.length} Events gescrapt`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.log(`Gesamt: ${events.length} Festival-Events`);
    return events;
  }

  private parsePage($: ReturnType<typeof cheerio.load>, html: string, baseUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const ev = this.parseJsonLdEvent(item, baseUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: common festival listing patterns
    $('article, .festival-item, .event-item, [class*="festival"], [class*="event-card"]').each((_, el) => {
      try {
        const $el = $(el);
        const titleEl = $el.find('h2, h3, h1, .title, [class*="title"]').first();
        const title = titleEl.text().trim();
        if (!title || title.length < 3) return;

        const href = ($el.find('a').first().attr('href') || '').trim();
        const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : baseUrl;

        const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
          || $el.find('[datetime]').attr('datetime') || '';
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        const location = $el.find('.location, .venue, [class*="location"], [class*="venue"]').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        events.push({
          source_id: `festival-at-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: location || 'Österreich',
          category: categorizeEvent(title),
          tags: ['Festival'],
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseJsonLdEvent(item: Record<string, unknown>, baseUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const location = item.location as Record<string, unknown> | undefined;
    const locationName = location ? String(location.name || '') : 'Österreich';

    let imageUrl: string | undefined;
    const img = item.image;
    if (typeof img === 'string') imageUrl = this.cleanImageUrl(this.resolveImageUrl(img, baseUrl));
    else if (typeof img === 'object' && img !== null) {
      const imgObj = img as Record<string, unknown>;
      const u = String(imgObj.url || imgObj.contentUrl || '');
      if (u) imageUrl = this.cleanImageUrl(this.resolveImageUrl(u, baseUrl));
    }

    return {
      source_id: `festival-at-${slug}`,
      source_name: this.name,
      source_url: String(item.url || baseUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: locationName || 'Österreich',
      category: categorizeEvent(name, item.description ? String(item.description) : undefined),
      tags: ['Festival'],
      image_url: imageUrl,
    };
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    // ISO date
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    // DD.MM.YYYY
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // datetime attribute
    const dt = text.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (dt) return dt[1];
    return null;
  }
}

/**
 * festivalguide.at — Austrian festival guide.
 * Scrapes festival listings with date and location data.
 */
export class FestivalGuideScraper extends BaseScraper {
  readonly name = 'festivalguide.at';
  private readonly BASE = 'https://www.festivalguide.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte festivalguide.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/festivals/oesterreich`,
      `${this.BASE}/festivals/oesterreich?page=2`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, html);
        events.push(...pageEvents);
        this.log(`${url}: ${pageEvents.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.log(`Gesamt: ${events.length} Festivals`);
    return events;
  }

  private parsePage($: ReturnType<typeof cheerio.load>, html: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 10);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          events.push({
            source_id: `festivalguide-${slug}`,
            source_name: this.name,
            source_url: String(item.url || this.BASE),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 10) : undefined,
            location_name: 'Österreich',
            category: categorizeEvent(name),
            tags: ['Festival'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('[class*="festival"], [class*="event"], article').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : this.BASE;

      const dateEl = $el.find('time, [datetime], .date').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .city, .ort').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `festivalguide-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        category: categorizeEvent(title),
        tags: ['Festival'],
        image_url: imageUrl,
      });
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }
}
