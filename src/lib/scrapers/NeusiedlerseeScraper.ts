import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { getDistrictByLocation, getDistrictByCoordinates } from '../districts';
import type { ScrapedEvent } from '@/types/events';

export class NeusiedlerseeScraper extends BaseScraper {
  readonly name = 'neusiedlersee.com';
  private readonly baseUrl = 'https://www.neusiedlersee.com';
  private readonly sitemapUrl = 'https://www.neusiedlersee.com/sitemap.xml?sitemap=dataCycle&cHash=6ff4505669ef55bcee9838d063a6f4b6';
  private readonly listUrl = 'https://www.neusiedlersee.com/erleben/veranstaltungen/alle-veranstaltungen';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Scraping...');

    // Stage 1: Collect event URLs from sitemap + listing pages
    const eventUrls = await this.collectAllEventUrls();
    this.log(`${eventUrls.size} einzigartige Event-URLs gefunden`);

    // Stage 2: Scrape each detail page for JSON-LD
    const events: ScrapedEvent[] = [];
    let i = 0;
    for (const url of eventUrls) {
      i++;
      try {
        this.log(`Detail ${i}/${eventUrls.size}: ${url.split('/').pop()}`);
        const event = await this.scrapeDetailPage(url);
        if (event) events.push(event);
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`${events.length} Events erfolgreich gescrapt`);
    return events;
  }

  private async collectAllEventUrls(): Promise<Set<string>> {
    const urls = new Set<string>();

    // Source 1: Sitemap (most complete)
    try {
      this.log('Lese Sitemap...');
      const sitemapXml = await this.fetchPage(this.sitemapUrl);
      const sitemapUrls = sitemapXml.match(/https:\/\/www\.neusiedlersee\.com\/datacycle-detailseite\/detail\/Veranstaltung\/[^<]+/g);
      if (sitemapUrls) {
        sitemapUrls.forEach(u => urls.add(u.trim()));
        this.log(`${sitemapUrls.length} Events aus Sitemap`);
      }
    } catch (err) {
      this.log(`Sitemap-Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Source 2: Listing pages (catches recently added events not yet in sitemap)
    try {
      this.log('Lese Listing-Seiten...');
      const page1Html = await this.fetchPage(this.listUrl);
      const $page1 = cheerio.load(page1Html);

      this.extractEventUrls($page1).forEach(u => urls.add(u));

      const totalPages = this.extractTotalPages($page1);
      const paginationLinks = this.extractPaginationLinks($page1);

      for (let page = 2; page <= totalPages; page++) {
        await this.rateLimit();
        const pageUrl = paginationLinks[page]
          ? `${this.baseUrl}${paginationLinks[page]}`
          : `${this.listUrl}?tx_dc_index[controller]=DataCycleV4&tx_dc_index[page]=${page}`;
        try {
          const pageHtml = await this.fetchPage(pageUrl);
          const $ = cheerio.load(pageHtml);
          this.extractEventUrls($).forEach(u => urls.add(u));
        } catch { /* skip */ }
      }
      this.log(`Nach Listing: ${urls.size} einzigartige URLs`);
    } catch (err) {
      this.log(`Listing-Fehler: ${err instanceof Error ? err.message : err}`);
    }

    return urls;
  }

  private extractEventUrls($: cheerio.CheerioAPI): string[] {
    const urls: string[] = [];
    $('a[href*="/datacycle-detailseite/detail/Veranstaltung/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      urls.push(fullUrl);
    });
    return urls;
  }

  private extractTotalPages($: cheerio.CheerioAPI): number {
    const text = $('body').text();
    const match = text.match(/(\d+)\s+von\s+(\d+)\s+Seiten/i);
    if (match) return parseInt(match[2], 10);

    const pageLinks = $('a[href*="tx_dc_index[page]"]');
    let maxPage = 1;
    pageLinks.each((_, el) => {
      const href = $(el).attr('href') || '';
      const pageMatch = href.match(/tx_dc_index\[page\]=(\d+)/);
      if (pageMatch) maxPage = Math.max(maxPage, parseInt(pageMatch[1], 10));
    });
    return maxPage;
  }

  private extractPaginationLinks($: cheerio.CheerioAPI): Record<number, string> {
    const links: Record<number, string> = {};
    $('a[href*="tx_dc_index[page]"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/tx_dc_index\[page\]=(\d+)/);
      if (match) links[parseInt(match[1], 10)] = href;
    });
    return links;
  }

  private async scrapeDetailPage(url: string): Promise<ScrapedEvent | null> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    const jsonLdScript = $('script[type="application/ld+json"]').first().html();
    if (!jsonLdScript) return null;

    try {
      const jsonLd = JSON.parse(jsonLdScript);
      let eventData = jsonLd;
      if (jsonLd['@graph']) {
        eventData = Array.isArray(jsonLd['@graph'])
          ? jsonLd['@graph'].find((item: Record<string, unknown>) => {
              const type = item['@type'];
              return (Array.isArray(type) && (type.includes('Event') || type.some((t: string) => t.includes('Event'))))
                || type === 'Event'
                || (typeof type === 'string' && type.includes('Event'));
            })
          : jsonLd['@graph'];
      }
      if (!eventData) return null;

      const location = Array.isArray(eventData.location) ? eventData.location[0] : eventData.location;
      const organizer = Array.isArray(eventData.organizer) ? eventData.organizer[0] : eventData.organizer;
      const image = Array.isArray(eventData.image) ? eventData.image[0] : eventData.image;

      const rawDesc = eventData.description || '';
      const description = rawDesc.replace(/<[^>]*>/g, '').trim();

      const imageUrl = image?.contentUrl || image?.url || null;

      // Try to get image from page if not in JSON-LD
      let finalImageUrl = imageUrl;
      if (!finalImageUrl) {
        const ogImage = $('meta[property="og:image"]').attr('content');
        const heroImage = $('img[src*="data.burgenland.info"]').first().attr('src');
        finalImageUrl = ogImage || heroImage || null;
      }

      const lat = location?.geo?.latitude ? parseFloat(location.geo.latitude) : undefined;
      const lng = location?.geo?.longitude ? parseFloat(location.geo.longitude) : undefined;

      const title = eventData.name || url.split('/').pop()?.replace(/-/g, ' ') || '';

      return {
        source_id: eventData['@id'] || url,
        source_name: this.name,
        source_url: url,
        title,
        description: description || undefined,
        start_date: eventData.startDate || '',
        end_date: eventData.endDate || undefined,
        location_name: location?.name || undefined,
        address: this.formatAddress(organizer?.address || location?.address),
        postal_code: organizer?.address?.postalCode || location?.address?.postalCode || undefined,
        district: getDistrictByLocation(location?.name || '')
          || (lat ? getDistrictByCoordinates(lat, lng!) : null)
          || undefined,
        latitude: lat,
        longitude: lng,
        category: categorizeEvent(title, description),
        image_url: finalImageUrl || undefined,
        organizer: organizer?.name || undefined,
      };
    } catch {
      return null;
    }
  }

  private formatAddress(address: Record<string, string> | undefined): string | undefined {
    if (!address) return undefined;
    const parts = [
      address.streetAddress,
      [address.postalCode, address.addressLocality].filter(Boolean).join(' '),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
}
