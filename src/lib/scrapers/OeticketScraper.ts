import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getDistrictByPostalCodeAT, getDistrictByCoordsAT } from '../districtsAT';
import type { ScrapedEvent } from '@/types/events';

/**
 * oeticket.com Scraper — uses the public Eventim API directly (no Puppeteer).
 * Fetches all Austrian concerts, festivals, theater, and events.
 * API: https://public-api.eventim.com/websearch/search/api/exploration/v1/products
 *
 * This scraper paginates through ALL results (up to 50 per page) and filters
 * to Austrian events by checking city/venue against known AT cities and coords.
 */

interface EventimProduct {
  productId: string;
  productGroupId: string;
  name: string;
  description?: string;
  status: string;
  link?: string;
  url?: { path?: string; domain?: string };
  imageUrl?: string;
  inStock: boolean;
  typeAttributes?: {
    liveEntertainment?: {
      startDate?: string;
      endDate?: string;
      location?: {
        name?: string;
        city?: string;
        postalCode?: string;
        street?: string;
        country?: string;
        state?: string;
        geoLocation?: { latitude?: number; longitude?: number };
      };
    };
  };
  categories?: Array<{ name: string; parentCategory?: { name: string } }>;
}

const CITY_TO_BUNDESLAND: Record<string, string> = {
  'wien': 'wien', 'vienna': 'wien',
  'graz': 'steiermark', 'leoben': 'steiermark', 'kapfenberg': 'steiermark', 'leibnitz': 'steiermark', 'hartberg': 'steiermark', 'fürstenfeld': 'steiermark', 'judenburg': 'steiermark', 'knittelfeld': 'steiermark', 'weiz': 'steiermark', 'voitsberg': 'steiermark', 'murau': 'steiermark', 'liezen': 'steiermark', 'schladming': 'steiermark', 'bad aussee': 'steiermark',
  'linz': 'oberoesterreich', 'wels': 'oberoesterreich', 'steyr': 'oberoesterreich', 'gmunden': 'oberoesterreich', 'ried': 'oberoesterreich', 'braunau': 'oberoesterreich', 'vöcklabruck': 'oberoesterreich', 'freistadt': 'oberoesterreich', 'bad ischl': 'oberoesterreich', 'enns': 'oberoesterreich', 'attnang-puchheim': 'oberoesterreich', 'kirchdorf': 'oberoesterreich',
  'salzburg': 'salzburg', 'hallein': 'salzburg', 'zell am see': 'salzburg', 'saalfelden': 'salzburg', 'st. johann im pongau': 'salzburg', 'bischofshofen': 'salzburg', 'plainfeld': 'salzburg',
  'innsbruck': 'tirol', 'kufstein': 'tirol', 'kitzbühel': 'tirol', 'schwaz': 'tirol', 'lienz': 'tirol', 'wörgl': 'tirol', 'hall in tirol': 'tirol', 'imst': 'tirol', 'landeck': 'tirol', 'reutte': 'tirol', 'mayrhofen': 'tirol', 'erl': 'tirol',
  'klagenfurt': 'kaernten', 'villach': 'kaernten', 'spittal': 'kaernten', 'wolfsberg': 'kaernten', 'st. veit': 'kaernten', 'feldkirchen': 'kaernten', 'völkermarkt': 'kaernten', 'ossiach': 'kaernten',
  'bregenz': 'vorarlberg', 'dornbirn': 'vorarlberg', 'feldkirch': 'vorarlberg', 'hohenems': 'vorarlberg', 'lustenau': 'vorarlberg', 'bludenz': 'vorarlberg', 'rankweil': 'vorarlberg', 'hard': 'vorarlberg', 'götzis': 'vorarlberg',
  'st. pölten': 'niederoesterreich', 'krems': 'niederoesterreich', 'wiener neustadt': 'niederoesterreich', 'baden': 'niederoesterreich', 'mödling': 'niederoesterreich', 'amstetten': 'niederoesterreich', 'tulln': 'niederoesterreich', 'zwettl': 'niederoesterreich', 'korneuburg': 'niederoesterreich', 'hollabrunn': 'niederoesterreich', 'mistelbach': 'niederoesterreich', 'grafenegg': 'niederoesterreich', 'melk': 'niederoesterreich', 'spitz': 'niederoesterreich',
  'eisenstadt': 'burgenland', 'oberwart': 'burgenland', 'güssing': 'burgenland', 'neusiedl': 'burgenland', 'mattersburg': 'burgenland', 'oberpullendorf': 'burgenland', 'jennersdorf': 'burgenland', 'mörbisch': 'burgenland', 'rust': 'burgenland', 'kobersdorf': 'burgenland', 'nickelsdorf': 'burgenland',
};

// Austrian postal codes start with 1-9 and are 4 digits
function isAustrianPostalCode(code?: string): boolean {
  if (!code) return false;
  return /^[1-9]\d{3}$/.test(code);
}

export class OeticketScraper extends BaseScraper {
  readonly name = 'oeticket';
  private readonly API_BASE = 'https://public-api.eventim.com/websearch/search/api/exploration/v1/products';
  private readonly PAGE_SIZE = 50; // max allowed by API
  private readonly MAX_PAGES = 200; // 200 * 50 = 10.000 events max

  // Top-level categories to scrape — each separately to stay under API pagination limit (~103 pages)
  // Names from the API facets (hierarchicalItems)
  private readonly CATEGORIES = [
    'Konzerte',
    'Kabarett & Comedy',
    'Musical & Show',
    'Klassik & Kultur',
    'Sport',
    'Freizeit',
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte oeticket API-Scraping (direkt, kein Puppeteer)...');

    const allProducts = new Map<string, EventimProduct>();

    for (const category of this.CATEGORIES) {
      let page = 1;
      let categoryTotal = 0;
      const beforeCount = allProducts.size;

      while (page <= this.MAX_PAGES) {
        try {
          const url = `${this.API_BASE}?webId=web__oeticket-at&language=de&page=${page}&categories=${encodeURIComponent(category)}&sort=DateAsc&top=${this.PAGE_SIZE}`;
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            if (response.status === 429) {
              this.log(`Rate limited (${category} Seite ${page}), warte 5s...`);
              await this.sleep(5000);
              continue;
            }
            // API pagination limit reached — move to next category
            break;
          }

          const data = await response.json() as { products: EventimProduct[]; totalResults: number };
          if (page === 1) categoryTotal = data.totalResults;

          if (!data.products || data.products.length === 0) break;

          for (const p of data.products) {
            allProducts.set(p.productId, p);
          }

          if (data.products.length < this.PAGE_SIZE) break;

          page++;
          await this.sleep(150);
        } catch (err) {
          this.log(`Fehler bei ${category} Seite ${page}: ${err instanceof Error ? err.message : err}`);
          break;
        }
      }

      const newInCategory = allProducts.size - beforeCount;
      this.log(`${category}: ${newInCategory} neue (${categoryTotal} total in API, ${page - 1} Seiten)`);
    }

    this.log(`${allProducts.size} Produkte geladen, filtere nach Österreich...`);

    // Map products to events, filtering to Austria only
    const events: ScrapedEvent[] = [];
    const seenIds = new Set<string>();

    for (const product of allProducts.values()) {
      if (product.status === 'Cancelled') continue;

      const mapped = this.mapProduct(product);
      if (mapped && !seenIds.has(mapped.source_id)) {
        seenIds.add(mapped.source_id);
        events.push(mapped);
      }
    }

    this.log(`${events.length} österreichische Events gemappt (von ${allProducts.size} Produkten)`);
    return events;
  }

  private mapProduct(product: EventimProduct): ScrapedEvent | null {
    const la = product.typeAttributes?.liveEntertainment;
    if (!la?.startDate) return null;

    const location = la.location;
    if (!location?.city) return null;

    const city = location.city;
    const cityLower = city.toLowerCase().trim();

    // Determine Bundesland — by city name or postal code or coordinates
    let bundesland: string | undefined = CITY_TO_BUNDESLAND[cityLower];

    if (!bundesland) {
      // Try partial match
      for (const [key, bl] of Object.entries(CITY_TO_BUNDESLAND)) {
        if (cityLower.includes(key) || key.includes(cityLower)) {
          bundesland = bl;
          break;
        }
      }
    }

    const geo = location.geoLocation;
    const lat = geo?.latitude;
    const lng = geo?.longitude;

    if (!bundesland && isAustrianPostalCode(location.postalCode)) {
      const districtResult = getDistrictByPostalCodeAT(location.postalCode!);
      if (districtResult) bundesland = districtResult.bundesland;
    }

    if (!bundesland && lat && lng) {
      bundesland = this.getBundeslandByCoords(lat, lng);
    }

    // Skip non-Austrian events
    if (!bundesland) return null;

    // Category detection
    let category = categorizeEvent(product.name);
    if (category === 'Sonstiges' && product.categories?.length) {
      const cats = product.categories.map(c => c.name).join(' ').toLowerCase();
      if (cats.includes('konzert') || cats.includes('rock') || cats.includes('pop') || cats.includes('jazz') || cats.includes('klassik') || cats.includes('hip-hop') || cats.includes('electronic')) category = 'Musik';
      else if (cats.includes('sport')) category = 'Sport';
      else if (cats.includes('theater') || cats.includes('kabarett') || cats.includes('comedy') || cats.includes('musical')) category = 'Kultur';
      else if (cats.includes('family') || cats.includes('kinder') || cats.includes('familie')) category = 'Familie';
      else if (cats.includes('festival') || cats.includes('party')) category = 'Musik';
      else if (cats.includes('ausstellung') || cats.includes('messe')) category = 'Kultur';
    }

    // District
    let district: string | undefined;
    if (location.postalCode) {
      const result = getDistrictByPostalCodeAT(location.postalCode);
      if (result?.bundesland === bundesland) district = result.district;
    }
    if (!district && lat && lng) {
      district = getDistrictByCoordsAT(lat, lng, bundesland) || undefined;
    }

    // URL
    let sourceUrl = 'https://www.oeticket.com';
    if (product.link) {
      sourceUrl = product.link;
    } else if (product.url?.path) {
      sourceUrl = `${product.url.domain || 'https://www.oeticket.com'}${product.url.path}`;
    }

    // Price from URL or description
    const priceMatch = product.description?.match(/(?:ab|from)\s*€?\s*(\d+[.,]\d{2})/i);
    const priceText = priceMatch ? `ab € ${priceMatch[1]}` : undefined;

    return {
      source_id: `oeticket-${product.productId}`,
      source_name: this.name,
      source_url: sourceUrl,
      title: product.name,
      description: product.description?.slice(0, 1000) || undefined,
      start_date: la.startDate,
      end_date: la.endDate || undefined,
      location_name: location.name || city,
      address: location.street ? `${location.street}, ${location.postalCode || ''} ${city}`.trim() : city,
      postal_code: location.postalCode || undefined,
      district,
      bundesland,
      latitude: lat || undefined,
      longitude: lng || undefined,
      category,
      image_url: product.imageUrl || undefined,
      price_text: priceText,
      ticket_url: sourceUrl,
    };
  }

  private getBundeslandByCoords(lat: number, lng: number): string | undefined {
    if (lat >= 48.11 && lat <= 48.33 && lng >= 16.18 && lng <= 16.58) return 'wien';
    if (lat >= 46.80 && lat <= 48.10 && lng >= 16.00 && lng <= 17.20) return 'burgenland';
    if (lat >= 47.40 && lat <= 48.97 && lng >= 14.45 && lng <= 17.07) return 'niederoesterreich';
    if (lat >= 47.45 && lat <= 48.77 && lng >= 13.42 && lng <= 14.99) return 'oberoesterreich';
    if (lat >= 46.95 && lat <= 47.85 && lng >= 12.58 && lng <= 13.68) return 'salzburg';
    if (lat >= 46.60 && lat <= 47.83 && lng >= 13.55 && lng <= 16.17) return 'steiermark';
    if (lat >= 46.37 && lat <= 47.13 && lng >= 12.65 && lng <= 15.05) return 'kaernten';
    if (lat >= 46.65 && lat <= 47.75 && lng >= 10.10 && lng <= 12.97) return 'tirol';
    if (lat >= 46.84 && lat <= 47.59 && lng >= 9.52 && lng <= 10.24) return 'vorarlberg';
    return undefined;
  }
}
