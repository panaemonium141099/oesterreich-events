/**
 * Nightlife / Club Scrapers
 *
 * Sources:
 * - residentadvisor.net/austria: Austria club events (RA Austria)
 * - clubmap.at: Austrian club directory and events
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categories';
import type { ScrapedEvent } from '@/types/events';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', mär: '03', apr: '04',
  may: '05', mai: '05', jun: '06', jul: '07',
  aug: '08', sep: '09', oct: '10', okt: '10',
  nov: '11', dec: '12', dez: '12',
};

/**
 * Resident Advisor Austria — scrapes electronic music / club events in Austria.
 * Uses RA's Austria guide page which lists upcoming events with JSON-LD.
 */
export class ResidentAdvisorAustriaScraper extends BaseScraper {
  readonly name = 'ra.co/austria';
  private readonly BASE = 'https://ra.co';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Resident Advisor Austria Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/events/at`,
      `${this.BASE}/events/at/wien`,
      `${this.BASE}/events/at/graz`,
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

    // Deduplicate by source_id
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);

    this.log(`Gesamt: ${seen.size} Nightlife-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD structured events
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) return;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) return;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locationName = location ? String(location.name || '') : 'Österreich';
          let imageUrl: string | undefined;
          const img = item.image;
          if (typeof img === 'string') imageUrl = this.cleanImageUrl(img);
          else if (img && typeof img === 'object') {
            const imgObj = img as Record<string, unknown>;
            const u = String(imgObj.url || imgObj.contentUrl || '');
            if (u) imageUrl = this.cleanImageUrl(u);
          }
          events.push({
            source_id: `ra-austria-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locationName,
            category: categorizeEvent(name),
            tags: ['Nightlife'],
            image_url: imageUrl,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('[class*="event"], article, li[class*="listing"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, [class*="title"], [class*="name"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('[class*="venue"], [class*="location"]').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `ra-austria-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        category: categorizeEvent(title),
        tags: ['Nightlife'],
        image_url: imageUrl,
      });
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const m = text.match(/(\d{1,2})\s+([A-Za-zä]+)\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }
}

/**
 * clubmap.at — Austrian club directory with events per venue.
 * Scrapes Vienna, Graz, and Linz club events.
 */
export class ClubmapScraper extends BaseScraper {
  readonly name = 'clubmap.at';
  private readonly BASE = 'https://www.clubmap.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte clubmap.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/events/wien`,
      `${this.BASE}/events/graz`,
      `${this.BASE}/events/linz`,
      `${this.BASE}/events/salzburg`,
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
    this.log(`Gesamt: ${seen.size} Club-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const city = pageUrl.split('/').pop() || 'wien';

    $('[class*="event"], article, .listing-item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title, [class*="name"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const venue = $el.find('[class*="venue"], [class*="club"]').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = `${city}-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 50)}`;
      events.push({
        source_id: `clubmap-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: venue || city.charAt(0).toUpperCase() + city.slice(1),
        category: categorizeEvent(title),
        tags: ['Nightlife'],
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
