import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { getDistrictByPostalCode, getDistrictByLocation, getDistrictByCoordinates } from '../districts';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

interface EventLink {
  url: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string | null;
}

export class BurgenlandInfoScraper extends BaseScraper {
  readonly name = 'burgenland.info';
  private readonly baseUrl = 'https://www.burgenland.info';
  private readonly listUrl = 'https://www.burgenland.info/erleben/veranstaltungen';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Scraping...');

    // Stage 1: Collect event links from all pages
    const eventLinks = await this.scrapeAllListPages();
    this.log(`${eventLinks.length} Event-Links gefunden`);

    // Stage 2: Scrape each detail page
    const events: ScrapedEvent[] = [];
    for (let i = 0; i < eventLinks.length; i++) {
      const link = eventLinks[i];
      try {
        this.log(`Detail ${i + 1}/${eventLinks.length}: ${link.title}`);
        const event = await this.scrapeDetailPage(link);
        if (event) {
          events.push(event);
        }
      } catch (err) {
        this.log(`Fehler bei ${link.url}: ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`${events.length} Events erfolgreich gescrapt`);
    return events;
  }

  private async scrapeAllListPages(): Promise<EventLink[]> {
    const allLinks: EventLink[] = [];

    // Load page 1
    const page1Html = await this.fetchPage(this.listUrl);
    const $page1 = cheerio.load(page1Html);

    allLinks.push(...this.extractEventLinks($page1));

    // Get total pages from pagination text (e.g., "1 von 7 Seiten")
    const totalPages = this.extractTotalPages($page1);
    this.log(`${totalPages} Seiten gefunden`);

    // Extract pagination links from page 1 to get cHash values
    const paginationLinks = this.extractPaginationLinks($page1);

    // Load remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await this.rateLimit();

      let pageUrl: string;
      if (paginationLinks[page]) {
        pageUrl = `${this.baseUrl}${paginationLinks[page]}`;
      } else {
        // Fallback: try without cHash
        pageUrl = `${this.listUrl}?dtoSeed=0&tx_dc_index[controller]=DataCycleV4&tx_dc_index[page]=${page}`;
      }

      try {
        const pageHtml = await this.fetchPage(pageUrl);
        const $ = cheerio.load(pageHtml);
        const links = this.extractEventLinks($);
        allLinks.push(...links);
        this.log(`Seite ${page}: ${links.length} Events`);
      } catch (err) {
        this.log(`Fehler bei Seite ${page}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return allLinks;
  }

  private extractEventLinks($: cheerio.CheerioAPI): EventLink[] {
    const links: EventLink[] = [];

    $('a[href*="/dc/detail/Veranstaltung/"]').each((_, el) => {
      const $el = $(el);
      const url = $el.attr('href');
      if (!url) return;

      // Skip duplicates
      if (links.some(l => l.url === url)) return;

      const imgEl = $el.find('img[src*="data.burgenland.info"]');
      const imageUrl = imgEl.attr('src') || null;

      // Extract text content
      const textParts = $el.text().trim().split('\n').map(s => s.trim()).filter(Boolean);

      // Remove "Jetzt entdecken" / "Discover now" at the end
      const filteredParts = textParts.filter(
        t => !t.match(/^(Jetzt entdecken|Discover now|©)/i)
      );

      const title = filteredParts[0] || '';
      const date = filteredParts.find(t => t.match(/\d{2}\.\d{2}\.\d{4}/)) || '';
      const location = filteredParts.find(t =>
        t.match(/(Nordburgenland|Mittelburgenland|Südburgenland|Eisenstadt|Neusiedl|Oberwart|Güssing|Jennersdorf|Mattersburg|Oberpullendorf)/i)
      ) || '';

      if (title) {
        links.push({ url, title, date, location, imageUrl });
      }
    });

    return links;
  }

  private extractTotalPages($: cheerio.CheerioAPI): number {
    // Look for "X von Y Seiten" or "X of Y pages"
    const text = $('body').text();
    const match = text.match(/(\d+)\s+von\s+(\d+)\s+Seiten/i)
      || text.match(/(\d+)\s+of\s+(\d+)\s+pages/i);

    if (match) {
      return parseInt(match[2], 10);
    }

    // Fallback: count pagination links
    const pageLinks = $('a[href*="tx_dc_index[page]"]');
    if (pageLinks.length > 0) {
      let maxPage = 1;
      pageLinks.each((_, el) => {
        const href = $(el).attr('href') || '';
        const pageMatch = href.match(/tx_dc_index\[page\]=(\d+)/);
        if (pageMatch) {
          maxPage = Math.max(maxPage, parseInt(pageMatch[1], 10));
        }
      });
      return maxPage;
    }

    return 1;
  }

  private extractPaginationLinks($: cheerio.CheerioAPI): Record<number, string> {
    const links: Record<number, string> = {};

    $('a[href*="tx_dc_index[page]"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/tx_dc_index\[page\]=(\d+)/);
      if (match) {
        links[parseInt(match[1], 10)] = href;
      }
    });

    return links;
  }

  private async scrapeDetailPage(link: EventLink): Promise<ScrapedEvent | null> {
    const fullUrl = link.url.startsWith('http') ? link.url : `${this.baseUrl}${link.url}`;
    const html = await this.fetchPage(fullUrl);
    const $ = cheerio.load(html);

    // Extract JSON-LD
    const jsonLdScript = $('script[type="application/ld+json"]').first().html();
    if (!jsonLdScript) {
      this.log(`Kein JSON-LD gefunden für: ${link.title}`);
      return this.createEventFromListData(link);
    }

    try {
      const jsonLd = JSON.parse(jsonLdScript);

      // Handle @graph structure: data is inside jsonLd['@graph'][0]
      let eventData = jsonLd;
      if (jsonLd['@graph']) {
        const graph = jsonLd['@graph'];
        eventData = Array.isArray(graph)
          ? graph.find((item: Record<string, unknown>) => {
              const type = item['@type'];
              return isEventType(type);
            })
          : graph;
      } else if (Array.isArray(jsonLd)) {
        eventData = jsonLd.find((item: Record<string, unknown>) => {
          const type = item['@type'];
          return isEventType(type);
        });
      }

      if (!eventData) {
        return this.createEventFromListData(link);
      }

      // Handle location as array or object
      const location = Array.isArray(eventData.location) ? eventData.location[0] : eventData.location;
      // Handle organizer as array or object
      const organizer = Array.isArray(eventData.organizer) ? eventData.organizer[0] : eventData.organizer;
      // Handle image as array or object
      const image = Array.isArray(eventData.image) ? eventData.image[0] : eventData.image;

      const postalCode = organizer?.address?.postalCode
        || location?.address?.postalCode
        || '';

      const tags = this.extractTags($, eventData);

      // Strip HTML from description
      const rawDesc = eventData.description || '';
      const description = rawDesc.replace(/<[^>]*>/g, '').trim();

      // Get image URL - try contentUrl first, then look for asset URLs
      let imageUrl = image?.contentUrl || image?.url || link.imageUrl;
      if (!imageUrl && image?.['@id']) {
        // Try to construct image URL from asset ID
        imageUrl = `https://data.burgenland.info/asset/${image['@id']}`;
      }

      const event: ScrapedEvent = {
        source_id: eventData['@id'] || link.url,
        source_name: this.name,
        source_url: fullUrl,
        title: eventData.name || link.title,
        description: description || undefined,
        start_date: eventData.startDate || '',
        end_date: eventData.endDate || undefined,
        location_name: location?.name || undefined,
        address: this.formatAddress(organizer?.address || location?.address),
        postal_code: postalCode || undefined,
        district: getDistrictByLocation(location?.name || '')
          || (location?.geo?.latitude ? getDistrictByCoordinates(location.geo.latitude, location.geo.longitude) : null)
          || (postalCode ? getDistrictByPostalCode(postalCode) : null)
          || undefined,
        latitude: location?.geo?.latitude || undefined,
        longitude: location?.geo?.longitude || undefined,
        category: categorizeEvent(
          eventData.name || link.title,
          description,
          tags
        ),
        image_url: imageUrl || undefined,
        organizer: organizer?.name || undefined,
        tags,
      };

      // Try to extract price from HTML
      const priceInfo = this.extractPrice($);
      if (priceInfo) {
        event.price_text = priceInfo.text;
        event.price_min = priceInfo.min;
        event.price_max = priceInfo.max;
      }

      return event;
    } catch (err) {
      this.log(`JSON-LD Parse-Fehler für ${link.title}: ${err instanceof Error ? err.message : err}`);
      return this.createEventFromListData(link);
    }
  }

  private createEventFromListData(link: EventLink): ScrapedEvent {
    return {
      source_id: link.url,
      source_name: this.name,
      source_url: `${this.baseUrl}${link.url}`,
      title: link.title,
      start_date: this.parseDateString(link.date),
      location_name: link.location || undefined,
      category: categorizeEvent(link.title),
      image_url: link.imageUrl || undefined,
    };
  }

  private extractTags($: cheerio.CheerioAPI, jsonLd: Record<string, unknown>): string[] {
    const tags: string[] = [];

    // From JSON-LD keywords
    if (typeof jsonLd.keywords === 'string') {
      tags.push(...jsonLd.keywords.split(',').map((t: string) => t.trim()));
    } else if (Array.isArray(jsonLd.keywords)) {
      tags.push(...jsonLd.keywords.map(String));
    }

    // From meta tags
    $('meta[name="keywords"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) {
        tags.push(...content.split(',').map(t => t.trim()));
      }
    });

    return [...new Set(tags.filter(Boolean))];
  }

  private extractPrice($: cheerio.CheerioAPI): { text: string; min?: number; max?: number } | null {
    const body = $('body').text();

    // Common patterns: "€50", "EUR 50", "50 Euro", "ab €10", "€10 - €30"
    const pricePatterns = [
      /(?:ab\s+)?€\s*(\d+(?:[.,]\d{2})?)\s*(?:[-–]\s*€?\s*(\d+(?:[.,]\d{2})?))?/,
      /(?:ab\s+)?EUR\s*(\d+(?:[.,]\d{2})?)\s*(?:[-–]\s*(?:EUR\s*)?(\d+(?:[.,]\d{2})?))?/i,
      /(\d+(?:[.,]\d{2})?)\s*Euro/i,
    ];

    for (const pattern of pricePatterns) {
      const match = body.match(pattern);
      if (match) {
        const min = parseFloat(match[1].replace(',', '.'));
        const max = match[2] ? parseFloat(match[2].replace(',', '.')) : undefined;
        return {
          text: match[0].trim(),
          min: isNaN(min) ? undefined : min,
          max: max && !isNaN(max) ? max : undefined,
        };
      }
    }

    return null;
  }

  private formatAddress(address: Record<string, string> | undefined): string | undefined {
    if (!address) return undefined;
    const parts = [
      address.streetAddress,
      [address.postalCode, address.addressLocality].filter(Boolean).join(' '),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private parseDateString(dateStr: string): string {
    // Parse "DD.MM.YYYY" format
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return new Date().toISOString().split('T')[0];
  }
}
