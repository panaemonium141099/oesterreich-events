/**
 * Resolve a user's "where am I" location for the lifecycle email cron.
 *
 * Four fallback tiers, in order of precision/preference:
 *   1. Manual: profiles.postal_code + city  →  lookup in gemeinden.json (exact PLZ match)
 *   2. Manual: profiles.preferred_bundesland →  Bundesland-center lat/lng (broad ~50 km radius)
 *   3. Detected: profiles.detected_city / detected_lat / detected_lng (Vercel-Edge IP, ~5-20 km accuracy)
 *   4. None: returns null — caller falls back to nation-wide top events
 *
 * Caller uses returned { lat, lng, radius_km } to build a bbox event query.
 */

import gemeinden from '../../../public/gemeinden.json' assert { type: 'json' };

export interface ResolvedLocation {
  lat: number;
  lng: number;
  /** Search radius in km. Tighter when we trust the source. */
  radius_km: number;
  /** Human-readable city/region name for the email subject + body. */
  display: string;
  /**
   * Canonical bundesland name when we can derive it — used to build the
   * email CTA's ?bl=… filter. Null when we only have IP coords and no
   * gemeinde match to back-resolve from.
   */
  bundesland: string | null;
  /** Which tier won — for debugging / cron logs. */
  source: 'plz' | 'bundesland' | 'detected' | 'fallback';
}

interface ProfileLocationFields {
  city?: string | null;
  postal_code?: string | null;
  preferred_bundesland?: string | null;
  detected_city?: string | null;
  detected_lat?: number | null;
  detected_lng?: number | null;
}

interface Gemeinde {
  n: string;        // name
  b: string;        // bundesland
  i: string;        // bundesland slug
  p: string;        // postal code
  lat: number;
  lng: number;
}

const GEMEINDEN = gemeinden as Gemeinde[];

// Bundesland centers (capital cities). Used when only preferred_bundesland is set.
const BUNDESLAND_CENTERS: Record<string, { lat: number; lng: number; display: string }> = {
  'Wien':              { lat: 48.2082, lng: 16.3738, display: 'Wien' },
  'Niederösterreich':  { lat: 48.2080, lng: 15.6266, display: 'Niederösterreich' },
  'Burgenland':        { lat: 47.8455, lng: 16.5249, display: 'Burgenland' },
  'Oberösterreich':    { lat: 48.3069, lng: 14.2858, display: 'Oberösterreich' },
  'Salzburg':          { lat: 47.8095, lng: 13.0550, display: 'Salzburg' },
  'Tirol':             { lat: 47.2692, lng: 11.4041, display: 'Tirol' },
  'Vorarlberg':        { lat: 47.2497, lng: 9.9711,  display: 'Vorarlberg' },
  'Steiermark':        { lat: 47.0707, lng: 15.4395, display: 'Steiermark' },
  'Kärnten':           { lat: 46.6228, lng: 14.3076, display: 'Kärnten' },
};

export function resolveUserLocation(profile: ProfileLocationFields | null): ResolvedLocation | null {
  if (!profile) return null;

  // Tier 1: PLZ match (most precise — exact gemeinde lat/lng + bundesland)
  if (profile.postal_code) {
    const plz = profile.postal_code.trim();
    const hit = GEMEINDEN.find((g) => g.p === plz);
    if (hit) {
      return {
        lat: hit.lat,
        lng: hit.lng,
        radius_km: 15,
        display: profile.city?.trim() || hit.n,
        bundesland: hit.b,
        source: 'plz',
      };
    }
  }

  // Tier 2: preferred_bundesland → capital center, wide radius
  if (profile.preferred_bundesland) {
    const center = BUNDESLAND_CENTERS[profile.preferred_bundesland];
    if (center) {
      return {
        lat: center.lat,
        lng: center.lng,
        radius_km: 50,
        display: center.display,
        bundesland: profile.preferred_bundesland,
        source: 'bundesland',
      };
    }
  }

  // Tier 3: passive IP-detected city + coords. We don't know the bundesland
  // from Vercel geo, but we can reverse-lookup via the closest gemeinde —
  // cheap O(n) scan over the 2.1k entries beats running a real GIS query.
  if (
    profile.detected_lat !== null &&
    profile.detected_lat !== undefined &&
    profile.detected_lng !== null &&
    profile.detected_lng !== undefined &&
    Number.isFinite(profile.detected_lat) &&
    Number.isFinite(profile.detected_lng)
  ) {
    const nearest = nearestGemeinde(profile.detected_lat, profile.detected_lng);
    return {
      lat: profile.detected_lat,
      lng: profile.detected_lng,
      radius_km: 25, // wider — IP geo is coarse
      display: profile.detected_city?.trim() || nearest?.n || 'deiner Nähe',
      bundesland: nearest?.b ?? null,
      source: 'detected',
    };
  }

  // Tier 4: nothing — caller decides whether to send a nation-wide email or skip.
  return null;
}

/**
 * Find the gemeinde whose lat/lng is closest to the input point. Used to
 * back-resolve a bundesland from IP-derived coordinates. Squared euclidean
 * distance is fine for ranking (AT bbox is small enough that the cosine
 * latitude correction doesn't affect ordering).
 */
function nearestGemeinde(lat: number, lng: number): Gemeinde | null {
  let best: Gemeinde | null = null;
  let bestDist = Infinity;
  for (const g of GEMEINDEN) {
    const dLat = g.lat - lat;
    const dLng = g.lng - lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return best;
}

/**
 * Compute a lat/lng bounding box from a center point + radius in km.
 * Used by the events query to limit the search to "near this user".
 *
 * Simple equirectangular approximation — fine at AT latitudes for ≤100km
 * boxes. Don't use this for precise geographic computation.
 */
export function bboxFromCenter(lat: number, lng: number, radiusKm: number): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const dLat = radiusKm / 111;                          // 1° lat ≈ 111 km
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}
