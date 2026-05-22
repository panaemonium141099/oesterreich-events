/**
 * ntry.at — Austrian concert/club ticketing platform.
 * Scrapes event listings with ticket_url extraction.
 * Focus on music and nightlife events across Austria.
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

// Bundesland lookup from common Austrian location names
const BUNDESLAND_MAP: Record<string, string> = {
  'wien': 'Wien', 'vienna': 'Wien',
  'graz': 'Steiermark', 'steiermark': 'Steiermark',
  'linz': 'Oberösterreich', 'oberösterreich': 'Oberösterreich', 'wels': 'Oberösterreich',
  'salzburg': 'Salzburg',
  'innsbruck': 'Tirol', 'tirol': 'Tirol',
  'klagenfurt': 'Kärnten', 'kärnten': 'Kärnten', 'villach': 'Kärnten',
  'bregenz': 'Vorarlberg', 'vorarlberg': 'Vorarlberg', 'dornbirn': 'Vorarlberg',
  'eisenstadt': 'Burgenland', 'burgenland': 'Burgenland',
  'st. pölten': 'Niederösterreich', 'niederösterreich': 'Niederösterreich',
  'krems': 'Niederösterreich', 'wiener neustadt': 'Niederösterreich',
};

function guessBundesland(location: string): string | undefined {
  const lower = location.toLowerCase();
  for (const [key, val] of Object.entries(BUNDESLAND_MAP)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}

function guessCategory(title: string, description?: string): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Nightlife keywords
  if (/techno|rave|club\s*night|dj\s+set|afterhour|party|clubbing|drum\s*and\s*bass|psytrance|house\s*music/.test(text)) {
    return 'Nightlife';
  }
  // Default to Musik for a ticketing platform
  return 'Musik';
}

function guessTags(title: string, description?: string): string[] {
  const text = `${title} ${description || ''}`.toLowerCase();
  const tags: string[] = [];

  if (/konzert|concert|live/.test(text)) tags.push('Konzert');
  if (/club|party|rave|techno|house/.test(text)) tags.push('Nightlife');
  if (/rock|metal|punk/.test(text)) tags.push('Rock');
  if (/jazz|blues/.test(text)) tags.push('Jazz');
  if (/hip\s*hop|rap/.test(text)) tags.push('Hip-Hop');
  if (/electronic|electro|techno|house|drum/.test(text)) tags.push('Electronic');
  if (/folk|acoustic|singer/.test(text)) tags.push('Folk');

  if (tags.length === 0) tags.push('Musik');
  return tags;
}

export class NtryAtScraper extends BaseScraper {
  readonly name = 'ntry.at';
  private readonly BASE = 'https://ntry.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte ntry.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Scrape listing pages — ntry.at has event listings and city-based pages
    const urls = [
      `${this.BASE}/events`,
      `${this.BASE}/events?page=2`,
      `${this.BASE}/events?page=3`,
      `${this.BASE}/events?page=4`,
      `${this.BASE}/events?page=5`,
      `${this.BASE}/wien`,
      `${this.BASE}/graz`,
      `${this.BASE}/linz`,
      `${this.BASE}/salzburg`,
      `${this.BASE}/innsbruck`,
      `${this.BASE}/klagenfurt`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, url);
        events.push(...pageEvents);
        this.log(`${url}: ${pageEvents.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Deduplicate
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    const deduped = Array.from(seen.values());
    this.log(`Gesamt: ${seen.size} ntry.at Events`);

    if (deduped.length > 0) {
      const summary = await this.enrichFromDetail(deduped);
      this.log(`detail-enrich: ${JSON.stringify(summary)}`);
    }
    return deduped;
  }

  private parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || !isEventType(item['@type'])) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;
          const locName = location ? String(location.name || '') : '';
          const geo = location?.geo as Record<string, unknown> | undefined;
          const ticketUrl = item.offers?.url ? String(item.offers.url) : undefined;

          events.push({
            source_id: `ntry-${slug}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: locName || 'Österreich',
            bundesland: guessBundesland(locName),
            latitude: geo?.latitude ? Number(geo.latitude) : undefined,
            longitude: geo?.longitude ? Number(geo.longitude) : undefined,
            category: guessCategory(name, item.description ? String(item.description) : undefined),
            tags: guessTags(name, item.description ? String(item.description) : undefined),
            ticket_url: ticketUrl || String(item.url || pageUrl),
            price_text: item.offers?.price ? `${item.offers.price} ${item.offers.priceCurrency || 'EUR'}` : undefined,
            image_url: item.image ? String(Array.isArray(item.image) ? item.image[0] : item.image) : undefined,
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback — search for event cards
    $('article, .event, .event-card, [class*="event"], .card, .listing-item, a[href*="/event/"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, .event-title, .name').first().text().trim()
        || $el.text().trim().split('\n')[0]?.trim();
      if (!title || title.length < 3 || title.length > 200) return;
      if (['Home', 'Kontakt', 'Impressum', 'Datenschutz', 'AGB', 'Login'].includes(title)) return;

      const href = $el.is('a') ? ($el.attr('href') || '') : ($el.find('a').first().attr('href') || '');
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date, [class*="datum"], [class*="date"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const location = $el.find('.location, .venue, .ort, [class*="venue"], [class*="location"]').first().text().trim();
      const desc = $el.find('.description, .text, p').first().text().trim().slice(0, 500) || undefined;
      const imgSrc = $el.find('img').first().attr('src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      // Extract price if available
      const priceEl = $el.find('.price, [class*="price"], [class*="preis"]').first().text().trim();

      // Ticket link — the event URL on ntry.at IS the ticket URL
      const ticketUrl = sourceUrl.includes('ntry.at') ? sourceUrl : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `ntry-${slug}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: desc,
        start_date: startDate,
        location_name: location || 'Österreich',
        bundesland: guessBundesland(location || ''),
        category: guessCategory(title, desc),
        tags: guessTags(title, desc),
        image_url: imageUrl,
        ticket_url: ticketUrl,
        price_text: priceEl || undefined,
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
    return null;
  }
}
