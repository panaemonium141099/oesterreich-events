/**
 * Trust gate for event coordinates.
 *
 * Background: ~30% of our future events have lat/lng that point at a town or
 * gemeinde center (Feratel region fallback, scraper-defaults, gemeinde-registry
 * lookups), not at the actual venue. Examples: 1545 events sit on the Linz
 * Hauptplatz coord, 904 on Wiener Neustadt center, etc. If we open a Google
 * Maps directions URL to those, the user drives to the wrong place — bad
 * reputation hit.
 *
 * Trust criteria: we keep the Route affordance ONLY when at least one of
 *   1. The event row has a specific `address` string (street + number).
 *   2. The geocoding pipeline marked confidence as one of the "venue-level"
 *      buckets: 'exact', 'manual', 'verified', 'json-ld-venue'.
 *
 * Everything else ('scraper', 'normalized', 'gemeinde-registry', 'gemini',
 * 'from_title', 'from_description', null) is treated as approximate — the
 * UI shows a grey "Ortsangabe ungefähr — beim Veranstalter prüfen" pill
 * instead of a routing link.
 */

const TRUSTED_GEOCODING_CONFIDENCES = new Set<string>([
  'exact',
  'manual',
  'verified',
  'json-ld-venue',
]);

export interface EventLocationLike {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  geocoding_confidence?: string | null;
}

/**
 * Returns true when the coordinates are reliable enough to send a user to.
 * Always false when coords are missing.
 */
export function isLocationTrusted(event: EventLocationLike): boolean {
  if (event.latitude == null || event.longitude == null) return false;
  if (event.address && event.address.trim().length > 0) return true;
  if (event.geocoding_confidence && TRUSTED_GEOCODING_CONFIDENCES.has(event.geocoding_confidence)) {
    return true;
  }
  return false;
}

/**
 * True when we have coordinates but they're too approximate to route to.
 * Used by the UI to show the "Ortsangabe ungefähr" pill instead of nothing.
 */
export function isLocationApproximate(event: EventLocationLike): boolean {
  if (event.latitude == null || event.longitude == null) return false;
  return !isLocationTrusted(event);
}
