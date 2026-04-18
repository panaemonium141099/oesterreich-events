import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { getSharedBrowser } from './puppeteerBrowser';
import type { ScrapedEvent } from '@/types/events';

/**
 * Portal config for an Austrian tourism site.
 * Each portal has fixed coordinates (region center) and a parser function.
 */
interface PortalConfig {
  id: string;
  domain: string;
  listUrl: string;
  latitude: number;
  longitude: number;
  bundesland: string;
  locationName: string;
  parser: (html: string, cfg: PortalConfig) => ScrapedEvent[];
  /** Optional AJAX pagination (TYPO3 style) */
  ajaxUrl?: string;
  ajaxPageParam?: string;
  maxPages?: number;
}

// ─────────────────── German month names ───────────────────
const GERMAN_MONTHS: Record<string, string> = {
  'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
  'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
  'august': '08', 'september': '09', 'oktober': '10',
  'november': '11', 'dezember': '12',
};

function parseGermanDate(text: string): string | null {
  // "28. März 2026" or "3. April 2026"
  const longMatch = text.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  if (longMatch) {
    const month = GERMAN_MONTHS[longMatch[2].toLowerCase()];
    if (month) {
      return `${longMatch[3]}-${month}-${longMatch[1].padStart(2, '0')}`;
    }
  }

  // "28.03.2026" or "28.03.26"
  const numMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (numMatch) {
    let year = numMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
  }

  // "19 September 2025"
  const spaceMatch = text.match(/(\d{1,2})\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  if (spaceMatch) {
    const month = GERMAN_MONTHS[spaceMatch[2].toLowerCase()];
    if (month) {
      return `${spaceMatch[3]}-${month}-${spaceMatch[1].padStart(2, '0')}`;
    }
  }

  return null;
}

function parseTime(text: string): string | undefined {
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return undefined;
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\W+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ─────────────────── Parsers ───────────────────

/**
 * Zell am See-Kaprun: SSR cards with .card.textbox structure.
 * Links: /de/events/{slug}
 * Dates: "28. März 2026" as text after <strong>
 */
function parseZellamsee(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Cards with links to /de/events/ or /de/event/
  $('a[href*="/events/"], a[href*="/event/"]').each((_, el) => {
    try {
      const $a = $(el);
      const href = $a.attr('href') || '';
      if (!href || href === '#') return;

      // Title from strong or heading inside link
      const title = $a.find('strong, h2, h3, h4').first().text().trim() || $a.text().trim().split('\n')[0].trim();
      if (!title || title.length < 3) return;

      const slug = slugify(title);
      if (seen.has(slug)) return;
      seen.add(slug);

      // Date from text content
      const cardText = $a.text();
      const date = parseGermanDate(cardText);
      if (!date) return;

      const time = parseTime(cardText);

      // Image
      const $img = $a.find('img').first();
      let imageUrl: string | undefined;
      const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
      if (imgSrc && !imgSrc.includes('lazy') && !imgSrc.includes('placeholder')) {
        imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${cfg.domain}${imgSrc}`;
      }

      const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

      events.push({
        source_id: `${cfg.id}-${slug}`,
        source_name: 'tourismus-portale',
        source_url: sourceUrl,
        title,
        start_date: time ? `${date}T${time}` : date,
        location_name: cfg.locationName,
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        bundesland: cfg.bundesland,
        category: categorizeEvent(title),
        image_url: imageUrl,
      });
    } catch { /* skip */ }
  });

  return events;
}

/**
 * Stubaital: SSR cards with img + h3 + ul(date, location).
 * Dates: "19 September 2025, um 09:00"
 */
function parseStubaital(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Find event-like cards: look for links to /event/ or /veranstaltung/
  $('a[href*="/event/"], a[href*="/veranstaltung/"]').each((_, el) => {
    try {
      const $a = $(el);
      const href = $a.attr('href') || '';
      if (!href || href === '#') return;

      const $card = $a.closest('div, li, article').first();
      const title = ($card.find('h2, h3, h4').first().text().trim() || $a.text().trim()).replace(/\.\.$/, '...');
      if (!title || title.length < 3) return;

      const slug = slugify(title);
      if (seen.has(slug)) return;
      seen.add(slug);

      const cardText = $card.text();
      const date = parseGermanDate(cardText);
      if (!date) return;

      const time = parseTime(cardText);

      // Location from list items
      let locationName = cfg.locationName;
      $card.find('li, .location').each((_, li) => {
        const t = $(li).text().trim();
        if (t && !t.match(/^\d/) && !t.includes('um ') && t.length > 2 && t.length < 50) {
          locationName = t;
        }
      });

      const $img = $card.find('img').first();
      const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
      let imageUrl: string | undefined;
      if (imgSrc && imgSrc.length > 15) {
        imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${cfg.domain}${imgSrc}`;
      }

      const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

      events.push({
        source_id: `${cfg.id}-${slug}`,
        source_name: 'tourismus-portale',
        source_url: sourceUrl,
        title,
        start_date: time ? `${date}T${time}` : date,
        location_name: locationName,
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        bundesland: cfg.bundesland,
        category: categorizeEvent(title),
        image_url: imageUrl,
      });
    } catch { /* skip */ }
  });

  return events;
}

/**
 * Osttirol: TYPO3 tx_webxbookingemo plugin with AJAX pagination.
 * Links: /events-kultur/alle-veranstaltungen/detail/event/{slug}
 * Dates: "Sa. 28.03.2026 09:00"
 */
function parseOsttirol(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  $('a[href*="/detail/event/"]').each((_, el) => {
    try {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const slugMatch = href.match(/\/detail\/event\/([^/]+)\/?/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const $card = $a.closest('div, li, article').first();
      const $context = $card.length ? $card : $a;

      const title = $context.find('h2, h3, h4').first().text().trim() || $a.text().trim().split('\n')[0].trim();
      if (!title || title.length < 3) return;

      const cardText = $context.text();
      const date = parseGermanDate(cardText);
      if (!date) return;

      const time = parseTime(cardText);

      // Location: "Venue - City" pattern
      let locationName = cfg.locationName;
      const locText = $context.find('p, .location').first().text().trim();
      if (locText && locText.includes(' - ')) {
        locationName = locText.split(' - ')[0].trim();
      } else if (locText && !locText.match(/^\d/) && locText.length > 3 && locText.length < 80) {
        locationName = locText;
      }

      const $img = $context.find('img').first();
      const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
      let imageUrl: string | undefined;
      if (imgSrc && imgSrc.length > 15) {
        imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${cfg.domain}${imgSrc}`;
      }

      const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

      events.push({
        source_id: `${cfg.id}-${slug}`,
        source_name: 'tourismus-portale',
        source_url: sourceUrl,
        title,
        start_date: time ? `${date}T${time}` : date,
        location_name: locationName,
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        bundesland: cfg.bundesland,
        category: categorizeEvent(title),
        image_url: imageUrl,
      });
    } catch { /* skip */ }
  });

  return events;
}

/**
 * Achensee: SSR event listing with event detail links.
 * Links: /de/veranstaltungen-tirol-oesterreich/details/event/{slug}/
 * Dates: "Samstag, 28.03.26"
 */
function parseAchensee(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  $('a[href*="/details/event/"], a[href*="/detail/event/"]').each((_, el) => {
    try {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const slugMatch = href.match(/\/details?\/event\/([^/]+)\/?/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const $card = $a.closest('div, li, article').first();
      const $context = $card.length ? $card : $a;

      const title = $context.find('h2, h3, h4').first().text().trim() || $a.text().trim().split('\n')[0].trim();
      if (!title || title.length < 3) return;

      const cardText = $context.text();
      const date = parseGermanDate(cardText);
      if (!date) return;

      const time = parseTime(cardText);

      // Location from card
      let locationName = cfg.locationName;
      const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.includes('am Achensee') || line.includes('Achenkirch') || line.includes('Pertisau') || line.includes('Maurach') || line.includes('Wiesing')) {
          locationName = line;
          break;
        }
      }

      const $img = $context.find('img').first();
      const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
      let imageUrl: string | undefined;
      if (imgSrc && imgSrc.length > 15 && !imgSrc.includes('lazy') && !imgSrc.includes('placeholder')) {
        imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${cfg.domain}${imgSrc}`;
      }

      const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

      events.push({
        source_id: `${cfg.id}-${slug}`,
        source_name: 'tourismus-portale',
        source_url: sourceUrl,
        title,
        start_date: time ? `${date}T${time}` : date,
        location_name: locationName,
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        bundesland: cfg.bundesland,
        category: categorizeEvent(title),
        image_url: imageUrl,
      });
    } catch { /* skip */ }
  });

  return events;
}

/**
 * Kitzbühel: SSR with .veranstaltung cards.
 * Links: /veranstaltungen/event/{slug}/
 * Dates: "Sa. 28.03.2026"
 */
function parseKitzbuehel(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Try .veranstaltung cards first, then generic event links
  const $cards = $('a[href*="/veranstaltungen/event/"]');

  $cards.each((_, el) => {
    try {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const slugMatch = href.match(/\/veranstaltungen\/event\/([^/]+)\/?/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const $card = $a.find('.veranstaltung').first().length ? $a.find('.veranstaltung').first() : $a;

      const title = $card.find('h2, h3, h4').first().text().trim() || $a.text().trim().split('\n')[0].trim();
      if (!title || title.length < 3) return;

      const cardText = $card.text();
      const date = parseGermanDate(cardText);
      if (!date) return;

      const time = parseTime(cardText);

      // Location from text
      let locationName = cfg.locationName;
      const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.includes('Kitzbühel') || line.includes('Reith') || line.includes('Jochberg') || line.includes('Aurach')) {
          if (!line.match(/^\d/) && !line.includes('ab ') && !line.includes('Sa.') && !line.includes('So.')) {
            locationName = line;
            break;
          }
        }
      }

      const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

      events.push({
        source_id: `${cfg.id}-${slug}`,
        source_name: 'tourismus-portale',
        source_url: sourceUrl,
        title,
        start_date: time ? `${date}T${time}` : date,
        location_name: locationName,
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        bundesland: cfg.bundesland,
        category: categorizeEvent(title),
      });
    } catch { /* skip */ }
  });

  return events;
}

/**
 * Generic fallback parser: tries to find event links and cards with date patterns.
 * Works for sites with standard event link patterns.
 */
function parseGeneric(html: string, cfg: PortalConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  // Try multiple link patterns
  const linkSelectors = [
    'a[href*="/event/"]',
    'a[href*="/events/"]',
    'a[href*="/veranstaltung"]',
    'a[href*="/detail/"]',
  ];

  for (const selector of linkSelectors) {
    $(selector).each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        if (!href || href === '#' || href === '/') return;

        const $card = $a.closest('div, li, article').first();
        const $context = $card.length ? $card : $a;

        const title = $context.find('h2, h3, h4, strong').first().text().trim() || $a.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3 || title.length > 200) return;

        const slug = slugify(title);
        if (seen.has(slug)) return;
        seen.add(slug);

        const cardText = $context.text();
        const date = parseGermanDate(cardText);
        if (!date) return;

        const time = parseTime(cardText);

        const $img = $context.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        let imageUrl: string | undefined;
        if (imgSrc && imgSrc.length > 15 && !imgSrc.includes('lazy') && !imgSrc.includes('placeholder')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${cfg.domain}${imgSrc}`;
        }

        const sourceUrl = href.startsWith('http') ? href : `https://${cfg.domain}${href}`;

        events.push({
          source_id: `${cfg.id}-${slug}`,
          source_name: 'tourismus-portale',
          source_url: sourceUrl,
          title,
          start_date: time ? `${date}T${time}` : date,
          location_name: cfg.locationName,
          latitude: cfg.latitude,
          longitude: cfg.longitude,
          bundesland: cfg.bundesland,
          category: categorizeEvent(title),
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    if (events.length > 0) break;
  }

  return events;
}

// ─────────────────── Portal configurations ───────────────────

const PORTALS: PortalConfig[] = [
  {
    id: 'zellamsee',
    domain: 'www.zellamsee-kaprun.com',
    listUrl: 'https://www.zellamsee-kaprun.com/de/events',
    latitude: 47.3233,
    longitude: 12.7967,
    bundesland: 'salzburg',
    locationName: 'Zell am See',
    parser: parseZellamsee,
  },
  {
    id: 'stubaital',
    domain: 'www.stubaital.at',
    listUrl: 'https://www.stubaital.at/de/events',
    latitude: 47.1,
    longitude: 11.3,
    bundesland: 'tirol',
    locationName: 'Stubaital',
    parser: parseStubaital,
  },
  {
    id: 'osttirol',
    domain: 'www.osttirol.com',
    listUrl: 'https://www.osttirol.com/veranstaltungen',
    latitude: 46.9833,
    longitude: 12.4667,
    bundesland: 'tirol',
    locationName: 'Osttirol',
    parser: parseOsttirol,
    ajaxUrl: 'https://www.osttirol.com/index.php?id=491&L=&no_cache=1',
    ajaxPageParam: 'tx_webxbookingemo_event',
    maxPages: 30,
  },
  {
    id: 'achensee',
    domain: 'www.achensee.com',
    listUrl: 'https://www.achensee.com/events',
    latitude: 47.4333,
    longitude: 11.7167,
    bundesland: 'tirol',
    locationName: 'Achensee',
    parser: parseAchensee,
  },
  {
    id: 'kitzbuehel',
    domain: 'www.kitzbuehel.com',
    listUrl: 'https://www.kitzbuehel.com/veranstaltungen',
    latitude: 47.4467,
    longitude: 12.3667,
    bundesland: 'tirol',
    locationName: 'Kitzbühel',
    parser: parseKitzbuehel,
  },
];

// ─────────────────── Puppeteer portal configurations ───────────────────

interface PuppeteerPortalConfig {
  id: string;
  domain: string;
  eventsUrl: string;
  latitude: number;
  longitude: number;
  postalCode: string;
  bezirk: string;
  bundesland: string;
  locationName: string;
  /** Optional wait selector to confirm events loaded */
  waitSelector?: string;
  /** Optional extra scroll/wait steps */
  needsExtraScroll?: boolean;
}

const PUPPETEER_PORTALS: PuppeteerPortalConfig[] = [
  {
    id: 'soelden',
    domain: 'www.soelden.com',
    eventsUrl: 'https://www.soelden.com/de/veranstaltungen-freizeittipps/veranstaltungskalender',
    latitude: 46.9667,
    longitude: 11.0075,
    postalCode: '6450',
    bezirk: 'Imst',
    bundesland: 'tirol',
    locationName: 'Sölden',
    waitSelector: 'a[href*="/events/"], a[href*="/veranstaltung"], .event, article',
  },
  {
    id: 'oetztal',
    domain: 'www.oetztal.com',
    eventsUrl: 'https://www.oetztal.com/de/events-freizeittipps',
    latitude: 47.03,
    longitude: 10.86,
    postalCode: '6450',
    bezirk: 'Imst',
    bundesland: 'tirol',
    locationName: 'Ötztal',
    waitSelector: 'a[href*="/veranstaltungskalender/"], a[href*="/event"], article',
  },
  {
    id: 'ischgl',
    domain: 'www.ischgl.com',
    eventsUrl: 'https://www.ischgl.com/de/veranstaltungen-erlebnisse',
    latitude: 47.01,
    longitude: 10.29,
    postalCode: '6561',
    bezirk: 'Landeck',
    bundesland: 'tirol',
    locationName: 'Ischgl',
    waitSelector: 'a[href*="/event"], a[href*="/veranstaltung"], .event-card, article',
    needsExtraScroll: true,
  },
  {
    id: 'saalbach',
    domain: 'www.saalbach.com',
    eventsUrl: 'https://www.saalbach.com/de/events',
    latitude: 47.39,
    longitude: 12.64,
    postalCode: '5753',
    bezirk: 'Zell am See',
    bundesland: 'salzburg',
    locationName: 'Saalbach-Hinterglemm',
    waitSelector: 'a[href*="/event"], .event, article, .card',
    needsExtraScroll: true,
  },
  {
    id: 'mayrhofen',
    domain: 'www.mayrhofen.at',
    eventsUrl: 'https://www.mayrhofen.at/de/pages/veranstaltungskalender',
    latitude: 47.16,
    longitude: 11.86,
    postalCode: '6290',
    bezirk: 'Schwaz',
    bundesland: 'tirol',
    locationName: 'Mayrhofen',
    waitSelector: 'a[href*="/event"], a[href*="/veranstaltung"], article, .card',
    needsExtraScroll: true,
  },
  {
    id: 'serfaus-fiss-ladis',
    domain: 'www.serfaus-fiss-ladis.at',
    eventsUrl: 'https://www.serfaus-fiss-ladis.at/de/events-und-erlebnisse/erlebnisprogramm',
    latitude: 47.04,
    longitude: 10.60,
    postalCode: '6534',
    bezirk: 'Landeck',
    bundesland: 'tirol',
    locationName: 'Serfaus-Fiss-Ladis',
    waitSelector: 'a[href*="/event"], a[href*="/erlebnis"], article, .card',
    needsExtraScroll: true,
  },
  {
    id: 'schladming',
    domain: 'www.schladming-dachstein.at',
    eventsUrl: 'https://www.schladming-dachstein.at/de/events/veranstaltungskalender',
    latitude: 47.39,
    longitude: 13.69,
    postalCode: '8970',
    bezirk: 'Liezen',
    bundesland: 'steiermark',
    locationName: 'Schladming-Dachstein',
    waitSelector: '#tosc5, a[href*="/event"], .event, article',
    needsExtraScroll: true,
  },
  {
    id: 'nassfeld',
    domain: 'www.nassfeld.at',
    eventsUrl: 'https://www.nassfeld.at/de/erleben/veranstaltungen',
    latitude: 46.56,
    longitude: 13.28,
    postalCode: '9620',
    bezirk: 'Hermagor',
    bundesland: 'kaernten',
    locationName: 'Nassfeld',
    waitSelector: 'a[href*="/event"], a[href*="/veranstaltung"], article, .card',
    needsExtraScroll: true,
  },
  {
    id: 'attersee',
    domain: 'attersee-attergau.salzkammergut.at',
    eventsUrl: 'https://attersee-attergau.salzkammergut.at/veranstaltungen/top-veranstaltungen.html',
    latitude: 47.92,
    longitude: 13.54,
    postalCode: '4864',
    bezirk: 'Vöcklabruck',
    bundesland: 'oberoesterreich',
    locationName: 'Attersee-Attergau',
    waitSelector: '#resultSet a, .result a, a[href*="/event"], a[href*="/detail"]',
    needsExtraScroll: true,
  },
  {
    id: 'zillertal',
    domain: 'www.zillertal.at',
    eventsUrl: 'https://www.zillertal.at/info/urlaubsinfo/veranstaltungen.html',
    latitude: 47.17,
    longitude: 11.87,
    postalCode: '6280',
    bezirk: 'Schwaz',
    bundesland: 'tirol',
    locationName: 'Zillertal',
    waitSelector: '#tosc5, a[href*="/event"], a[href*="/veranstaltung"], .lazy',
    needsExtraScroll: true,
  },
];

// ─────────────────── Scraper class ───────────────────

/**
 * TourismusPortaleScraper
 *
 * Aggregates events from multiple Austrian regional tourism portals.
 * Each portal has its own parser optimized for its HTML structure.
 * Portals that use SPAs or returned 404 are skipped.
 *
 * Working portals:
 * - zellamsee-kaprun.com (SSR, card-based)
 * - stubaital.at (SSR, card-based)
 * - osttirol.com (TYPO3 + AJAX pagination)
 * - achensee.com (SSR, 82+ events)
 * - kitzbuehel.com (SSR, .veranstaltung cards)
 *
 * Puppeteer portals (SPA/dynamic — need headless browser):
 * - soelden.com, oetztal.com, ischgl.com, saalbach.com
 * - mayrhofen.at, serfaus-fiss-ladis.at, schladming-dachstein.at
 * - nassfeld.at, attersee-attergau.at, zillertal.at
 */
export class TourismusPortaleScraper extends BaseScraper {
  readonly name = 'tourismus-portale';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Tourismus-Portale Scraping...');
    const allEvents: ScrapedEvent[] = [];

    for (const portal of PORTALS) {
      try {
        this.log(`Portal ${portal.domain} wird gescrapt...`);

        // Fetch initial page
        const html = await this.fetchPage(portal.listUrl);
        const events = portal.parser(html, portal);
        this.log(`${portal.domain}: ${events.length} Events von Startseite`);

        allEvents.push(...events);

        // AJAX pagination for TYPO3 portals (like osttirol.com)
        if (portal.ajaxUrl && portal.ajaxPageParam && events.length > 0) {
          const maxPages = portal.maxPages || 20;
          const existingSlugs = new Set(events.map(e => e.source_id));

          for (let page = 2; page <= maxPages; page++) {
            await this.rateLimit();
            try {
              const pageHtml = await this.fetchAjaxPage(portal, page);
              if (!pageHtml) break;

              const pageEvents = portal.parser(pageHtml, portal);
              if (pageEvents.length === 0) break;

              let newCount = 0;
              for (const ev of pageEvents) {
                if (!existingSlugs.has(ev.source_id)) {
                  existingSlugs.add(ev.source_id);
                  allEvents.push(ev);
                  newCount++;
                }
              }

              if (newCount === 0) break; // No new events, stop paging

              if (page % 5 === 0) {
                this.log(`${portal.domain} Seite ${page}: ${newCount} neue Events`);
              }
            } catch (err) {
              this.log(`${portal.domain} Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
              break;
            }
          }
        }

        await this.rateLimit();
      } catch (err) {
        this.log(`${portal.domain} FEHLER: ${err instanceof Error ? err.message : err}`);
        // Continue with next portal
      }
    }

    this.log(`SSR-Portale: ${allEvents.length} Events von ${PORTALS.length} Portalen`);

    // ── Puppeteer portals (SPA/dynamic) ──
    this.log(`Starte Puppeteer-Portale Scraping (${PUPPETEER_PORTALS.length} Portale)...`);
    for (const portal of PUPPETEER_PORTALS) {
      try {
        this.log(`[Puppeteer] ${portal.domain} wird gescrapt...`);
        const events = await this.scrapePuppeteerPortal(portal);
        this.log(`[Puppeteer] ${portal.domain}: ${events.length} Events`);
        allEvents.push(...events);
      } catch (err) {
        this.log(`[Puppeteer] ${portal.domain} FEHLER: ${err instanceof Error ? err.message : err}`);
      }
      // Rate limit: 3 seconds between portals
      await this.sleep(3000);
    }

    this.log(`Gesamt: ${allEvents.length} Events von ${PORTALS.length + PUPPETEER_PORTALS.length} Portalen`);
    return allEvents;
  }

  // ─────────────────── Puppeteer scraping ───────────────────

  /**
   * Scrape a single SPA/dynamic portal using Puppeteer.
   * Opens the page in a headless browser, waits for dynamic content,
   * scrolls to trigger lazy loading, then parses with Cheerio.
   */
  private async scrapePuppeteerPortal(portal: PuppeteerPortalConfig): Promise<ScrapedEvent[]> {
    const browser = await getSharedBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );

      await page.goto(portal.eventsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for events to appear in DOM
      if (portal.waitSelector) {
        await page.waitForSelector(portal.waitSelector, { timeout: 10000 }).catch(() => {
          // Selector not found — page may still have useful content
        });
      }

      // Initial wait for JS rendering
      await this.sleep(2000);

      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(2000);

      // Extra scroll for portals that need it (infinite scroll / lazy sections)
      if (portal.needsExtraScroll) {
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await this.sleep(1500);
        }
        // Scroll back to top to capture all
        await page.evaluate(() => window.scrollTo(0, 0));
        await this.sleep(500);
      }

      const html = await page.content();
      return this.parseGenericEventPage(html, portal);
    } finally {
      await page.close();
    }
  }

  /**
   * Generic event page parser for Puppeteer-rendered HTML.
   * Tries multiple strategies to find event cards/links:
   * 1. JSON-LD structured data
   * 2. Event detail links with common URL patterns
   * 3. Cards with date patterns and titles
   */
  private parseGenericEventPage(html: string, portal: PuppeteerPortalConfig): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // ── Strategy 1: JSON-LD Event data ──
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
        for (const item of items) {
          if (item['@type'] !== 'Event') continue;
          const title = String(item.name || '').trim();
          if (!title || title.length < 3) continue;

          const slug = slugify(title);
          if (seen.has(slug)) continue;
          seen.add(slug);

          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;

          let imageUrl: string | undefined;
          if (item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            imageUrl = typeof img === 'string' ? img : img?.url;
          }

          const locationName = item.location?.name || item.location?.address?.addressLocality || portal.locationName;
          const sourceUrl = item.url || portal.eventsUrl;

          events.push({
            source_id: `${portal.id}-${slug}`,
            source_name: 'tourismus-portale',
            source_url: typeof sourceUrl === 'string' && sourceUrl.startsWith('http')
              ? sourceUrl
              : `https://${portal.domain}${sourceUrl}`,
            title,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locationName,
            latitude: portal.latitude,
            longitude: portal.longitude,
            postal_code: portal.postalCode,
            bundesland: portal.bundesland,
            category: categorizeEvent(title),
            image_url: imageUrl,
          });
        }
      } catch { /* skip malformed JSON-LD */ }
    });

    if (events.length > 0) return events;

    // ── Strategy 2: Event links with common URL patterns ──
    const linkPatterns = [
      'a[href*="/events/"]',
      'a[href*="/event/"]',
      'a[href*="/veranstaltung"]',
      'a[href*="/detail/event/"]',
      'a[href*="/details/event/"]',
      'a[href*="/erlebnis"]',
      'a[href*=".e-"]', // oetztal UUID pattern
    ];

    for (const selector of linkPatterns) {
      $(selector).each((_, el) => {
        try {
          const $a = $(el);
          const href = $a.attr('href') || '';
          if (!href || href === '#' || href === '/' || href.length < 5) return;
          // Skip navigation/menu links
          if (href.includes('/de/events') && href.split('/').length <= 4 && !href.includes('.')) return;

          const $card = $a.closest('div, li, article, section').first();
          const $context = $card.length ? $card : $a;

          // Title: prefer headings, then strong, then link text
          let title = $context.find('h2, h3, h4, h5').first().text().trim();
          if (!title) title = $context.find('strong, b').first().text().trim();
          if (!title) title = $a.text().trim().split('\n')[0].trim();
          if (!title || title.length < 3 || title.length > 200) return;

          // Clean up title (remove "mehr erfahren" etc.)
          title = title.replace(/\s*(mehr erfahren|weiterlesen|details|→|»)\s*$/i, '').trim();
          if (!title || title.length < 3) return;

          const slug = slugify(title);
          if (seen.has(slug)) return;
          seen.add(slug);

          // Date extraction
          const cardText = $context.text();
          const date = parseGermanDate(cardText);
          // Allow events without dates for SPA portals — they might have dates in detail pages
          const time = parseTime(cardText);

          // Image
          const $img = $context.find('img').first();
          let imgSrc = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
          // Also check background-image style
          if (!imgSrc) {
            const style = $context.find('[style*="background-image"]').first().attr('style') || '';
            const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (bgMatch) imgSrc = bgMatch[1];
          }
          let imageUrl: string | undefined;
          if (imgSrc && imgSrc.length > 15 && !imgSrc.includes('data:')) {
            imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${portal.domain}${imgSrc}`;
          }

          const sourceUrl = href.startsWith('http') ? href : `https://${portal.domain}${href}`;

          events.push({
            source_id: `${portal.id}-${slug}`,
            source_name: 'tourismus-portale',
            source_url: sourceUrl,
            title,
            start_date: date ? (time ? `${date}T${time}` : date) : '',
            location_name: portal.locationName,
            latitude: portal.latitude,
            longitude: portal.longitude,
            postal_code: portal.postalCode,
            bundesland: portal.bundesland,
            category: categorizeEvent(title),
            image_url: imageUrl,
          });
        } catch { /* skip */ }
      });

      if (events.length > 0) break; // Found events with this selector pattern
    }

    if (events.length > 0) {
      // Filter out events without dates — but keep at least some if all lack dates
      const withDates = events.filter(e => e.start_date);
      return withDates.length > 0 ? withDates : events;
    }

    // ── Strategy 3: Find any cards/articles with date patterns ──
    const cardSelectors = [
      'article', '.card', '.event', '.event-card', '.event-item',
      '.teaser', '.teaser-item', '[class*="event"]', '[class*="veranstaltung"]',
    ];

    for (const selector of cardSelectors) {
      $(selector).each((_, el) => {
        try {
          const $card = $(el);
          const cardText = $card.text();
          const date = parseGermanDate(cardText);
          if (!date) return;

          const title = $card.find('h2, h3, h4, h5, strong').first().text().trim();
          if (!title || title.length < 3 || title.length > 200) return;

          const slug = slugify(title);
          if (seen.has(slug)) return;
          seen.add(slug);

          const time = parseTime(cardText);

          // Link
          const $link = $card.find('a').first();
          const href = $link.attr('href') || '';
          const sourceUrl = href && href !== '#'
            ? (href.startsWith('http') ? href : `https://${portal.domain}${href}`)
            : portal.eventsUrl;

          // Image
          const $img = $card.find('img').first();
          const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
          let imageUrl: string | undefined;
          if (imgSrc && imgSrc.length > 15 && !imgSrc.includes('data:')) {
            imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://${portal.domain}${imgSrc}`;
          }

          events.push({
            source_id: `${portal.id}-${slug}`,
            source_name: 'tourismus-portale',
            source_url: sourceUrl,
            title,
            start_date: time ? `${date}T${time}` : date,
            location_name: portal.locationName,
            latitude: portal.latitude,
            longitude: portal.longitude,
            postal_code: portal.postalCode,
            bundesland: portal.bundesland,
            category: categorizeEvent(title),
            image_url: imageUrl,
          });
        } catch { /* skip */ }
      });

      if (events.length > 0) break;
    }

    return events;
  }

  private async fetchAjaxPage(portal: PortalConfig, page: number): Promise<string | null> {
    if (!portal.ajaxUrl || !portal.ajaxPageParam) return null;

    const param = portal.ajaxPageParam;
    const formData = new URLSearchParams();
    formData.append(`${param}[action]`, 'ajaxReloadEvents');
    formData.append(`${param}[controller]`, 'Event');
    formData.append(`${param}[data]`, '');
    formData.append(`${param}[data_sorting]`, '');
    formData.append(`${param}[paginate_currentpage]`, String(page));
    formData.append(`${param}[tt]`, String(Date.now()));

    const response = await fetch(portal.ajaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
        'Accept': 'text/html, */*',
        'Referer': portal.listUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`AJAX HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim().length < 50) return null;

    return text;
  }
}
