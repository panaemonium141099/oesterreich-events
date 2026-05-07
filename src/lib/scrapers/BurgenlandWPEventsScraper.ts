import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { detectNextPage, MAX_PAGES_PER_SITE } from './pagination';
import { isEventType } from '../connectors/json-ld-connector';

/**
 * WordPress Event Scraper for Burgenland municipalities.
 * Supports:
 * - JSON-LD Event schema (best quality — Pama/Tribe Events, Trausdorf/MEC)
 * - MEC HTML parsing (.mec-event-item selectors)
 * - Generic WordPress event pages (date pattern + title extraction)
 */
export class BurgenlandWPEventsScraper extends BaseScraper {
  readonly name = 'gemeinden-wp-burgenland';

  private readonly timeoutMs = 10000;

  /** German month names for parsing */
  private readonly MONTHS: Record<string, string> = {
    'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03', 'marz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
    // Abbreviated
    'jan': '01', 'feb': '02', 'mär': '03', 'apr': '04',
    'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
    'okt': '10', 'nov': '11', 'dez': '12',
  };

  private readonly MUNICIPALITIES: WPMunicipality[] = [
    // JSON-LD available on listing page
    { name: 'Trausdorf an der Wulka', eventUrl: 'https://www.trausdorf-wulka.gv.at/events/', plz: '7061', bezirk: 'Eisenstadt-Umgebung', lat: 47.8205, lng: 16.5406 },
    { name: 'Pama', eventUrl: 'https://www.gemeinde-pama.at/veranstaltungen/', plz: '2422', bezirk: 'Neusiedl am See', lat: 48.0178, lng: 17.0583 },
    // MEC HTML (detail pages may have JSON-LD)
    { name: 'Gattendorf', eventUrl: 'https://www.gattendorf.at/events/', plz: '2474', bezirk: 'Neusiedl am See', lat: 47.9939, lng: 17.0275 },
    { name: 'Sieggraben', eventUrl: 'https://www.sieggraben.at/veranstaltungen/', plz: '7223', bezirk: 'Mattersburg', lat: 47.6356, lng: 16.3733 },
    { name: 'Schachendorf', eventUrl: 'https://schachendorf.at/events/', plz: '7472', bezirk: 'Oberwart', lat: 47.1803, lng: 16.4283 },
    { name: 'Wörterberg', eventUrl: 'https://www.woerterberg.at/veranstaltungen/', plz: '8293', bezirk: 'Güssing', lat: 47.1553, lng: 16.1553 },
    // Generic WordPress
    { name: 'Bildein', eventUrl: 'https://bildein.at/termine/', plz: '7521', bezirk: 'Güssing', lat: 47.1500, lng: 16.4667 },
    { name: 'Unterrabnitz-Schwendgraben', eventUrl: 'https://www.unterrabnitz.at/events/', plz: '7371', bezirk: 'Oberpullendorf', lat: 47.4500, lng: 16.3667 },
    { name: 'Heiligenbrunn', eventUrl: 'https://www.heiligenbrunn.at/veranstaltungen/', plz: '7522', bezirk: 'Güssing', lat: 47.1333, lng: 16.4500 },
    // GEM2GO sites with non-standard event paths (not found by Gem2GoScraper)
    { name: 'Stoob', eventUrl: 'https://www.stoob.at/gemeinde/veranstaltungen', plz: '7344', bezirk: 'Oberpullendorf', lat: 47.5261, lng: 16.4836 },
    { name: 'Loipersdorf-Kitzladen', eventUrl: 'https://www.loipersdorf-kitzladen.at/buergerservice/veranstaltungen', plz: '7410', bezirk: 'Oberwart', lat: 47.2833, lng: 16.1000 },
    { name: 'Markt Allhau', eventUrl: 'https://www.marktallhau.gv.at/buergerservice/veranstaltungen', plz: '7411', bezirk: 'Oberwart', lat: 47.2900, lng: 16.0756 },
    // Other CMS with event pages
    { name: 'Mogersdorf', eventUrl: 'https://www.mogersdorf.at/veranstaltungen', plz: '8382', bezirk: 'Jennersdorf', lat: 46.9500, lng: 16.0167 },
    { name: 'Loretto', eventUrl: 'https://www.gemeinde-loretto.at/kalender', plz: '2443', bezirk: 'Eisenstadt-Umgebung', lat: 47.8333, lng: 16.5333 },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte WordPress-Events Scraping (${this.MUNICIPALITIES.length} Gemeinden)...`);
    const allEvents: ScrapedEvent[] = [];
    let scraped = 0;

    for (let i = 0; i < this.MUNICIPALITIES.length; i++) {
      const m = this.MUNICIPALITIES[i];
      try {
        const html = await this.fetchWithTimeout(m.eventUrl);
        if (!html) continue;

        let allPageEvents = this.parseSinglePage(html, m);

        // Pagination: follow next-page links
        if (allPageEvents.length > 0) {
          let currentHtml = html;
          let currentUrl = m.eventUrl;
          const visitedUrls = new Set<string>([currentUrl]);

          for (let p = 1; p < MAX_PAGES_PER_SITE; p++) {
            const { nextUrl } = detectNextPage(currentHtml, currentUrl);
            if (!nextUrl || visitedUrls.has(nextUrl)) break;
            visitedUrls.add(nextUrl);

            const nextHtml = await this.fetchWithTimeout(nextUrl);
            if (!nextHtml) break;

            const nextEvents = this.parseSinglePage(nextHtml, m);
            if (nextEvents.length === 0) break;

            allPageEvents.push(...nextEvents);
            currentHtml = nextHtml;
            currentUrl = nextUrl;
            await this.rateLimit();
          }
        }

        if (allPageEvents.length > 0) {
          allEvents.push(...allPageEvents);
          scraped++;
          this.log(`  [${i + 1}/${this.MUNICIPALITIES.length}] ${m.name}: ${allPageEvents.length} Events`);
        }
      } catch (err) {
        this.log(`  [${i + 1}/${this.MUNICIPALITIES.length}] ${m.name}: FEHLER - ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`WP-Events fertig: ${allEvents.length} Events von ${scraped} Gemeinden`);
    return allEvents;
  }

  /** Parse a single page with all 3 strategies */
  private parseSinglePage(html: string, m: WPMunicipality): ScrapedEvent[] {
    const $ = cheerio.load(html);
    let events = this.parseJsonLd($, m);
    if (events.length === 0) events = this.parseMEC($, m);
    if (events.length === 0) events = this.parseGeneric($, m);
    return events;
  }

  // ── Strategy 1: JSON-LD ─────────────────────────────────────────

  private parseJsonLd($: cheerio.CheerioAPI, m: WPMunicipality): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const data = JSON.parse(raw);
        const items = this.extractEventItems(data);

        for (const item of items) {
          if (!isEventType(item['@type'])) continue;
          if (!item.name || !item.startDate) continue;

          const dedupeKey = `${item.name}-${item.startDate}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const startDate = this.parseJsonLdDate(item.startDate);
          if (!startDate) continue;

          const endDate = item.endDate ? this.parseJsonLdDate(item.endDate) ?? undefined : undefined;
          const description = this.stripHtml(item.description || '');
          // JSON-LD image: string | { url, width?, height? } | array
          let imageUrl: string | undefined;
          let imageWidth: number | undefined;
          let imageHeight: number | undefined;
          const rawImage = item.image;
          if (typeof rawImage === 'string') {
            imageUrl = rawImage;
          } else if (Array.isArray(rawImage) && rawImage.length > 0) {
            const first = rawImage[0];
            if (typeof first === 'string') imageUrl = first;
            else if (first) {
              imageUrl = first.url || first.contentUrl;
              if (typeof first.width === 'number') imageWidth = first.width;
              if (typeof first.height === 'number') imageHeight = first.height;
            }
          } else if (rawImage && typeof rawImage === 'object') {
            imageUrl = rawImage.url || rawImage.contentUrl;
            if (typeof rawImage.width === 'number') imageWidth = rawImage.width;
            if (typeof rawImage.height === 'number') imageHeight = rawImage.height;
          }
          const locationName = item.location?.name || m.name;
          const organizer = item.organizer?.name;
          const url = item.url || m.eventUrl;

          events.push({
            source_id: `wp-bgld-${Buffer.from(item.name + startDate).toString('base64').substring(0, 24)}`,
            source_name: this.name,
            source_url: url,
            title: this.stripHtml(item.name).trim(),
            description: description || undefined,
            start_date: startDate,
            end_date: endDate,
            location_name: locationName || m.name,
            postal_code: m.plz,
            bundesland: 'Burgenland',
            district: m.bezirk,
            latitude: m.lat,
            longitude: m.lng,
            category: categorizeEvent(item.name, description),
            image_url: imageUrl,
            image_width: imageWidth,
            image_height: imageHeight,
            organizer,
          });
        }
      } catch { /* skip malformed JSON-LD */ }
    });

    return events;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractEventItems(data: any): any[] {
    if (Array.isArray(data)) return data.flatMap((d: unknown) => this.extractEventItems(d));
    if (typeof data !== 'object' || !data) return [];
    if (isEventType(data['@type'])) return [data];
    if (data['@graph'] && Array.isArray(data['@graph'])) return data['@graph'].flatMap((g: unknown) => this.extractEventItems(g));
    return [];
  }

  private parseJsonLdDate(dateStr: string): string | null {
    if (!dateStr) return null;
    // Full ISO 8601: "2026-04-05T21:00:00+02:00"
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        // Convert to Vienna local time
        const local = d.toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' });
        const [date, time] = local.split(' ');
        return time && time !== '00:00:00' ? `${date}T${time}` : date;
      } catch { return null; }
    }
    // Date only: "2026-04-05"
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    return null;
  }

  // ── Strategy 2: MEC HTML parsing ────────────────────────────────

  private parseMEC($: cheerio.CheerioAPI, m: WPMunicipality): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // MEC event items
    $('.mec-event-article, .mec-event-item').each((_, el) => {
      try {
        const $el = $(el);
        const titleEl = $el.find('.mec-event-title a, .mec-event-title');
        const title = titleEl.text().trim();
        if (!title) return;

        const link = titleEl.attr('href') || $el.find('a').first().attr('href') || m.eventUrl;

        // Date extraction from MEC date elements
        const dateEl = $el.find('.mec-event-date');
        const timeEl = $el.find('.mec-time-details, .mec-event-time');
        const dateText = dateEl.text().trim();
        const timeText = timeEl.text().trim();

        const startDate = this.parseMECDate(dateText, timeText);
        if (!startDate) return;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        // Image (carries width/height from HTML attrs into the upsert)
        const imageInfo = this.imageFromElement($el.find('img').first(), m.eventUrl);

        // Location
        const locationEl = $el.find('.mec-event-loc-place, .mec-event-location');
        const locationText = locationEl.text().trim();

        events.push({
          source_id: `wp-bgld-mec-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: link.startsWith('http') ? link : new URL(link, m.eventUrl).href,
          title,
          start_date: startDate,
          location_name: locationText || m.name,
          postal_code: m.plz,
          bundesland: 'Burgenland',
          district: m.bezirk,
          latitude: m.lat,
          longitude: m.lng,
          category: categorizeEvent(title, ''),
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseMECDate(dateText: string, timeText: string): string | null {
    // MEC formats: "04 Apr", "05 Apr.", "29 Mai", "Apr. 2026"
    // Also: full date like "5. April 2026"
    const now = new Date();
    const currentYear = now.getFullYear();

    // Try "DD MonthName YYYY" or "DD. MonthName YYYY"
    const fullMatch = dateText.match(/(\d{1,2})\.?\s*(\w+)\.?\s*(\d{4})/);
    if (fullMatch) {
      const day = fullMatch[1].padStart(2, '0');
      const month = this.MONTHS[fullMatch[2].toLowerCase()];
      if (month) {
        const date = `${fullMatch[3]}-${month}-${day}`;
        return this.appendTime(date, timeText);
      }
    }

    // Try "DD MonthAbbrev" (no year)
    const shortMatch = dateText.match(/(\d{1,2})\s*(\w{3,})/);
    if (shortMatch) {
      const day = shortMatch[1].padStart(2, '0');
      const monthKey = shortMatch[2].replace('.', '').toLowerCase();
      const month = this.MONTHS[monthKey];
      if (month) {
        // Assume current or next year
        let year = currentYear;
        const testDate = new Date(`${year}-${month}-${day}`);
        if (testDate < new Date(now.getTime() - 30 * 86400000)) year++;
        const date = `${year}-${month}-${day}`;
        return this.appendTime(date, timeText);
      }
    }

    return null;
  }

  private appendTime(date: string, timeText: string): string {
    // Parse time: "18:00", "18:00 - 19:00", "19:00 Uhr"
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
    }
    return date;
  }

  // ── Strategy 3: Generic WordPress ───────────────────────────────

  private parseGeneric($: cheerio.CheerioAPI, m: WPMunicipality): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    const dateRegex = /(\d{1,2})\.?\s*([\wä]+)\s*(\d{4})/;
    const numericDateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

    // Look for event-like elements
    $('article, .wp-block-group, .elementor-widget-container, .entry-content a, li, .event-item').each((_, el) => {
      try {
        const $el = $(el);
        const text = $el.text().trim();
        if (text.length < 10 || text.length > 2000) return;

        // Must contain a date
        let startDate: string | null = null;

        // Try numeric date: DD.MM.YYYY
        const numMatch = text.match(numericDateRegex);
        if (numMatch) {
          const day = numMatch[1].padStart(2, '0');
          const month = numMatch[2].padStart(2, '0');
          const year = numMatch[3];
          if (parseInt(year) >= 2025 && parseInt(year) <= 2030) {
            startDate = `${year}-${month}-${day}`;
          }
        }

        // Try German date: "4. April 2026"
        if (!startDate) {
          const gerMatch = text.match(dateRegex);
          if (gerMatch) {
            const day = gerMatch[1].padStart(2, '0');
            const monthKey = gerMatch[2].toLowerCase().replace('.', '');
            const month = this.MONTHS[monthKey];
            const year = gerMatch[3];
            if (month && parseInt(year) >= 2025) {
              startDate = `${year}-${month}-${day}`;
            }
          }
        }

        if (!startDate) return;

        // Extract title — find heading or first link text
        let title = $el.find('h2, h3, h4, h5, h6').first().text().trim()
          || $el.find('a').first().text().trim()
          || $el.find('strong').first().text().trim();

        // Clean title — remove date parts
        if (title) {
          title = title.replace(/\d{1,2}\.?\s*\w+\.?\s*\d{4}/g, '').trim();
          title = title.replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '').trim();
          title = title.replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();
        }

        if (!title || title.length < 3 || title.length > 200) return;

        const dedupeKey = `${startDate}-${title.substring(0, 30)}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        // Only future events
        if (new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) return;

        const link = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
        const sourceUrl = link && link.startsWith('http') ? link : link ? new URL(link, m.eventUrl).href : m.eventUrl;

        const imageInfo = this.imageFromElement($el.find('img').first(), m.eventUrl);

        events.push({
          source_id: `wp-bgld-gen-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: m.name,
          postal_code: m.plz,
          bundesland: 'Burgenland',
          district: m.bezirk,
          latitude: m.lat,
          longitude: m.lng,
          category: categorizeEvent(title, ''),
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#8222;/g, '„')
      .replace(/&#8220;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
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

interface WPMunicipality {
  name: string;
  eventUrl: string;
  plz: string;
  bezirk: string;
  lat: number;
  lng: number;
}
