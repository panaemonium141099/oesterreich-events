/**
 * Location detox — strip trailing-place location tails from titles before
 * the classifier lexes them (R — "kein blindes Präpositions-Stripping").
 *
 * Rules:
 *   1. Only the END of the title is considered (we don't strip from the
 *      middle, so "Neusiedl am See - Konzert" stays intact).
 *   2. The candidate suffix must be preceded by a known preposition
 *      (`in`, `im`, `am`, `an der`, `bei`, `zu`, `nach`) OR a standalone dash.
 *   3. The joined suffix must match `isKnownAustrianPlace(...)` via GeoNames.
 *      If it does not, we leave the title unchanged.
 *
 * Counter-examples that are preserved:
 *   - "Konzert im Park"          → "Park" is not in GeoNames → kept
 *   - "Jazz bei Kerzenschein"    → not a place → kept
 *   - "Messe am Berg"            → "Berg" may be a place but the whole title
 *                                  is ambiguous, and the event-type word
 *                                  stays because we preserve the prefix.
 *   - "Neusiedl am See"          → stripped only if preceded by an event word
 *
 * Examples that are correctly stripped:
 *   - "Dorffest in Neckenmarkt"  → "Dorffest"
 *   - "Lesung in Wiener Neustadt"→ "Lesung"
 *   - "Vortrag - Linz"           → "Vortrag"
 */

import { isKnownAustrianPlace, normalizeString } from '@/lib/location-normalizer';

/** Prepositions (normalized form) that mark a trailing-place segment. */
const PREPOSITIONS = new Set(['in', 'im', 'am', 'bei', 'zu', 'nach']);
/** Multi-word prepositions. */
const MULTI_WORD_PREPOSITIONS: Array<string[]> = [['an', 'der']];

/**
 * Strip a trailing place tail from a title.
 *
 * Input and output are expected to be in the classifier's normalized form
 * (lowercase, no diacritics, whitespace-collapsed). If no tail is found, the
 * input is returned unchanged.
 */
export function stripLocationTails(normalizedTitle: string): string {
  if (!normalizedTitle) return normalizedTitle;

  const tokens = normalizedTitle.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return normalizedTitle; // need prefix + preposition + place

  // Try suffix lengths 3, 2, 1 at the end (a place can be up to 3 tokens).
  for (let placeLen = 3; placeLen >= 1; placeLen--) {
    if (tokens.length < placeLen + 2) continue;

    const placeTokens = tokens.slice(tokens.length - placeLen);
    const placePhrase = placeTokens.join(' ');

    // Guard: the joined suffix must be a known Austrian place.
    if (!isKnownAustrianPlace(normalizeString(placePhrase))) continue;

    // What precedes the place? Either a single-word preposition, a multi-word
    // preposition, or a standalone dash.
    const beforeIdx = tokens.length - placeLen - 1;
    const beforeToken = tokens[beforeIdx];

    // Dash case: "Vortrag - Linz" → the dash becomes a separate token only if
    // the original input had whitespace around it; otherwise normalizeText may
    // keep it attached. We accept both by checking for "-" as the boundary
    // token OR as the last character of the previous token.
    if (beforeToken === '-' || beforeToken === '–') {
      // Make sure there's still prefix content (not just "- Linz").
      if (beforeIdx === 0) return normalizedTitle;
      return tokens.slice(0, beforeIdx).join(' ');
    }

    // Single-word preposition: "Dorffest in Neckenmarkt"
    if (PREPOSITIONS.has(beforeToken)) {
      if (beforeIdx === 0) return normalizedTitle; // preserve when nothing before it
      return tokens.slice(0, beforeIdx).join(' ');
    }

    // Multi-word preposition: "Kirche an der Thaya" — but only if it's
    // preceded by a real event-type prefix (so "Laa an der Thaya" as a
    // stand-alone title stays intact).
    for (const mwp of MULTI_WORD_PREPOSITIONS) {
      const mwpStart = beforeIdx - mwp.length + 1;
      if (mwpStart <= 0) continue;                // need at least one prefix token
      if (mwpStart < 0) continue;
      let ok = true;
      for (let i = 0; i < mwp.length; i++) {
        if (tokens[mwpStart + i] !== mwp[i]) { ok = false; break; }
      }
      if (ok) {
        return tokens.slice(0, mwpStart).join(' ');
      }
    }
  }

  return normalizedTitle;
}
