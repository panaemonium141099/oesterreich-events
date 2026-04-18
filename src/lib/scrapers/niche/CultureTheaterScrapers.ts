/**
 * Culture & Theater Scrapers
 *
 * Sources:
 * - bundestheater.at: Austrian Federal Theaters (Burgtheater, Staatsoper, Volksoper, Akademietheater)
 * - theater.at: Austria-wide theater listing portal
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * bundestheater.at — Austrian Federal Theaters.
 * Covers Burgtheater, Staatsoper, Volksoper, Akademietheater.
 * Uses JSON-LD structured data on the spielplan (schedule) pages.
 */
export class BundestheaterScraper extends BaseScraper {
  readonly name = 'bundestheater.at';
  private readonly BASE = 'https://www.bundestheater.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte bundestheater.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Each federal theater has its own spielplan
    const theaterUrls = [
      { url: `${this.BASE}/burgtheater/spielplan`, venue: 'Burgtheater Wien', lat: 48.2063, lon: 16.3617 },
      { url: `${this.BASE}/staatsoper/spielplan`, venue: 'Wiener Staatsoper', lat: 48.2033, lon: 16.3694 },
      { url: `${this.BASE}/volksoper/spielplan`, venue: 'Volksoper Wien', lat: 48.2265, lon: 16.3560 },
    ];

    for (const { url, venue, lat, lon } of theaterUrls) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, url, venue, lat, lon);
        events.push(...pageEvents);
        this.log(`${venue}: ${pageEvents.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.log(`Gesamt: ${events.length} Bundestheater-Events`);
    return events;
  }

  private parsePage(
    $: ReturnType<typeof cheerio.load>,
    pageUrl: string,
    defaultVenue: string,
    defaultLat: number,
    defaultLon: number,
  ): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const imageUrl = this.extractJsonLdImage(item, pageUrl);
          events.push({
            source_id: `bundestheater-${slug}-${startDate.slice(0, 10)}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: defaultVenue,
            latitude: defaultLat,
            longitude: defaultLon,
            bundesland: 'wien',
            category: categorizeEvent(name),
            tags: ['Theater', 'Kultur'],
            image_url: imageUrl,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: common theater schedule table/list patterns
    $('[class*="spielplan"], [class*="schedule"], [class*="event"], article').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title, [class*="title"], [class*="stueck"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="datum"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `bundestheater-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: defaultVenue,
        latitude: defaultLat,
        longitude: defaultLon,
        bundesland: 'wien',
        category: categorizeEvent(title),
        tags: ['Theater', 'Kultur'],
        image_url: imageUrl,
      });
    });

    return events;
  }

  private extractJsonLdImage(item: Record<string, unknown>, baseUrl: string): string | undefined {
    const img = item.image;
    if (!img) return undefined;
    if (typeof img === 'string') return this.cleanImageUrl(this.resolveImageUrl(img, baseUrl));
    if (typeof img === 'object' && img !== null) {
      const imgObj = img as Record<string, unknown>;
      const u = String(imgObj.url || imgObj.contentUrl || '');
      if (u) return this.cleanImageUrl(this.resolveImageUrl(u, baseUrl));
    }
    return undefined;
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

/**
 * theater.at — Austria-wide theater listing portal.
 * Aggregates events from Austrian theaters and cultural venues.
 */
export class TheaterAtScraper extends BaseScraper {
  readonly name = 'theater.at';
  private readonly BASE = 'https://www.theater.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte theater.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/spielplan`,
      `${this.BASE}/spielplan?seite=2`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, url);
        events.push(...pageEvents);
        this.log(`${url}: ${pageEvents.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    this.log(`Gesamt: ${seen.size} Theater-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          events.push({
            source_id: `theater-at-${slug}-${startDate.slice(0, 10)}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: location ? String(location.name || '') : 'Österreich',
            category: categorizeEvent(name),
            tags: ['Theater', 'Kultur'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, [class*="vorstellung"], [class*="event"], [class*="spielplan-item"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title, .stueck-titel').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.theater, .venue, .spielstaette').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `theater-at-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        category: categorizeEvent(title),
        tags: ['Theater', 'Kultur'],
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
