import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

// meinbezirk.at region abbreviations → bundesland IDs
const REGION_TO_BUNDESLAND: Record<string, string> = {
  'wien': 'wien', 'w': 'wien',
  'nö': 'niederoesterreich', 'niederösterreich': 'niederoesterreich',
  'oö': 'oberoesterreich', 'oberösterreich': 'oberoesterreich',
  'sbg': 'salzburg', 'salzburg': 'salzburg',
  'stmk': 'steiermark', 'steiermark': 'steiermark',
  'ktn': 'kaernten', 'kärnten': 'kaernten',
  'tirol': 'tirol', 't': 'tirol',
  'vbg': 'vorarlberg', 'vorarlberg': 'vorarlberg',
  'bgld': 'burgenland', 'burgenland': 'burgenland',
};

// URL bezirk slugs → bundesland (all 94 Bezirke)
const BEZIRK_BUNDESLAND: Record<string, string> = {
  // Wien
  'wien': 'wien',

  // Niederösterreich
  'st-poelten': 'niederoesterreich',
  'amstetten': 'niederoesterreich',
  'baden': 'niederoesterreich',
  'bruck-an-der-leitha': 'niederoesterreich',
  'gaenserndorf': 'niederoesterreich',
  'gmuend': 'niederoesterreich',
  'hollabrunn': 'niederoesterreich',
  'horn': 'niederoesterreich',
  'korneuburg': 'niederoesterreich',
  'krems': 'niederoesterreich',
  'lilienfeld': 'niederoesterreich',
  'melk': 'niederoesterreich',
  'mistelbach': 'niederoesterreich',
  'moedling': 'niederoesterreich',
  'neunkirchen': 'niederoesterreich',
  'scheibbs': 'niederoesterreich',
  'tulln': 'niederoesterreich',
  'waidhofen-an-der-thaya': 'niederoesterreich',
  'waidhofen-an-der-ybbs': 'niederoesterreich',
  'wiener-neustadt': 'niederoesterreich',
  'zwettl': 'niederoesterreich',
  'wr-neustadt': 'niederoesterreich',

  // Oberösterreich
  'linz': 'oberoesterreich',
  'braunau': 'oberoesterreich',
  'eferding': 'oberoesterreich',
  'freistadt': 'oberoesterreich',
  'gmunden': 'oberoesterreich',
  'grieskirchen': 'oberoesterreich',
  'kirchdorf': 'oberoesterreich',
  'linz-land': 'oberoesterreich',
  'perg': 'oberoesterreich',
  'ried': 'oberoesterreich',
  'rohrbach': 'oberoesterreich',
  'schaerding': 'oberoesterreich',
  'steyr': 'oberoesterreich',
  'steyr-steyr-land': 'oberoesterreich',
  'urfahr-umgebung': 'oberoesterreich',
  'voecklabruck': 'oberoesterreich',
  'wels': 'oberoesterreich',
  'enns': 'oberoesterreich',

  // Steiermark
  'graz': 'steiermark',
  'bruck-an-der-mur': 'steiermark',
  'deutschlandsberg': 'steiermark',
  'graz-umgebung': 'steiermark',
  'hartberg': 'steiermark',
  'hartberg-fuerstenfeld': 'steiermark',
  'leibnitz': 'steiermark',
  'leoben': 'steiermark',
  'liezen': 'steiermark',
  'murau': 'steiermark',
  'murtal': 'steiermark',
  'suedoststeiermark': 'steiermark',
  'voitsberg': 'steiermark',
  'weiz': 'steiermark',

  // Salzburg
  'salzburg': 'salzburg',
  'salzburg-stadt': 'salzburg',
  'hallein': 'salzburg',
  'salzburg-umgebung': 'salzburg',
  'st-johann-im-pongau': 'salzburg',
  'tamsweg': 'salzburg',
  'zell-am-see': 'salzburg',
  'lungau': 'salzburg',
  'flachgau': 'salzburg',
  'tennengau': 'salzburg',
  'pongau': 'salzburg',
  'pinzgau': 'salzburg',

  // Kärnten
  'klagenfurt': 'kaernten',
  'feldkirchen': 'kaernten',
  'hermagor': 'kaernten',
  'klagenfurt-land': 'kaernten',
  'st-veit': 'kaernten',
  'spittal': 'kaernten',
  'villach': 'kaernten',
  'villach-land': 'kaernten',
  'voelkermarkt': 'kaernten',
  'wolfsberg': 'kaernten',

  // Tirol
  'innsbruck': 'tirol',
  'imst': 'tirol',
  'innsbruck-land': 'tirol',
  'kitzbuehel': 'tirol',
  'kufstein': 'tirol',
  'landeck': 'tirol',
  'lienz': 'tirol',
  'reutte': 'tirol',
  'schwaz': 'tirol',

  // Vorarlberg
  'bludenz': 'vorarlberg',
  'bregenz': 'vorarlberg',
  'dornbirn': 'vorarlberg',
  'feldkirch': 'vorarlberg',

  // Burgenland
  'eisenstadt': 'burgenland',
  'guessing': 'burgenland',
  'jennersdorf': 'burgenland',
  'mattersburg': 'burgenland',
  'neusiedl-am-see': 'burgenland',
  'oberpullendorf': 'burgenland',
  'oberwart': 'burgenland',
};

const MONTHS: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'jan': '01',
  'februar': '02', 'feb': '02',
  'märz': '03', 'mar': '03', 'mär': '03',
  'april': '04', 'apr': '04',
  'mai': '05',
  'juni': '06', 'jun': '06',
  'juli': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09', 'sept': '09',
  'oktober': '10', 'okt': '10', 'oct': '10',
  'november': '11', 'nov': '11',
  'dezember': '12', 'dez': '12', 'dec': '12',
};

/** Max number of detail pages to scrape for richer data */
const DETAIL_SCRAPE_LIMIT = 500;

export class MeinBezirkScraper extends BaseScraper {
  readonly name = 'meinbezirk';
  private readonly BASE = 'https://www.meinbezirk.at';
  private readonly MAX_PAGES = 420; // 416+ Seiten auf meinbezirk.at

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte meinbezirk.at Scraping (ganz Österreich)...');
    const allEvents = new Map<string, ScrapedEvent>();
    let page = 1;
    let hasMore = true;
    let emptyCount = 0;

    while (hasMore && page <= this.MAX_PAGES) {
      const url = `${this.BASE}/event/list/all/${page}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) {
          emptyCount++;
          if (emptyCount >= 3) {
            this.log(`${emptyCount} leere Seiten in Folge, stoppe.`);
            hasMore = false;
          }
        } else {
          emptyCount = 0;
          for (const ev of events) {
            allEvents.set(ev.source_id, ev);
          }
        }

        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
        page++;
        await this.sleep(1500); // Etwas langsamer für großes Volumen
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 3) hasMore = false;
        page++;
        await this.rateLimit();
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt von ${page - 1} Seiten`);

    // Scrape detail pages for the first N events to get richer data
    await this.enrichWithDetails(events);

    return events;
  }

  /**
   * Scrape detail pages for the first DETAIL_SCRAPE_LIMIT events
   * to get full address, better images, and descriptions.
   */
  private async enrichWithDetails(events: ScrapedEvent[]): Promise<void> {
    const toEnrich = events.slice(0, DETAIL_SCRAPE_LIMIT);
    this.log(`Scrape ${toEnrich.length} Detail-Seiten für bessere Daten...`);
    let enriched = 0;
    let failed = 0;

    for (const event of toEnrich) {
      // Skip events without a source_url — MeinBezirk always has one,
      // but the type is nullable now (other scrapers like Feratel return
      // null). Narrow here so we don't pass null into fetchPage.
      if (!event.source_url) continue;
      try {
        const html = await this.fetchPage(event.source_url);
        const detail = this.parseDetailPage(html);

        if (detail.description) event.description = detail.description;
        if (detail.address) event.address = detail.address;
        if (detail.postalCode) event.postal_code = detail.postalCode;
        // Image: when the detail page provides a better URL, swap
        // image_url AND its dims atomically. Keeping the listing-page
        // thumbnail dims on the new hero URL would emit impossible
        // metadata (e.g. 400x300 thumbnail dims on a 1200×630 og URL).
        // detail.imageWidth/Height may be undefined — that's fine,
        // the supabase-sync `pickFinalImageWidth/Height` helpers
        // and pattern-extraction in extractDimsFromUrl pick up the
        // slack.
        if (detail.imageUrl) {
          event.image_url = detail.imageUrl;
          event.image_width = detail.imageWidth;
          event.image_height = detail.imageHeight;
        }
        if (detail.locationName && !event.location_name) {
          event.location_name = detail.locationName;
        }

        enriched++;
      } catch {
        failed++;
      }

      // Rate-limit: 1 second between detail requests
      await this.sleep(1000);
    }

    this.log(`Detail-Enrichment: ${enriched} angereichert, ${failed} fehlgeschlagen`);
  }

  /**
   * Parse a detail page for richer event data.
   */
  private parseDetailPage(html: string): {
    description?: string;
    address?: string;
    postalCode?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    locationName?: string;
  } {
    const $ = cheerio.load(html);
    const result: {
      description?: string;
      address?: string;
      postalCode?: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      locationName?: string;
    } = {};

    // Description: look for event description / article body
    const $desc = $('.event-detail__description, .article-body, [itemprop="description"]').first();
    if ($desc.length) {
      const text = $desc.text().trim();
      if (text.length > 10) {
        result.description = text.slice(0, 2000); // Limit length
      }
    }

    // Address: look for structured address or location info
    const $address = $('[itemprop="address"], .event-detail__location, .event-location').first();
    if ($address.length) {
      const streetName = $address.find('[itemprop="streetAddress"]').text().trim();
      const postalCode = $address.find('[itemprop="postalCode"]').text().trim();
      const locality = $address.find('[itemprop="addressLocality"]').text().trim();

      if (streetName || locality) {
        const parts = [streetName, postalCode, locality].filter(Boolean);
        result.address = parts.join(', ');
      }
      if (postalCode) {
        result.postalCode = postalCode;
      }
    }

    // Fallback: try to extract PLZ from any text matching "A-XXXX" or just 4 digits near address context
    if (!result.postalCode) {
      const bodyText = $('body').text();
      const plzMatch = bodyText.match(/\b(?:A-)?(\d{4})\s+[A-ZÄÖÜ]/);
      if (plzMatch) {
        result.postalCode = plzMatch[1];
      }
    }

    // Location name from venue
    const $venue = $('[itemprop="location"] [itemprop="name"], .event-detail__venue').first();
    if ($venue.length) {
      const venueName = $venue.text().trim();
      if (venueName) result.locationName = venueName;
    }

    // Better image: look for larger event images. Prefer og:image
    // (with og:image:width/height meta when emitted), otherwise pull
    // from the detail page's hero img (using imageFromElement so
    // width/height attrs are picked up).
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !ogImage.startsWith('data:')) {
      result.imageUrl = ogImage;
      // og:image:width / og:image:height are commonly set on
      // article pages — pick them up so the upsert doesn't carry
      // stale listing-page thumbnail dims.
      const ogW = parseInt($('meta[property="og:image:width"]').attr('content') || '0', 10);
      const ogH = parseInt($('meta[property="og:image:height"]').attr('content') || '0', 10);
      if (ogW > 0) result.imageWidth = ogW;
      if (ogH > 0) result.imageHeight = ogH;
    } else {
      // Fallback: large image in event detail. Use imageFromElement
      // so srcset and width/height attrs are honoured.
      const detailInfo = this.imageFromElement(
        $('.event-detail__image img, .article-image img, [itemprop="image"]').first(),
        'https://www.meinbezirk.at',
      );
      if (detailInfo?.url) {
        result.imageUrl = detailInfo.url;
        result.imageWidth = detailInfo.image_width;
        result.imageHeight = detailInfo.image_height;
      }
    }

    return result;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Each event is in a list item containing an h3 with a link
    $('h3 a[href*="/event/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const title = $link.text().trim();

        if (!title || !href.includes('/event/')) return;
        // Skip category/list links
        if (href.match(/\/event\/(list|kalender|search)/)) return;

        // Extract event ID from URL: /event/city/c-category/slug_e12345
        const idMatch = href.match(/_e(\d+)$/);
        if (!idMatch) return;
        const eventId = idMatch[1];

        // Get the parent container (li or wrapping div)
        const $container = $link.closest('li').length ? $link.closest('li') : $link.parent().parent();
        const containerText = $container.text();

        // Parse date from container text
        const startDate = this.parseDate(containerText);
        if (!startDate) return;

        // Extract bezirk and category from URL path: /event/{bezirk-slug}/c-{category}/...
        const urlParts = href.match(/\/event\/([^/]+)\/c-([^/]+)\//);
        const bezirkSlug = urlParts ? urlParts[1] : '';
        const categorySlug = urlParts ? urlParts[2] : '';

        // Store bezirk-slug as district
        const district = bezirkSlug || undefined;

        // Determine Bundesland from bezirk slug
        let bundesland: string | undefined;
        if (bezirkSlug && BEZIRK_BUNDESLAND[bezirkSlug]) {
          bundesland = BEZIRK_BUNDESLAND[bezirkSlug];
        }

        // Fallback: try to find region abbreviation in text (Wien, OÖ, NÖ, etc.)
        if (!bundesland) {
          const regionMatch = containerText.match(/\b(Wien|OÖ|NÖ|Stmk|Bgld|Sbg|Ktn|Vbg|Tirol)\b/i);
          if (regionMatch) {
            bundesland = REGION_TO_BUNDESLAND[regionMatch[1].toLowerCase()];
          }
        }

        // Extract image (carries width/height from HTML attrs into the upsert)
        const imageInfo = this.imageFromElement($container.find('img').first(), this.BASE);

        // Extract venue from list items
        let locationName: string | undefined;
        const $lis = $container.find('ul li');
        if ($lis.length >= 2) {
          // Usually: li[0]=date, li[1]=venue, li[2]=detail
          locationName = $lis.eq(1).text().trim() || undefined;
        }

        // Category from URL slug
        const category = this.mapCategory(categorySlug) || categorizeEvent(title);

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `meinbezirk-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: locationName,
          district,
          bundesland,
          category,
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
        });
      } catch { /* skip individual event errors */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // Try: "27. März 2026" or "27. März 2026 um 19:00"
    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})(?:\s+(?:um\s+)?(\d{1,2}):(\d{2}))?/);
    if (m) {
      const [, day, month, year, hour, minute] = m;
      const mo = MONTHS[month.toLowerCase()];
      if (!mo) return null;
      const dateStr = `${year}-${mo}-${day.padStart(2, '0')}`;
      return hour ? `${dateStr}T${hour.padStart(2, '0')}:${minute}:00` : dateStr;
    }

    // Try numeric: "27.03.2026"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (n) {
      const [, day, mo, year, hour, minute] = n;
      const dateStr = `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return hour ? `${dateStr}T${hour.padStart(2, '0')}:${minute}:00` : dateStr;
    }

    return null;
  }

  private mapCategory(slug: string): string | undefined {
    const s = slug.toLowerCase();
    if (s.includes('konzert') || s.includes('buehne') || s.includes('bühne') || s.includes('kino')) return 'Kultur';
    if (s.includes('musik') || s.includes('festival')) return 'Musik';
    if (s.includes('sport') || s.includes('fitness')) return 'Sport';
    if (s.includes('familie') || s.includes('kinder')) return 'Familie';
    if (s.includes('markt') || s.includes('flohmarkt')) return 'Märkte';
    if (s.includes('kulinar') || s.includes('wein') || s.includes('gastro')) return 'Wein & Kulinarik';
    if (s.includes('natur') || s.includes('outdoor')) return 'Natur';
    if (s.includes('party') || s.includes('club') || s.includes('techno') || s.includes('rave')) return 'Rave';
    return undefined;
  }
}
