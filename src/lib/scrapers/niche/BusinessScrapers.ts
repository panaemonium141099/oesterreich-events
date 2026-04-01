/**
 * Business & Trade Scrapers
 *
 * Sources:
 * - wko.at: Wirtschaftskammer events (seminars, workshops, networking) — all 9 Bundeslaender
 * - messecenter.at: Messe Wien / Reed Exhibitions trade fairs
 * - messe-wels.at: Messe Wels trade fairs (Agraria, Power Days, etc.)
 * - mcg.at: Messe Congress Graz trade fairs
 * - ams.at: AMS job fairs and career events
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import type { ScrapedEvent } from '@/types/events';

// Bundesland lookup from common Austrian location names
const BUNDESLAND_MAP: Record<string, string> = {
  'wien': 'Wien', 'vienna': 'Wien',
  'graz': 'Steiermark', 'steiermark': 'Steiermark', 'styria': 'Steiermark',
  'linz': 'Oberösterreich', 'oberösterreich': 'Oberösterreich', 'wels': 'Oberösterreich',
  'salzburg': 'Salzburg',
  'innsbruck': 'Tirol', 'tirol': 'Tirol', 'tyrol': 'Tirol',
  'klagenfurt': 'Kärnten', 'kärnten': 'Kärnten', 'villach': 'Kärnten',
  'bregenz': 'Vorarlberg', 'vorarlberg': 'Vorarlberg', 'dornbirn': 'Vorarlberg',
  'eisenstadt': 'Burgenland', 'burgenland': 'Burgenland', 'neusiedl': 'Burgenland',
  'st. pölten': 'Niederösterreich', 'niederösterreich': 'Niederösterreich',
  'krems': 'Niederösterreich', 'wiener neustadt': 'Niederösterreich',
};

function guessBundesland(location: string): string | undefined {
  const lower = location.toLowerCase();
  for (const [key, val] of Object.entries(BUNDESLAND_MAP)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}

function parseDate(text: string): string | null {
  if (!text) return null;
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

/**
 * WKO Veranstaltungen — Wirtschaftskammer events across Austria.
 * Seminars, workshops, networking events from all 9 Landesorganisationen.
 */
export class WKOScraper extends BaseScraper {
  readonly name = 'wko.at';
  private readonly BASE = 'https://www.wko.at';

  // WKO state URLs and their Bundesland mappings
  private readonly STATE_URLS: Array<{ url: string; bundesland: string }> = [
    { url: 'https://www.wko.at/veranstaltungen/start', bundesland: '' },
    { url: 'https://www.wko.at/wien/veranstaltungen', bundesland: 'Wien' },
    { url: 'https://www.wko.at/noe/veranstaltungen', bundesland: 'Niederösterreich' },
    { url: 'https://www.wko.at/ooe/veranstaltungen', bundesland: 'Oberösterreich' },
    { url: 'https://www.wko.at/stmk/veranstaltungen', bundesland: 'Steiermark' },
    { url: 'https://www.wko.at/sbg/veranstaltungen', bundesland: 'Salzburg' },
    { url: 'https://www.wko.at/tirol/veranstaltungen', bundesland: 'Tirol' },
    { url: 'https://www.wko.at/ktn/veranstaltungen', bundesland: 'Kärnten' },
    { url: 'https://www.wko.at/vlbg/veranstaltungen', bundesland: 'Vorarlberg' },
    { url: 'https://www.wko.at/bgld/veranstaltungen', bundesland: 'Burgenland' },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte WKO Veranstaltungen Scraping...');
    const events: ScrapedEvent[] = [];

    for (const { url, bundesland } of this.STATE_URLS) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, url, bundesland);
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
    this.log(`Gesamt: ${seen.size} WKO-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string, defaultBundesland: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD extraction
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
          const locName = location ? String(location.name || '') : '';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `wko-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName || 'Österreich',
            bundesland: guessBundesland(locName) || defaultBundesland || undefined,
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Wirtschaft',
            tags: ['Wirtschaft', 'WKO', 'Seminar'],
            organizer: 'Wirtschaftskammer Österreich',
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — search for event cards/articles
    $('article, .event-item, .event-card, [class*="event"], [class*="veranstaltung"], .list-item, .teaser').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum', 'Datenschutz'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, [class*="ort"], [class*="location"]').first().text().trim();
      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `wko-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || '') || defaultBundesland || undefined,
        category: 'Wirtschaft',
        tags: ['Wirtschaft', 'WKO', 'Seminar'],
        image_url: imageUrl,
        organizer: 'Wirtschaftskammer Österreich',
      });
    });

    return events;
  }
}

/**
 * Messe Wien — Reed Exhibitions trade fairs in Vienna.
 * ~40 trade fairs/year at Messe Wien Exhibition & Congress Center.
 */
export class MesseWienScraper extends BaseScraper {
  readonly name = 'messecenter.at';
  private readonly BASE = 'https://www.messecenter.at';

  // Known coordinates for Messe Wien
  private readonly MESSE_WIEN_LAT = 48.2167;
  private readonly MESSE_WIEN_LON = 16.4094;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Messe Wien Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/events/`,
      `${this.BASE}/veranstaltungen/`,
      `${this.BASE}/messen/`,
      `${this.BASE}/kalender/`,
      'https://www.reedexpo.at/de/events/',
      'https://www.reedexpo.at/de/messen/',
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

    // Deduplicate
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    this.log(`Gesamt: ${seen.size} Messe Wien Events`);
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
          const locName = location ? String(location.name || '') : 'Messe Wien';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `messewien-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName,
            bundesland: 'Wien',
            latitude: geo?.latitude ? Number(geo.latitude) : this.MESSE_WIEN_LAT,
            longitude: geo?.longitude ? Number(geo.longitude) : this.MESSE_WIEN_LON,
            category: 'Wirtschaft',
            tags: ['Messe', 'Wirtschaft', 'Trade Fair'],
            organizer: 'Reed Exhibitions / Messe Wien',
            ticket_url: item.offers?.url ? String(item.offers.url) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, .messe, [class*="event"], [class*="messe"], .card, .teaser').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = parseDate(dateText);
      if (!startDate) return;

      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `messewien-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: 'Messe Wien',
        bundesland: 'Wien',
        latitude: this.MESSE_WIEN_LAT,
        longitude: this.MESSE_WIEN_LON,
        category: 'Wirtschaft',
        tags: ['Messe', 'Wirtschaft', 'Trade Fair'],
        image_url: imageUrl,
        organizer: 'Messe Wien',
      });
    });

    return events;
  }
}

/**
 * Messe Wels — OÖ trade fairs (Agraria, Power Days, etc.)
 */
export class MesseWelsScraper extends BaseScraper {
  readonly name = 'messe-wels.at';
  private readonly BASE = 'https://www.messe-wels.at';

  // Known coordinates for Messe Wels
  private readonly MESSE_WELS_LAT = 48.1545;
  private readonly MESSE_WELS_LON = 14.0287;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Messe Wels Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/messen`,
      `${this.BASE}/kalender`,
      `${this.BASE}/events`,
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
    this.log(`Gesamt: ${seen.size} Messe Wels Events`);
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
          events.push({
            source_id: `messewels-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: 'Messe Wels',
            bundesland: 'Oberösterreich',
            latitude: this.MESSE_WELS_LAT,
            longitude: this.MESSE_WELS_LON,
            category: 'Wirtschaft',
            tags: ['Messe', 'Wirtschaft', 'Trade Fair'],
            organizer: 'Messe Wels',
            ticket_url: item.offers?.url ? String(item.offers.url) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, .messe, [class*="event"], [class*="messe"], .card, .teaser').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = parseDate(dateText);
      if (!startDate) return;

      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `messewels-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: 'Messe Wels',
        bundesland: 'Oberösterreich',
        latitude: this.MESSE_WELS_LAT,
        longitude: this.MESSE_WELS_LON,
        category: 'Wirtschaft',
        tags: ['Messe', 'Wirtschaft', 'Trade Fair'],
        image_url: imageUrl,
        organizer: 'Messe Wels',
      });
    });

    return events;
  }
}

/**
 * MCG Messe Congress Graz — Steiermark trade fairs and congress center.
 */
export class MesseGrazScraper extends BaseScraper {
  readonly name = 'mcg.at';
  private readonly BASE = 'https://www.mcg.at';

  // Known coordinates for Messe Congress Graz
  private readonly MCG_LAT = 47.0763;
  private readonly MCG_LON = 15.4453;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MCG Messe Congress Graz Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/events`,
      `${this.BASE}/messen`,
      `${this.BASE}/programm`,
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
    this.log(`Gesamt: ${seen.size} MCG Graz Events`);
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
          events.push({
            source_id: `mcg-graz-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: 'Messe Congress Graz',
            bundesland: 'Steiermark',
            latitude: this.MCG_LAT,
            longitude: this.MCG_LON,
            category: 'Wirtschaft',
            tags: ['Messe', 'Wirtschaft', 'Kongress'],
            organizer: 'MCG Messe Congress Graz',
            ticket_url: item.offers?.url ? String(item.offers.url) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, [class*="event"], [class*="veranstaltung"], .card, .teaser').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = parseDate(dateText);
      if (!startDate) return;

      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `mcg-graz-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: 'Messe Congress Graz',
        bundesland: 'Steiermark',
        latitude: this.MCG_LAT,
        longitude: this.MCG_LON,
        category: 'Wirtschaft',
        tags: ['Messe', 'Wirtschaft', 'Kongress'],
        image_url: imageUrl,
        organizer: 'MCG Messe Congress Graz',
      });
    });

    return events;
  }
}

/**
 * AMS Veranstaltungen — Job fairs and career events from AMS (Arbeitsmarktservice).
 */
export class AMSScraper extends BaseScraper {
  readonly name = 'ams.at';
  private readonly BASE = 'https://www.ams.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte AMS Veranstaltungen Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/organisation/veranstaltungen`,
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/unternehmen/service-fuer-unternehmen/veranstaltungen`,
      `${this.BASE}/arbeitsuchende/veranstaltungen`,
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
    this.log(`Gesamt: ${seen.size} AMS-Events`);
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
          const locName = location ? String(location.name || '') : '';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `ams-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName || 'Österreich',
            bundesland: guessBundesland(locName) || undefined,
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Wirtschaft',
            tags: ['Karriere', 'Wirtschaft', 'Jobmesse'],
            organizer: 'AMS Österreich',
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, [class*="event"], [class*="veranstaltung"], .list-item, li, .card').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum', 'Datenschutz', 'Login', 'Suche'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, [class*="ort"]').first().text().trim();
      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `ams-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || '') || undefined,
        category: 'Wirtschaft',
        tags: ['Karriere', 'Wirtschaft', 'Jobmesse'],
        organizer: 'AMS Österreich',
      });
    });

    return events;
  }
}
