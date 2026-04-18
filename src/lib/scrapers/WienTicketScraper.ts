import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * Wien-Ticket Scraper
 *
 * Scrapes event listings from wien-ticket.at, one of Austria's largest
 * ticketing platforms focused on Vienna cultural events, concerts, musicals,
 * theater, sport, and exhibitions.
 *
 * Approach:
 * 1. Fetch category landing pages which list featured events
 * 2. Collect event detail URLs (/de/ticket/{id}/{slug})
 * 3. Fetch each detail page and extract JSON-LD Event structured data
 *
 * The JSON-LD on detail pages includes: name, startDate, endDate, location
 * (with geo coords), offers (price), image, organizer, performer, and
 * ticket URL.
 *
 * Source: https://www.wien-ticket.at
 */

/** Wien-Ticket category pages to scrape for event links */
const CATEGORY_PAGES = [
  { url: '/de/konzerte', label: 'Konzerte' },
  { url: '/de/musicals-shows', label: 'Musicals & Shows' },
  { url: '/de/klassik-theater-kabarett', label: 'Klassik, Theater & Kabarett' },
  { url: '/de/sport', label: 'Sport' },
  { url: '/de/museum-ausstellung-freizeit', label: 'Museum, Ausstellung & Freizeit' },
];

const BASE_URL = 'https://www.wien-ticket.at';

/** Extract ticket/event links from an HTML page */
function extractEventLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $('a[href*="/de/ticket/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /^\/de\/ticket\/\d+\//.test(href)) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!links.includes(fullUrl)) {
        links.push(fullUrl);
      }
    }
  });

  return links;
}

/** JSON-LD Event schema as found on wien-ticket.at detail pages */
interface WienTicketJsonLd {
  '@context'?: string;
  '@type'?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  image?: string;
  inLanguage?: string;
  url?: string;
  location?: {
    '@type'?: string;
    name?: string;
    address?: {
      '@type'?: string;
      addressCountry?: string;
      addressLocality?: string;
      postalCode?: string;
      streetAddress?: string;
    };
    geo?: {
      '@type'?: string;
      latitude?: string | number;
      longitude?: string | number;
    };
    image?: string;
  };
  offers?: {
    '@type'?: string;
    price?: number | string;
    priceCurrency?: string;
    url?: string;
    availability?: string;
  };
  organizer?: {
    '@type'?: string;
    name?: string;
  };
  performer?: {
    '@type'?: string;
    name?: string;
    url?: string;
    image?: string;
  } | Array<{
    '@type'?: string;
    name?: string;
  }>;
}

export class WienTicketScraper extends BaseScraper {
  readonly name = 'wien-ticket';

  // Be respectful with rate limiting
  protected delayMs = 1500;

  // Max events to scrape (each requires a detail page fetch)
  private readonly MAX_EVENTS = 300;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Wien-Ticket Scraping...');
    const eventUrls = new Set<string>();

    // Phase 1: Collect event URLs from category pages
    for (const cat of CATEGORY_PAGES) {
      try {
        const url = `${BASE_URL}${cat.url}`;
        this.log(`Kategorie ${cat.label}: ${url}`);
        const html = await this.fetchPage(url);
        const links = extractEventLinks(html);
        links.forEach(l => eventUrls.add(l));
        this.log(`  ${links.length} Event-Links gefunden (gesamt: ${eventUrls.size})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  ${cat.label}: FEHLER - ${msg}`);
      }

      await this.sleep(800);
    }

    if (eventUrls.size === 0) {
      this.log('Keine Event-URLs gefunden.');
      return [];
    }

    // Phase 2: Fetch detail pages and extract JSON-LD
    const allUrls = Array.from(eventUrls).slice(0, this.MAX_EVENTS);
    this.log(`${allUrls.length} Events werden gescrapt (max ${this.MAX_EVENTS})...`);

    const events: ScrapedEvent[] = [];

    for (let i = 0; i < allUrls.length; i++) {
      try {
        const event = await this.scrapeDetailPage(allUrls[i]);
        if (event) events.push(event);

        if ((i + 1) % 25 === 0) {
          this.log(`  Progress: ${i + 1}/${allUrls.length} (${events.length} valid)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  ${allUrls[i]}: FEHLER - ${msg}`);
      }

      await this.rateLimit();
    }

    this.log(`Wien-Ticket scrape complete: ${events.length} events`);
    return events;
  }

  private extractJsonLd($: cheerio.CheerioAPI): WienTicketJsonLd | null {
    let result: WienTicketJsonLd | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      if (result) return;
      try {
        const text = $(el).html();
        if (!text) return;
        const parsed = JSON.parse(text);
        const items: WienTicketJsonLd[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item['@type'] === 'Event') {
            result = item;
            return;
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    return result;
  }

  private async scrapeDetailPage(url: string): Promise<ScrapedEvent | null> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    // Extract JSON-LD structured data
    const jsonLd = this.extractJsonLd($);

    if (!jsonLd) return null;

    const title = jsonLd.name?.trim();
    if (!title || title.length < 3) return null;

    // Start date
    const startDate = jsonLd.startDate;
    if (!startDate) return null;

    // End date
    const endDate = jsonLd.endDate || undefined;

    // Location
    const loc = jsonLd.location;
    const locationName = loc?.name || undefined;
    const address = loc?.address
      ? [loc.address.streetAddress, loc.address.postalCode, loc.address.addressLocality]
          .filter(Boolean).join(', ')
      : undefined;
    const postalCode = loc?.address?.postalCode || undefined;

    // Coordinates
    const lat = loc?.geo?.latitude
      ? (typeof loc.geo.latitude === 'string' ? parseFloat(loc.geo.latitude) : loc.geo.latitude)
      : undefined;
    const lng = loc?.geo?.longitude
      ? (typeof loc.geo.longitude === 'string' ? parseFloat(loc.geo.longitude) : loc.geo.longitude)
      : undefined;

    // Description
    let description = jsonLd.description?.trim();
    if (description && description.length > 1000) {
      description = description.substring(0, 997) + '...';
    }

    // Image
    const imageUrl = jsonLd.image ? this.cleanImageUrl(jsonLd.image) : undefined;

    // Price
    const price = jsonLd.offers?.price;
    const priceText = price != null
      ? `ab ${price} ${jsonLd.offers?.priceCurrency || 'EUR'}`
      : undefined;
    const priceMin = typeof price === 'number' ? price : (typeof price === 'string' ? parseFloat(price) : undefined);

    // Ticket URL
    const ticketUrl = jsonLd.offers?.url || url;

    // Organizer
    const organizer = jsonLd.organizer?.name || undefined;

    // Performer as tag
    const tags: string[] = [];
    if (jsonLd.performer) {
      if (Array.isArray(jsonLd.performer)) {
        for (const p of jsonLd.performer) {
          if (p.name) tags.push(p.name);
        }
      } else if (jsonLd.performer.name) {
        tags.push(jsonLd.performer.name);
      }
    }

    // Category
    const categoryText = [title, description || '', ...tags].join(' ');
    const category = categorizeEvent(categoryText);

    // Source ID — extract ticket ID from URL
    const ticketIdMatch = url.match(/\/ticket\/(\d+)\//);
    const ticketId = ticketIdMatch ? ticketIdMatch[1] : url.replace(/\W+/g, '-').slice(-40);
    const sourceId = `wien-ticket-${ticketId}`;

    return {
      source_id: sourceId,
      source_name: this.name,
      source_url: url,
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      location_name: locationName,
      address,
      postal_code: postalCode,
      bundesland: 'Wien',
      latitude: lat && !isNaN(lat) ? lat : undefined,
      longitude: lng && !isNaN(lng) ? lng : undefined,
      category,
      price_text: priceText,
      price_min: priceMin && !isNaN(priceMin) ? priceMin : undefined,
      image_url: imageUrl,
      organizer,
      tags: tags.length > 0 ? tags : undefined,
      ticket_url: ticketUrl,
    };
  }
}
