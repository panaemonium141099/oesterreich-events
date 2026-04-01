/**
 * Sport Federation Scrapers
 *
 * Sources:
 * - oeav-events.at: Aggregated OeAV (Alpenverein) events across all Sektionen
 * - laufen.at: Austrian running event calendar (marathons, trail runs, fun runs)
 * - rad-net.at: Austrian cycling events (road, MTB, gravel)
 * - oefb.at: Austrian Football Federation — match schedule
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categories';
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

/**
 * oeav-events.at — Aggregated Alpenverein events.
 * Scrapes the central OeAV events portal which lists events across all Sektionen.
 * Complements the existing AlpenvereinScraper (alpenverein.at) with branch-level events.
 */
export class OeAVEventsScraper extends BaseScraper {
  readonly name = 'oeav-events.at';
  private readonly BASE = 'https://www.alpenverein.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte oeav-events.at Scraping (Sektionen-Events)...');
    const events: ScrapedEvent[] = [];

    // Scrape the aggregated events pages (multiple pages)
    const urls = [
      `${this.BASE}/events`,
      `${this.BASE}/events?page=2`,
      `${this.BASE}/events?page=3`,
      `${this.BASE}/termine`,
      `${this.BASE}/termine?page=2`,
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
    this.log(`Gesamt: ${seen.size} OeAV-Events`);
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
          const locName = location ? String(location.name || '') : 'Österreich';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `oeav-events-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName,
            bundesland: guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Sport',
            tags: ['Outdoor', 'Sport', 'Alpenverein'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — search for event cards/articles
    $('article, .event-item, .event-card, [class*="event"], [class*="termin"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, [class*="ort"], [class*="location"]').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `oeav-events-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || ''),
        category: 'Sport',
        tags: ['Outdoor', 'Sport', 'Alpenverein'],
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
 * laufen.at — Austrian running event calendar.
 * Covers marathons, half-marathons, trail runs, fun runs, and charity runs across Austria.
 */
export class LaufenAtScraper extends BaseScraper {
  readonly name = 'laufen.at';
  private readonly BASE = 'https://www.laufen.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte laufen.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Scrape the Laufkalender (running calendar) — current and upcoming months
    const now = new Date();
    const year = now.getFullYear();
    const urls = [
      `${this.BASE}/laufkalender`,
      `${this.BASE}/laufkalender/${year}`,
      `${this.BASE}/laufkalender?year=${year}`,
      `${this.BASE}/termine`,
      `${this.BASE}/veranstaltungen`,
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
    this.log(`Gesamt: ${seen.size} Lauf-Events`);
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
          if (!item || item['@type'] !== 'Event' && item['@type'] !== 'SportsEvent') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : 'Österreich';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `laufen-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName,
            bundesland: guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Sport',
            tags: ['Laufen', 'Sport', 'Marathon'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — look for event listings
    $('article, .event, .race, .lauf, [class*="event"], [class*="race"], [class*="lauf"], tr, .row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-name, a').first().text().trim();
      if (!title || title.length < 3) return;
      // Skip navigation / header items
      if (['Home', 'Kontakt', 'Impressum', 'Datenschutz', 'Login'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"], td:first-child').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, .city, [class*="ort"], td:nth-child(3)').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      // Distance info (e.g. "42.195km", "10km")
      const distText = $el.find('.distance, .strecke, [class*="distance"]').first().text().trim();
      const desc = distText ? `Distanz: ${distText}` : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `laufen-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || ''),
        category: 'Sport',
        tags: ['Laufen', 'Sport'],
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
 * rad-net.at — Austrian cycling events.
 * Covers road races, MTB events, gravel events, and cycling tours.
 */
export class RadNetScraper extends BaseScraper {
  readonly name = 'rad-net.at';
  private readonly BASE = 'https://www.rad-net.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte rad-net.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/rad-termine`,
      `${this.BASE}/termine`,
      `${this.BASE}/events`,
      `${this.BASE}/rennkalender`,
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
    this.log(`Gesamt: ${seen.size} Rad-Events`);
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
          if (!item || (item['@type'] !== 'Event' && item['@type'] !== 'SportsEvent')) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : 'Österreich';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `radnet-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName,
            bundesland: guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Sport',
            tags: ['Radfahren', 'Sport', 'Cycling'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, .race, [class*="event"], [class*="termin"], [class*="race"], tr, .row').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-name, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum', 'Datenschutz', 'Login'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"], td:first-child').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .ort, .city, [class*="ort"], td:nth-child(3)').first().text().trim();
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `radnet-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || ''),
        category: 'Sport',
        tags: ['Radfahren', 'Sport', 'Cycling'],
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
 * oefb.at — Austrian Football Federation match schedule.
 * Scrapes upcoming matches from Bundesliga, 2. Liga, and OeFB Cup.
 */
export class OeFBScraper extends BaseScraper {
  readonly name = 'oefb.at';
  private readonly BASE = 'https://www.oefb.at';

  // Major stadium coordinates
  private readonly STADIUMS: Record<string, { lat: number; lon: number; bundesland: string }> = {
    'ernst-happel-stadion': { lat: 48.2085, lon: 16.4203, bundesland: 'Wien' },
    'allianz stadion': { lat: 48.1963, lon: 16.2664, bundesland: 'Wien' },
    'generali arena': { lat: 48.1621, lon: 16.3893, bundesland: 'Wien' },
    'red bull arena': { lat: 47.8161, lon: 13.0458, bundesland: 'Salzburg' },
    'merkur arena': { lat: 47.0462, lon: 15.4530, bundesland: 'Steiermark' },
    'tivoli stadion': { lat: 47.2581, lon: 11.4036, bundesland: 'Tirol' },
    'wörthersee stadion': { lat: 46.6268, lon: 14.2925, bundesland: 'Kärnten' },
    'linzer stadion': { lat: 48.3219, lon: 14.2886, bundesland: 'Oberösterreich' },
    'cashpoint arena': { lat: 47.4210, lon: 9.6575, bundesland: 'Vorarlberg' },
    'pappelstadion': { lat: 48.3261, lon: 14.2927, bundesland: 'Oberösterreich' },
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte oefb.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/bewerbe/bundesliga/spielplan`,
      `${this.BASE}/bewerbe/2-liga/spielplan`,
      `${this.BASE}/bewerbe/oefb-cup/spielplan`,
      `${this.BASE}/spielplan`,
      `${this.BASE}/termine`,
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
    this.log(`Gesamt: ${seen.size} Fußball-Events`);
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
          if (!item || (item['@type'] !== 'Event' && item['@type'] !== 'SportsEvent')) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : '';
          const geo = location?.geo as Record<string, unknown> | undefined;
          const stadiumInfo = this.matchStadium(locName);
          events.push({
            source_id: `oefb-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName || 'Österreich',
            bundesland: stadiumInfo?.bundesland || guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : stadiumInfo?.lat,
            longitude: geo?.longitude ? Number(geo.longitude) : stadiumInfo?.lon,
            category: 'Sport',
            tags: ['Fußball', 'Sport', 'Bundesliga'],
            ticket_url: item.offers?.url ? String(item.offers.url) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — match rows
    $('.match, .game, .spielplan-row, [class*="match"], [class*="game"], [class*="spiel"], tr').each((_, el) => {
      const $el = $(el);

      // Try to find team names — common football schedule pattern
      const home = $el.find('.home, .team-home, td:nth-child(1)').first().text().trim();
      const away = $el.find('.away, .team-away, td:nth-child(3)').first().text().trim();
      let title = '';
      if (home && away) {
        title = `${home} vs ${away}`;
      } else {
        title = $el.find('h2, h3, h4, .title, a').first().text().trim();
      }
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum'].includes(title)) return;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"], td:nth-child(2)').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .venue, .stadion, [class*="ort"], [class*="venue"]').first().text().trim();
      const stadiumInfo = this.matchStadium(location);
      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `oefb-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: stadiumInfo?.bundesland || guessBundesland(location || ''),
        latitude: stadiumInfo?.lat,
        longitude: stadiumInfo?.lon,
        category: 'Sport',
        tags: ['Fußball', 'Sport'],
      });
    });

    return events;
  }

  private matchStadium(location: string): { lat: number; lon: number; bundesland: string } | undefined {
    if (!location) return undefined;
    const lower = location.toLowerCase();
    for (const [key, val] of Object.entries(this.STADIUMS)) {
      if (lower.includes(key)) return val;
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
 * runnersfun.at — Austrian running/triathlon event calendar.
 * Backup running source complementing laufen.at with trail runs and triathlons.
 */
export class RunnersFunScraper extends BaseScraper {
  readonly name = 'runnersfun.at';
  private readonly BASE = 'https://www.runnersfun.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte runnersfun.at Scraping...');
    const events: ScrapedEvent[] = [];

    const urls = [
      `${this.BASE}/laufkalender`,
      `${this.BASE}/laufkalender/oesterreich`,
      `${this.BASE}/veranstaltungen`,
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
    this.log(`Gesamt: ${seen.size} RunnersFun-Events`);
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
          if (!item || (item['@type'] !== 'Event' && item['@type'] !== 'SportsEvent')) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : 'Österreich';
          const geo = location?.geo as Record<string, unknown> | undefined;
          events.push({
            source_id: `runnersfun-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName,
            bundesland: guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: 'Sport',
            tags: ['Laufen', 'Sport', 'Triathlon'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, [class*="event"], [class*="lauf"], tr, .row, li').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, a').first().text().trim();
      if (!title || title.length < 3) return;
      if (['Home', 'Kontakt', 'Impressum'].includes(title)) return;

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
        source_id: `runnersfun-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || ''),
        category: 'Sport',
        tags: ['Laufen', 'Sport'],
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
