/**
 * Meetup — Community events in Austria via HTML scraping.
 *
 * Meetup's GraphQL API requires OAuth 2.0 and has been increasingly restrictive.
 * Instead, we scrape Meetup's public search pages for Austrian cities.
 * This approach is more reliable and doesn't require API credentials.
 *
 * Categories: Tech meetups, hobby groups, language exchange, professional networking.
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/events';

// Bundesland lookup from Austrian city names
const CITY_BUNDESLAND: Record<string, string> = {
  'wien': 'Wien', 'vienna': 'Wien',
  'graz': 'Steiermark',
  'linz': 'Oberösterreich',
  'salzburg': 'Salzburg',
  'innsbruck': 'Tirol',
  'klagenfurt': 'Kärnten',
  'villach': 'Kärnten',
  'bregenz': 'Vorarlberg',
  'dornbirn': 'Vorarlberg',
  'eisenstadt': 'Burgenland',
  'st. pölten': 'Niederösterreich',
  'wels': 'Oberösterreich',
  'wiener neustadt': 'Niederösterreich',
  'krems': 'Niederösterreich',
};

function guessBundesland(location: string): string | undefined {
  const lower = location.toLowerCase();
  for (const [key, val] of Object.entries(CITY_BUNDESLAND)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}

function guessCategory(title: string, groupName: string, description?: string): string {
  const text = `${title} ${groupName} ${description || ''}`.toLowerCase();

  if (/tech|code|coding|programm|developer|software|data|ai |machine learning|devops|cloud|cyber|hack/.test(text)) return 'Bildung';
  if (/business|startup|entrepreneur|network|career|profession/.test(text)) return 'Wirtschaft';
  if (/yoga|fitness|sport|run |hiking|outdoor|climb|swim/.test(text)) return 'Sport';
  if (/musik|music|concert|jam|band/.test(text)) return 'Musik';
  if (/kunst|art|gallery|photo|paint|design|creative/.test(text)) return 'Kultur';
  if (/sprach|language|english|deutsch|spanish|french|conversation/.test(text)) return 'Bildung';
  if (/cook|food|kulinar|wine|wein|dinner|brunch/.test(text)) return 'Wein & Kulinarik';
  if (/natur|nature|garden|green|environ/.test(text)) return 'Natur';
  if (/family|famili|kinder|kids|parent/.test(text)) return 'Familie';

  return 'Sonstiges';
}

function guessTags(title: string, groupName: string): string[] {
  const text = `${title} ${groupName}`.toLowerCase();
  const tags: string[] = ['Meetup'];

  if (/tech|code|programm|developer|software/.test(text)) tags.push('Tech');
  if (/startup|entrepreneur/.test(text)) tags.push('Startup');
  if (/language|sprach/.test(text)) tags.push('Sprache');
  if (/network|professional/.test(text)) tags.push('Networking');
  if (/workshop/.test(text)) tags.push('Workshop');
  if (/hiking|outdoor|wander/.test(text)) tags.push('Outdoor');

  return tags;
}

/**
 * Meetup Scraper — scrapes public Meetup event pages for Austrian cities.
 *
 * Note: Meetup's GraphQL API requires OAuth 2.0 which adds complexity.
 * HTML scraping of public event pages is more practical and reliable.
 * If Meetup blocks scraping, this scraper gracefully returns empty results.
 */
export class MeetupScraper extends BaseScraper {
  readonly name = 'meetup.com';
  private readonly BASE = 'https://www.meetup.com';

  // Austrian cities to search for events
  private readonly CITIES: Array<{ name: string; lat: number; lon: number; bundesland: string }> = [
    { name: 'Wien', lat: 48.2082, lon: 16.3738, bundesland: 'Wien' },
    { name: 'Graz', lat: 47.0707, lon: 15.4395, bundesland: 'Steiermark' },
    { name: 'Linz', lat: 48.3069, lon: 14.2858, bundesland: 'Oberösterreich' },
    { name: 'Salzburg', lat: 47.8095, lon: 13.0550, bundesland: 'Salzburg' },
    { name: 'Innsbruck', lat: 47.2692, lon: 11.4041, bundesland: 'Tirol' },
    { name: 'Klagenfurt', lat: 46.6249, lon: 14.3050, bundesland: 'Kärnten' },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Meetup Scraping (öffentliche Seiten)...');
    const events: ScrapedEvent[] = [];

    for (const city of this.CITIES) {
      // Try different URL patterns Meetup uses
      const urls = [
        `${this.BASE}/find/?location=${encodeURIComponent(city.name)}%2C+Austria&source=EVENTS`,
        `${this.BASE}/find/events/?allMeetups=true&radius=50&userFreeform=${encodeURIComponent(city.name)}%2C+Austria`,
        `${this.BASE}/cities/at/${city.name.toLowerCase()}/events/`,
      ];

      for (const url of urls) {
        try {
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);
          const pageEvents = this.parsePage($, url, city.bundesland);
          events.push(...pageEvents);
          this.log(`${city.name}: ${pageEvents.length} Events von ${url}`);
          if (pageEvents.length > 0) break; // Got events from this city, skip other URL patterns
          await this.rateLimit();
        } catch (err) {
          this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
        }
      }
      await this.rateLimit();
    }

    // Deduplicate
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    this.log(`Gesamt: ${seen.size} Meetup-Events`);
    return Array.from(seen.values());
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string, defaultBundesland: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD extraction (Meetup uses this on some pages)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : '';
          const geo = location?.geo as Record<string, unknown> | undefined;
          const organizer = item.organizer as Record<string, unknown> | undefined;
          const groupName = organizer ? String(organizer.name || '') : '';

          events.push({
            source_id: `meetup-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName || 'Österreich',
            bundesland: guessBundesland(locName) || defaultBundesland,
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: guessCategory(name, groupName, item.description ? String(item.description) : undefined),
            tags: guessTags(name, groupName),
            organizer: groupName || undefined,
            image_url: item.image ? String(Array.isArray(item.image) ? item.image[0] : item.image) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — Meetup event cards
    $('[class*="eventCard"], [class*="event-card"], [data-testid*="event"], .event-listing, article').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, [class*="title"], [class*="name"], a').first().text().trim();
      if (!title || title.length < 3 || title.length > 200) return;
      if (['Home', 'Kontakt', 'Sign up', 'Log in'].includes(title)) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      // Look for date/time info
      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="time"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      // Group/organizer name
      const groupName = $el.find('[class*="group"], [class*="organizer"]').first().text().trim();

      // Location
      const location = $el.find('[class*="location"], [class*="venue"]').first().text().trim();

      const desc = $el.find('[class*="description"], p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc && !imgSrc.includes('avatar') ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `meetup-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || '') || defaultBundesland,
        category: guessCategory(title, groupName, desc),
        tags: guessTags(title, groupName),
        organizer: groupName || undefined,
        image_url: imageUrl,
      });
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // Handle "Mon DD, YYYY" English date format
    const mdy = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
    if (mdy) {
      const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
      };
      const m = months[mdy[1].toLowerCase().slice(0, 3)];
      if (m) return `${mdy[3]}-${m}-${mdy[2].padStart(2, '0')}`;
    }
    return null;
  }
}
