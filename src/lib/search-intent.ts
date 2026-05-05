/**
 * Strict-equality search-intent resolver — turns a raw query string into a
 * structured filter intent before falling back to ILIKE keyword search.
 * Same logic powers HeroSection (landing) and MapTopBar (map/list) so the
 * Enter-key behaviour matches the suggestion-click behaviour everywhere.
 *
 * Strict equality only; no fuzzy matching. False positives (e.g. typo
 * "Steiermark" → "Salzburg") are worse than dropping to the ILIKE fallback.
 *
 * Priority:
 *   1. Bundesland (name / shortName / canonical id / ASCII alias)
 *   2. District (suffix-stripped, Stadt preferred for ambiguous Stadt/Land)
 *   3. Gemeinde (exact name)
 *   4. Fallback ILIKE
 */
import { BUNDESLAENDER, bundeslandToId } from './bundeslaender';
import { DISTRICTS_BY_BUNDESLAND, type BundeslandId } from './districtsAT';

export interface GemeindeMin {
  n: string; // name
  i: string; // bundesland id
  p: string; // postal code
  lat: number;
  lng: number;
}

export type ResolvedIntent =
  | { kind: 'bundesland'; bundeslandId: string }
  | { kind: 'district'; bundeslandId: BundeslandId; district: string }
  | {
      kind: 'gemeinde';
      name: string;
      bundeslandId: string;
      lat: number;
      lng: number;
      postalCode?: string;
    }
  | { kind: 'fallback'; search: string };

const STRIP_SUFFIX = /\s*\((stadt|land)\)\s*$/i;

export function resolveSearchIntent(
  raw: string,
  gemeinden: ReadonlyArray<GemeindeMin>,
): ResolvedIntent {
  const q = raw.trim().toLowerCase();
  if (!q) return { kind: 'fallback', search: '' };

  // Compute BOTH the Bundesland and District matches first. We need both
  // before deciding because some queries hit both (e.g. "Salzburg" is the
  // bundesland AND a Statutarstadt). Intent for one-word city queries is
  // almost always the city — let the Stadt-district win in that case.
  const blByExact = BUNDESLAENDER.find(
    (b) =>
      b.id !== 'all' &&
      (b.name.toLowerCase() === q ||
        b.shortName.toLowerCase() === q ||
        b.id === q ||
        b.name.toLowerCase().replace(/österreich/g, 'oesterreich') === q),
  );
  const blByAlias = !blByExact ? bundeslandToId(q) : null;
  const blMatch = blByExact ?? (blByAlias ? BUNDESLAENDER.find((b) => b.id === blByAlias) : undefined);

  // District match — suffix-stripped equality, Stadt preferred.
  let bestDistrict: { name: string; bl: BundeslandId; isStadt: boolean } | null = null;
  for (const [bl, ds] of Object.entries(DISTRICTS_BY_BUNDESLAND)) {
    for (const d of ds) {
      const lc = d.name.toLowerCase();
      const bare = lc.replace(STRIP_SUFFIX, '').trim();
      if (lc === q || bare === q) {
        const isStadt = /\(stadt\)$/i.test(d.name);
        if (!bestDistrict || (isStadt && !bestDistrict.isStadt)) {
          bestDistrict = { name: d.name, bl: bl as BundeslandId, isStadt };
        }
      }
    }
  }

  // Tie-breaker: when a query matches both a Bundesland AND a Stadt-district
  // (Salzburg is the only such case in AT), prefer the city. Nobody types
  // "Salzburg" wanting all of Bundesland Salzburg's events — they want the
  // Mozart-city. Same logic protects future ambiguous names.
  if (bestDistrict && bestDistrict.isStadt) {
    return { kind: 'district', bundeslandId: bestDistrict.bl, district: bestDistrict.name };
  }
  if (blMatch && blMatch.id !== 'all') {
    return { kind: 'bundesland', bundeslandId: blMatch.id };
  }
  if (bestDistrict) {
    return { kind: 'district', bundeslandId: bestDistrict.bl, district: bestDistrict.name };
  }

  // 3. Gemeinde exact match. When multiple Gemeinden share the name (rare)
  // we still pick the first — disambiguation is what the dropdown is for.
  const g = gemeinden.find((x) => x.n.toLowerCase() === q);
  if (g) {
    return {
      kind: 'gemeinde',
      name: g.n,
      bundeslandId: g.i,
      lat: g.lat,
      lng: g.lng,
      postalCode: g.p,
    };
  }

  // 4. Fallback — return raw text for ILIKE keyword search.
  return { kind: 'fallback', search: raw.trim() };
}
