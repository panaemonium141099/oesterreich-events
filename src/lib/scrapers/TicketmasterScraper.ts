import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getDistrictByPostalCodeAT, getDistrictByCoordsAT } from '../districtsAT';
import type { ScrapedEvent } from '@/types/events';

interface TMEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: { localDate: string; localTime?: string };
    end?: { localDate?: string };
  };
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  priceRanges?: Array<{ min: number; max: number; currency: string }>;
  images?: Array<{ url: string; width: number; height: number; ratio?: string }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      city?: { name: string };
      address?: { line1: string };
      postalCode?: string;
      state?: { name: string; stateCode: string };
      location?: { latitude: string; longitude: string };
    }>;
    attractions?: Array<{ name: string }>;
  };
  info?: string;
  pleaseNote?: string;
}

// Map Austrian cities/venues to Bundesland
const BUNDESLAND_BY_CITY: Record<string, string> = {
  'wien': 'wien', 'vienna': 'wien',
  'graz': 'steiermark', 'leoben': 'steiermark', 'kapfenberg': 'steiermark', 'bruck an der mur': 'steiermark',
  'linz': 'oberoesterreich', 'wels': 'oberoesterreich', 'steyr': 'oberoesterreich', 'gmunden': 'oberoesterreich',
  'salzburg': 'salzburg', 'hallein': 'salzburg', 'zell am see': 'salzburg', 'saalfelden': 'salzburg',
  'innsbruck': 'tirol', 'hall in tirol': 'tirol', 'schwaz': 'tirol', 'kufstein': 'tirol', 'kitzbühel': 'tirol', 'lienz': 'tirol', 'wörgl': 'tirol',
  'klagenfurt': 'kaernten', 'villach': 'kaernten', 'spittal an der drau': 'kaernten', 'wolfsberg': 'kaernten',
  'bregenz': 'vorarlberg', 'dornbirn': 'vorarlberg', 'feldkirch': 'vorarlberg', 'hohenems': 'vorarlberg', 'lustenau': 'vorarlberg',
  'st. pölten': 'niederoesterreich', 'krems': 'niederoesterreich', 'wiener neustadt': 'niederoesterreich', 'baden': 'niederoesterreich', 'mödling': 'niederoesterreich',
  'eisenstadt': 'burgenland', 'oberwart': 'burgenland', 'neusiedl am see': 'burgenland', 'güssing': 'burgenland', 'mattersburg': 'burgenland',
};

// Bounding boxes per Bundesland (rough)
const BUNDESLAND_BOUNDS: Record<string, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  wien: { latMin: 48.11, latMax: 48.33, lngMin: 16.18, lngMax: 16.58 },
  niederoesterreich: { latMin: 47.40, latMax: 48.97, lngMin: 14.45, lngMax: 17.07 },
  burgenland: { latMin: 46.80, latMax: 48.10, lngMin: 16.00, lngMax: 17.20 },
  oberoesterreich: { latMin: 47.45, latMax: 48.77, lngMin: 13.42, lngMax: 14.99 },
  salzburg: { latMin: 46.95, latMax: 47.85, lngMin: 12.58, lngMax: 13.68 },
  steiermark: { latMin: 46.60, latMax: 47.83, lngMin: 13.55, lngMax: 16.17 },
  kaernten: { latMin: 46.37, latMax: 47.13, lngMin: 12.65, lngMax: 15.05 },
  tirol: { latMin: 46.65, latMax: 47.75, lngMin: 10.10, lngMax: 12.97 },
  vorarlberg: { latMin: 46.84, latMax: 47.59, lngMin: 9.52, lngMax: 10.24 },
};

function getBundeslandByCoords(lat: number, lng: number): string | undefined {
  // Wien has highest priority (inside NÖ bounds)
  if (lat >= 48.11 && lat <= 48.33 && lng >= 16.18 && lng <= 16.58) return 'wien';
  for (const [bl, b] of Object.entries(BUNDESLAND_BOUNDS)) {
    if (bl === 'wien') continue;
    if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) return bl;
  }
  return undefined;
}

export class TicketmasterScraper extends BaseScraper {
  readonly name = 'ticketmaster';
  private readonly API_KEY = process.env.TICKETMASTER_API_KEY || '';
  private readonly BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

  async scrape(): Promise<ScrapedEvent[]> {
    if (!this.API_KEY) {
      this.log('TICKETMASTER_API_KEY nicht gesetzt — Scraper übersprungen.');
      return [];
    }
    this.log('Starte Ticketmaster API Scraping für ganz Österreich...');

    const allEvents = new Map<string, ScrapedEvent>();
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < 10) {
      try {
        const params = new URLSearchParams({
          apikey: this.API_KEY,
          countryCode: 'AT',
          size: '200',
          page: String(page),
          sort: 'date,asc',
        });

        const url = `${this.BASE_URL}/events.json?${params}`;
        const response = await fetch(url);

        if (response.status === 429) {
          this.log('Rate limit, warte 2s...');
          await this.sleep(2000);
          continue;
        }

        if (!response.ok) {
          this.log(`API Fehler: ${response.status}`);
          break;
        }

        const data = await response.json();
        totalPages = data.page?.totalPages || 1;
        const events: TMEvent[] = data._embedded?.events || [];
        this.log(`Seite ${page + 1}/${totalPages}: ${events.length} Events`);

        for (const event of events) {
          if (allEvents.has(event.id)) continue;
          const mapped = this.mapEvent(event);
          if (mapped) allEvents.set(event.id, mapped);
        }

        page++;
        await this.sleep(300);
      } catch (err) {
        this.log(`Fehler Seite ${page}: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    this.log(`${allEvents.size} AT-Events gefunden`);
    return Array.from(allEvents.values());
  }

  private mapEvent(event: TMEvent): ScrapedEvent | null {
    const venue = event._embedded?.venues?.[0];
    let lat = venue?.location ? parseFloat(venue.location.latitude) : 0;
    let lng = venue?.location ? parseFloat(venue.location.longitude) : 0;

    // Skip events without valid coordinates
    if (!lat || !lng || (lat === 0 && lng === 0)) return null;

    // Determine Bundesland
    const city = venue?.city?.name || '';
    let bundesland = BUNDESLAND_BY_CITY[city.toLowerCase()] || getBundeslandByCoords(lat, lng);
    if (!bundesland) return null; // Not in Austria

    // District assignment
    const postalCodeStr = venue?.postalCode || undefined;
    let district: string | undefined;
    if (postalCodeStr) {
      const districtResult = getDistrictByPostalCodeAT(postalCodeStr);
      if (districtResult && districtResult.bundesland === bundesland) {
        district = districtResult.district;
      }
    }
    if (!district) {
      district = getDistrictByCoordsAT(lat, lng, bundesland) || undefined;
    }

    const classification = event.classifications?.[0];
    const genre = classification?.genre?.name;
    const segment = classification?.segment?.name;

    let category = categorizeEvent(event.name);
    if (category === 'Sonstiges' && segment) {
      if (segment === 'Music') category = 'Musik';
      else if (segment === 'Sports') category = 'Sport';
      else if (segment === 'Arts & Theatre') category = 'Kultur';
      else if (segment === 'Film') category = 'Kultur';
    }

    let priceText: string | undefined;
    let priceMin: number | undefined;
    let priceMax: number | undefined;
    if (event.priceRanges?.length) {
      const pr = event.priceRanges[0];
      priceMin = pr.min;
      priceMax = pr.max;
      priceText = pr.min === pr.max
        ? `€ ${pr.min.toFixed(2).replace('.', ',')}`
        : `€ ${pr.min.toFixed(2).replace('.', ',')} - € ${pr.max.toFixed(2).replace('.', ',')}`;
    }

    const image = event.images
      ?.sort((a, b) => {
        const aScore = (a.ratio === '16_9' ? 1000 : 0) + a.width;
        const bScore = (b.ratio === '16_9' ? 1000 : 0) + b.width;
        return bScore - aScore;
      })?.[0];

    const parts: string[] = [];
    if (event.info) parts.push(event.info);
    if (event.pleaseNote) parts.push(event.pleaseNote);
    if (genre && genre !== 'Undefined') parts.push(`Genre: ${genre}`);
    const attraction = event._embedded?.attractions?.[0]?.name;
    if (attraction && attraction !== event.name) parts.push(`Künstler: ${attraction}`);

    let sourceUrl = event.url;
    try {
      const urlObj = new URL(event.url);
      const realUrl = urlObj.searchParams.get('u');
      if (realUrl) sourceUrl = decodeURIComponent(realUrl);
    } catch { /* keep original */ }

    const address = venue?.address?.line1 ? `${venue.address.line1}, ${venue.postalCode || ''} ${city}` : city;

    return {
      source_id: `ticketmaster-${event.id}`,
      source_name: this.name,
      source_url: sourceUrl,
      title: event.name,
      description: parts.join('\n') || undefined,
      start_date: event.dates.start.localTime
        ? `${event.dates.start.localDate}T${event.dates.start.localTime}`
        : event.dates.start.localDate,
      end_date: event.dates.end?.localDate || undefined,
      location_name: venue?.name || city,
      address,
      postal_code: venue?.postalCode || undefined,
      district,
      bundesland,
      category,
      price_text: priceText,
      price_min: priceMin,
      price_max: priceMax,
      image_url: image?.url || undefined,
      organizer: attraction || undefined,
    };
  }
}
