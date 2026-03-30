import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getDistrictByPostalCodeAT, getDistrictByCoordsAT } from '../districtsAT';
import type { ScrapedEvent } from '@/types/events';

interface OeticketProduct {
  productGroupId: number;
  name: string;
  typeAttributes?: string[];
  startDate?: string;
  endDate?: string;
  description?: string;
  products?: Record<string, unknown>[];
  venue?: {
    name: string;
    city: string;
    postalCode?: string;
    street?: string;
    country?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  };
  imageUrl?: string;
  url?: string | { pathname: string };
  priceFrom?: number;
  priceTo?: number;
  currency?: string;
  categories?: Array<{ name: string; parentCategory?: { name: string } }>;
  attractions?: Array<{ name: string }>;
}

const CITY_TO_BUNDESLAND: Record<string, string> = {
  'wien': 'wien', 'vienna': 'wien',
  'graz': 'steiermark', 'leoben': 'steiermark', 'kapfenberg': 'steiermark', 'leibnitz': 'steiermark', 'hartberg': 'steiermark', 'fürstenfeld': 'steiermark', 'judenburg': 'steiermark', 'knittelfeld': 'steiermark', 'weiz': 'steiermark',
  'linz': 'oberoesterreich', 'wels': 'oberoesterreich', 'steyr': 'oberoesterreich', 'gmunden': 'oberoesterreich', 'ried': 'oberoesterreich', 'braunau': 'oberoesterreich', 'vöcklabruck': 'oberoesterreich', 'freistadt': 'oberoesterreich',
  'salzburg': 'salzburg', 'hallein': 'salzburg', 'zell am see': 'salzburg', 'saalfelden': 'salzburg', 'st. johann im pongau': 'salzburg', 'bischofshofen': 'salzburg',
  'innsbruck': 'tirol', 'kufstein': 'tirol', 'kitzbühel': 'tirol', 'schwaz': 'tirol', 'lienz': 'tirol', 'wörgl': 'tirol', 'hall in tirol': 'tirol', 'imst': 'tirol', 'landeck': 'tirol', 'reutte': 'tirol',
  'klagenfurt': 'kaernten', 'villach': 'kaernten', 'spittal': 'kaernten', 'wolfsberg': 'kaernten', 'st. veit': 'kaernten', 'feldkirchen': 'kaernten', 'völkermarkt': 'kaernten',
  'bregenz': 'vorarlberg', 'dornbirn': 'vorarlberg', 'feldkirch': 'vorarlberg', 'hohenems': 'vorarlberg', 'lustenau': 'vorarlberg', 'bludenz': 'vorarlberg', 'rankweil': 'vorarlberg', 'hard': 'vorarlberg',
  'st. pölten': 'niederoesterreich', 'krems': 'niederoesterreich', 'wiener neustadt': 'niederoesterreich', 'baden': 'niederoesterreich', 'mödling': 'niederoesterreich', 'amstetten': 'niederoesterreich', 'tulln': 'niederoesterreich', 'zwettl': 'niederoesterreich', 'korneuburg': 'niederoesterreich', 'hollabrunn': 'niederoesterreich', 'mistelbach': 'niederoesterreich',
  'eisenstadt': 'burgenland', 'oberwart': 'burgenland', 'güssing': 'burgenland', 'neusiedl': 'burgenland', 'mattersburg': 'burgenland', 'oberpullendorf': 'burgenland', 'jennersdorf': 'burgenland', 'mörbisch': 'burgenland', 'rust': 'burgenland',
};

export class OeticketScraper extends BaseScraper {
  readonly name = 'oeticket';
  private readonly API_BASE = 'https://public-api.eventim.com/websearch/search/api/exploration/v2';
  private readonly HEADERS: Record<string, string> = {
    'Accept': 'application/json',
    'oidc-client-id': 'web__oeticket-at',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://www.oeticket.com/',
    'Origin': 'https://www.oeticket.com',
  };

  // Austrian cities to search - covers all Bundesländer
  private readonly SEARCH_CITIES = [
    'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt',
    'Bregenz', 'Eisenstadt', 'St. Pölten', 'Villach', 'Wels',
    'Dornbirn', 'Wiener Neustadt', 'Steyr', 'Feldkirch', 'Wolfsberg',
    'Baden', 'Mödling', 'Krems', 'Amstetten', 'Kapfenberg', 'Leoben',
    'Hallein', 'Kufstein', 'Oberwart', 'Güssing', 'Neusiedl',
    'Mattersburg', 'Kitzbühel', 'Zell am See', 'Tulln', 'Korneuburg',
    'Gmunden', 'Mörbisch', 'St. Margarethen',
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte oeticket Scraping für ganz Österreich via Puppeteer...');

    try {
      const puppeteer = require('puppeteer-core');
      const browser = await puppeteer.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: 'shell',
        args: ['--no-sandbox', '--disable-http2'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

      const allProducts = new Map<number, OeticketProduct>();

      for (const city of this.SEARCH_CITIES) {
        try {
          // Navigate to search page to trigger API call
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let apiResult: any = null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const responseHandler = async (res: any) => {
            if (res.url().includes('productGroups') && res.url().includes('exploration') && res.status() === 200) {
              try { apiResult = await res.json() as typeof apiResult; } catch {}
            }
          };
          page.on('response', responseHandler);

          await page.goto(`https://www.oeticket.com/search/?searchterm=${encodeURIComponent(city)}`, {
            waitUntil: 'networkidle0', timeout: 30000,
          });
          await this.sleep(4000);

          page.removeAllListeners('response');

          if (!apiResult) {
            this.log(`${city}: keine API-Antwort`);
            continue;
          }

          const total = apiResult.totalResults;
          const firstPage = apiResult.productGroups || [];
          firstPage.forEach((p: OeticketProduct) => allProducts.set(p.productGroupId, p));
          this.log(`${city}: ${total} total, ${firstPage.length} auf Seite 1`);

          // Fetch remaining pages via browser context
          if (total > 20) {
            const totalPages = Math.min(apiResult.totalPages, 10); // Max 10 pages per city
            for (let pg = 1; pg < totalPages; pg++) {
              const data = await page.evaluate(async (searchTerm: string, pageNum: number) => {
                const r = await fetch(`https://public-api.eventim.com/websearch/search/api/exploration/v2/productGroups?webId=web__oeticket-at&search_term=${encodeURIComponent(searchTerm)}&language=de&retail_partner=EOE&sort=DateAsc&page=${pageNum}&tags=DISABLE_FBS`);
                return await r.json();
              }, city, pg);

              if (data?.productGroups) {
                data.productGroups.forEach((p: OeticketProduct) => allProducts.set(p.productGroupId, p));
              }
              await this.sleep(500);
            }
          }
        } catch (err) {
          this.log(`${city}: Fehler - ${err instanceof Error ? err.message : err}`);
        }
      }

      await browser.close();

      // Map all products to events - each sub-product (with its own venue/date) becomes an event
      const events: ScrapedEvent[] = [];
      const seenIds = new Set<string>();
      for (const pg of allProducts.values()) {
        const subEvents = this.mapProductGroup(pg);
        for (const e of subEvents) {
          if (!seenIds.has(e.source_id)) {
            seenIds.add(e.source_id);
            events.push(e);
          }
        }
      }

      this.log(`${events.length} AT-Events gemappt (${allProducts.size} unique product groups)`);
      return events;
    } catch (err) {
      this.log(`Puppeteer fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private mapProductGroup(pg: OeticketProduct): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const products = pg.products;

    // Category from productGroup categories
    let category = categorizeEvent(pg.name);
    if (category === 'Sonstiges' && pg.categories?.length) {
      const cats = pg.categories.map(c => c.name).join(' ').toLowerCase();
      if (cats.includes('konzert') || cats.includes('rock') || cats.includes('pop') || cats.includes('jazz') || cats.includes('klassik')) category = 'Musik';
      else if (cats.includes('sport')) category = 'Sport';
      else if (cats.includes('theater') || cats.includes('kabarett') || cats.includes('comedy') || cats.includes('musical')) category = 'Kultur';
      else if (cats.includes('family') || cats.includes('kinder') || cats.includes('familie')) category = 'Familie';
      else if (cats.includes('festival') || cats.includes('party')) category = 'Musik';
    }

    if (!products || products.length === 0) {
      // No sub-products, skip
      return events;
    }

    for (const product of products) {
      const typeAttrs = product.typeAttributes as Record<string, unknown> | undefined;
      const liveEnt = typeAttrs?.liveEntertainment as Record<string, unknown> | undefined;
      const location = liveEnt?.location as Record<string, unknown> | undefined;

      if (!location?.city) continue;

      const city = String(location.city);
      const cityLower = city.toLowerCase().trim();

      // Determine Bundesland
      let bundesland: string | undefined = CITY_TO_BUNDESLAND[cityLower];
      if (!bundesland) {
        for (const [key, bl] of Object.entries(CITY_TO_BUNDESLAND)) {
          if (cityLower.includes(key) || key.includes(cityLower)) {
            bundesland = bl;
            break;
          }
        }
      }

      const geoLoc = location.geoLocation as Record<string, number> | undefined;
      const lat = geoLoc?.latitude;
      const lng = geoLoc?.longitude;

      if (!bundesland && lat && lng) {
        bundesland = this.getBundeslandByCoords(lat, lng);
      }

      if (!bundesland) continue;

      const startDate = String(liveEnt?.startDate || pg.startDate || new Date().toISOString().slice(0, 10));
      const venueName = String(location.name || city);
      const postalCode = location.postalCode ? String(location.postalCode) : undefined;
      const street = location.street ? String(location.street) : undefined;

      // District assignment
      let district: string | undefined;
      if (postalCode) {
        const districtResult = getDistrictByPostalCodeAT(postalCode);
        if (districtResult && districtResult.bundesland === bundesland) {
          district = districtResult.district;
        }
      }
      if (!district && lat && lng) {
        district = getDistrictByCoordsAT(lat, lng, bundesland) || undefined;
      }

      // URL
      const productUrl = product.url as { path?: string; domain?: string } | string | undefined;
      let sourceUrl = 'https://www.oeticket.com';
      if (productUrl) {
        if (typeof productUrl === 'string') {
          sourceUrl = productUrl.startsWith('http') ? productUrl : `https://www.oeticket.com${productUrl}`;
        } else if (productUrl.path) {
          sourceUrl = `${productUrl.domain || 'https://www.oeticket.com'}${productUrl.path}`;
        }
      } else if (product.link) {
        sourceUrl = String(product.link);
      }

      events.push({
        source_id: `oeticket-${product.productId || pg.productGroupId}`,
        source_name: this.name,
        source_url: sourceUrl,
        title: pg.name,
        description: pg.description?.slice(0, 500) || undefined,
        start_date: startDate,
        location_name: venueName,
        address: street ? `${street}, ${postalCode || ''} ${city}` : city,
        postal_code: postalCode,
        district,
        bundesland,
        latitude: lat || undefined,
        longitude: lng || undefined,
        category,
        image_url: pg.imageUrl || undefined,
        organizer: pg.name.split(' - ')[0] || undefined,
      });
    }

    return events;
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
