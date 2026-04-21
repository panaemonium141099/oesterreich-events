import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

/**
 * linztermine.at Scraper
 * Official Linz city event calendar. SSR with JSON-LD on detail pages.
 * Has GPS coordinates in structured data!
 */
export class LinzTermineScraper extends BaseScraper {
  readonly name = 'linztermine';
  private readonly BASE = 'https://www.linztermine.at';
  private readonly MAX_PAGES = 30;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte linztermine.at Scraping...');
    const allEventUrls = new Set<string>();

    // Collect event URLs from listing pages
    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = `${this.BASE}/suche.xhtml?page=${page}`;
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        let found = 0;

        $('a[href*="/event/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          if (href.match(/\/event\/\d+/)) {
            const fullUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;
            allEventUrls.add(fullUrl);
            found++;
          }
        });

        if (found === 0) break;
        this.log(`Seite ${page}: ${found} Event-Links (gesamt: ${allEventUrls.size})`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    this.log(`${allEventUrls.size} Event-URLs gefunden, scrape Details...`);

    // Scrape detail pages for JSON-LD
    const events: ScrapedEvent[] = [];
    let i = 0;
    for (const url of allEventUrls) {
      i++;
      try {
        const html = await this.fetchPage(url);
        const ev = this.parseDetailPage(html, url);
        if (ev) events.push(ev);
        if (i % 50 === 0) this.log(`Detail ${i}/${allEventUrls.size}`);
        await this.sleep(800);
      } catch { /* skip */ }
    }

    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseDetailPage(html: string, url: string): ScrapedEvent | null {
    const $ = cheerio.load(html);

    // Try JSON-LD first
    let jsonLdEvent: Record<string, unknown> | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] || [json];
        for (const item of items) {
          if (isEventType(item['@type'])) {
            jsonLdEvent = item;
            return false;
          }
        }
      } catch {}
    });

    if (jsonLdEvent) {
      const ev = jsonLdEvent as Record<string, unknown>;
      const name = String(ev.name || '').trim();
      if (!name) return null;

      const startDate = String(ev.startDate || '').slice(0, 19);
      if (!startDate) return null;

      const idMatch = url.match(/\/event\/(\d+)/);
      const eventId = idMatch ? idMatch[1] : name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

      const location = ev.location as Record<string, unknown> | undefined;
      const geo = location?.geo as Record<string, unknown> | undefined;

      return {
        source_id: `linztermine-${eventId}`,
        source_name: this.name,
        source_url: url,
        title: name,
        description: ev.description ? String(ev.description).slice(0, 500) : undefined,
        start_date: startDate,
        end_date: ev.endDate ? String(ev.endDate).slice(0, 19) : undefined,
        location_name: location?.name ? String(location.name) : undefined,
        address: location?.address ? (typeof location.address === 'string' ? location.address : String((location.address as Record<string, unknown>).streetAddress || '')) : undefined,
        latitude: geo?.latitude ? Number(geo.latitude) : undefined,
        longitude: geo?.longitude ? Number(geo.longitude) : undefined,
        bundesland: 'oberoesterreich',
        district: 'Linz',
        category: categorizeEvent(name, ev.description ? String(ev.description) : undefined),
        image_url: ev.image ? String(typeof ev.image === 'string' ? ev.image : (ev.image as Record<string, unknown>).url || '') : undefined,
      };
    }

    // Fallback: parse HTML
    const title = $('h1').first().text().trim();
    if (!title) return null;

    const idMatch = url.match(/\/event\/(\d+)/);
    const eventId = idMatch ? idMatch[1] : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

    const bodyText = $('body').text();
    const dateMatch = bodyText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!dateMatch) return null;

    return {
      source_id: `linztermine-${eventId}`,
      source_name: this.name,
      source_url: url,
      title,
      start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
      bundesland: 'oberoesterreich',
      district: 'Linz',
      latitude: 48.3069,
      longitude: 14.2858,
      category: categorizeEvent(title),
    };
  }
}
