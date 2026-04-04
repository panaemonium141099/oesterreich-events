/**
 * Unicode-aware normalized token matching for place names.
 * Avoids .includes() false positives (e.g., "Rust" matching "frustrated")
 * and \b regex failures on umlauts and punctuation.
 */

/**
 * Normalize a string for place-name comparison:
 * - lowercase
 * - collapse common German diacritics/digraphs: ä->a, ö->o, ü->u, ß->ss
 * - strip periods (so "St." becomes "St")
 * - trim
 */
export function normalizePlaceName(s: string): string {
  return s
    .toLowerCase()
    // Collapse actual umlaut characters
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    // Collapse digraph variants (oe->o, ae->a, ue->u)
    // These appear in ASCII-ified Austrian place names (e.g., Moerbisch, Voecklabruck)
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/\./g, '')
    .trim();
}

/**
 * Tokenize a string by splitting on whitespace and common punctuation.
 * Returns an array of non-empty normalized tokens.
 */
export function tokenize(s: string): string[] {
  return normalizePlaceName(s)
    .split(/[\s,;:\-–—/()]+/)
    .filter(t => t.length > 0);
}

/**
 * Check if `placeName` appears as a complete token sequence within `query`.
 *
 * For single-word names like "Rust", checks that "rust" is a standalone token
 * in the query (not a substring of "frustrated").
 *
 * For multi-word names like "St. Margarethen", checks that "st" and "margarethen"
 * appear as consecutive tokens in the query.
 *
 * Returns true if all tokens of placeName appear consecutively in query tokens.
 */
export function matchPlaceName(query: string, placeName: string): boolean {
  const queryTokens = tokenize(query);
  const placeTokens = tokenize(placeName);

  if (placeTokens.length === 0) return false;

  // Find starting positions where the first place token matches
  for (let i = 0; i <= queryTokens.length - placeTokens.length; i++) {
    let allMatch = true;
    for (let j = 0; j < placeTokens.length; j++) {
      if (queryTokens[i + j] !== placeTokens[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }

  return false;
}
