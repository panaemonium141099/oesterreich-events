import { getDatabase } from '../lib/db/connection';
import * as cheerio from 'cheerio';

const USER_AGENT = 'BurgenlandEvents-Scraper/1.0 (educational project)';

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try og:image first
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !ogImage.includes('logo') && !ogImage.includes('placeholder')) {
      return ogImage;
    }

    // Try twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) return twitterImage;

    // Try first large content image
    const imgs: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const width = parseInt($(el).attr('width') || '0', 10);
      if (src && width >= 200 && !src.includes('logo') && !src.includes('icon') && !src.includes('.svg')) {
        imgs.push(src);
      }
    });
    if (imgs.length > 0) return imgs[0];

    // Try any content image that's not tiny
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('.svg')
        && !src.includes('tracking') && !src.includes('pixel')
        && (src.includes('fileadmin') || src.includes('upload') || src.includes('image') || src.includes('foto') || src.includes('photo'))) {
        imgs.push(src);
      }
    });
    if (imgs.length > 0) return imgs[0];

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const db = getDatabase();

  const events = db.prepare(
    "SELECT id, title, source_url, source_name FROM events WHERE image_url IS NULL AND source_url IS NOT NULL AND source_url != ''"
  ).all() as Array<{ id: number; title: string; source_url: string; source_name: string }>;

  console.log(`${events.length} Events ohne Bild gefunden`);

  const update = db.prepare('UPDATE events SET image_url = ? WHERE id = ?');
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const url = event.source_url;

    // Skip URLs that point to the listing page (not detail)
    if (url.includes('/alle-termine') || url === 'https://www.burgenland.at/service/termine-/-veranstaltungen/alle-termine/') {
      continue;
    }

    try {
      console.log(`[${i + 1}/${events.length}] ${event.title.substring(0, 40)}...`);
      const imageUrl = await fetchOgImage(url);

      if (imageUrl) {
        // Make absolute URL if relative
        let absoluteUrl = imageUrl;
        if (imageUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          absoluteUrl = `${baseUrl.origin}${imageUrl}`;
        }
        update.run(absoluteUrl, event.id);
        enriched++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nFertig: ${enriched} Bilder hinzugefügt, ${failed} fehlgeschlagen`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
