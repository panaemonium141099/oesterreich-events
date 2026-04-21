/**
 * bergfex.at Event Scraper
 *
 * Source: bergfex.at/sommer/oesterreich/veranstaltungen/ — Mountain/outdoor event portal.
 * Covers all Austrian regions with outdoor, sport, and mountain events.
 * Simple page-based pagination with ~45-50 events per page.
 *
 * Estimated yield: 200-250 events
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

export class BergfexScraper extends BaseScraper {
  readonly name = 'bergfex.at';
  private readonly BASE = 'https://www.bergfex.at';
  private readonly LISTING_BASE = 'https://www.bergfex.at/sommer/oesterreich/veranstaltungen/';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte bergfex.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Paginated listing pages
    const maxPages = 6;
    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? this.LISTING_BASE : `${this.LISTING_BASE}?page=${page}`;
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parseListingPage($, url);
        events.push(...pageEvents);
        this.log(`Seite ${page}: ${pageEvents.length} Events`);

        // Stop if no events found (end of pagination)
        if (pageEvents.length === 0) break;

        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei Seite ${page}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Deduplicate by source_id
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) {
      if (!seen.has(ev.source_id)) {
        seen.set(ev.source_id, ev);
      }
    }

    this.log(`Gesamt: ${seen.size} Outdoor/Berg-Events`);
    return Array.from(seen.values());
  }

  private parseListingPage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || !isEventType(item['@type'])) continue;
          const ev = this.jsonLdToEvent(item, pageUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: parse event listing items
    // bergfex uses a structured listing with event cards
    $('article, .event, .event-item, [class*="veranstaltung"], .list-item, .listitem, tr.event, .event-row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, a.title, .event-title, .name, a[class*="title"]').first().text().trim()
        || $el.find('a').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      // Date parsing
      const dateEl = $el.find('time, [datetime], .date, .datum, .event-date, [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      // Location/region
      const locationText = $el.find('.location, .ort, .region, [class*="location"], [class*="region"], [class*="ort"]').first().text().trim();

      // Image
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      // Description
      const description = $el.find('.description, .text, .teaser, p').first().text().trim().slice(0, 500) || undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      const bundesland = this.detectBundesland(locationText, sourceUrl);

      events.push({
        source_id: `bergfex-${slug}-${startDate.slice(0, 10)}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description,
        start_date: startDate,
        location_name: locationText || undefined,
        bundesland,
        category: this.categorizeOutdoor(title),
        image_url: imageUrl,
        tags: ['Outdoor', 'Berg', 'Sport'],
      });
    });

    // Also try parsing links that look like event detail links
    if (events.length === 0) {
      $('a[href*="/veranstaltungen/"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const title = $a.text().trim();
        if (!title || title.length < 5) return;
        // Skip navigation links
        if (title.toLowerCase().includes('mehr') || title.toLowerCase().includes('alle')) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        // Try to find date in parent/sibling elements
        const parent = $a.parent();
        const dateText = parent.find('time, .date, .datum').first().text().trim()
          || parent.text().match(/\d{1,2}\.\d{1,2}\.\d{4}/)?.[0] || '';
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        events.push({
          source_id: `bergfex-${slug}-${startDate.slice(0, 10)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          bundesland: this.detectBundesland('', sourceUrl),
          category: this.categorizeOutdoor(title),
          tags: ['Outdoor', 'Berg', 'Sport'],
        });
      });
    }

    return events;
  }

  private jsonLdToEvent(item: Record<string, unknown>, pageUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate || startDate.length < 10) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const location = item.location as Record<string, unknown> | undefined;

    let locationName: string | undefined;
    let bundesland: string | undefined;

    if (location) {
      locationName = String(location.name || '').trim() || undefined;
      const address = location.address as Record<string, unknown> | undefined;
      if (address) {
        const region = String(address.addressRegion || '').trim();
        bundesland = this.regionToBundesland(region);
      }
    }

    let imageUrl: string | undefined;
    const img = item.image;
    if (typeof img === 'string') {
      imageUrl = this.cleanImageUrl(img);
    } else if (Array.isArray(img) && img.length > 0) {
      const first = img[0];
      imageUrl = this.cleanImageUrl(typeof first === 'string' ? first : first?.url);
    } else if (img && typeof img === 'object') {
      imageUrl = this.cleanImageUrl((img as Record<string, unknown>).url as string);
    }

    return {
      source_id: `bergfex-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: String(item.url || pageUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: locationName,
      bundesland: bundesland || this.detectBundesland(locationName || '', String(item.url || pageUrl)),
      category: this.categorizeOutdoor(name),
      image_url: imageUrl,
      tags: ['Outdoor', 'Berg', 'Sport'],
    };
  }

  private categorizeOutdoor(title: string): string {
    const t = title.toLowerCase();
    // Sport-specific keywords
    if (/lauf|run|marathon|trail|radrennen|radsport|bike|triathlon|schwimm|ski|langlauf|biathlon/.test(t)) return 'Sport';
    // Nature/hiking keywords
    if (/wander|hike|alm|berg|gipfel|natur|flora|fauna|kräuter|botanik/.test(t)) return 'Natur';
    // Use general categorizer as fallback
    return categorizeEvent(title);
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }

  private detectBundesland(location: string, url: string): string | undefined {
    const combined = `${location} ${url}`.toLowerCase();

    // Region-specific URL segments from bergfex
    if (combined.includes('tirol') || combined.includes('innsbruck') || combined.includes('kitzbuehel') || combined.includes('zillertal') || combined.includes('stubaital') || combined.includes('oetztal')) return 'tirol';
    if (combined.includes('salzburg') || combined.includes('gastein') || combined.includes('pinzgau') || combined.includes('lungau') || combined.includes('pongau')) return 'salzburg';
    if (combined.includes('vorarlberg') || combined.includes('bregenz') || combined.includes('montafon') || combined.includes('arlberg') || combined.includes('bregenzerwald')) return 'vorarlberg';
    if (combined.includes('kaernten') || combined.includes('kärnten') || combined.includes('klagenfurt') || combined.includes('villach') || combined.includes('nassfeld') || combined.includes('wörthersee')) return 'kaernten';
    if (combined.includes('steiermark') || combined.includes('graz') || combined.includes('schladming') || combined.includes('dachstein')) return 'steiermark';
    if (combined.includes('oberoesterreich') || combined.includes('oberösterreich') || combined.includes('linz') || combined.includes('salzkammergut')) return 'oberoesterreich';
    if (combined.includes('niederoesterreich') || combined.includes('niederösterreich') || combined.includes('wachau') || combined.includes('semmering')) return 'niederoesterreich';
    if (combined.includes('burgenland') || combined.includes('neusiedl')) return 'burgenland';
    if (combined.includes('wien') || combined.includes('vienna')) return 'wien';

    return undefined;
  }

  private regionToBundesland(region: string): string | undefined {
    if (!region) return undefined;
    const r = region.toLowerCase();
    if (r.includes('tirol') || r.includes('tyrol')) return 'tirol';
    if (r.includes('salzburg')) return 'salzburg';
    if (r.includes('vorarlberg')) return 'vorarlberg';
    if (r.includes('kärnten') || r.includes('carinthia')) return 'kaernten';
    if (r.includes('steiermark') || r.includes('styria')) return 'steiermark';
    if (r.includes('oberösterreich') || r.includes('upper austria')) return 'oberoesterreich';
    if (r.includes('niederösterreich') || r.includes('lower austria')) return 'niederoesterreich';
    if (r.includes('burgenland')) return 'burgenland';
    if (r.includes('wien') || r.includes('vienna')) return 'wien';
    return undefined;
  }
}
