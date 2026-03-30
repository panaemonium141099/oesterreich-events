import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getSharedBrowser } from './puppeteerBrowser';
import type { ScrapedEvent } from '@/types/events';

interface ClubConfig {
  id: string;
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  postalCode: string;
  district: string;
  needsPuppeteer: boolean;
  /** Optional custom parser key — if set, uses a club-specific parsing method */
  parser?: string;
}

const CLUBS: ClubConfig[] = [
  {
    id: 'grelle-forelle',
    name: 'Grelle Forelle',
    url: 'https://www.grelleforelle.com/programm/',
    latitude: 48.2363, longitude: 16.3683,
    postalCode: '1090', district: '9. Alsergrund',
    needsPuppeteer: false,
  },
  {
    id: 'flex',
    name: 'Flex',
    url: 'https://flex.at/events/',
    latitude: 48.2126, longitude: 16.3726,
    postalCode: '1010', district: '1. Innere Stadt',
    needsPuppeteer: false,
  },
  {
    id: 'u4',
    name: 'U4',
    url: 'https://www.u4.at/',
    latitude: 48.1927, longitude: 16.3389,
    postalCode: '1120', district: '12. Meidling',
    needsPuppeteer: true,
  },
  {
    id: 'pratersauna',
    name: 'Pratersauna',
    url: 'https://pratersauna.tv/',
    latitude: 48.2175, longitude: 16.3953,
    postalCode: '1020', district: '2. Leopoldstadt',
    needsPuppeteer: true,
  },
  {
    id: 'praterdome',
    name: 'Praterdome',
    url: 'https://www.praterdome.at/api/events',
    latitude: 48.2152, longitude: 16.3989,
    postalCode: '1020', district: '2. Leopoldstadt',
    needsPuppeteer: false,
    parser: 'praterdome-api',
  },
  {
    id: 'volksgarten',
    name: 'Volksgarten',
    url: 'https://www.volksgarten.at/',
    latitude: 48.2047, longitude: 16.3608,
    postalCode: '1010', district: '1. Innere Stadt',
    needsPuppeteer: true,
  },
  {
    id: 'fluc',
    name: 'Fluc',
    url: 'https://fluc.at/programm/',
    latitude: 48.2178, longitude: 16.3903,
    postalCode: '1020', district: '2. Leopoldstadt',
    needsPuppeteer: false,
    parser: 'fluc',
  },
  {
    id: 'das-werk',
    name: 'Das Werk',
    url: 'https://daswerk.org/',
    latitude: 48.2350, longitude: 16.3694,
    postalCode: '1090', district: '9. Alsergrund',
    needsPuppeteer: true,
  },
  {
    id: 'sass',
    name: 'Sass Music Club',
    url: 'https://sassvienna.com/',
    latitude: 48.2081, longitude: 16.3652,
    postalCode: '1010', district: '1. Innere Stadt',
    needsPuppeteer: true,
  },
  {
    id: 'camera-club',
    name: 'Camera Club',
    url: 'https://camera-club.at/',
    latitude: 48.2011, longitude: 16.3640,
    postalCode: '1010', district: '1. Innere Stadt',
    needsPuppeteer: false,
  },
  {
    id: 'chelsea',
    name: 'Chelsea',
    url: 'https://chelsea.co.at/concerts.php',
    latitude: 48.2089, longitude: 16.3370,
    postalCode: '1080', district: '8. Josefstadt',
    needsPuppeteer: false,
    parser: 'chelsea',
  },
  {
    id: 'rhiz',
    name: 'Rhiz',
    url: 'https://rhiz.wien/',
    latitude: 48.2083, longitude: 16.3397,
    postalCode: '1080', district: '8. Josefstadt',
    needsPuppeteer: false,
  },
  {
    id: 'b72',
    name: 'B72',
    url: 'https://b72.at/',
    latitude: 48.2092, longitude: 16.3382,
    postalCode: '1080', district: '8. Josefstadt',
    needsPuppeteer: false,
    parser: 'b72',
  },
  // --- Neue Clubs ---
  {
    id: 'arena-wien',
    name: 'Arena Wien',
    url: 'https://arena.wien/Home/Event-List',
    latitude: 48.1893, longitude: 16.4103,
    postalCode: '1030', district: '3. Landstraße',
    needsPuppeteer: false,
    parser: 'arena-wien',
  },
  {
    id: 'wuk',
    name: 'WUK',
    url: 'https://wuk.at/programm',
    latitude: 48.2262, longitude: 16.3566,
    postalCode: '1090', district: '9. Alsergrund',
    needsPuppeteer: true,
  },
  {
    id: 'szene-wien',
    name: 'Szene Wien',
    url: 'https://szenewien.com/',
    latitude: 48.1718, longitude: 16.4060,
    postalCode: '1110', district: '11. Simmering',
    needsPuppeteer: false,
    parser: 'szene-wien',
  },
  {
    id: 'cafe-leopold',
    name: 'Café Leopold',
    url: 'https://cafeleopold.wien',
    latitude: 48.2034, longitude: 16.3584,
    postalCode: '1070', district: '7. Neubau',
    needsPuppeteer: true,
  },
  {
    id: 'ottakringer-brauerei',
    name: 'Ottakringer Brauerei',
    url: 'https://www.otbrauerei.at/events',
    latitude: 48.2134, longitude: 16.3119,
    postalCode: '1160', district: '16. Ottakring',
    needsPuppeteer: false,
    parser: 'ottakringer',
  },
];

const MONTHS: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'jan': '01', 'january': '01',
  'februar': '02', 'feb': '02', 'february': '02',
  'märz': '03', 'mär': '03', 'mar': '03', 'march': '03',
  'april': '04', 'apr': '04',
  'mai': '05', 'may': '05',
  'juni': '06', 'jun': '06', 'june': '06',
  'juli': '07', 'jul': '07', 'july': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09', 'sept': '09',
  'oktober': '10', 'okt': '10', 'oct': '10', 'october': '10',
  'november': '11', 'nov': '11',
  'dezember': '12', 'dez': '12', 'dec': '12', 'december': '12',
};

/**
 * Wien Clubs Scraper
 * Config-driven scraper that iterates over all Wien clubs.
 * Uses Cheerio for SSR sites, Puppeteer for dynamic ones,
 * and club-specific parsers where the HTML structure requires it.
 */
export class WienClubsScraper extends BaseScraper {
  readonly name = 'wien-clubs';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte Wien Clubs Scraping (${CLUBS.length} Clubs)...`);
    const allEvents: ScrapedEvent[] = [];

    for (const club of CLUBS) {
      try {
        let events: ScrapedEvent[];

        if (club.parser) {
          events = await this.scrapeWithCustomParser(club);
        } else if (club.needsPuppeteer) {
          events = await this.scrapeClubPuppeteer(club);
        } else {
          events = await this.scrapeClubCheerio(club);
        }

        allEvents.push(...events);
        this.log(`${club.name}: ${events.length} Events`);
      } catch (err) {
        this.log(`${club.name}: Fehler - ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`${allEvents.length} Events von ${CLUBS.length} Clubs gescrapt`);
    return allEvents;
  }

  // ---------------------------------------------------------------------------
  // Custom parsers for specific club sites
  // ---------------------------------------------------------------------------

  private async scrapeWithCustomParser(club: ClubConfig): Promise<ScrapedEvent[]> {
    switch (club.parser) {
      case 'praterdome-api':
        return this.scrapePraterdomeApi(club);
      case 'b72':
        return this.scrapeB72(club);
      case 'chelsea':
        return this.scrapeChelsea(club);
      case 'fluc':
        return this.scrapeFluc(club);
      case 'arena-wien':
        return this.scrapeArenaWien(club);
      case 'szene-wien':
        return this.scrapeSzeneWien(club);
      case 'ottakringer':
        return this.scrapeOttakringer(club);
      default:
        return this.scrapeClubCheerio(club);
    }
  }

  /**
   * Praterdome: SPA powered by disco2app — fetch events from their JSON API.
   * API returns { success: true, events: [...] } with event objects.
   */
  private async scrapePraterdomeApi(club: ClubConfig): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    try {
      const response = await fetch(club.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.userAgent,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json() as PraterdomeApiResponse;
      const items = json.events || (Array.isArray(json) ? json as unknown as PraterdomeEvent[] : []);

      for (const item of items) {
        const name = String(item.name || '').trim();
        if (!name) continue;
        const startTime = String(item.start_time || '').slice(0, 19);
        if (!startTime) continue;

        const slug = (item.slug || name.toLowerCase().replace(/\W+/g, '-')).slice(0, 60);
        const sourceId = `wien-clubs-${club.id}-${slug}`;

        let imageUrl: string | undefined;
        if (item.image) {
          imageUrl = String(item.image);
        }

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: `https://www.praterdome.at/events/${slug}`,
          title: name,
          description: item.details ? String(item.details).slice(0, 500) : undefined,
          start_date: startTime,
          end_date: item.end_time ? String(item.end_time).slice(0, 19) : undefined,
          location_name: club.name,
          address: `${club.postalCode} Wien`,
          postal_code: club.postalCode,
          bundesland: 'wien',
          district: club.district,
          latitude: club.latitude,
          longitude: club.longitude,
          category: categorizeEvent(name),
          image_url: imageUrl,
        });
      }
    } catch (err) {
      this.log(`Praterdome API: ${err instanceof Error ? err.message : err}`);
    }
    return events;
  }

  /**
   * B72: Simple HTML pattern —
   * <h4>DD.MM</h4> followed by <h6><a href="/program/ID/Slug">Title</a></h6>
   */
  private async scrapeB72(club: ClubConfig): Promise<ScrapedEvent[]> {
    const html = await this.fetchPage(club.url);
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    const year = new Date().getFullYear();

    // Each event has an h4 with "DD.MM" date and an h6 with a link
    $('h4').each((_, h4El) => {
      try {
        const dateText = $(h4El).text().trim();
        // Match "DD.MM" pattern (e.g. "21.04")
        const dateMatch = dateText.match(/^(\d{1,2})\.(\d{1,2})$/);
        if (!dateMatch) return;

        const [, day, month] = dateMatch;
        const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // The h6 with the event title follows the h4
        const $h6 = $(h4El).next('h6');
        if (!$h6.length) return;

        const $link = $h6.find('a').first();
        const title = ($link.length ? $link.text() : $h6.text()).trim();
        if (!title || title.length < 3) return;

        const href = $link.attr('href') || '';
        const sourceUrl = href ? new URL(href, club.url).href : club.url;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const sourceId = `wien-clubs-${club.id}-${slug}`;
        if (seen.has(sourceId)) return;
        seen.add(sourceId);

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: dateStr,
          location_name: club.name,
          address: `${club.postalCode} Wien`,
          postal_code: club.postalCode,
          bundesland: 'wien',
          district: club.district,
          latitude: club.latitude,
          longitude: club.longitude,
          category: categorizeEvent(title),
        });
      } catch { /* skip individual */ }
    });

    return events;
  }

  /**
   * Chelsea (chelsea.co.at/concerts.php):
   * Events in table.termindetails with:
   *   <div class="date">Sa, 28.03.</div>
   *   <div class="band"><span class="highlight">ARTIST NAME</span></div>
   * Images: <img src="img/concert_ID_N.jpg">
   * Anchors: <a name="concert_ID">
   */
  private async scrapeChelsea(club: ClubConfig): Promise<ScrapedEvent[]> {
    const html = await this.fetchPage(club.url);
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    const year = new Date().getFullYear();

    $('table.termindetails').each((_, tableEl) => {
      try {
        const $table = $(tableEl);

        // Extract date from div.date — e.g. "Sa, 28.03."
        const dateText = $table.find('div.date').first().text().trim();
        const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\./);
        if (!dateMatch) return;

        const [, day, month] = dateMatch;
        const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Extract artist from div.band (may contain span.highlight)
        const $band = $table.find('div.band').first();
        const title = ($band.find('span.highlight').text() || $band.text()).trim();
        if (!title || title.length < 2) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const sourceId = `wien-clubs-${club.id}-${slug}`;
        if (seen.has(sourceId)) return;
        seen.add(sourceId);

        // Get first concert image
        let imageUrl: string | undefined;
        const $img = $table.find('img[src*="concert_"]').first();
        if ($img.length) {
          const src = ($img.attr('src') || '').replace(/\?.*$/, '');
          if (src) {
            imageUrl = src.startsWith('http') ? src : new URL(src, 'https://chelsea.co.at/').href;
          }
        }

        // Find anchor before this table for direct link
        let sourceUrl = club.url;
        const $anchor = $table.prevAll('a[name^="concert_"]').first();
        if ($anchor.length) {
          sourceUrl = `https://chelsea.co.at/concerts.php#${$anchor.attr('name')}`;
        }

        // Extract price from div.price
        const priceText = $table.find('div.price').text().trim() || undefined;

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: dateStr,
          location_name: club.name,
          address: `${club.postalCode} Wien`,
          postal_code: club.postalCode,
          bundesland: 'wien',
          district: club.district,
          latitude: club.latitude,
          longitude: club.longitude,
          category: categorizeEvent(title),
          image_url: imageUrl,
          price_text: priceText,
        });
      } catch { /* skip individual */ }
    });

    return events;
  }

  /**
   * Fluc (fluc.at/programm/):
   * Weekly program in <ul><li> structure. The main page links to the current week.
   * Each day: "Montag DD. Monat" as text, then sub-items with "HH:MM: Event Title".
   * Bold text marks the event name. Two venues: "fluc" and "fluc_wanne".
   * We scrape the current week page and look for next/previous week links.
   */
  private async scrapeFluc(club: ClubConfig): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];
    const scrapedUrls = new Set<string>();

    // Start by fetching the main /programm/ page to find the current week link
    const mainHtml = await this.fetchPage(club.url);
    const $main = cheerio.load(mainHtml);

    // Find links to weekly program pages (e.g., 2026_Flucwoche13.html)
    const weekLinks: string[] = [];
    $main('a').each((_, el) => {
      const href = $main(el).attr('href') || '';
      if (href.match(/\d{4}_Flucwoche\d+\.html/i)) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, club.url).href;
        if (!weekLinks.includes(fullUrl)) weekLinks.push(fullUrl);
      }
    });

    // If the main page itself contains event content, parse it too
    const mainEvents = this.parseFlucWeekHtml(mainHtml, club);
    allEvents.push(...mainEvents);
    scrapedUrls.add(club.url);

    // Scrape linked week pages (max 4 weeks to not overload)
    for (const weekUrl of weekLinks.slice(0, 4)) {
      if (scrapedUrls.has(weekUrl)) continue;
      scrapedUrls.add(weekUrl);
      try {
        await this.rateLimit();
        const weekHtml = await this.fetchPage(weekUrl);
        const weekEvents = this.parseFlucWeekHtml(weekHtml, club);
        allEvents.push(...weekEvents);

        // Also look for next-week links in this page
        const $week = cheerio.load(weekHtml);
        $week('a').each((_, el) => {
          const href = $week(el).attr('href') || '';
          if (href.match(/\d{4}_Flucwoche\d+\.html/i)) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, weekUrl).href;
            if (!weekLinks.includes(fullUrl) && weekLinks.length < 6) {
              weekLinks.push(fullUrl);
            }
          }
        });
      } catch (err) {
        this.log(`Fluc Woche ${weekUrl}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return allEvents.filter(ev => {
      if (seen.has(ev.source_id)) return false;
      seen.add(ev.source_id);
      return true;
    });
  }

  private parseFlucWeekHtml(html: string, club: ClubConfig): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const year = new Date().getFullYear();

    // Fluc uses li.datum elements with id="d_YYYYMMDD"
    // Each contains child li.fluc and li.wanne with <strong> event titles
    $('li.datum').each((_, dayEl) => {
      try {
        const $day = $(dayEl);
        const dayId = $day.attr('id') || '';

        // Extract date from id like "d_20260323" or from text "Montag 23. März"
        let dateStr: string | null = null;
        const idMatch = dayId.match(/^d_(\d{4})(\d{2})(\d{2})$/);
        if (idMatch) {
          dateStr = `${idMatch[1]}-${idMatch[2]}-${idMatch[3]}`;
        } else {
          // Fallback: parse from text
          const dayText = $day.clone().children('ul').remove().end().text().trim();
          const textMatch = dayText.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)/);
          if (textMatch) {
            const mo = MONTHS[textMatch[2].toLowerCase()];
            if (mo) dateStr = `${year}-${mo}-${textMatch[1].padStart(2, '0')}`;
          }
        }
        if (!dateStr) return;

        // Process both fluc and fluc_wanne venue entries
        $day.find('li.fluc, li.wanne, li[class*="fluc"], li[class*="wanne"]').each((_, venueEl) => {
          const $venue = $(venueEl);
          const venueText = $venue.text();

          // Skip entirely if only construction/closed
          const lower = venueText.toLowerCase();
          if (lower.includes('baustelle') && !lower.match(/\d{1,2}:\d{2}/)) return;

          // Find all <strong> elements — these are event titles
          $venue.find('strong').each((_, strongEl) => {
            const title = $(strongEl).text().trim();
            if (!title || title.length < 3 || title.length > 200) return;

            // Skip construction, cancelled, technical entries
            const titleLower = title.toLowerCase();
            if (titleLower.includes('baustelle') || titleLower.includes('abgesagt')) return;
            if (titleLower.includes('schallmessung') || titleLower.includes('probe')) return;

            // Try to find time before this strong element
            // Get text before the strong element in the venue li
            const venueHtml = $venue.html() || '';
            const strongHtml = $.html(strongEl);
            const beforeStrong = venueHtml.split(strongHtml)[0] || '';
            // Look for time pattern like "19:00:" or "22:00"
            const timeMatches = [...beforeStrong.matchAll(/(\d{1,2}):(\d{2})/g)];
            const lastTime = timeMatches.length > 0 ? timeMatches[timeMatches.length - 1] : null;

            let eventDate = dateStr!;
            if (lastTime) {
              eventDate = `${dateStr}T${lastTime[1].padStart(2, '0')}:${lastTime[2]}:00`;
            }

            const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
            const sourceId = `wien-clubs-${club.id}-${slug}-${dateStr}`;

            events.push({
              source_id: sourceId,
              source_name: this.name,
              source_url: club.url,
              title,
              start_date: eventDate,
              location_name: club.name,
              address: `${club.postalCode} Wien`,
              postal_code: club.postalCode,
              bundesland: 'wien',
              district: club.district,
              latitude: club.latitude,
              longitude: club.longitude,
              category: categorizeEvent(title),
            });
          });
        });
      } catch { /* skip day */ }
    });

    return events;
  }

  /**
   * Arena Wien: Events loaded via DNN AJAX API with Handlebars templates.
   * The API needs a DNN-specific verification token from the page.
   * We use Puppeteer to load the page and let JS render the event list,
   * then parse the rendered DOM.
   */
  private async scrapeArenaWien(club: ClubConfig): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      await page.goto('https://arena.wien/Home/Programm', { waitUntil: 'networkidle2', timeout: 25000 });
      await this.sleep(5000); // Wait for JS to load events

      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 2000));
      await this.sleep(2000);

      const html = await page.content();
      await page.close();

      const $ = cheerio.load(html);

      // Parse suite_calRowContainer entries (rendered by Handlebars)
      $('.suite_calRowContainer').each((_, el) => {
        try {
          const $row = $(el);
          const dayNum = $row.find('.suite_day-number').text().trim();
          const monthYear = $row.find('.suite_year').text().trim(); // "Mär | 2026"
          const title = $row.find('.Event_H1').text().trim();
          const subtitle = $row.find('.Event_H2').text().trim();

          if (!title || !dayNum) return;

          // Parse month from "Mär | 2026" or "Apr | 2026"
          const myMatch = monthYear.match(/([A-Za-zäöü]+)\s*\|\s*(\d{4})/);
          if (!myMatch) return;
          const mo = MONTHS[myMatch[1].toLowerCase()];
          const yr = myMatch[2];
          if (!mo) return;

          const dateStr = `${yr}-${mo}-${dayNum.padStart(2, '0')}`;
          const fullTitle = subtitle ? `${title} - ${subtitle}` : title;
          const slug = fullTitle.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const sourceId = `wien-clubs-${club.id}-${slug}`;
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          const $link = $row.find('a').first();
          const href = $link.attr('href') || '';
          const sourceUrl = href ? new URL(href, 'https://arena.wien').href : 'https://arena.wien/Home/Programm';

          events.push({
            source_id: sourceId,
            source_name: this.name,
            source_url: sourceUrl,
            title: fullTitle,
            start_date: dateStr,
            location_name: club.name,
            address: `${club.postalCode} Wien`,
            postal_code: club.postalCode,
            bundesland: 'wien',
            district: club.district,
            latitude: club.latitude,
            longitude: club.longitude,
            category: categorizeEvent(fullTitle),
          });
        } catch { /* skip */ }
      });

      // Fallback: parse event links from the homepage if programm page didn't render
      if (events.length === 0) {
        const mainHtml = await this.fetchPage('https://arena.wien');
        const $main = cheerio.load(mainHtml);
        $main('a[href*="Programm-Detail"]').each((_, el) => {
          try {
            const $a = $main(el);
            const href = $a.attr('href') || '';
            const title = $a.text().trim();
            if (!title || title.length < 3) return;

            // Try to find date in surrounding context
            const $parent = $a.closest('div, li, td');
            const parentText = $parent.text();
            const dateStr = this.parseDate(parentText);
            if (!dateStr) return;

            const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
            const sourceId = `wien-clubs-${club.id}-${slug}`;
            if (seen.has(sourceId)) return;
            seen.add(sourceId);

            events.push({
              source_id: sourceId,
              source_name: this.name,
              source_url: href.startsWith('http') ? href : new URL(href, 'https://arena.wien').href,
              title,
              start_date: dateStr,
              location_name: club.name,
              address: `${club.postalCode} Wien`,
              postal_code: club.postalCode,
              bundesland: 'wien',
              district: club.district,
              latitude: club.latitude,
              longitude: club.longitude,
              category: categorizeEvent(title),
            });
          } catch { /* skip */ }
        });
      }
    } catch (err) {
      this.log(`Arena Wien: ${err instanceof Error ? err.message : err}`);
    }

    return events;
  }

  /**
   * Szene Wien: Site has TLS cert issues, try with error handling.
   * Falls back gracefully if site is unreachable.
   */
  private async scrapeSzeneWien(club: ClubConfig): Promise<ScrapedEvent[]> {
    try {
      const html = await this.fetchPage(club.url);
      return this.parseClubHtml(html, club);
    } catch (err) {
      this.log(`Szene Wien: Seite nicht erreichbar (TLS/Zertifikat) - ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /**
   * Ottakringer Brauerei: Site might be down, graceful fallback.
   */
  private async scrapeOttakringer(club: ClubConfig): Promise<ScrapedEvent[]> {
    try {
      const html = await this.fetchPage(club.url);
      return this.parseClubHtml(html, club);
    } catch (err) {
      this.log(`Ottakringer Brauerei: Seite nicht erreichbar - ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Generic scraping methods
  // ---------------------------------------------------------------------------

  private async scrapeClubCheerio(club: ClubConfig): Promise<ScrapedEvent[]> {
    const html = await this.fetchPage(club.url);
    return this.parseClubHtml(html, club);
  }

  private async scrapeClubPuppeteer(club: ClubConfig): Promise<ScrapedEvent[]> {
    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      await page.goto(club.url, { waitUntil: 'networkidle2', timeout: 20000 });
      await this.sleep(3000);

      // Scroll to load content
      await page.evaluate(() => window.scrollBy(0, 3000));
      await this.sleep(2000);

      const html = await page.content();
      await page.close();
      return this.parseClubHtml(html, club);
    } catch (err) {
      this.log(`${club.name} Puppeteer: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private parseClubHtml(html: string, club: ClubConfig): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Strategy 1: JSON-LD Event data
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
        for (const item of items) {
          if (item['@type'] !== 'Event') continue;
          const ev = this.mapJsonLdEvent(item, club);
          if (ev && !seen.has(ev.source_id)) {
            seen.add(ev.source_id);
            events.push(ev);
          }
        }
      } catch {}
    });

    if (events.length > 0) return events;

    // Strategy 2: Common event selectors
    const eventSelectors = [
      // Grelle Forelle pattern: portfolio items
      '.et_pb_portfolio_item h3 a',
      // Flex pattern
      '.ewpe-event-title a, .ewpe-event-title',
      // Generic patterns
      'a[href*="/event/"]', 'a[href*="/project/"]', 'a[href*="/programm/"]',
      '.event-title a', '.event-item a', '.event a',
      'article a', '.post-title a',
      'h2 a, h3 a, h4 a',
    ];

    for (const selector of eventSelectors) {
      $(selector).each((_, el) => {
        try {
          const $el = $(el);
          const href = $el.attr('href') || '';
          const text = $el.text().trim();
          if (!text || text.length < 3) return;

          // Get containing card
          const $card = $el.closest('article, .event, .event-item, .et_pb_portfolio_item, li, div').first();
          const cardText = $card.length ? $card.text() : text;

          // Try to extract date from text: "27/03 Title" or "27.03. Title"
          let title = text;
          let dateStr: string | null = null;

          // Pattern: "DD/MM Title" (Grelle Forelle)
          const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)/);
          if (slashDate) {
            const [, day, month, rest] = slashDate;
            const year = new Date().getFullYear();
            dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            title = rest.trim();
          }

          // Pattern: "DD. Monat YYYY" in card text
          if (!dateStr) {
            dateStr = this.parseDate(cardText);
          }

          // Pattern: "DD.MM." or "DD.MM.YYYY" from schedule elements
          if (!dateStr) {
            const schedText = $card.find('.ewpe-events-schedule, .date, time, [class*="date"]').text();
            dateStr = this.parseDate(schedText);
          }

          if (!dateStr || !title) return;

          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const sourceId = `wien-clubs-${club.id}-${slug}`;
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          // Image
          let imageUrl: string | undefined;
          const $img = $card.find('img').first();
          const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
          if (imgSrc && !imgSrc.startsWith('data:')) {
            imageUrl = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, club.url).href;
          }

          const sourceUrl = href.startsWith('http') ? href : (href ? new URL(href, club.url).href : club.url);

          events.push({
            source_id: sourceId,
            source_name: this.name,
            source_url: sourceUrl,
            title,
            start_date: dateStr,
            location_name: club.name,
            address: `${club.postalCode} Wien`,
            postal_code: club.postalCode,
            bundesland: 'wien',
            district: club.district,
            latitude: club.latitude,
            longitude: club.longitude,
            category: categorizeEvent(title),
            image_url: imageUrl,
          });
        } catch { /* skip individual */ }
      });

      if (events.length > 0) break; // Found events with this selector strategy
    }

    // Strategy 3: Brute-force text scan for dates with nearby titles
    if (events.length === 0) {
      const textBlocks = this.extractTextBlocks($, club);
      events.push(...textBlocks);
    }

    return events;
  }

  private extractTextBlocks($: cheerio.CheerioAPI, club: ClubConfig): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Look for any date patterns and grab surrounding text as title
    $('*').each((_, el) => {
      const $el = $(el);
      if ($el.children().length > 0) return; // Only text nodes

      const text = $el.text().trim();
      const dateStr = this.parseDate(text);
      if (!dateStr) return;

      // Look for a title in nearby elements
      const $parent = $el.parent();
      const $heading = $parent.find('h1, h2, h3, h4, strong, b').first();
      let title = $heading.text().trim();
      if (!title) {
        title = $parent.text().replace(text, '').trim().split('\n')[0].trim();
      }
      if (!title || title.length < 3 || title.length > 200) return;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      const sourceId = `wien-clubs-${club.id}-${slug}`;
      if (seen.has(sourceId)) return;
      seen.add(sourceId);

      events.push({
        source_id: sourceId,
        source_name: this.name,
        source_url: club.url,
        title,
        start_date: dateStr,
        location_name: club.name,
        postal_code: club.postalCode,
        bundesland: 'wien',
        district: club.district,
        latitude: club.latitude,
        longitude: club.longitude,
        category: categorizeEvent(title),
      });
    });

    return events;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapJsonLdEvent(item: Record<string, unknown>, club: ClubConfig): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;

    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

    return {
      source_id: `wien-clubs-${club.id}-${slug}`,
      source_name: this.name,
      source_url: String(item.url || club.url),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: club.name,
      postal_code: club.postalCode,
      bundesland: 'wien',
      district: club.district,
      latitude: club.latitude,
      longitude: club.longitude,
      category: categorizeEvent(name),
      image_url: item.image ? String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '') : undefined,
    };
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // ISO format
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];

    // "27.03.2026" or "27.03.2026 19:00"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (n) {
      const dateStr = `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;
      return n[4] ? `${dateStr}T${n[4].padStart(2, '0')}:${n[5]}:00` : dateStr;
    }

    // "27.03." (no year) with time like "@ 23:00"
    const noYear = text.match(/(\d{1,2})\.(\d{1,2})\.(?:\s+@?\s*(\d{1,2}):(\d{2}))?/);
    if (noYear) {
      const year = new Date().getFullYear();
      const dateStr = `${year}-${noYear[2].padStart(2, '0')}-${noYear[1].padStart(2, '0')}`;
      return noYear[3] ? `${dateStr}T${noYear[3].padStart(2, '0')}:${noYear[4]}:00` : dateStr;
    }

    // "27. März 2026"
    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\.?\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }

    // "27. März" (no year)
    const noYearMonth = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\.?\s*(?:@\s*(\d{1,2}):(\d{2}))?/);
    if (noYearMonth) {
      const mo = MONTHS[noYearMonth[2].toLowerCase()];
      if (mo) {
        const year = new Date().getFullYear();
        const dateStr = `${year}-${mo}-${noYearMonth[1].padStart(2, '0')}`;
        return noYearMonth[3] ? `${dateStr}T${noYearMonth[3].padStart(2, '0')}:${noYearMonth[4]}:00` : dateStr;
      }
    }

    return null;
  }
}

// Types for Praterdome API response
interface PraterdomeApiResponse {
  success?: boolean;
  events?: PraterdomeEvent[];
}

interface PraterdomeEvent {
  id?: number;
  name?: string;
  start_time?: string;
  end_time?: string;
  slug?: string;
  image?: string;
  details?: string;
  share_url?: string;
}
