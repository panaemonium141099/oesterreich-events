/**
 * Concert House Scrapers
 *
 * Sources:
 * - konzerthaus.at: Wiener Konzerthaus — classical, jazz, world music
 * - musikverein.at: Musikverein Wien — classical concerts, Neujahrskonzert venue
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * konzerthaus.at — Wiener Konzerthaus.
 * Scrapes the spielplan (schedule) page for classical, jazz, and world music concerts.
 */
export class KonzerthausScraper extends BaseScraper {
  readonly name = 'konzerthaus.at';
  private readonly BASE = 'https://www.konzerthaus.at';
  private readonly VENUE = 'Wiener Konzerthaus';
  private readonly LAT = 48.2012;
  private readonly LON = 16.3788;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte konzerthaus.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Scrape current and next month spielplan pages
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${y}/${m}`);
    }

    const urls = [
      `${this.BASE}/spielplan`,
      ...months.map(m => `${this.BASE}/spielplan/${m}`),
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
    this.log(`Gesamt: ${seen.size} Konzerthaus-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || (item['@type'] !== 'Event' && item['@type'] !== 'MusicEvent')) continue;
          const ev = this.parseJsonLdEvent(item, pageUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: look for event cards/list items
    $('article, [class*="event"], [class*="program"], [class*="spielplan"], .veranstaltung, li[class*="concert"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="datum"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const timeText = $el.find('[class*="time"], [class*="uhrzeit"], [class*="zeit"]').first().text().trim();
      const startDateTime = this.combineDateAndTime(startDate, timeText);

      const description = $el.find('.subtitle, [class*="subtitle"], [class*="description"], p').first().text().trim() || undefined;
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      // Look for ticket URL
      const ticketHref = $el.find('a[href*="ticket"], a[href*="karten"], a[class*="ticket"], a[class*="buy"]').first().attr('href') || '';
      const ticketUrl = ticketHref ? (ticketHref.startsWith('http') ? ticketHref : `${this.BASE}${ticketHref}`) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `konzerthaus-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: description?.slice(0, 500),
        start_date: startDateTime,
        location_name: this.VENUE,
        latitude: this.LAT,
        longitude: this.LON,
        bundesland: 'wien',
        category: categorizeEvent(title),
        tags: ['Konzert', 'Klassik', 'Kultur'],
        image_url: imageUrl,
        ticket_url: ticketUrl,
      });
    });

    return events;
  }

  private parseJsonLdEvent(item: Record<string, unknown>, pageUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const img = item.image;
    let imageUrl: string | undefined;
    if (typeof img === 'string') imageUrl = this.cleanImageUrl(this.resolveImageUrl(img, pageUrl));
    else if (img && typeof img === 'object') {
      const imgObj = img as Record<string, unknown>;
      const u = String(imgObj.url || imgObj.contentUrl || '');
      if (u) imageUrl = this.cleanImageUrl(this.resolveImageUrl(u, pageUrl));
    }

    // Extract ticket URL from offers
    let ticketUrl: string | undefined;
    const offers = item.offers;
    if (offers && typeof offers === 'object') {
      const offersObj = offers as Record<string, unknown>;
      ticketUrl = String(offersObj.url || '') || undefined;
    }

    return {
      source_id: `konzerthaus-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: String(item.url || pageUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: this.VENUE,
      latitude: this.LAT,
      longitude: this.LON,
      bundesland: 'wien',
      category: categorizeEvent(name),
      tags: ['Konzert', 'Klassik', 'Kultur'],
      image_url: imageUrl,
      ticket_url: ticketUrl,
    };
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }

  private combineDateAndTime(date: string, timeText: string): string {
    const match = timeText.match(/(\d{1,2})[:.:](\d{2})/);
    if (match) return `${date}T${match[1].padStart(2, '0')}:${match[2]}:00`;
    return date;
  }
}

/**
 * musikverein.at — Musikverein Wien.
 * Home of the Vienna Philharmonic, scrapes Spielplan for classical concerts.
 */
export class MusikvereinScraper extends BaseScraper {
  readonly name = 'musikverein.at';
  private readonly BASE = 'https://www.musikverein.at';
  private readonly VENUE = 'Musikverein Wien';
  private readonly LAT = 48.2007;
  private readonly LON = 16.3726;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte musikverein.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Scrape both German and English spielplan
    const urls = [
      `${this.BASE}/spielplan`,
      `${this.BASE}/en/spielplan`,
    ];

    // Also try monthly subpages
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      urls.push(`${this.BASE}/spielplan/${y}/${m}`);
    }

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
    this.log(`Gesamt: ${seen.size} Musikverein-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || (item['@type'] !== 'Event' && item['@type'] !== 'MusicEvent')) continue;
          const ev = this.parseJsonLdEvent(item, pageUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, [class*="event"], [class*="program"], [class*="spielplan"], [class*="concert"], .veranstaltung').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="datum"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const timeText = $el.find('[class*="time"], [class*="uhrzeit"]').first().text().trim();
      const startDateTime = this.combineDateAndTime(startDate, timeText);

      const description = $el.find('.subtitle, [class*="subtitle"], [class*="description"], p').first().text().trim() || undefined;
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const ticketHref = $el.find('a[href*="ticket"], a[href*="karten"]').first().attr('href') || '';
      const ticketUrl = ticketHref ? (ticketHref.startsWith('http') ? ticketHref : `${this.BASE}${ticketHref}`) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `musikverein-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: description?.slice(0, 500),
        start_date: startDateTime,
        location_name: this.VENUE,
        latitude: this.LAT,
        longitude: this.LON,
        bundesland: 'wien',
        category: categorizeEvent(title),
        tags: ['Konzert', 'Klassik', 'Kultur'],
        image_url: imageUrl,
        ticket_url: ticketUrl,
      });
    });

    return events;
  }

  private parseJsonLdEvent(item: Record<string, unknown>, pageUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const img = item.image;
    let imageUrl: string | undefined;
    if (typeof img === 'string') imageUrl = this.cleanImageUrl(this.resolveImageUrl(img, pageUrl));
    else if (img && typeof img === 'object') {
      const imgObj = img as Record<string, unknown>;
      const u = String(imgObj.url || imgObj.contentUrl || '');
      if (u) imageUrl = this.cleanImageUrl(this.resolveImageUrl(u, pageUrl));
    }

    let ticketUrl: string | undefined;
    const offers = item.offers;
    if (offers && typeof offers === 'object') {
      const offersObj = offers as Record<string, unknown>;
      ticketUrl = String(offersObj.url || '') || undefined;
    }

    return {
      source_id: `musikverein-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: String(item.url || pageUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: this.VENUE,
      latitude: this.LAT,
      longitude: this.LON,
      bundesland: 'wien',
      category: categorizeEvent(name),
      tags: ['Konzert', 'Klassik', 'Kultur'],
      image_url: imageUrl,
      ticket_url: ticketUrl,
    };
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }

  private combineDateAndTime(date: string, timeText: string): string {
    const match = timeText.match(/(\d{1,2})[:.:](\d{2})/);
    if (match) return `${date}T${match[1].padStart(2, '0')}:${match[2]}:00`;
    return date;
  }
}
