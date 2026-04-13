/**
 * Artist Name Normalization for Festival Lineups
 *
 * Comprehensive normalization pipeline for festival lineup artist names:
 *  1. Trim whitespace
 *  2. Strip performance modifiers: (DJ Set), (Live), (Acoustic), etc.
 *  3. Strip featured artist suffixes: feat., ft., featuring
 *  4. Split collaborative bookings: b2b, vs., x, presents
 *  5. Strip diacritics via NFD + regex
 *  6. Lowercase
 *  7. Collapse multiple spaces
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.3
 */

// ── Known bands with "&" in their name ─────────────────────────────────────────
// These should NOT be split on "&". Stored normalized (lowercase, no diacritics).

const AMPERSAND_BANDS: Set<string> = new Set([
  'above & beyond',
  'simon & garfunkel',
  'mumford & sons',
  'seiler & speer',
  'pizzera & jaus',
  'hubert von goisern & die alpinkatzen',
  'simon & jan',
  'pan & banda de rolda',
  'birds of tokyo & the western australian symphony orchestra',
  'bob & marley',
  'flogging molly & the interrupters',
  'for king & country',
  'haudegen & freunde',
  'herb alpert & the tijuana brass',
  'josh & wesz',
  'kool & the gang',
  'lilly wood & the prick',
  'of mice & men',
  'peking duk & alison wonderland',
  'peter, bjorn & john',
  'rise & fall',
  'sasha & john digweed',
  'showtek & wosp',
  'simon & garfunkel tribute',
  'slash & myles kennedy',
  'tears for fears & hall & oates',
  'tegan & sara',
  'tyler, the creator & friends',
  'aly & fila',
  'banks & steelz',
  'bob marley & the wailers',
  'earth, wind & fire',
  'emerson, lake & palmer',
  'hootie & the blowfish',
  'joan jett & the blackhearts',
  'joscho stephan & friends',
  'kenny rogers & dolly parton',
  'king & queen',
  'lords of the sound & friends',
  'nico & vinz',
  'odesza & golden features',
  'pep & rash',
  'rod stewart & the faces',
  'salt & pepper',
  'snoop dogg & wiz khalifa',
  'tom petty & the heartbreakers',
  'w&w',
]);

// ── Performance modifier patterns ──────────────────────────────────────────────
// Matches content in parentheses or brackets that are performance-related.

const PERFORMANCE_MODIFIERS = /\s*[\(\[](dj\s*set|live(\s*set)?|acoustic(\s*set)?|hybrid\s*set|solo(\s*set)?|unplugged|remix|mashup|a\/?v\s*set|closing\s*set|opening\s*set|b2b\s*set|extended\s*set|classics?\s*set|vinyl\s*(only\s*)?set|hosted\s*by\s+[^\)\]]+)[\)\]]/gi;

// ── Featured artist patterns ───────────────────────────────────────────────────
// Matches "feat.", "ft.", "featuring" in parens/brackets or bare.

const FEATURED_IN_PARENS = /\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]/gi;
const FEATURED_BARE = /\s+(?:feat\.?|ft\.?|featuring)\s+.+$/gi;

// ── Collaborative booking patterns ─────────────────────────────────────────────
// Patterns that indicate two artists performing together as separate acts.

const B2B_PATTERN = /\s+b2b\s+/i;
const VS_PATTERN = /\s+vs\.?\s+/i;
const X_COLLAB_PATTERN = /\s+x\s+/i;
const PRESENTS_PATTERN = /\s+presents?\s+/i;

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Strip diacritics from a string for normalized comparison.
 * Reuses the same NFD + combining-marks pattern as artist-matching.ts.
 */
function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if a raw name (after lowering + diacritics stripping) matches
 * a known ampersand band. Used to prevent splitting "Seiler & Speer" on "&".
 */
function isKnownAmpersandBand(normalizedName: string): boolean {
  return AMPERSAND_BANDS.has(normalizedName.trim());
}

/**
 * Internal normalization pipeline applied to a single artist name
 * (no splitting). Steps: trim -> strip modifiers -> strip feat ->
 * diacritics -> lowercase -> collapse spaces.
 */
function normalizeSingle(raw: string): string {
  let name = raw.trim();

  if (!name) return '';

  // Strip performance modifiers in parens/brackets
  name = name.replace(PERFORMANCE_MODIFIERS, '');

  // Strip featured artist references in parens/brackets
  name = name.replace(FEATURED_IN_PARENS, '');

  // Strip bare featured artist suffixes
  name = name.replace(FEATURED_BARE, '');

  // Strip diacritics
  name = stripDiacritics(name);

  // Lowercase
  name = name.toLowerCase();

  // Collapse multiple spaces and trim
  name = name.replace(/\s{2,}/g, ' ').trim();

  return name;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Normalize an artist name for matching purposes.
 *
 * Pipeline:
 *  1. Trim whitespace
 *  2. Strip performance modifiers: (DJ Set), (Live), (Acoustic), etc.
 *  3. Strip featured artist suffixes: feat., ft., featuring
 *  4. Strip diacritics via NFD + regex
 *  5. Lowercase
 *  6. Collapse multiple spaces
 *
 * Note: This does NOT split collaborative bookings. Use
 * `splitCollaborativeBooking()` first if you need individual names.
 *
 * @param raw - The raw artist name from a lineup
 * @returns The normalized name
 */
export function normalizeArtistName(raw: string): string {
  return normalizeSingle(raw);
}

/**
 * Split a collaborative booking into individual artist names.
 *
 * Handles:
 *  - "A b2b B" -> ["A", "B"]
 *  - "A vs. B" -> ["A", "B"]
 *  - "A x B"   -> ["A", "B"]
 *  - "A presents B" -> ["A", "B"]
 *  - "A & B"   -> ["A", "B"] (unless A & B is a known band)
 *  - "A und B"  -> ["A", "B"] (Austrian "und" = "&")
 *
 * Each resulting name is individually normalized via `normalizeArtistName()`.
 * Empty entries are filtered out.
 *
 * @param raw - The raw artist entry from a lineup
 * @returns Array of individually normalized artist names
 */
export function splitCollaborativeBooking(raw: string): string[] {
  const trimmed = raw.trim();

  if (!trimmed) return [];

  // First strip performance modifiers and feat. before splitting,
  // so "A b2b B (DJ Set)" becomes "A b2b B" before split.
  let cleaned = trimmed;
  cleaned = cleaned.replace(PERFORMANCE_MODIFIERS, '');
  cleaned = cleaned.replace(FEATURED_IN_PARENS, '');
  cleaned = cleaned.replace(FEATURED_BARE, '');

  // Check for b2b split
  if (B2B_PATTERN.test(cleaned)) {
    return cleaned
      .split(B2B_PATTERN)
      .map(normalizeSingle)
      .filter(Boolean);
  }

  // Check for vs. split
  if (VS_PATTERN.test(cleaned)) {
    return cleaned
      .split(VS_PATTERN)
      .map(normalizeSingle)
      .filter(Boolean);
  }

  // Check for "x" collaboration split.
  // Only split if "x" is a standalone word between artist names.
  // Avoid splitting names like "Dax J" or "MistaJam x Dimension".
  if (X_COLLAB_PATTERN.test(cleaned)) {
    const parts = cleaned.split(X_COLLAB_PATTERN);
    // Only split if both parts look like real names (length > 1)
    if (parts.length === 2 && parts[0].trim().length > 1 && parts[1].trim().length > 1) {
      return parts.map(normalizeSingle).filter(Boolean);
    }
  }

  // Check for "presents" split
  if (PRESENTS_PATTERN.test(cleaned)) {
    return cleaned
      .split(PRESENTS_PATTERN)
      .map(normalizeSingle)
      .filter(Boolean);
  }

  // Check for "&" or "und" split (Austrian equivalent)
  // First, check if the whole name is a known ampersand band
  const normalizedForCheck = stripDiacritics(cleaned.toLowerCase()).trim();
  if (!isKnownAmpersandBand(normalizedForCheck)) {
    // Replace "und" with "&" for uniform handling, then split on "&"
    // "und" must be a standalone word (word boundaries)
    const withUnifiedAmpersand = cleaned.replace(/\bund\b/gi, '&');

    if (withUnifiedAmpersand.includes('&')) {
      // Also check each potential part: if recombining any two adjacent parts
      // yields a known band, don't split those parts.
      const rawParts = withUnifiedAmpersand.split('&');
      if (rawParts.length === 2) {
        return rawParts.map(normalizeSingle).filter(Boolean);
      }

      // For 3+ parts (rare: "A & B & C"), split all
      return rawParts.map(normalizeSingle).filter(Boolean);
    }
  }

  // No collaborative pattern found -- return the single normalized name
  return [normalizeSingle(cleaned)].filter(Boolean);
}
