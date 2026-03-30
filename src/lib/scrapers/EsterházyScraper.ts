import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { getDistrictByLocation } from '../districts';
import type { ScrapedEvent } from '@/types/events';

export class EsterházyScraper extends BaseScraper {
  readonly name = 'esterhazy.at';
  private readonly url = 'https://esterhazy.at/de/veranstaltungen';

  // Known Esterhazy venue coordinates
  private readonly VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
    'schloss esterházy': { lat: 47.8458, lng: 16.5182 },
    'schloss esterhazy': { lat: 47.8458, lng: 16.5182 },
    'burg forchtenstein': { lat: 47.7081, lng: 16.3283 },
    'steinbruch st. margarethen': { lat: 47.8028, lng: 16.6039 },
    'schloss lackenbach': { lat: 47.5862, lng: 16.4673 },
    'burg güssing': { lat: 47.0567, lng: 16.3237 },
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Scraping...');
    const html = await this.fetchPage(this.url);
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('div.event').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a.media').attr('href') || '';
        const imgSrc = $el.find('img').attr('src') || '';

        const textParts = $el.text().trim().split('\n').map(s => s.trim()).filter(Boolean);
        if (textParts.length < 2) return;

        // First part: "DD.MM.YYYY HH:MM"
        const dateTimePart = textParts[0];
        // Second part: "Venue | Category Title Description"
        const infoPart = textParts[1];

        // Parse date
        const dateMatch = dateTimePart.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (!dateMatch) return;
        const startDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}:${dateMatch[5]}:00`;

        // Parse venue and title from info part
        // Format: "Venue | Category Title"
        const pipeIndex = infoPart.indexOf('|');
        let venue = '';
        let titleAndDesc = infoPart;
        if (pipeIndex > 0) {
          venue = infoPart.substring(0, pipeIndex).trim();
          titleAndDesc = infoPart.substring(pipeIndex + 1).trim();
        }

        // Extract category prefix and title
        const categoryPrefixes = ['Konzert', 'Führung', 'Ausstellung', 'Markt', 'Event', 'Musical', 'Kids & Family', 'Oper', 'Classic', 'Messe'];
        let title = titleAndDesc;
        for (const prefix of categoryPrefixes) {
          if (titleAndDesc.startsWith(prefix)) {
            title = titleAndDesc.substring(prefix.length).trim();
            break;
          }
        }

        // Clean up title - remove duplicated words
        if (!title) title = titleAndDesc;

        // Create unique key to avoid duplicates (same event on different dates)
        const dedupeKey = `${link}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        // Get coordinates from venue
        const coords = this.getVenueCoords(venue);

        // Get image URL - make sure it's absolute
        let imageUrl: string | undefined;
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://esterhazy.at${imgSrc}`;
        }

        events.push({
          source_id: `esterhazy-${Buffer.from(title + startDate).toString('base64').substring(0, 20)}`,
          source_name: this.name,
          source_url: link.startsWith('http') ? link : `https://esterhazy.at${link}`,
          title,
          start_date: startDate,
          location_name: venue || 'Esterhazy',
          district: getDistrictByLocation(venue) || 'Eisenstadt',
          latitude: coords?.lat,
          longitude: coords?.lng,
          category: categorizeEvent(title, titleAndDesc),
          image_url: imageUrl,
          organizer: 'Esterhazy',
        });
      } catch {
        // Skip individual event errors
      }
    });

    this.log(`${events.length} Events gefunden`);
    return events;
  }

  private getVenueCoords(venue: string): { lat: number; lng: number } | undefined {
    const venueLower = venue.toLowerCase();
    for (const [key, coords] of Object.entries(this.VENUE_COORDS)) {
      if (venueLower.includes(key)) {
        return coords;
      }
    }
    // Default to Schloss Esterhazy for unknown venues
    return { lat: 47.8458, lng: 16.5182 };
  }
}
