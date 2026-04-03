/**
 * Category-based fallback images for events without image_url.
 * Uses Unsplash images (free, no attribution required for hotlinking).
 *
 * ## Image Fallback Chain
 *
 * Events go through this priority order for display images:
 *
 * 1. **Event image_url** - Extracted by the scraper from the source page.
 *    Most scrapers extract images from og:image, JSON-LD, or img tags.
 *    The image URL is cleaned by BaseScraper.cleanImageUrl() to filter
 *    out placeholders, data URIs, and known bad patterns.
 *
 * 2. **Category-specific fallback** - If no valid image_url is available,
 *    a category-appropriate Unsplash image is used. Categories include:
 *    Musik, Sport, Kultur, Familie, Maerkte, Wein & Kulinarik, Natur, Rave.
 *
 * 3. **Generic fallback** - If no category is set or the category is unknown,
 *    a generic event/celebration image is used.
 *
 * ## Scraper Image Sources
 *
 * Scrapers that provide images (extract from source):
 * - BurgenlandInfoScraper: JSON-LD @graph image + listing img tags
 * - LandesregierungScraper: article.event img tags
 * - EsterházyScraper: detail page img tags
 * - OhoScraper: regex-matched img tags
 * - NeusiedlerseeScraper: JSON-LD contentUrl/url
 * - EventsAtScraper: JSON-LD + detail page img tags
 * - FalterScraper: listing img tags
 * - MeinBezirkScraper: og:image + detail page img tags
 * - WienGvScraper: API image field
 * - WienVADBScraper: API image field
 * - WienInfoScraper: API image field
 * - FeverUpScraper: API image field
 * - PraterWienScraper: API image field
 * - StadthalleScraper: listing img tags
 * - PartytimerScraper: listing img tags
 * - WienClubsScraper: JSON-LD + detail page img tags
 * - TirolScraper: listing img tags
 * - DonauNOEScraper: listing img tags
 * - BodenseeVorarlbergScraper: listing img tags
 * - GrazTourismusScraper: JSON-LD image
 * - PopcultureScraper: JSON-LD image
 * - KulturGrazScraper: detail page img tags
 * - KaerntenLiveScraper: JSON-LD image
 * - LinzTermineScraper: JSON-LD image
 * - PosthofScraper: detail page img tags
 * - GanzWienScraper: detail page img tags
 * - BasiskulturScraper: detail page img tags
 * - VeranstaltungskalenderNetScraper: detail page img tags
 * - SalzburgScrapers (Rockhouse, ARGEkultur, SzeneSalzburg): listing img tags
 * - VorarlbergTravelScraper: API image/featured_media_url
 * - EventsTTScraper: JSON-LD image
 * - TourismusPortaleScraper: listing/detail page img tags + JSON-LD
 * - GemeindeListScraper: JSON-LD + listing img tags
 * - Gem2GoScraper: listing/detail page img tags
 * - OeticketScraper: detail page images
 * - TicketmasterScraper: API image field
 * - FeratelScraper: API image URLs
 * - GasteinScraper: detail page img tags
 * - MariazellScraper: detail page img tags
 *
 * Scrapers without images (source provides no images or text-only):
 * - GenericGemeindeScraper: varies by municipality, many text-only
 */

const IMAGES_PER_CATEGORY = 5;

/** Category slug used in filenames: /images/categories/{slug}-{1..5}.jpg */
const CATEGORY_SLUGS: Record<string, string> = {
  'Musik': 'musik',
  'Sport': 'sport',
  'Kultur': 'kultur',
  'Familie': 'familie',
  'Maerkte': 'maerkte',
  'Wein & Kulinarik': 'wein',
  'Natur': 'natur',
  'Rave': 'rave',
  'Wirtschaft': 'wirtschaft',
  'Sonstiges': 'default',
};

/** Alternate spellings / legacy category names mapped to canonical keys */
const CATEGORY_ALIASES: Record<string, string> = {
  'Markte': 'Maerkte',
  'Märkte': 'Maerkte',
};

const DEFAULT_SLUG = 'default';

/** Simple hash for deterministic but varied image selection */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Get the fallback image for a given event category.
 * Uses a deterministic hash of the seed to pick one of 5 variants per category,
 * so different events get different fallback images.
 */
export function getCategoryFallbackImage(category: string | undefined | null, seed?: string): string {
  const canonical = category ? (CATEGORY_ALIASES[category] || category) : 'Sonstiges';
  const slug = CATEGORY_SLUGS[canonical] || DEFAULT_SLUG;
  const variant = seed ? (simpleHash(seed) % IMAGES_PER_CATEGORY) + 1 : 1;
  return `/images/categories/${slug}-${variant}.jpg`;
}

/**
 * Get the display image for an event using the fallback chain:
 * 1. event image_url (from scraper)
 * 2. category-specific fallback (1 of 5 variants, picked by event title hash)
 * 3. generic default
 */
export function getEventImage(imageUrl: string | undefined | null, category: string | undefined | null, seed?: string): string {
  if (imageUrl && imageUrl.trim()) return imageUrl;
  return getCategoryFallbackImage(category, seed);
}
