import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * Configuration for a single Deskline/Feratel TOSC5 region.
 *
 * The `code` is the path prefix used in the webapi.deskline.net REST API,
 * e.g. "blsalzb" for SalzburgerLand, "innsbruck" for Innsbruck region.
 */
interface FeratelRegionConfig {
  /** API path prefix (e.g. "blsalzb", "innsbruck") */
  code: string;
  /** Human-readable region name */
  name: string;
  /** Austrian Bundesland */
  bundesland: string;
  /** Approximate center latitude (fallback when event has no coordinates) */
  fallbackLat: number;
  /** Approximate center longitude (fallback when event has no coordinates) */
  fallbackLng: number;
}

// ─────────────────── Region configurations ───────────────────
// Discovered by probing webapi.deskline.net with known tourism organization codes.
// Each returns 200 OK with event data.

const REGIONS: FeratelRegionConfig[] = [
  // ── Burgenland ──
  { code: 'burgenland', name: 'Burgenland', bundesland: 'Burgenland', fallbackLat: 47.845, fallbackLng: 16.525 },

  // ── Salzburg ──
  { code: 'blsalzb', name: 'SalzburgerLand', bundesland: 'Salzburg', fallbackLat: 47.349, fallbackLng: 13.060 },
  { code: 'gastein', name: 'Gastein', bundesland: 'Salzburg', fallbackLat: 47.114, fallbackLng: 13.133 },
  { code: 'lungau', name: 'Lungau', bundesland: 'Salzburg', fallbackLat: 47.075, fallbackLng: 13.685 },
  { code: 'tennengau', name: 'Tennengau', bundesland: 'Salzburg', fallbackLat: 47.568, fallbackLng: 13.190 },
  { code: 'hochkoenig', name: 'Hochkoenig', bundesland: 'Salzburg', fallbackLat: 47.420, fallbackLng: 13.075 },
  { code: 'fuschlsee', name: 'Fuschlseeregion', bundesland: 'Salzburg', fallbackLat: 47.786, fallbackLng: 13.310 },
  { code: 'grossarl', name: 'Grossarltal', bundesland: 'Salzburg', fallbackLat: 47.238, fallbackLng: 13.193 },
  { code: 'radstadt', name: 'Radstadt', bundesland: 'Salzburg', fallbackLat: 47.382, fallbackLng: 13.461 },
  { code: 'flachau', name: 'Flachau', bundesland: 'Salzburg', fallbackLat: 47.340, fallbackLng: 13.392 },
  { code: 'wagrain', name: 'Wagrain-Kleinarl', bundesland: 'Salzburg', fallbackLat: 47.333, fallbackLng: 13.300 },
  { code: 'altenmarkt', name: 'Altenmarkt-Zauchensee', bundesland: 'Salzburg', fallbackLat: 47.381, fallbackLng: 13.425 },
  { code: 'hallein', name: 'Hallein', bundesland: 'Salzburg', fallbackLat: 47.687, fallbackLng: 13.098 },
  { code: 'werfen', name: 'Werfen', bundesland: 'Salzburg', fallbackLat: 47.479, fallbackLng: 13.189 },
  { code: 'abtenau', name: 'Abtenau', bundesland: 'Salzburg', fallbackLat: 47.564, fallbackLng: 13.349 },
  { code: 'golling', name: 'Golling', bundesland: 'Salzburg', fallbackLat: 47.592, fallbackLng: 13.167 },
  { code: 'annaberg', name: 'Annaberg-Lungoetz', bundesland: 'Salzburg', fallbackLat: 47.536, fallbackLng: 13.410 },
  { code: 'uttendorf', name: 'Uttendorf', bundesland: 'Salzburg', fallbackLat: 47.277, fallbackLng: 12.566 },
  { code: 'krimml', name: 'Krimml', bundesland: 'Salzburg', fallbackLat: 47.222, fallbackLng: 12.172 },

  // ── Kärnten ──
  { code: 'kaernten', name: 'Kaernten', bundesland: 'Kärnten', fallbackLat: 46.724, fallbackLng: 14.091 },
  { code: 'woerthersee', name: 'Woerthersee', bundesland: 'Kärnten', fallbackLat: 46.627, fallbackLng: 14.138 },
  { code: 'nassfeld', name: 'Nassfeld-Pressegger See', bundesland: 'Kärnten', fallbackLat: 46.559, fallbackLng: 13.280 },
  { code: 'badkleinkirchheim', name: 'Bad Kleinkirchheim', bundesland: 'Kärnten', fallbackLat: 46.813, fallbackLng: 13.793 },
  { code: 'villach', name: 'Villach', bundesland: 'Kärnten', fallbackLat: 46.611, fallbackLng: 13.851 },

  // ── Tirol ──
  { code: 'innsbruck', name: 'Innsbruck', bundesland: 'Tirol', fallbackLat: 47.260, fallbackLng: 11.395 },
  { code: 'zillertal', name: 'Zillertal', bundesland: 'Tirol', fallbackLat: 47.169, fallbackLng: 11.875 },
  { code: 'oetztal', name: 'Oetztal', bundesland: 'Tirol', fallbackLat: 47.014, fallbackLng: 10.860 },
  { code: 'stubaital', name: 'Stubaital', bundesland: 'Tirol', fallbackLat: 47.085, fallbackLng: 11.310 },
  { code: 'seefeld', name: 'Seefeld', bundesland: 'Tirol', fallbackLat: 47.330, fallbackLng: 11.188 },
  { code: 'kufstein', name: 'Kufstein', bundesland: 'Tirol', fallbackLat: 47.583, fallbackLng: 12.166 },
  { code: 'serfaus', name: 'Serfaus-Fiss-Ladis', bundesland: 'Tirol', fallbackLat: 47.039, fallbackLng: 10.602 },
  { code: 'ischgl', name: 'Ischgl-Paznaun', bundesland: 'Tirol', fallbackLat: 47.010, fallbackLng: 10.293 },
  { code: 'lech', name: 'Lech-Zuers', bundesland: 'Tirol', fallbackLat: 47.211, fallbackLng: 10.142 },
  { code: 'wipptal', name: 'Wipptal', bundesland: 'Tirol', fallbackLat: 47.085, fallbackLng: 11.460 },
  { code: 'mayrhofen', name: 'Mayrhofen', bundesland: 'Tirol', fallbackLat: 47.160, fallbackLng: 11.862 },
  { code: 'osttirol', name: 'Osttirol', bundesland: 'Tirol', fallbackLat: 46.828, fallbackLng: 12.770 },
  { code: 'tvbpitztal', name: 'Pitztal', bundesland: 'Tirol', fallbackLat: 47.014, fallbackLng: 10.764 },
  { code: 'pillerseetal', name: 'Pillerseetal', bundesland: 'Tirol', fallbackLat: 47.449, fallbackLng: 12.582 },
  { code: 'lechtal', name: 'Lechtal', bundesland: 'Tirol', fallbackLat: 47.261, fallbackLng: 10.555 },
  { code: 'reutte', name: 'Reutte-Naturparkregion', bundesland: 'Tirol', fallbackLat: 47.485, fallbackLng: 10.718 },
  { code: 'imst', name: 'Imst-Gurgltal', bundesland: 'Tirol', fallbackLat: 47.245, fallbackLng: 10.740 },
  { code: 'kirchberg', name: 'Kirchberg in Tirol', bundesland: 'Tirol', fallbackLat: 47.449, fallbackLng: 12.320 },
  { code: 'stanton', name: 'St. Anton am Arlberg', bundesland: 'Tirol', fallbackLat: 47.128, fallbackLng: 10.268 },
  { code: 'arlberg', name: 'Arlberg', bundesland: 'Tirol', fallbackLat: 47.130, fallbackLng: 10.212 },

  // ── Steiermark ──
  { code: 'thermenland', name: 'Thermenland Steiermark', bundesland: 'Steiermark', fallbackLat: 46.878, fallbackLng: 16.020 },
  { code: 'oststeiermark', name: 'Oststeiermark', bundesland: 'Steiermark', fallbackLat: 47.180, fallbackLng: 15.900 },
  { code: 'dachstein', name: 'Dachstein-Salzkammergut', bundesland: 'Steiermark', fallbackLat: 47.530, fallbackLng: 13.627 },
  { code: 'ausseerland', name: 'Ausseerland-Salzkammergut', bundesland: 'Steiermark', fallbackLat: 47.608, fallbackLng: 13.783 },
  { code: 'gesaeuse', name: 'Gesaeuse', bundesland: 'Steiermark', fallbackLat: 47.577, fallbackLng: 14.627 },

  // ── Oberösterreich ──
  { code: 'salzkammergut', name: 'Salzkammergut', bundesland: 'Oberösterreich', fallbackLat: 47.714, fallbackLng: 13.621 },
  { code: 'wels', name: 'Wels', bundesland: 'Oberösterreich', fallbackLat: 48.160, fallbackLng: 14.025 },
  { code: 'linz', name: 'Linz', bundesland: 'Oberösterreich', fallbackLat: 48.306, fallbackLng: 14.286 },

  // ── Niederösterreich ──
  { code: 'gmuend', name: 'Gmuend', bundesland: 'Niederösterreich', fallbackLat: 48.770, fallbackLng: 14.978 },

  // ── Vorarlberg ──
  // (lech and arlberg listed above under Tirol — they span both)
  { code: 'klostertal', name: 'Klostertal', bundesland: 'Vorarlberg', fallbackLat: 47.130, fallbackLng: 10.080 },

  // ── Kärnten extras ──
  { code: 'hohetauern', name: 'Hohe Tauern', bundesland: 'Kärnten', fallbackLat: 46.910, fallbackLng: 13.150 },
  { code: 'nationalpark', name: 'Nationalpark Region', bundesland: 'Kärnten', fallbackLat: 46.928, fallbackLng: 13.200 },
  { code: 'klagenfurt', name: 'Klagenfurt', bundesland: 'Kärnten', fallbackLat: 46.624, fallbackLng: 14.308 },
  { code: 'lesachtal', name: 'Lesachtal', bundesland: 'Kärnten', fallbackLat: 46.700, fallbackLng: 12.840 },
  { code: 'feldamsee', name: 'Feld am See', bundesland: 'Kärnten', fallbackLat: 46.775, fallbackLng: 13.748 },
  { code: 'weissensee', name: 'Weissensee', bundesland: 'Kärnten', fallbackLat: 46.713, fallbackLng: 13.300 },
  { code: 'rosental', name: 'Rosental', bundesland: 'Kärnten', fallbackLat: 46.540, fallbackLng: 14.180 },

  // ── Salzburg extras ──
  { code: 'zellkaprun', name: 'Zell am See-Kaprun', bundesland: 'Salzburg', fallbackLat: 47.323, fallbackLng: 12.796 },
  { code: 'filzmoos', name: 'Filzmoos', bundesland: 'Salzburg', fallbackLat: 47.435, fallbackLng: 13.522 },
  { code: 'eugendorf', name: 'Eugendorf', bundesland: 'Salzburg', fallbackLat: 47.867, fallbackLng: 13.130 },

  // ── Oberösterreich extras ──
  { code: 'pyhrn', name: 'Pyhrn-Priel', bundesland: 'Oberösterreich', fallbackLat: 47.715, fallbackLng: 14.116 },
  { code: 'traunseealmtal', name: 'Traunsee-Almtal', bundesland: 'Oberösterreich', fallbackLat: 47.862, fallbackLng: 13.789 },
  { code: 'donauooe', name: 'Donau Oberösterreich', bundesland: 'Oberösterreich', fallbackLat: 48.305, fallbackLng: 14.300 },

  // ── Tirol extras ──
  { code: 'halltirol', name: 'Hall in Tirol', bundesland: 'Tirol', fallbackLat: 47.289, fallbackLng: 11.508 },
  { code: 'kaiserwinkl', name: 'Kaiserwinkl', bundesland: 'Tirol', fallbackLat: 47.625, fallbackLng: 12.300 },
  { code: 'hochpustertal', name: 'Hochpustertal', bundesland: 'Tirol', fallbackLat: 46.740, fallbackLng: 12.420 },
  { code: 'ramsau', name: 'Ramsau am Dachstein', bundesland: 'Steiermark', fallbackLat: 47.421, fallbackLng: 13.643 },
];

// ─────────────────── API configuration ───────────────────

const API_BASE = 'https://webapi.deskline.net';
const DW_SOURCE = 'desklineweb';

/** Fields requested from the API — GraphQL-like field selection */
const EVENT_FIELDS = [
  'id',
  'name',
  'date',
  'hasMoreDates',
  'location{place,town,regions,country,coordinate{name,long,lat}}',
  'descriptions(types:[32]){description,type}',
  'images(count:1,sizes:[54]){urls}',
  'urlFriendlyName',
  'mainCriteria{id,name,value}',
  'eventGroups{id,name}',
].join(',');

const PAGE_SIZE = 50;

// ─────────────────── Helper functions ───────────────────

/** Generate a session ID in the format the widget uses */
function generateSessionId(): string {
  return `L${Date.now()}`;
}

/** Strip HTML tags from description */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Map Bundesland string from API regions to our Bundesland names */
function mapBundesland(regions: string[] | null, configBundesland: string): string {
  if (!regions || regions.length === 0) return configBundesland;

  const regionStr = regions.join(' ').toLowerCase();

  if (regionStr.includes('burgenland')) return 'Burgenland';
  if (regionStr.includes('wien') || regionStr.includes('vienna')) return 'Wien';
  if (regionStr.includes('niederösterreich') || regionStr.includes('niederoesterreich') || regionStr.includes('lower austria')) return 'Niederösterreich';
  if (regionStr.includes('oberösterreich') || regionStr.includes('oberoesterreich') || regionStr.includes('upper austria')) return 'Oberösterreich';
  if (regionStr.includes('salzburg')) return 'Salzburg';
  if (regionStr.includes('tirol') || regionStr.includes('tyrol')) return 'Tirol';
  if (regionStr.includes('vorarlberg')) return 'Vorarlberg';
  if (regionStr.includes('kärnten') || regionStr.includes('kaernten') || regionStr.includes('carinthia')) return 'Kärnten';
  if (regionStr.includes('steiermark') || regionStr.includes('styria')) return 'Steiermark';

  return configBundesland;
}

// ─────────────────── API response types ───────────────────

interface DesklineEvent {
  id: string;
  name: string;
  date: string;
  hasMoreDates?: boolean;
  location?: {
    place?: string;
    town?: string;
    regions?: string[];
    country?: string;
    coordinate?: {
      name?: string;
      long?: number;
      lat?: number;
    } | null;
  };
  descriptions?: Array<{
    description: string;
    type: number;
  }>;
  images?: Array<{
    urls?: string[];
  }>;
  urlFriendlyName?: string;
  mainCriteria?: {
    id: string;
    name: string;
    value: string;
  } | null;
  eventGroups?: Array<{
    id: string;
    name: string;
  }> | null;
}

interface DesklineResponse {
  data: DesklineEvent[];
  paging: {
    pageNo: number;
    pageSize: number;
    pageCount: number;
    totalRecordCount: number;
  };
  links: {
    prev: string | null;
    next: string | null;
  };
}

// ─────────────────── Scraper ───────────────────

export class FeratelScraper extends BaseScraper {
  readonly name = 'feratel-deskline';

  // Larger delay to be respectful — many regions to scrape
  protected delayMs = 500;

  // Max events per region to avoid overwhelming the API
  private maxEventsPerRegion = 500;

  // Track seen event IDs to deduplicate across regions
  private seenEventIds = new Set<string>();

  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];
    const sessionId = generateSessionId();

    this.log(`Starting Feratel Deskline scrape across ${REGIONS.length} regions`);

    for (const region of REGIONS) {
      try {
        const events = await this.scrapeRegion(region, sessionId);
        allEvents.push(...events);
        this.log(`${region.name}: ${events.length} events (${this.seenEventIds.size} unique total)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`${region.name}: FEHLER - ${msg}`);
      }

      // Rate limit between regions
      await this.rateLimit();
    }

    this.log(`Feratel scrape complete: ${allEvents.length} events from ${REGIONS.length} regions`);
    return allEvents;
  }

  private async scrapeRegion(region: FeratelRegionConfig, sessionId: string): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    let pageNo = 0;
    let totalPages = 1;

    while (pageNo < totalPages) {
      const url = `${API_BASE}/${region.code}/de/events?fields=${EVENT_FIELDS}&sortingFields=date&pageNo=${pageNo}&pageSize=${PAGE_SIZE}`;

      const response = await this.fetchApi(url, sessionId);
      if (!response) break;

      totalPages = response.paging.pageCount;

      for (const event of response.data) {
        // Deduplicate: skip events we've already seen from another region
        if (this.seenEventIds.has(event.id)) continue;
        this.seenEventIds.add(event.id);

        const parsed = this.parseEvent(event, region);
        if (parsed) events.push(parsed);
      }

      // Respect max events per region
      if (events.length >= this.maxEventsPerRegion) {
        this.log(`${region.name}: reached max ${this.maxEventsPerRegion} events, stopping pagination`);
        break;
      }

      pageNo++;

      // Rate limit between pages
      if (pageNo < totalPages) {
        await this.sleep(300);
      }
    }

    return events;
  }

  private async fetchApi(url: string, sessionId: string): Promise<DesklineResponse | null> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'DW-Source': DW_SOURCE,
            'DW-SessionId': sessionId,
            'User-Agent': this.userAgent,
          },
        });

        if (response.status === 429) {
          // Rate limited — wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          this.log(`Rate limited, waiting ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
        }

        return (await response.json()) as DesklineResponse;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`API attempt ${attempt}/${this.maxRetries} failed: ${msg}`);

        if (attempt < this.maxRetries) {
          await this.sleep(this.delayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    return null;
  }

  private parseEvent(event: DesklineEvent, region: FeratelRegionConfig): ScrapedEvent | null {
    if (!event.name || !event.date) return null;

    const title = event.name.trim();
    if (title.length < 3) return null;

    // Parse date — API returns ISO format "2026-03-29T16:00:00"
    const startDate = event.date;

    // Location
    const loc = event.location;
    const place = loc?.place?.trim();
    const town = loc?.town?.trim();
    const locationName = [place, town].filter(Boolean).join(', ') || town || region.name;

    // Coordinates — use from API if available, otherwise fallback to region center
    const lat = loc?.coordinate?.lat ?? region.fallbackLat;
    const lng = loc?.coordinate?.long ?? region.fallbackLng;

    // Bundesland — derive from API regions data or use config
    const bundesland = mapBundesland(loc?.regions ?? null, region.bundesland);

    // Description
    let description: string | undefined;
    if (event.descriptions && event.descriptions.length > 0) {
      const raw = event.descriptions[0].description;
      if (raw) {
        description = stripHtml(raw);
        if (description.length > 1000) {
          description = description.substring(0, 997) + '...';
        }
      }
    }

    // Image URL
    let imageUrl: string | undefined;
    if (event.images && event.images.length > 0 && event.images[0].urls && event.images[0].urls.length > 0) {
      let url = event.images[0].urls[0];
      // Fix protocol-relative URLs
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      imageUrl = this.cleanImageUrl(url);
    }

    // Source URL — construct from region code and urlFriendlyName
    const slug = event.urlFriendlyName || event.id;
    const sourceUrl = `https://webapi.deskline.net/${region.code}/de/events/${event.id}`;

    // Category
    const category = categorizeEvent(title + ' ' + (description || ''));

    // Tags from event groups
    const tags: string[] = [];
    if (event.eventGroups) {
      for (const group of event.eventGroups) {
        if (group.name) tags.push(group.name);
      }
    }
    if (event.mainCriteria?.name) {
      tags.push(event.mainCriteria.name);
    }

    return {
      source_id: `feratel-${event.id}`,
      source_name: 'feratel-deskline',
      source_url: sourceUrl,
      title,
      description,
      start_date: startDate,
      location_name: locationName,
      latitude: lat,
      longitude: lng,
      bundesland,
      category,
      image_url: imageUrl,
      tags: tags.length > 0 ? tags : undefined,
    };
  }
}
