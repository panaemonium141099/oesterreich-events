/**
 * Slug generation and event URL utilities.
 *
 * **Current URL schema (Phase 1, v2):**
 *   /events/{plz}-{ort}/{slug}-{shortId}
 *
 *   The PLZ+Ort prefix is the single largest on-page SEO signal for local
 *   queries ("Events 1010", "Konzerte Linz"). Keeping it as the first path
 *   segment gives Google a strong geographic indexing hint.
 *
 * **Legacy schema (pre-Phase-1):**
 *   /events/{shortId}-{slug}
 *
 *   Still supported by the catch-all route — it 301-redirects to the new
 *   form so existing Google backlinks and bookmarks keep working.
 *
 * Components:
 *   - shortId = first 8 chars of UUID (stable technical identity)
 *   - slug    = human-readable descriptor from title + location
 *   - plz     = Austrian postal code (4 digits); falls back to the
 *               bundesland-capital PLZ when a row has no postal_code
 *   - ort     = canonical city slug (from extractCity + slugify) or the
 *               bundesland-capital name as fallback
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
 * Handles three formats:
 * - Legacy: "888a6421-weinverkostung-mehr-rose"  → "888a6421"
 * - Legacy full UUID: "888a6421-d38f-43e7-b16d-ba033a469aed"  → "888a6421"
 * - New v2: "weinverkostung-mehr-rose-888a6421"  → "888a6421"
 *
 * We detect by checking whether the first 8 chars look like a hex short ID.
 * If yes → legacy. If no → new v2, extract shortId from the end.
 *
 * @param slugParam - The dynamic route parameter
 * @returns 8-character short ID prefix for database lookup
 */
export function extractShortId(slugParam: string): string {
  // Legacy: first 8 chars are hex (shortId prefix)
  if (/^[0-9a-f]{8}/i.test(slugParam)) {
    return slugParam.slice(0, 8);
  }
  // V2: shortId is the last hyphen-delimited token
  const lastHyphenIdx = slugParam.lastIndexOf('-');
  if (lastHyphenIdx !== -1) {
    const tail = slugParam.slice(lastHyphenIdx + 1);
    if (/^[0-9a-f]{8}$/i.test(tail)) return tail;
  }
  // Fallback to first 8 (will fail later DB lookup but at least deterministic)
  return slugParam.slice(0, 8);
}

// ───────────────────────────────────────────────────────────────────────
//  V2 URL builder — /events/{plz}-{ort}/{slug}-{shortId}
// ───────────────────────────────────────────────────────────────────────

/** Bundesland → (capital PLZ, capital city slug). Used for the fallback
 *  prefix when a row has no postal_code or no parseable city. */
const BUNDESLAND_DEFAULTS: Record<string, { plz: string; citySlug: string }> = {
  'Burgenland':       { plz: '7000', citySlug: 'eisenstadt' },
  'Kärnten':          { plz: '9020', citySlug: 'klagenfurt' },
  'Niederösterreich': { plz: '3100', citySlug: 'st-poelten' },
  'Oberösterreich':   { plz: '4020', citySlug: 'linz' },
  'Salzburg':         { plz: '5020', citySlug: 'salzburg' },
  'Steiermark':       { plz: '8010', citySlug: 'graz' },
  'Tirol':            { plz: '6020', citySlug: 'innsbruck' },
  'Vorarlberg':       { plz: '6900', citySlug: 'bregenz' },
  'Wien':             { plz: '1010', citySlug: 'wien' },
};

/** Slug a single location-ish string (city name, address fragment). */
function slugifyLocation(value: string): string {
  let s = value;
  for (const [char, replacement] of Object.entries(UMLAUT_MAP)) {
    s = s.split(char).join(replacement);
  }
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

/** Parses a city out of an address string. Identical algorithm to
 *  `extractCity()` in `lib/utils/city.ts` but local here so we don't pull
 *  that whole module into scrape-pipeline scripts. */
function parseCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (lower === 'oesterreich' || lower === 'österreich' || lower === 'austria' || lower === 'at') continue;
    const stripped = part.replace(/^\d{4}\s+/, '').trim();
    if (!stripped || stripped.length < 2 || /^\d+$/.test(stripped)) continue;
    return stripped;
  }
  return null;
}

export interface EventForUrl {
  id: string;
  slug?: string | null;
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
  location_name?: string | null;
}

/**
 * Builds the canonical Phase-1 event URL.
 *
 *   /events/{plz}-{ort}/{slug}-{shortId}
 *
 * Priority for the `{plz}-{ort}` prefix:
 *   1. event.postal_code + city parsed from address     → "1010-wien"
 *   2. event.postal_code + bundesland capital slug      → "4020-linz"  (when city unparseable)
 *   3. bundesland-capital PLZ + bundesland-capital slug → "7000-eisenstadt"
 *   4. hard fallback                                    → "0000-at"
 *
 * This means **every event gets a deterministic, keyword-rich URL**, even
 * rows with missing postal_code or city. Worst case is "0000-at" — which
 * is rare (<1% of rows) and still legal SEO-wise.
 */
export function buildEventUrlV2(event: EventForUrl): string {
  const shortId = event.id.slice(0, 8);
  const slug = event.slug ?? shortId;

  const { plz, ort } = resolveEventUrlPrefix(event);
  const prefix = `${plz}-${ort}`;

  // Slug must end with `-shortId` so the catch-all route can reliably extract
  // it from the last hyphen-delimited token.
  const slugWithId = slug.endsWith(`-${shortId}`) ? slug : `${slug}-${shortId}`;

  return `/events/${prefix}/${slugWithId}`;
}

/**
 * Just the prefix part. Exposed because the sitemap / tests need it too.
 */
export function resolveEventUrlPrefix(
  event: Pick<EventForUrl, 'postal_code' | 'address' | 'bundesland' | 'location_name'>,
): { plz: string; ort: string } {
  const fallback = event.bundesland && BUNDESLAND_DEFAULTS[event.bundesland]
    ? BUNDESLAND_DEFAULTS[event.bundesland]
    : { plz: '0000', citySlug: 'at' };

  const city =
    parseCityFromAddress(event.address) ??
    (event.bundesland === 'Wien' ? 'Wien' : null);

  const ort = city ? slugifyLocation(city) : fallback.citySlug;
  const plz = (event.postal_code ?? '').trim().match(/^\d{4}$/)
    ? (event.postal_code as string).trim()
    : fallback.plz;

  return { plz, ort };
}

