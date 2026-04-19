/**
 * Slug generation and event URL utilities.
 *
 * Hybrid URL schema: /events/[shortId]-[slug]
 * - shortId = first 8 chars of UUID (stable technical identity)
 * - slug = human-readable descriptor from title + location
 */

const MAX_SLUG_LENGTH = 60;

/** German umlaut and special character replacements */
const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae',
  'ö': 'oe',
  'ü': 'ue',
  'ß': 'ss',
  'Ä': 'ae',
  'Ö': 'oe',
  'Ü': 'ue',
};

/**
 * Generates a URL-safe slug from an event title and optional location.
 *
 * - Lowercases, resolves German umlauts
 * - Replaces non-alphanumeric chars with hyphens
 * - Trims to MAX_SLUG_LENGTH, no trailing hyphens
 * - Appends location suffix if provided
 *
 * Example: "Weinverkostung méhr rosé géht nicht" + "Parndorf"
 *       → "weinverkostung-mehr-rose-geht-nicht-parndorf"
 */
export function generateEventSlug(
  title: string,
  locationName?: string | null,
): string {
  let input = title;

  // Append location if available and not already in title
  if (locationName) {
    const locLower = locationName.toLowerCase();
    if (!title.toLowerCase().includes(locLower)) {
      input = `${title} ${locationName}`;
    }
  }

  // Replace umlauts
  let slug = input;
  for (const [char, replacement] of Object.entries(UMLAUT_MAP)) {
    slug = slug.split(char).join(replacement);
  }

  // Normalize unicode accents (é → e, ô → o, etc.)
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Lowercase
  slug = slug.toLowerCase();

  // Replace non-alphanumeric with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Truncate to max length, but don't cut mid-word
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > MAX_SLUG_LENGTH * 0.5) {
      slug = slug.slice(0, lastHyphen);
    }
  }

  return slug || 'event';
}

/**
 * Builds the canonical event URL using the hybrid shortId-slug format.
 *
 * For events without slug we fall back to the 8-char short ID — never the
 * full 36-char UUID. Rationale: short IDs are cleaner in search results and
 * the event detail page already resolves both forms via a range query on
 * the UUID. Keeping the canonical form short also keeps the "we serve only
 * one URL per event" invariant the redirect logic in `events/[slug]/page.tsx`
 * depends on.
 *
 * @param id - Full UUID of the event
 * @param slug - Generated slug (nullable for events without slug)
 * @returns URL path like "/events/888a6421-weinverkostung-mehr-rose-parndorf"
 *          or "/events/888a6421" for events without a slug
 */
export function buildEventUrl(id: string, slug?: string | null): string {
  const shortId = id.slice(0, 8);
  if (slug) {
    return `/events/${shortId}-${slug}`;
  }
  return `/events/${shortId}`;
}

/**
 * Extracts the short ID from a hybrid slug parameter.
 *
 * Handles both formats:
 * - "888a6421-weinverkostung-mehr-rose" → "888a6421"
 * - "888a6421-d38f-43e7-b16d-ba033a469aed0" (full UUID) → "888a6421"
 *
 * @param slugParam - The dynamic route parameter
 * @returns 8-character short ID prefix for database lookup
 */
export function extractShortId(slugParam: string): string {
  // Always take the first 8 characters — works for both formats
  return slugParam.slice(0, 8);
}
