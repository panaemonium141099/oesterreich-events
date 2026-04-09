/**
 * City extraction utility for events.
 *
 * Events don't have a dedicated `city` field. This utility derives
 * the city from available data with a clear priority chain.
 */

/** Bundeslaender that are simultaneously cities (Stadtstaaten) */
const CITY_STATES = new Set(['Wien']);

/**
 * Normalizes a city name for deduplication and storage.
 * Used as the canonical key in `followed_cities.city_normalized`.
 */
export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Extracts the city name from an event's data.
 *
 * Priority:
 * 1. venue.city (from JOIN when event has venue_id)
 * 2. Address parsing (last component after comma)
 * 3. City-state fallback (Wien only)
 *
 * Returns null if no real city can be derived.
 * The Follow-City button should not be shown in that case.
 */
export function extractCity(
  event: {
    address?: string | null;
    bundesland?: string | null;
  },
  venueCity?: string | null,
): string | null {
  // 1. Venue city is most reliable
  if (venueCity?.trim()) {
    return venueCity.trim();
  }

  // 2. Parse city from address (last meaningful component after comma)
  if (event.address) {
    const city = parseCityFromAddress(event.address);
    if (city) return city;
  }

  // 3. City-state fallback — only Wien
  if (event.bundesland && CITY_STATES.has(event.bundesland)) {
    return event.bundesland;
  }

  // No fallback for regular Bundeslaender (Tirol, Steiermark, etc.)
  return null;
}

/**
 * Parses city from an address string.
 * Expects formats like:
 *   "Hauptstrasse 5, 1010 Wien"
 *   "Schillerplatz 3, Wien"
 *   "Universitaetsstrasse 7, 1010 Wien, Oesterreich"
 *
 * Returns null for addresses without a comma or where parsing fails.
 */
function parseCityFromAddress(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length < 2) return null;

  // Try last part first, then second-to-last (in case of country suffix)
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts[i];
    const city = extractCityFromPart(candidate);
    if (city) return city;
  }

  return null;
}

/**
 * Extracts a city name from a single address component.
 * Strips leading postal codes (4-digit Austrian PLZ).
 */
function extractCityFromPart(part: string): string | null {
  if (!part) return null;

  // Skip if this looks like a country name
  const lower = part.toLowerCase();
  if (
    lower === 'oesterreich' ||
    lower === 'österreich' ||
    lower === 'austria' ||
    lower === 'at'
  ) {
    return null;
  }

  // Strip leading postal code (Austrian PLZ: 4 digits)
  const stripped = part.replace(/^\d{4}\s+/, '').trim();
  if (!stripped || stripped.length < 2) return null;

  // Reject if the result is still just digits
  if (/^\d+$/.test(stripped)) return null;

  return stripped;
}
