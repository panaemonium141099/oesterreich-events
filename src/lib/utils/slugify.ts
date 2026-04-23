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
 * @deprecated Legacy shortId-based URL builder — superseded by
 * `buildEventUrlV2(event)` which emits the canonical V3 form
 * `/events/{plz-ort}/{yyyy-mm-dd}/{slug}`.
 *
 * Kept exported (but unused internally — see `grep -r buildEventUrl`)
 * for backwards compatibility with any external consumer that might
 * still import it. Will be removed in a future cleanup pass once we're
 * certain no integration references it.
 *
 * New code MUST use `buildEventUrlV2(event)`. Any internal call sites
 * touched during development should be migrated in the same commit.
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

/**
 * Normalises a bundesland field to its canonical capitalised form.
 *
 * Our production data has ~15 different spellings in the same column
 * (legacy tech-debt noted in Phase-0 review): `Steiermark` alongside
 * `steiermark`, `Niederösterreich` alongside `niederoesterreich`, even
 * short codes like `ooe`. Returns null for unrecognised inputs so the
 * caller can fall through to the hard `0000-at` default.
 *
 * Two-pass matcher:
 *   1. Shortcodes (`ooe`, `noe`, `bgld`, `stmk`, …) handled BEFORE text
 *      normalisation, because stripping umlaut-alternatives collapses
 *      "ooe" to "oo" (the `/oe/g → /o/` rule eats the first `oe`).
 *   2. Text normalisation (lowercase → NFD-strip → `ae/oe/ue → a/o/u`)
 *      handles variants like `Kärnten`, `kaernten`, `KÄRNTEN`.
 */
function normalizeBundesland(name: string | null | undefined): string | null {
  if (!name) return null;
  const raw = name.trim().toLowerCase();

  // 1) Shortcodes — resolve before any further mangling.
  const shortcodes: Record<string, string> = {
    'bgld': 'Burgenland',
    'ktn':  'Kärnten',
    'noe':  'Niederösterreich',
    'ooe':  'Oberösterreich',
    'sbg':  'Salzburg',
    'stmk': 'Steiermark',
    't':    'Tirol',
    'vbg':  'Vorarlberg',
    'w':    'Wien',
  };
  if (shortcodes[raw]) return shortcodes[raw];

  // 2) Text-normalised lookup: `kaernten`, `Kärnten`, `KAERNTEN` all
  //    collapse to `karnten`.
  const key = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z]/g, '');

  const map: Record<string, string> = {
    'burgenland':       'Burgenland',
    'karnten':          'Kärnten',
    'niederosterreich': 'Niederösterreich',
    'oberosterreich':   'Oberösterreich',
    'salzburg':         'Salzburg',
    'steiermark':       'Steiermark',
    'tirol':            'Tirol',
    'vorarlberg':       'Vorarlberg',
    'wien':             'Wien',
  };
  return map[key] ?? null;
}

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
  /** ISO timestamp — only the date portion is used in the URL */
  start_date?: string | null;
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
  location_name?: string | null;
}

/**
 * Builds the canonical Phase-1 event URL.
 *
 *   /events/{plz}-{ort}/{yyyy-mm-dd}/{slug}
 *
 * Example: `/events/8010-irdning/2026-09-15/irdninger-kirtag`
 *
 * Design notes:
 *   - Three path segments keep every token meaningful to humans + Google.
 *   - Date as middle segment gives Google an "event-like" structural hint
 *     (similar to news-article URL patterns) and makes the URL self-
 *     describing: a reader sees `/2026-09-15/` and immediately knows when.
 *   - No shortId suffix. DB lookup uses `(slug, date)` which is unique in
 *     practice across 42k events. On the extremely rare collision the
 *     handler picks the row with the highest event_score.
 *
 * Priority for the `{plz}-{ort}` prefix (unchanged from before):
 *   1. event.postal_code + parsed city from address       → "1010-wien"
 *   2. event.postal_code + location_name                  → "8952-irdning"
 *   3. event.postal_code + bundesland capital slug        → "4020-linz"
 *   4. bundesland-capital PLZ + location_name             → "8010-irdning"
 *   5. bundesland-capital PLZ + bundesland-capital slug   → "7000-eisenstadt"
 *   6. hard fallback                                      → "0000-at"
 *
 * Date fallback — if the row has no `start_date` (shouldn't happen in
 * production, but be defensive) we fall back to the legacy V2-with-shortId
 * form so the URL still uniquely identifies the event.
 */
export function buildEventUrlV2(event: EventForUrl): string {
  const shortId = event.id.slice(0, 8);
  const slug = event.slug ?? shortId;
  const { plz, ort } = resolveEventUrlPrefix(event);
  const prefix = `${plz}-${ort}`;

  const date = extractDatePart(event.start_date);
  if (date) {
    return `/events/${prefix}/${date}/${slug}`;
  }

  // Defensive fallback — no usable date. Use shortId-suffixed slug so the
  // catch-all can still resolve uniquely via shortId extraction.
  const slugWithId = slug.endsWith(`-${shortId}`) ? slug : `${slug}-${shortId}`;
  return `/events/${prefix}/${slugWithId}`;
}

/**
 * Extracts the `yyyy-mm-dd` portion of a date input. Accepts both:
 *   - "2026-09-15T19:30:00+00:00"  (common DB format)
 *   - "2026-09-15"                  (already a date)
 * Returns null if the input doesn't parse.
 */
function extractDatePart(input: string | null | undefined): string | null {
  if (!input) return null;
  // Fast-path: already looks like yyyy-mm-dd at the start
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(input.trim());
  if (match) return match[1];
  // Slow-path: try Date parsing
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Just the prefix part. Exposed because the sitemap / tests need it too.
 *
 * Implementation strategy: resolve each field independently against its own
 * fallback chain so a row with `postal_code=null, bundesland='steiermark',
 * location_name='Irdning'` yields the useful `/events/8010-irdning/...`
 * rather than the generic `/events/0000-at/...`. Google still sees a real
 * place name in the URL even when we lack the exact PLZ.
 */
export function resolveEventUrlPrefix(
  event: Pick<EventForUrl, 'postal_code' | 'address' | 'bundesland' | 'location_name'>,
): { plz: string; ort: string } {
  const canonicalBl = normalizeBundesland(event.bundesland);
  const blDefault = canonicalBl ? BUNDESLAND_DEFAULTS[canonicalBl] : null;

  // ─── ort resolution ──────────────────────────────────────────────────
  // Try real city sources in order of precision, only falling back to the
  // bundesland capital when nothing else is available.
  const addressCity = parseCityFromAddress(event.address);
  const locationCity = normaliseLocationName(event.location_name);
  const cityStateWien = canonicalBl === 'Wien' ? 'Wien' : null;

  const cityChoice = addressCity ?? locationCity ?? cityStateWien;
  const ort = cityChoice
    ? slugifyLocation(cityChoice)
    : (blDefault?.citySlug ?? 'at');

  // ─── plz resolution ──────────────────────────────────────────────────
  const plzFromRow = (event.postal_code ?? '').trim();
  const plz = /^\d{4}$/.test(plzFromRow)
    ? plzFromRow
    : (blDefault?.plz ?? '0000');

  return { plz, ort };
}

/**
 * Extracts a plausible city from the free-text `location_name` column.
 *
 * `location_name` is messy — often a single clean town name ("Irdning",
 * "Feldkirchen"), often a venue ("Gasthof zur Post"), sometimes a venue+
 * city combo ("Volkshaus Eisenstadt"). We take the strict-but-safe path:
 * only accept a **single clean word** as a city candidate. Multi-word
 * strings are treated as venues and fall through to the bundesland
 * capital, which is always a correct-at-bundesland-level substitute.
 *
 * Losing "Volkshaus Eisenstadt" → "eisenstadt" in exchange for never
 * accidentally labelling "Gasthof zur Post" as "post" is the right
 * trade-off for URL quality.
 */
function normaliseLocationName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/);
  if (words.length !== 1) return null;

  const w = words[0];
  if (w.length < 3) return null;
  // Accept German proper-noun pattern: capitalised start, letters + hyphen.
  if (!/^[A-ZÄÖÜ][a-zäöüß\-]+$/.test(w)) return null;
  return w;
}

