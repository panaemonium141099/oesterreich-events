/**
 * Compatibility wrapper — delegates to src/lib/event-images/.
 *
 * Existing consumers (EventMap, Feed components, ArtistEventCard, tests)
 * can keep importing from here without changes.
 * New code should import directly from '@/lib/event-images'.
 */

import { resolvePrimaryEventImage, resolveCategoryFallbackImage } from './event-images';

export { resolveCategoryFallbackImage as getCategoryFallbackImage } from './event-images';

/**
 * Get the display image for an event using the fallback chain:
 * 1. event image_url (from scraper)
 * 2. category + region-specific fallback (varies by bundesland — Burgenland
 *    events get pannonian scenes, Wien urban, rest alpine)
 * 3. generic default
 */
export function getEventImage(
  imageUrl: string | undefined | null,
  category: string | undefined | null,
  seed?: string,
  bundesland?: string | null,
): string {
  return resolvePrimaryEventImage({ imageUrl, category, title: seed, bundesland });
}
