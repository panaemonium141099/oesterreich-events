/**
 * tips.at Event Scraper
 *
 * Source: tips.at/events — Regional media portal with event listings,
 * focused on Oberösterreich but covering other Bundesländer too.
 * Uses AJAX POST for "load more" pagination and JSON-LD on detail pages.
 *
 * Estimated yield: 100-500+ events
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

export class TipsAtScraper extends BaseScraper {
  readonly name = 'tips.at';
  private readonly BASE = 'https://www.tips.at';
  private readonly LISTING_URL = 'https://www.tips.at/veranstaltungen';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte tips.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Scrape the main listing pages (paginated)
    const pages = [
      this.LISTING_URL,
      `${this.LISTING_URL}?page=2`,
      `${this.LISTING_URL}?page=3`,
      `${this.LISTING_URL}?page=4`,
      `${this.LISTING_URL}?page=5`,
    ];

    const detailUrls: string[] = [];

    for (const pageUrl of pages) {
      try {
        const html = await this.fetchPage(pageUrl);
        const $ = cheerio.load(html);

        // Extract event listing links
        $('a[href*="/veranstaltungen/"], a[href*="/events/"]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          const url = href.startsWith('http') ? href : `${this.BASE}${href}`;
          // Only detail pages (not listing/category pages)
          if (url.includes('/veranstaltungen/') && !url.endsWith('/veranstaltungen/') && !url.includes('?page=')) {
            detailUrls.push(url);
          }
        });

        // Also try to parse events from the listing page directly
        const listEvents = this.parseListingPage($, pageUrl);
        events.push(...listEvents);

        this.log(`${pageUrl}: ${listEvents.length} events from listing, ${detailUrls.length} detail links found`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${pageUrl}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Dedupe detail URLs
    const uniqueDetailUrls = [...new Set(detailUrls)];
    this.log(`${uniqueDetailUrls.length} unique detail URLs to crawl`);

    // Crawl detail pages for JSON-LD enrichment (limit to first 200)
    const maxDetails = Math.min(uniqueDetailUrls.length, 200);
    for (let i = 0; i < maxDetails; i++) {
      const detailUrl = uniqueDetailUrls[i];
      try {
        const html = await this.fetchPage(detailUrl);
        const $ = cheerio.load(html);
        const detailEvents = this.parseDetailPage($, detailUrl);
        events.push(...detailEvents);

        if ((i + 1) % 20 === 0) {
          this.log(`Detail page progress: ${i + 1}/${maxDetails}`);
        }
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei Detail ${detailUrl}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Deduplicate by source_id
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) {
      if (!seen.has(ev.source_id)) {
        seen.set(ev.source_id, ev);
      }
    }

    this.log(`Gesamt: ${seen.size} Events`);
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
          if (!item || item['@type'] !== 'Event') continue;
          const ev = this.jsonLdToEvent(item, pageUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: parse event cards
    $('article, .event-item, .event-card, [class*="event"], [class*="veranstaltung"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, .datum, [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, .venue, [class*="location"], [class*="ort"]').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `tips-${slug}-${startDate.slice(0, 10)}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || undefined,
        bundesland: this.detectBundesland(sourceUrl, location),
        category: categorizeEvent(title),
        image_url: imageUrl,
        tags: ['Veranstaltung'],
      });
    });

    return events;
  }

  private parseDetailPage($: ReturnType<typeof cheerio.load>, detailUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD parsing (tips.at detail pages usually have Event schema)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const ev = this.jsonLdToEvent(item, detailUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback for detail page
    const title = $('h1').first().text().trim();
    if (!title || title.length < 3) return events;

    const dateEl = $('time, [datetime], .date, .datum').first();
    const dateText = dateEl.attr('datetime') || dateEl.text().trim();
    const startDate = this.parseDate(dateText);
    if (!startDate) return events;

    const description = $('meta[name="description"]').attr('content')
      || $('[class*="description"], .content, article p').first().text().trim().slice(0, 500);
    const imageUrl = this.extractImageUrl($, detailUrl);

    const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    events.push({
      source_id: `tips-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: detailUrl,
      title,
      description: description || undefined,
      start_date: startDate,
      bundesland: this.detectBundesland(detailUrl, ''),
      category: categorizeEvent(title),
      image_url: imageUrl,
      tags: ['Veranstaltung'],
    });

    return events;
  }

  private jsonLdToEvent(item: Record<string, unknown>, pageUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate || startDate.length < 10) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const location = item.location as Record<string, unknown> | undefined;
    const address = location?.address as Record<string, unknown> | string | undefined;

    let locationName: string | undefined;
    let addressText: string | undefined;
    let postalCode: string | undefined;
    let bundesland: string | undefined;

    if (location) {
      locationName = String(location.name || '').trim() || undefined;
      if (typeof address === 'string') {
        addressText = address;
      } else if (address && typeof address === 'object') {
        addressText = String((address as Record<string, unknown>).streetAddress || '').trim() || undefined;
        postalCode = String((address as Record<string, unknown>).postalCode || '').trim() || undefined;
        const region = String((address as Record<string, unknown>).addressRegion || '').trim();
        bundesland = this.regionToBundesland(region);
      }
    }

    // Extract ticket URL if present
    const offers = item.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
    let ticketUrl: string | undefined;
    let priceText: string | undefined;
    if (offers) {
      const offerList = Array.isArray(offers) ? offers : [offers];
      for (const offer of offerList) {
        if (offer.url) ticketUrl = String(offer.url);
        if (offer.price) priceText = `${offer.price} ${offer.priceCurrency || 'EUR'}`;
      }
    }

    // Image
    let imageUrl: string | undefined;
    const img = item.image;
    if (typeof img === 'string') {
      imageUrl = this.cleanImageUrl(img);
    } else if (Array.isArray(img) && img.length > 0) {
      const first = img[0];
      imageUrl = this.cleanImageUrl(typeof first === 'string' ? first : first?.url || first?.contentUrl);
    } else if (img && typeof img === 'object') {
      imageUrl = this.cleanImageUrl((img as Record<string, unknown>).url as string || (img as Record<string, unknown>).contentUrl as string);
    }

    return {
      source_id: `tips-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: String(item.url || pageUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: locationName,
      address: addressText,
      postal_code: postalCode,
      bundesland: bundesland || this.detectBundesland(String(item.url || pageUrl), locationName || ''),
      category: categorizeEvent(name),
      price_text: priceText,
      image_url: imageUrl,
      ticket_url: ticketUrl,
      tags: ['Veranstaltung'],
    };
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    // ISO format
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    // DD.MM.YYYY
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }

  private detectBundesland(url: string, location: string): string {
    const combined = `${url} ${location}`.toLowerCase();
    if (combined.includes('linz') || combined.includes('wels') || combined.includes('steyr') || combined.includes('oberösterreich') || combined.includes('oberoesterreich')) return 'oberoesterreich';
    if (combined.includes('wien') || combined.includes('vienna')) return 'wien';
    if (combined.includes('graz') || combined.includes('steiermark')) return 'steiermark';
    if (combined.includes('salzburg')) return 'salzburg';
    if (combined.includes('innsbruck') || combined.includes('tirol')) return 'tirol';
    if (combined.includes('klagenfurt') || combined.includes('kärnten') || combined.includes('kaernten')) return 'kaernten';
    if (combined.includes('bregenz') || combined.includes('vorarlberg')) return 'vorarlberg';
    if (combined.includes('eisenstadt') || combined.includes('burgenland')) return 'burgenland';
    if (combined.includes('niederösterreich') || combined.includes('niederoesterreich') || combined.includes('st. pölten')) return 'niederoesterreich';
    // tips.at is primarily OÖ
    return 'oberoesterreich';
  }

  private regionToBundesland(region: string): string | undefined {
    if (!region) return undefined;
    const r = region.toLowerCase();
    if (r.includes('oberösterreich') || r.includes('upper austria')) return 'oberoesterreich';
    if (r.includes('niederösterreich') || r.includes('lower austria')) return 'niederoesterreich';
    if (r.includes('wien') || r.includes('vienna')) return 'wien';
    if (r.includes('steiermark') || r.includes('styria')) return 'steiermark';
    if (r.includes('salzburg')) return 'salzburg';
    if (r.includes('tirol') || r.includes('tyrol')) return 'tirol';
    if (r.includes('kärnten') || r.includes('carinthia')) return 'kaernten';
    if (r.includes('vorarlberg')) return 'vorarlberg';
    if (r.includes('burgenland')) return 'burgenland';
    return undefined;
  }
}
