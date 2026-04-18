import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

export class OhoScraper extends BaseScraper {
  readonly name = 'oho.at';
  private readonly baseUrl = 'https://www.oho.at';
  private readonly url = 'https://www.oho.at/programm/';

  // OHO is in Oberwart
  private readonly lat = 47.2896;
  private readonly lng = 16.2066;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Scraping...');
    const html = await this.fetchPage(this.url);
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('div.event').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('a').attr('title') || '';
        if (!title) return;

        const link = $el.find('a').attr('href') || '';
        const dateText = $el.find('.bg-blue, .bg-red, .text.bg-blue, .text.bg-red').text().trim();

        const { startDate, time } = this.parseDate(dateText);
        if (!startDate) return;

        const fullStartDate = time ? `${startDate}T${time}:00` : startDate;

        // Get image from background-image style
        const style = $el.find('.bild').attr('style') || '';
        const imgMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
        const imageUrl = imgMatch ? `${this.baseUrl}${imgMatch[1]}` : undefined;

        events.push({
          source_id: `oho-${Buffer.from(title + startDate).toString('base64').substring(0, 20)}`,
          source_name: this.name,
          source_url: link.startsWith('http') ? link : `${this.baseUrl}${link}`,
          title,
          start_date: fullStartDate,
          location_name: 'OHO - Offenes Haus Oberwart',
          district: 'Oberwart',
          latitude: this.lat,
          longitude: this.lng,
          category: categorizeEvent(title),
          image_url: imageUrl,
        });
      } catch {
        // Skip
      }
    });

    this.log(`${events.length} Events gefunden`);
    return events;
  }

  private parseDate(text: string): { startDate: string; time: string | null } {
    const months: Record<string, string> = {
      'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
    };

    const dateMatch = text.match(/(\d{1,2})\.\s*(\w+)\s+(\d{4})/);
    if (!dateMatch) return { startDate: '', time: null };

    const day = dateMatch[1].padStart(2, '0');
    const month = months[dateMatch[2].toLowerCase()] || '01';
    const year = dateMatch[3];

    const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*Uhr/);
    const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null;

    return { startDate: `${year}-${month}-${day}`, time };
  }
}
