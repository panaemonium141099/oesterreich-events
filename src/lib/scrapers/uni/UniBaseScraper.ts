import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEventMulti } from '../../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * Shared base class for university/FH scrapers.
 * Provides common helpers for parsing event listings from Austrian uni websites.
 */
export abstract class UniBaseScraper extends BaseScraper {
  protected abstract readonly shortName: string;
  protected abstract readonly baseUrl: string;
  protected abstract readonly eventListUrl: string;
  protected abstract readonly city: string;
  protected abstract readonly bundesland: string;
  protected abstract readonly defaultLat: number;
  protected abstract readonly defaultLng: number;

  /**
   * Generate a deterministic source_id from scraper name + slug.
   */
  protected makeSourceId(slug: string): string {
    return `uni-${this.shortName.toLowerCase()}-${slug}`;
  }

  /**
   * Build a ScrapedEvent with university defaults.
   * Tags always include 'Bildung'.
   */
  protected buildEvent(opts: {
    slug: string;
    title: string;
    startDate: string;
    endDate?: string;
    description?: string;
    locationName?: string;
    sourceUrl: string;
    imageUrl?: string;
    lat?: number;
    lng?: number;
  }): ScrapedEvent {
    const tags = categorizeEventMulti(opts.title, opts.description);
    // Ensure 'Bildung' is always included
    if (!tags.includes('Bildung')) {
      tags.unshift('Bildung');
      if (tags.length > 3) tags.pop();
    }

    return {
      source_id: this.makeSourceId(opts.slug),
      source_name: this.name,
      source_url: opts.sourceUrl,
      title: opts.title,
      description: opts.description?.slice(0, 500),
      start_date: opts.startDate,
      end_date: opts.endDate,
      location_name: opts.locationName || this.city,
      bundesland: this.bundesland,
      latitude: opts.lat || this.defaultLat,
      longitude: opts.lng || this.defaultLng,
      category: tags[0],
      tags,
      image_url: opts.imageUrl,
      organizer: this.shortName,
    };
  }

  /**
   * Parse JSON-LD Event objects from HTML.
   */
  protected parseJsonLdEvents(html: string, pageUrl: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] || [json];

        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;

          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;

          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const geo = location?.geo as Record<string, unknown> | undefined;

          let imageUrl: string | undefined;
          if (item.image) {
            imageUrl = typeof item.image === 'string'
              ? item.image
              : (item.image as Record<string, unknown>).url as string || undefined;
          }
          if (imageUrl) {
            imageUrl = this.resolveImageUrl(imageUrl, this.baseUrl);
            imageUrl = this.cleanImageUrl(imageUrl);
          }

          events.push(this.buildEvent({
            slug,
            title: name,
            startDate,
            endDate: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            locationName: location?.name ? String(location.name) : undefined,
            sourceUrl: item.url ? String(item.url) : pageUrl,
            imageUrl,
            lat: geo?.latitude ? Number(geo.latitude) : undefined,
            lng: geo?.longitude ? Number(geo.longitude) : undefined,
          }));
        }
      } catch { /* invalid JSON-LD, skip */ }
    });

    return events;
  }

  /**
   * Try to parse a German or ISO date string into YYYY-MM-DD format.
   */
  protected parseDate(text: string): string | null {
    // ISO format: 2026-03-15T10:00:00
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    // German format: 15.03.2026 or 15. März 2026
    const deMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (deMatch) {
      return `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`;
    }

    // German month names
    const months: Record<string, string> = {
      'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
      // English
      'january': '01', 'february': '02', 'march': '03',
      'may': '05', 'june': '06', 'july': '07',
      'october': '10', 'december': '12',
    };

    const monthMatch = text.toLowerCase().match(
      /(\d{1,2})\.?\s+(jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|january|february|march|may|june|july|october|december)\s+(\d{4})/
    );
    if (monthMatch) {
      const month = months[monthMatch[2]];
      if (month) {
        return `${monthMatch[3]}-${month}-${monthMatch[1].padStart(2, '0')}`;
      }
    }

    return null;
  }

  /**
   * Parse date+time into ISO datetime format.
   */
  protected parseDatetime(text: string): string | null {
    const date = this.parseDate(text);
    if (!date) return null;

    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
    }
    return date;
  }
}
