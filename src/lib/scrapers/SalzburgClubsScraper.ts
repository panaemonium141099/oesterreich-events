import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

interface ClubConfig {
  id: string;
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  postalCode: string;
}

const CLUBS: ClubConfig[] = [
  {
    id: 'rockhouse',
    name: 'Rockhouse',
    url: 'https://rockhouse.at/',
    latitude: 47.8095, longitude: 13.0440,
    postalCode: '5020',
  },
  {
    id: 'republic',
    name: 'Republic',
    url: 'https://republic.at/',
    latitude: 47.8020, longitude: 13.0440,
    postalCode: '5020',
  },
  {
    id: 'szene-salzburg',
    name: 'SZENE Salzburg',
    url: 'https://szene-salzburg.net/',
    latitude: 47.8020, longitude: 13.0440,
    postalCode: '5020',
  },
  {
    id: 'jazzit',
    name: 'Jazzit',
    url: 'https://jazzit.at/',
    latitude: 47.8005, longitude: 13.0430,
    postalCode: '5020',
  },
  {
    id: 'argekultur',
    name: 'ARGEkultur',
    url: 'https://argekultur.at/',
    latitude: 47.7980, longitude: 13.0350,
    postalCode: '5020',
  },
  {
    id: 'half-moon',
    name: 'Half Moon Club',
    url: 'https://halfmoon.at/',
    latitude: 47.7995, longitude: 13.0440,
    postalCode: '5020',
  },
  {
    id: 'mark-salzburg',
    name: 'MARK Salzburg',
    url: 'https://marksalzburg.at/',
    latitude: 47.8010, longitude: 13.0420,
    postalCode: '5020',
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

export class SalzburgClubsScraper extends BaseScraper {
  readonly name = 'salzburg-clubs';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte Salzburg Clubs Scraping (${CLUBS.length} Clubs)...`);
    const allEvents: ScrapedEvent[] = [];

    for (const club of CLUBS) {
      try {
        const html = await this.fetchPage(club.url);
        const events = this.parseClubHtml(html, club);
        allEvents.push(...events);
        this.log(`${club.name}: ${events.length} Events`);
      } catch (err) {
        this.log(`${club.name}: Fehler - ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }

    this.log(`${allEvents.length} Events von ${CLUBS.length} Salzburg Clubs gescrapt`);
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
          const sourceId = `salzburg-clubs-${club.id}-${slug}`;
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
            postal_code: club.postalCode,
            bundesland: 'salzburg',
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
      'a[href*="/event"]', 'a[href*="/veranstaltung"]', 'a[href*="/programm"]',
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
          const sourceId = `salzburg-clubs-${club.id}-${slug}`;
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
            postal_code: club.postalCode,
            bundesland: 'salzburg',
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
