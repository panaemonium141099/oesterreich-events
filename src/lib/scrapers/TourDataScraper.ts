import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * TourData / austria.info API Scraper
 *
 * Uses the tourdata.at OEW API to fetch events from all regional tourism
 * organizations across Austria. Requires an API key (contact api@austria.info).
 *
 * API: https://oew.tourdata.at/api/dataspace/GetJsonProxy.php
 * License: CC-BY 4.0 (Open Data)
 * Auth: API key required (env: TOURDATA_API_KEY)
 *
 * If no API key is configured, the scraper logs a message and returns [].
 */

interface TourDataEvent {
  ID?: string;
  Title?: string;
  Description?: string;
  StartDate?: string;
  EndDate?: string;
  Location?: string;
  Street?: string;
  PostalCode?: string;
  City?: string;
  County?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  ImageUrl?: string;
  Url?: string;
  Organizer?: string;
  Categories?: string[];
  Price?: string;
  PriceFrom?: number;
  PriceTo?: number;
}

/** Map tourdata County/Region names to our Bundesland format */
const COUNTY_TO_BUNDESLAND: Record<string, string> = {
  'wien': 'Wien',
  'vienna': 'Wien',
  'niederösterreich': 'Niederösterreich',
  'lower austria': 'Niederösterreich',
  'oberösterreich': 'Oberösterreich',
  'upper austria': 'Oberösterreich',
  'salzburg': 'Salzburg',
  'tirol': 'Tirol',
  'tyrol': 'Tirol',
  'vorarlberg': 'Vorarlberg',
  'kärnten': 'Kärnten',
  'carinthia': 'Kärnten',
  'steiermark': 'Steiermark',
  'styria': 'Steiermark',
  'burgenland': 'Burgenland',
};

function mapBundesland(county: string | undefined): string | undefined {
  if (!county) return undefined;
  return COUNTY_TO_BUNDESLAND[county.toLowerCase()] ?? undefined;
}

export class TourDataScraper extends BaseScraper {
  readonly name = 'tourdata';
  private readonly API_KEY = process.env.TOURDATA_API_KEY || '';
  private readonly BASE_URL = 'https://oew.tourdata.at/api/dataspace/GetJsonProxy.php';

  // Counties to query — all Austrian Bundeslaender
  private readonly COUNTIES = [
    'Wien', 'Niederösterreich', 'Oberösterreich', 'Salzburg',
    'Tirol', 'Vorarlberg', 'Kärnten', 'Steiermark', 'Burgenland',
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    if (!this.API_KEY) {
      this.log(
        'TOURDATA_API_KEY nicht gesetzt — Scraper übersprungen. ' +
        'API key erforderlich (Kontakt: api@austria.info). ' +
        'Lizenz: CC-BY 4.0 Open Data.'
      );
      return [];
    }

    const allEvents: ScrapedEvent[] = [];
    const seenIds = new Set<string>();

    for (const county of this.COUNTIES) {
      try {
        const events = await this.scrapeCounty(county, seenIds);
        allEvents.push(...events);
        this.log(`${county}: ${events.length} events`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`${county}: FEHLER - ${msg}`);
      }

      await this.rateLimit();
    }

    this.log(`TourData scrape complete: ${allEvents.length} events total`);
    return allEvents;
  }

  private async scrapeCounty(county: string, seenIds: Set<string>): Promise<ScrapedEvent[]> {
    const params = new URLSearchParams({
      ApiKey: this.API_KEY,
      ObjectType: 'Veranstaltung',
      County: county,
      Format: 'json',
    });

    const url = `${this.BASE_URL}?${params.toString()}`;
    const response = await this.fetchPage(url);

    let data: TourDataEvent[];
    try {
      const parsed = JSON.parse(response);
      // API may return { Items: [...] } or just [...]
      data = Array.isArray(parsed) ? parsed : (parsed.Items || parsed.data || []);
    } catch {
      this.log(`${county}: Ungültiges JSON erhalten`);
      return [];
    }

    if (!Array.isArray(data)) {
      this.log(`${county}: Unerwartetes Datenformat`);
      return [];
    }

    const events: ScrapedEvent[] = [];

    for (const item of data) {
      if (!item.Title || !item.StartDate) continue;

      const id = item.ID || `${item.Title}-${item.StartDate}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const event = this.parseEvent(item, county);
      if (event) events.push(event);
    }

    return events;
  }

  private parseEvent(item: TourDataEvent, county: string): ScrapedEvent | null {
    const title = item.Title?.trim();
    if (!title || title.length < 3) return null;

    const startDate = item.StartDate;
    if (!startDate) return null;

    // Coordinates
    const lat = typeof item.Latitude === 'string' ? parseFloat(item.Latitude) : item.Latitude;
    const lng = typeof item.Longitude === 'string' ? parseFloat(item.Longitude) : item.Longitude;

    // Location
    const locationParts = [item.Location, item.City].filter(Boolean);
    const locationName = locationParts.join(', ') || undefined;

    // Address
    const addressParts = [item.Street, item.PostalCode, item.City].filter(Boolean);
    const address = addressParts.join(', ') || undefined;

    // Bundesland
    const bundesland = mapBundesland(item.County) || mapBundesland(county);

    // Description (strip HTML if present)
    let description = item.Description?.trim();
    if (description) {
      description = description
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
      if (description.length > 1000) {
        description = description.substring(0, 997) + '...';
      }
    }

    // Image
    const imageUrl = item.ImageUrl ? this.cleanImageUrl(item.ImageUrl) : undefined;

    // Category
    const categoryText = [title, description || '', ...(item.Categories || [])].join(' ');
    const category = categorizeEvent(categoryText);

    // Tags from source categories
    const tags = item.Categories?.filter(c => c && c.length > 0) || undefined;

    // Source ID — deterministic
    const sourceId = `tourdata-${item.ID || Buffer.from(`${title}-${startDate}`).toString('base64').substring(0, 20)}`;

    return {
      source_id: sourceId,
      source_name: 'tourdata',
      source_url: item.Url || `https://www.austria.info/de/aktivitaeten/veranstaltungen`,
      title,
      description,
      start_date: startDate,
      end_date: item.EndDate || undefined,
      location_name: locationName,
      address,
      postal_code: item.PostalCode || undefined,
      bundesland,
      latitude: lat && !isNaN(lat) ? lat : undefined,
      longitude: lng && !isNaN(lng) ? lng : undefined,
      category,
      price_text: item.Price || undefined,
      price_min: item.PriceFrom || undefined,
      price_max: item.PriceTo || undefined,
      image_url: imageUrl,
      organizer: item.Organizer || undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
    };
  }
}
