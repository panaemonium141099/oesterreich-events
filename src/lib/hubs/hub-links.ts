/**
 * Deep-links from the static SEO hub pages (gemeinde / city / bundesland)
 * into the interactive /entdecken explorer, pre-scoped to the hub's place or
 * region. From there a user can widen the filter and browse ALL events — the
 * "hybrid" bridge that keeps a Google visitor from being trapped on a single
 * static list.
 *
 * Param names match what /entdecken's deriveInitialFilters reads:
 *   bl   → bundesland id(s)   (EventFilters.bundeslands)
 *   plz  → placePostalCode    (EventFilters.placePostalCode)
 *   ort  → placeName          (EventFilters.placeName)
 */
export interface EntdeckenScope {
  /** Bundesland id, e.g. 'oberoesterreich'. */
  bundesland?: string;
  /** Place name for the compound place-scope filter, e.g. 'Linz'. */
  placeName?: string;
  /** 4-digit PLZ for the compound place-scope filter, e.g. '4020'. */
  placePostalCode?: string;
  /** Tourism region within the bundesland (legacy; soft search-narrower). */
  region?: string;
  /** Bezirk name — exact value of the events' `district` field (real filter). */
  district?: string;
}

export function buildEntdeckenHref(scope: EntdeckenScope): string {
  const p = new URLSearchParams();
  if (scope.bundesland) p.set('bl', scope.bundesland);
  if (scope.placePostalCode) p.set('plz', scope.placePostalCode);
  if (scope.placeName) p.set('ort', scope.placeName);
  if (scope.region) p.set('region', scope.region);
  if (scope.district) p.set('district', scope.district);
  const qs = p.toString();
  return qs ? `/entdecken?${qs}` : '/entdecken';
}
