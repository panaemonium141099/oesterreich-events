import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

interface ClubConfig {
  id: string;
  name: string;
  city: string;
  url: string;
  latitude: number;
  longitude: number;
  postalCode: string;
  bundesland: string;
}

/**
 * Clubs in smaller Austrian cities: Klagenfurt, Villach, Vorarlberg,
 * St. Pölten, Wiener Neustadt, Wels, Steyr, Krems, Leoben
 */
const CLUBS: ClubConfig[] = [
  // --- Klagenfurt ---
  {
    id: 'stereo-club',
    name: 'Stereo Club',
    city: 'Klagenfurt',
    url: 'https://stereoclub.at/',
    latitude: 46.6240, longitude: 14.3080,
    postalCode: '9020',
    bundesland: 'kaernten',
  },
  {
    id: 'volxhaus',
    name: 'VolXhaus',
    city: 'Klagenfurt',
    url: 'https://volxhaus.net/',
    latitude: 46.6235, longitude: 14.3120,
    postalCode: '9020',
    bundesland: 'kaernten',
  },
  {
    id: 'zoo-club',
    name: 'Zoo Club',
    city: 'Klagenfurt',
    url: 'https://zooclub.at/',
    latitude: 46.6230, longitude: 14.3100,
    postalCode: '9020',
    bundesland: 'kaernten',
  },
  {
    id: 'fritz-club',
    name: 'Fritz Club',
    city: 'Klagenfurt',
    url: 'https://club-fritz.at/',
    latitude: 46.6245, longitude: 14.3095,
    postalCode: '9020',
    bundesland: 'kaernten',
  },
  {
    id: 'schleppe-eventhalle',
    name: 'Schleppe Eventhalle',
    city: 'Klagenfurt',
    url: 'https://schleppe.at/eventhalle/',
    latitude: 46.6250, longitude: 14.3050,
    postalCode: '9020',
    bundesland: 'kaernten',
  },
  // --- Vorarlberg ---
  {
    id: 'conrad-sohm',
    name: 'Conrad Sohm',
    city: 'Dornbirn',
    url: 'https://conradsohm.com/',
    latitude: 47.4120, longitude: 9.7440,
    postalCode: '6850',
    bundesland: 'vorarlberg',
  },
  {
    id: 'spielboden',
    name: 'Spielboden',
    city: 'Dornbirn',
    url: 'https://spielboden.at/',
    latitude: 47.4125, longitude: 9.7430,
    postalCode: '6850',
    bundesland: 'vorarlberg',
  },
  {
    id: 'poolbar',
    name: 'poolbar Festival',
    city: 'Feldkirch',
    url: 'https://poolbar.at/',
    latitude: 47.2390, longitude: 9.5990,
    postalCode: '6800',
    bundesland: 'vorarlberg',
  },
  // --- St. Pölten ---
  {
    id: 'warehouse',
    name: 'Warehouse',
    city: 'St. Pölten',
    url: 'https://w-house.at/',
    latitude: 48.2040, longitude: 15.6250,
    postalCode: '3100',
    bundesland: 'niederoesterreich',
  },
  {
    id: 'freiraum',
    name: 'Freiraum',
    city: 'St. Pölten',
    url: 'https://freiraum-stp.com/',
    latitude: 48.2035, longitude: 15.6240,
    postalCode: '3100',
    bundesland: 'niederoesterreich',
  },
  {
    id: 'cinema-paradiso',
    name: 'Cinema Paradiso',
    city: 'St. Pölten',
    url: 'https://cinema-paradiso.at/',
    latitude: 48.2045, longitude: 15.6260,
    postalCode: '3100',
    bundesland: 'niederoesterreich',
  },
  // --- Wiener Neustadt ---
  {
    id: 'triebwerk',
    name: 'Triebwerk',
    city: 'Wiener Neustadt',
    url: 'https://triebwerk.co.at/',
    latitude: 47.8130, longitude: 16.2430,
    postalCode: '2700',
    bundesland: 'niederoesterreich',
  },
  // --- Wels ---
  {
    id: 'alter-schlachthof',
    name: 'Alter Schlachthof',
    city: 'Wels',
    url: 'https://schlachthofwels.at/',
    latitude: 48.1590, longitude: 14.0250,
    postalCode: '4600',
    bundesland: 'oberoesterreich',
  },
  // --- Steyr ---
  {
    id: 'roeda',
    name: 'Kulturverein Röda',
    city: 'Steyr',
    url: 'https://roeda.at/',
    latitude: 48.0380, longitude: 14.4140,
    postalCode: '4400',
    bundesland: 'oberoesterreich',
  },
  // --- Krems ---
  {
    id: 'q-stall',
    name: 'Q-Stall',
    city: 'Krems',
    url: 'https://q-stall.at/',
    latitude: 48.4100, longitude: 15.6140,
    postalCode: '3500',
    bundesland: 'niederoesterreich',
  },
  {
    id: 'marquee',
    name: 'Marquee',
    city: 'Krems',
    url: 'https://marquee-krems.at/',
    latitude: 48.4095, longitude: 15.6135,
    postalCode: '3500',
    bundesland: 'niederoesterreich',
  },
];

const MONTHS: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'jan': '01',
  'februar': '02', 'feb': '02',
  'märz': '03', 'mär': '03', 'mar': '03',
  'april': '04', 'apr': '04',
  'mai': '05', 'may': '05',
  'juni': '06', 'jun': '06',
  'juli': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09',
  'oktober': '10', 'okt': '10', 'oct': '10',
  'november': '11', 'nov': '11',
  'dezember': '12', 'dez': '12', 'dec': '12',
};

export class KleinstaedteClubsScraper extends BaseScraper {
  readonly name = 'kleinstadte-clubs';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte Kleinstädte Clubs Scraping (${CLUBS.length} Clubs)...`);
    const allEvents: ScrapedEvent[] = [];

    for (const club of CLUBS) {
      try {
        const html = await this.fetchPage(club.url);
        const events = this.parseClubHtml(html, club);
        allEvents.push(...events);
        this.log(`${club.name} (${club.city}): ${events.length} Events`);
      } catch (err) {
        this.log(`${club.name} (${club.city}): Fehler - ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`${allEvents.length} Events von ${CLUBS.length} Kleinstädte Clubs gescrapt`);
    return allEvents;
  }

  private parseClubHtml(html: string, club: ClubConfig): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Strategy 1: JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
        for (const item of items) {
          if (item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const sourceId = `kleinstadte-clubs-${club.id}-${slug}`;
          if (seen.has(sourceId)) continue;
          seen.add(sourceId);
          events.push({
            source_id: sourceId,
            source_name: this.name,
            source_url: String(item.url || club.url),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            location_name: club.name,
            address: `${club.postalCode} ${club.city}`,
            postal_code: club.postalCode,
            bundesland: club.bundesland,
            latitude: club.latitude,
            longitude: club.longitude,
            category: categorizeEvent(name),
            tags: ['Club'],
            image_url: item.image ? String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '') : undefined,
          });
        }
      } catch {}
    });

    if (events.length > 0) return events;

    // Strategy 2: HTML selectors
    const selectors = [
      'a[href*="/event"]', 'a[href*="/veranstaltung"]', 'a[href*="/termin"]', 'a[href*="/programm"]',
      '.event-title a', '.event-item a',
      'article a', 'h2 a, h3 a, h4 a',
    ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        try {
          const $el = $(el);
          const href = $el.attr('href') || '';
          const text = $el.text().trim();
          if (!text || text.length < 3) return;

          const $card = $el.closest('article, .event, .event-item, li, div').first();
          const cardText = $card.length ? $card.text() : text;
          const dateStr = this.parseDate(cardText);
          if (!dateStr) return;

          const slug = text.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const sourceId = `kleinstadte-clubs-${club.id}-${slug}`;
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          let imageUrl: string | undefined;
          const $img = $card.find('img').first();
          const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
          if (imgSrc && !imgSrc.startsWith('data:')) {
            imageUrl = this.cleanImageUrl(this.resolveImageUrl(imgSrc, club.url));
          }

          const sourceUrl = href.startsWith('http') ? href : (href ? new URL(href, club.url).href : club.url);

          events.push({
            source_id: sourceId,
            source_name: this.name,
            source_url: sourceUrl,
            title: text,
            start_date: dateStr,
            location_name: club.name,
            address: `${club.postalCode} ${club.city}`,
            postal_code: club.postalCode,
            bundesland: club.bundesland,
            latitude: club.latitude,
            longitude: club.longitude,
            category: categorizeEvent(text),
            tags: ['Club'],
            image_url: imageUrl,
          });
        } catch {}
      });

      if (events.length > 0) break;
    }

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];

    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;

    const noYear = text.match(/(\d{1,2})\.(\d{1,2})\./);
    if (noYear) {
      const year = new Date().getFullYear();
      return `${year}-${noYear[2].padStart(2, '0')}-${noYear[1].padStart(2, '0')}`;
    }

    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\.?\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }

    return null;
  }
}
