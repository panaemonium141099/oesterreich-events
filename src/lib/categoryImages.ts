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

const CATEGORY_IMAGES: Record<string, string> = {
  'Musik': '/images/categories/musik.jpg',
  'Sport': '/images/categories/sport.jpg',
  'Kultur': '/images/categories/kultur.jpg',
  'Familie': '/images/categories/familie.jpg',
  'Maerkte': '/images/categories/maerkte.jpg',
  'Wein & Kulinarik': '/images/categories/wein.jpg',
  'Natur': '/images/categories/natur.jpg',
  'Rave': '/images/categories/rave.jpg',
  'Wirtschaft': '/images/categories/wirtschaft.jpg',
  'Sonstiges': '/images/categories/default.jpg',
};

/** Alternate spellings / legacy category names mapped to canonical keys */
const CATEGORY_ALIASES: Record<string, string> = {
  'Markte': 'Maerkte',
  'M\u00e4rkte': 'Maerkte',
};

const DEFAULT_IMAGE = '/images/categories/default.jpg';

/**
 * Get the fallback image for a given event category.
 * Returns a category-specific Unsplash image or the generic default.
 */
export function getCategoryFallbackImage(category: string | undefined | null): string {
  if (!category) return DEFAULT_IMAGE;
  const canonical = CATEGORY_ALIASES[category] || category;
  return CATEGORY_IMAGES[canonical] || DEFAULT_IMAGE;
}

/**
 * Get the display image for an event using the fallback chain:
 * 1. event image_url (from scraper)
 * 2. category-specific fallback
 * 3. generic default
 */
export function getEventImage(imageUrl: string | undefined | null, category: string | undefined | null): string {
  if (imageUrl && imageUrl.trim()) return imageUrl;
  return getCategoryFallbackImage(category);
}
