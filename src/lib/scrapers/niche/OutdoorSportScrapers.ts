/**
 * Outdoor & Sport Scrapers
 *
 * Sources:
 * - naturfreunde.at: Naturfreunde Österreich — hiking, outdoor events
 * - alpenverein.at: Österreichischer Alpenverein — mountaineering, climbing events
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categorize';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../../connectors/json-ld-connector';

/**
 * naturfreunde.at — Naturfreunde Österreich outdoor events.
 * Covers hiking, cycling, climbing, and nature events Austria-wide.
 */
export class NaturfreundeScraper extends BaseScraper {
  readonly name = 'naturfreunde.at';
  private readonly BASE = 'https://www.naturfreunde.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte naturfreunde.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/veranstaltungen?page=2`,
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

    this.log(`Gesamt: ${events.length} Outdoor-Events`);
    return events;
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || !isEventType(item['@type'])) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          events.push({
            source_id: `naturfreunde-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: location ? String(location.name || '') : 'Österreich',
            category: categorizeEvent(name),
            tags: ['Outdoor', 'Sport'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, [class*="veranstaltung"], [class*="event"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, [class*="ort"]').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `naturfreunde-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        category: categorizeEvent(title),
        tags: ['Outdoor', 'Sport'],
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

/**
 * alpenverein.at — Austrian Alpine Club events.
 * Covers mountaineering, hiking, climbing courses and tours across Austria.
 */
export class AlpenvereinScraper extends BaseScraper {
  readonly name = 'alpenverein.at';
  private readonly BASE = 'https://www.alpenverein.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte alpenverein.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/kurse-touren/touren`,
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
    this.log(`Gesamt: ${seen.size} Alpenverein-Events`);
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
          if (!item || !isEventType(item['@type'])) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const imageUrl = this.extractJsonLdImage(item, pageUrl);
          events.push({
            source_id: `alpenverein-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: location ? String(location.name || '') : 'Österreich',
            category: categorizeEvent(name),
            tags: ['Outdoor', 'Sport'],
            image_url: imageUrl,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .tour, .kurs, [class*="event"], [class*="veranstaltung"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, .region').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `alpenverein-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        category: categorizeEvent(title),
        tags: ['Outdoor', 'Sport'],
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
