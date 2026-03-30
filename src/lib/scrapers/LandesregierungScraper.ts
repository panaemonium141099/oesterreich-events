import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getDistrictByLocation } from '../districts';
import type { ScrapedEvent } from '@/types/events';

export class LandesregierungScraper extends BaseScraper {
  readonly name = 'burgenland.at';
  private readonly url = 'https://www.burgenland.at/service/termine-/-veranstaltungen/alle-termine/';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Scraping...');
    const html = await this.fetchPage(this.url);
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article.event').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3').first().text().trim();
        if (!title) return;

        const dateText = $el.find('.event-date').text().trim();
        const location = $el.find('.location').text().trim();
        const link = $el.find('p a').first().attr('href') || '';
        const description = $el.find('p a').first().text().trim();

        const { startDate, endDate } = this.parseDateRange(dateText);
        if (!startDate) return;

        // Create a stable source ID from title + date
        const sourceId = `landesreg-${Buffer.from(title + startDate).toString('base64').substring(0, 20)}`;

        // Extract image if available
        const $img = $el.find('img').first();
        let imageUrl: string | undefined;
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.burgenland.at${imgSrc}`;
        }

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: link || this.url,
          title,
          description: description !== title ? description : undefined,
          start_date: startDate,
          end_date: endDate || undefined,
          location_name: location || undefined,
          bundesland: 'burgenland',
          district: getDistrictByLocation(location) || undefined,
          category: categorizeEvent(title, description),
          image_url: imageUrl,
        });
      } catch (err) {
        // Skip individual event errors
      }
    });

    this.log(`${events.length} Events gefunden`);
    return events;
  }

  private parseDateRange(text: string): { startDate: string; endDate: string | null } {
    // Patterns:
    // "22. März 2026"
    // "21. Januar 2026 bis 29. März 2026"
    // "22. März 2026, 19:00 Uhr"

    const months: Record<string, string> = {
      'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
    };

    const datePattern = /(\d{1,2})\.\s*(\w+)\s+(\d{4})/g;
    const matches = [...text.matchAll(datePattern)];

    if (matches.length === 0) {
      return { startDate: '', endDate: null };
    }

    const parseMatch = (m: RegExpMatchArray): string => {
      const day = m[1].padStart(2, '0');
      const monthName = m[2].toLowerCase();
      const month = months[monthName] || '01';
      const year = m[3];

      // Try to extract time
      const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*Uhr/);
      if (timeMatch) {
        return `${year}-${month}-${day}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
      }
      return `${year}-${month}-${day}`;
    };

    const startDate = parseMatch(matches[0]);
    const endDate = matches.length > 1 ? parseMatch(matches[1]) : null;

    return { startDate, endDate };
  }
}
