import * as vm from 'vm';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * CITIES-Scraper: Scrapt Veranstaltungen von österreichischen Gemeinden,
 * die die CITIES-Plattform (citiesapps.com) nutzen.
 *
 * Technik:
 * - Events werden als JSON in `window.INITIAL_DATA` im HTML eingebettet
 * - Route: /events/upcoming liefert vorgerenderte Event-Daten
 * - Kein Puppeteer nötig — reines HTML-Parsing mit Regex
 *
 * Datenquellen:
 * - pageEvents.upcomingEvents[] — zukünftige Events
 * - pageEvents.currentEvents[] — laufende Events
 */
export class CitiesScraper extends BaseScraper {
  readonly name = 'cities';

  private readonly timeoutMs = 10000;
  private readonly gemeindeDelayMs = 1500;

  /**
   * CITIES municipalities with their event page URL.
   * Only includes sites confirmed to use the /events/upcoming route
   * which pre-renders event data in window.INITIAL_DATA.
   */
  private readonly MUNICIPALITIES: CitiesMunicipality[] = [
    // Burgenland — Eisenstadt-Umgebung
    { name: 'Hornstein', url: 'https://hornstein.at', plz: '7053', bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland', lat: 47.8791, lng: 16.443 },
    { name: 'Leithaprodersdorf', url: 'https://leithaprodersdorf.at', plz: '2443', bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland', lat: 47.9353, lng: 16.4794 },
    { name: 'Oslip', url: 'https://www.oslip.at', plz: '7064', bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland', lat: 47.8505, lng: 16.5935 },
    { name: 'Siegendorf', url: 'https://siegendorf.gv.at', plz: '7011', bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland', lat: 47.7803, lng: 16.5414 },
    { name: 'Zagersdorf', url: 'https://www.zagersdorf.at', plz: '7012', bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland', lat: 47.7646, lng: 16.5136 },
    // Burgenland — Güssing
    { name: 'Stinatz', url: 'https://www.stinatz.gv.at', plz: '7552', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.2044, lng: 16.1332 },
    { name: 'Heugraben', url: 'https://www.heugraben.gv.at', plz: '7551', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.1192, lng: 16.191 },
    { name: 'Moschendorf', url: 'https://citiesapps.com/pages/moschendorf', plz: '7540', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.0568, lng: 16.4784 },
    { name: 'Bildein', url: 'https://bildein.at', plz: '7521', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.1332, lng: 16.4856 },
    { name: 'Inzenhof', url: 'https://www.inzenhof.at', plz: '7540', bezirk: 'Güssing', bundesland: 'Burgenland', lat: 47.0125, lng: 16.3168 },
    // Burgenland — Jennersdorf
    { name: 'Deutsch Kaltenbrunn', url: 'https://deutschkaltenbrunn.eu', plz: '7572', bezirk: 'Jennersdorf', bundesland: 'Burgenland', lat: 47.0907, lng: 16.1062 },
    // Burgenland — Mattersburg
    { name: 'Hirm', url: 'https://www.hirm.gv.at', plz: '7024', bezirk: 'Mattersburg', bundesland: 'Burgenland', lat: 47.787, lng: 16.4546 },
    { name: 'Krensdorf', url: 'https://citiesapps.com/pages/krensdorf', plz: '7031', bezirk: 'Mattersburg', bundesland: 'Burgenland', lat: 47.7845, lng: 16.4155 },
    // Burgenland — Neusiedl am See
    { name: 'Bruckneudorf', url: 'https://bruckneudorf.eu', plz: '2460', bezirk: 'Neusiedl am See', bundesland: 'Burgenland', lat: 48.0198, lng: 16.7792 },
    { name: 'Nickelsdorf', url: 'https://nickelsdorf.gv.at', plz: '2425', bezirk: 'Neusiedl am See', bundesland: 'Burgenland', lat: 47.9403, lng: 17.0662 },
    { name: 'Zurndorf', url: 'https://zurndorf.at', plz: '2424', bezirk: 'Neusiedl am See', bundesland: 'Burgenland', lat: 47.9842, lng: 17.003 },
    { name: 'Potzneusiedl', url: 'https://potzneusiedl.at', plz: '2473', bezirk: 'Neusiedl am See', bundesland: 'Burgenland', lat: 48.0448, lng: 16.9477 },
    // Burgenland — Oberpullendorf
    { name: 'Draßmarkt', url: 'https://drassmarkt.at', plz: '7372', bezirk: 'Oberpullendorf', bundesland: 'Burgenland', lat: 47.5103, lng: 16.4008 },
    { name: 'Horitschon', url: 'https://www.horitschon.at', plz: '7312', bezirk: 'Oberpullendorf', bundesland: 'Burgenland', lat: 47.5875, lng: 16.5476 },
    { name: 'Lackendorf', url: 'https://lackendorf.at', plz: '7321', bezirk: 'Oberpullendorf', bundesland: 'Burgenland', lat: 47.5888, lng: 16.5027 },
    { name: 'Unterfrauenhaid', url: 'https://unterfrauenhaid.at', plz: '7321', bezirk: 'Oberpullendorf', bundesland: 'Burgenland', lat: 47.5726, lng: 16.4992 },
    // Burgenland — Oberwart
    { name: 'Bernstein', url: 'https://bernstein.gv.at', plz: '7434', bezirk: 'Oberwart', bundesland: 'Burgenland', lat: 47.4057, lng: 16.2581 },
    { name: 'Deutsch Schützen-Eisenberg', url: 'https://www.eisenberg.at', plz: '7474', bezirk: 'Oberwart', bundesland: 'Burgenland', lat: 47.1643, lng: 16.4485 },
    { name: 'Kemeten', url: 'https://kemeten.gv.at', plz: '7531', bezirk: 'Oberwart', bundesland: 'Burgenland', lat: 47.249, lng: 16.1525 },
    { name: 'Markt Neuhodis', url: 'https://www.markt-neuhodis.at', plz: '7464', bezirk: 'Oberwart', bundesland: 'Burgenland', lat: 47.2958, lng: 16.3944 },
    { name: 'Jabing', url: 'https://citiesapps.com/cities/jabing', plz: '7503', bezirk: 'Oberwart', bundesland: 'Burgenland', lat: 47.2396, lng: 16.2737 },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte CITIES Scraping (${this.MUNICIPALITIES.length} Gemeinden)...`);
    const allEvents: ScrapedEvent[] = [];
    let scraped = 0;
    let failed = 0;
    let noEvents = 0;

    for (let i = 0; i < this.MUNICIPALITIES.length; i++) {
      const m = this.MUNICIPALITIES[i];
      try {
        const events = await this.scrapeMunicipality(m);
        if (events.length > 0) {
          allEvents.push(...events);
          scraped++;
          this.log(`  [${i + 1}/${this.MUNICIPALITIES.length}] ${m.name}: ${events.length} Events`);
        } else {
          noEvents++;
        }
      } catch (err) {
        failed++;
        this.log(`  [${i + 1}/${this.MUNICIPALITIES.length}] ${m.name}: FEHLER - ${err instanceof Error ? err.message : err}`);
      }
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`CITIES fertig: ${allEvents.length} Events von ${scraped} Gemeinden (${noEvents} ohne Events, ${failed} fehlgeschlagen)`);
    return allEvents;
  }

  private async scrapeMunicipality(m: CitiesMunicipality): Promise<ScrapedEvent[]> {
    // Try /events/upcoming first, then /events
    const paths = ['/events/upcoming', '/events'];
    let html: string | null = null;
    let usedUrl = '';

    for (const path of paths) {
      const url = m.url.replace(/\/$/, '') + path;
      try {
        html = await this.fetchWithTimeout(url);
        if (html && html.includes('INITIAL_DATA')) {
          usedUrl = url;
          break;
        }
        html = null;
      } catch {
        // Try next path
      }
    }

    if (!html) return [];

    const events = this.extractEventsFromInitialData(html, m, usedUrl);
    return events;
  }

  /**
   * Evaluates the compressed IIFE that CITIES uses for window.INITIAL_DATA.
   * Format: window.INITIAL_DATA = (function(a,b,c,...){return {...}})(val1,val2,...)
   */
  private evaluateIIFE(html: string, varName: string): Record<string, unknown> | null {
    const tag = `window.${varName} = `;
    const start = html.indexOf(tag);
    if (start === -1) return null;

    const exprStart = start + tag.length;

    // Track parentheses to find the complete IIFE expression,
    // respecting string literals to avoid false matches
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = exprStart; i < html.length; i++) {
      const ch = html[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (inString) { if (ch === stringChar) inString = false; continue; }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          const expr = html.substring(exprStart, i + 1);
          try {
            return vm.runInNewContext(expr, {}, { timeout: 5000 }) as Record<string, unknown>;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  private extractEventsFromInitialData(html: string, m: CitiesMunicipality, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    const data = this.evaluateIIFE(html, 'INITIAL_DATA');
    if (!data) return [];

    // Events are at data['connected-page'].pageEvents
    const connectedPage = data['connected-page'] as Record<string, unknown> | undefined;
    const pageEvents = (connectedPage?.pageEvents ?? data.pageEvents) as CitiesPageEvents | undefined;
    if (!pageEvents) return [];

    const allCitiesEvents = [
      ...(pageEvents.upcomingEvents || []),
      ...(pageEvents.currentEvents || []),
    ];

    for (const evt of allCitiesEvents) {
      try {
        const event = this.mapCitiesEvent(evt, m, pageUrl);
        if (event) events.push(event);
      } catch {
        // Skip malformed events
      }
    }

    return events;
  }

  private mapCitiesEvent(evt: CitiesEvent, m: CitiesMunicipality, pageUrl: string): ScrapedEvent | null {
    if (!evt.name || !evt.startsAt) return null;

    // Parse dates — CITIES uses UTC ISO 8601
    const startDate = this.parseCitiesDate(evt.startsAt, evt.hasStartTime);
    if (!startDate) return null;

    const endDate = evt.endsAt ? this.parseCitiesDate(evt.endsAt, evt.hasEndTime) ?? undefined : undefined;

    // Extract location
    const loc = evt.location;
    let lat = m.lat;
    let lng = m.lng;
    let address: string | undefined;
    let postalCode = m.plz;
    let locationName = m.name;

    if (loc) {
      if (loc.location?.coordinates?.length === 2) {
        // GeoJSON: [longitude, latitude]
        lng = loc.location.coordinates[0];
        lat = loc.location.coordinates[1];
      }
      if (loc.postalCode) postalCode = loc.postalCode;
      if (loc.municipality) locationName = loc.municipality;

      const addrParts = [loc.street, loc.addressNumber].filter(Boolean);
      if (addrParts.length > 0) {
        address = addrParts.join(' ');
        if (loc.postalCode || loc.municipality) {
          address += ', ' + [loc.postalCode, loc.municipality].filter(Boolean).join(' ');
        }
      }
    }

    // Image URL
    let imageUrl: string | undefined;
    if (evt.bannerImage?.url) {
      imageUrl = evt.bannerImage.url;
      // Ensure HTTPS
      if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
      }
    }

    // Organizer from host page
    const organizer = evt.page?.name || evt.hosts?.[0]?.page?.name;

    // Description — prefer plain text
    const description = evt.plainDescription || this.stripHtml(evt.description || '');

    // Build source URL — link to the municipality events page
    const sourceUrl = pageUrl;

    // Category detection
    const textForCategory = [evt.name, description || ''].join(' ');
    const category = categorizeEvent(evt.name, description || '');

    return {
      source_id: `cities-${evt._id}`,
      source_name: this.name,
      source_url: sourceUrl,
      title: evt.name.trim(),
      description: description || undefined,
      start_date: startDate,
      end_date: endDate,
      location_name: locationName,
      address,
      postal_code: postalCode,
      bundesland: m.bundesland,
      district: m.bezirk,
      latitude: lat,
      longitude: lng,
      category,
      image_url: imageUrl,
      organizer,
    };
  }

  private parseCitiesDate(isoStr: string, hasTime: boolean): string | null {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;

      // Convert UTC to Europe/Vienna local time
      const viennaStr = d.toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' });
      // sv-SE gives: "2026-04-08 10:00:00"
      const [datePart, timePart] = viennaStr.split(' ');

      if (hasTime && timePart) {
        return `${datePart}T${timePart}`;
      }
      return datePart;
    } catch {
      return null;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchWithTimeout(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
        },
      });
      if (response.status !== 200) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}

// ── Types ───────────────────────────────────────────────────────────

interface CitiesMunicipality {
  name: string;
  url: string;
  plz: string;
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
}

interface CitiesPageEvents {
  upcomingEvents?: CitiesEvent[];
  currentEvents?: CitiesEvent[];
  pastEvents?: CitiesEvent[];
}

interface CitiesEvent {
  _id: string;
  name: string;
  description: string | null;
  plainDescription: string | null;
  bannerImage: {
    url: string;
    meta?: unknown;
    computedMeta?: {
      aspectRatio?: number;
      altText?: { language: string; text: string }[];
    };
  } | null;
  page: {
    _id: string;
    name: string;
    slug: string;
  } | null;
  startsAt: string;
  startsAtDate: string;
  startsAtTime: string | null;
  hasStartTime: boolean;
  endsAt: string | null;
  endsAtDate: string | null;
  endsAtTime: string | null;
  hasEndTime: boolean;
  canceledAt: string | null;
  location: {
    addressNumber: string | null;
    country: string;
    label: string;
    municipality: string;
    postalCode: string | null;
    region: string;
    street: string | null;
    subRegion: string;
    location: {
      type: string;
      coordinates: [number, number]; // [lng, lat]
    } | null;
  } | null;
  locationDetails: string | null;
  meetupUrl: string | null;
  hosts: { page: { _id: string; name: string }; status: string }[];
  period: string;
}
