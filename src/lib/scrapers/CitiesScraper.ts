import * as vm from 'vm';
import { BaseScraper } from './BaseScraper';
import { applyGemeindeContext } from './gemeinde-context';
import { withStammdaten, type GemeindeStammdaten } from './gemeinden/stammdaten';
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
    { name: 'Hornstein', url: 'https://hornstein.at', bundesland: 'Burgenland' },
    { name: 'Leithaprodersdorf', url: 'https://leithaprodersdorf.at', bundesland: 'Burgenland' },
    { name: 'Oslip', url: 'https://www.oslip.at', bundesland: 'Burgenland' },
    { name: 'Siegendorf', url: 'https://siegendorf.gv.at', bundesland: 'Burgenland' },
    { name: 'Zagersdorf', url: 'https://www.zagersdorf.at', bundesland: 'Burgenland' },
    // Burgenland — Güssing
    { name: 'Stinatz', url: 'https://www.stinatz.gv.at', bundesland: 'Burgenland' },
    { name: 'Heugraben', url: 'https://www.heugraben.gv.at', bundesland: 'Burgenland' },
    { name: 'Moschendorf', url: 'https://citiesapps.com/pages/moschendorf', bundesland: 'Burgenland' },
    { name: 'Bildein', url: 'https://bildein.at', bundesland: 'Burgenland' },
    { name: 'Inzenhof', url: 'https://www.inzenhof.at', bundesland: 'Burgenland' },
    // Burgenland — Jennersdorf
    { name: 'Deutsch Kaltenbrunn', url: 'https://deutschkaltenbrunn.eu', bundesland: 'Burgenland' },
    // Burgenland — Mattersburg
    { name: 'Hirm', url: 'https://www.hirm.gv.at', bundesland: 'Burgenland' },
    { name: 'Krensdorf', url: 'https://citiesapps.com/pages/krensdorf', bundesland: 'Burgenland' },
    // Burgenland — Neusiedl am See
    { name: 'Bruckneudorf', url: 'https://bruckneudorf.eu', bundesland: 'Burgenland' },
    { name: 'Nickelsdorf', url: 'https://nickelsdorf.gv.at', bundesland: 'Burgenland' },
    { name: 'Zurndorf', url: 'https://zurndorf.at', bundesland: 'Burgenland' },
    { name: 'Potzneusiedl', url: 'https://potzneusiedl.at', bundesland: 'Burgenland' },
    // Burgenland — Oberpullendorf
    { name: 'Draßmarkt', url: 'https://drassmarkt.at', bundesland: 'Burgenland' },
    { name: 'Horitschon', url: 'https://www.horitschon.at', bundesland: 'Burgenland' },
    { name: 'Lackendorf', url: 'https://lackendorf.at', bundesland: 'Burgenland' },
    { name: 'Unterfrauenhaid', url: 'https://unterfrauenhaid.at', bundesland: 'Burgenland' },
    // Burgenland — Oberwart
    { name: 'Bernstein', url: 'https://bernstein.gv.at', bundesland: 'Burgenland' },
    { name: 'Deutsch Schützen-Eisenberg', url: 'https://www.eisenberg.at', bundesland: 'Burgenland' },
    { name: 'Kemeten', url: 'https://kemeten.gv.at', bundesland: 'Burgenland' },
    { name: 'Markt Neuhodis', url: 'https://www.markt-neuhodis.at', bundesland: 'Burgenland' },
    { name: 'Jabing', url: 'https://citiesapps.com/cities/jabing', bundesland: 'Burgenland' },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    const municipalities = withStammdaten(this.MUNICIPALITIES);
    this.log(`Starte CITIES Scraping (${municipalities.length} Gemeinden)...`);
    const allEvents: ScrapedEvent[] = [];
    let scraped = 0;
    let failed = 0;
    let noEvents = 0;

    for (let i = 0; i < municipalities.length; i++) {
      const m = municipalities[i];
      try {
        const ctx = { name: m.name, plz: m.plz, lat: m.lat, lng: m.lng, bundesland: m.bundesland, bezirk: m.bezirk };
        const events = (await this.scrapeMunicipality(m)).map(e => applyGemeindeContext(e, ctx));
        if (events.length > 0) {
          allEvents.push(...events);
          scraped++;
          this.log(`  [${i + 1}/${municipalities.length}] ${m.name}: ${events.length} Events`);
        } else {
          noEvents++;
        }
      } catch (err) {
        failed++;
        this.log(`  [${i + 1}/${municipalities.length}] ${m.name}: FEHLER - ${err instanceof Error ? err.message : err}`);
      }
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`CITIES fertig: ${allEvents.length} Events von ${scraped} Gemeinden (${noEvents} ohne Events, ${failed} fehlgeschlagen)`);
    return allEvents;
  }

  private async scrapeMunicipality(m: CitiesGemeinde): Promise<ScrapedEvent[]> {
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

  private extractEventsFromInitialData(html: string, m: CitiesGemeinde, pageUrl: string): ScrapedEvent[] {
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

  private mapCitiesEvent(evt: CitiesEvent, m: CitiesGemeinde, pageUrl: string): ScrapedEvent | null {
    if (!evt.name || !evt.startsAt) return null;

    // Parse dates — CITIES uses UTC ISO 8601
    const startDate = this.parseCitiesDate(evt.startsAt, evt.hasStartTime);
    if (!startDate) return null;

    const endDate = evt.endsAt ? this.parseCitiesDate(evt.endsAt, evt.hasEndTime) ?? undefined : undefined;

    // Extract location
    const loc = evt.location;
    // Nur Quellwerte; den Gemeinde-Kontext setzt applyGemeindeContext.
    let lat: number | undefined;
    let lng: number | undefined;
    let address: string | undefined;
    let postalCode: string | undefined;
    let city: string | undefined;

    if (loc) {
      if (loc.location?.coordinates?.length === 2) {
        // GeoJSON: [longitude, latitude]
        lng = loc.location.coordinates[0];
        lat = loc.location.coordinates[1];
      }
      if (loc.postalCode) postalCode = loc.postalCode;
      if (loc.municipality) city = loc.municipality;

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
      address,
      postal_code: postalCode,
      city,
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

/** Identität + URL; Ortsdaten liefert withStammdaten(). */
interface CitiesMunicipality {
  name: string;
  url: string;
  bundesland: string;
}

type CitiesGemeinde = CitiesMunicipality & GemeindeStammdaten;

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
