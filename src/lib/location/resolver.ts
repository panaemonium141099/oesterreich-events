/**
 * Ortsentscheidung mit Belegen (fn-25 C3).
 *
 * Baut auf der konservativen Entscheidung auf (Quellwerte, genannte PLZ,
 * Gemeinde-Registry) und hebt sie nur dann auf eine genauere Stufe, wenn
 * ein Beleg vorliegt, der zum KONKRETEN Event gehört:
 *
 *  1. Quellkoordinate mit belegter Genauigkeit (Feed-Venue, Adapter-Venue)
 *     bleibt maßgeblich; ein passender Venue-Kandidat (≤ 300 m) liefert
 *     nur die `venue_id`.
 *  2. Bestätigte Zuordnung der Quellen-Venue-Kennung (`source_venue_map`).
 *  3. Venue-Kandidat aus dem eigenen Kandidatenbestand (`venues` +
 *     `venue_aliases`), aber nur mit ZWEITEM Beleg: gleiche Straße im
 *     Adresstext, Quellkoordinate in der Nähe oder ein bestätigter Alias.
 *     Ein Namenstreffer in derselben PLZ allein ist kein Beleg — der
 *     Kandidatenbestand ist kein geprüftes Register, und ein einzelner
 *     Kandidat kann schlicht Lücke im Bestand bedeuten.
 *  4. Geocodierte EVENTADRESSE (Straße + Hausnummer + PLZ/Ort) aus dem
 *     Cache, den der Nachtjob füllt; nie der Venue-Name allein.
 *  5. Sonst bleibt es bei der Gemeinde (`municipality_only`) oder der
 *     Zurückhaltung.
 *
 * Jede so gewonnene Position muss zur genannten PLZ passen (≤ 30 km),
 * sonst `conflict`. Rein: alle Belege kommen von außen (`evidence.ts`).
 */
import { resolveConservativeLocation, hasHouseNumber, type LocationInput } from './conservative-resolution';
import { plzCentroid } from './gemeinde-index';
import type { LocationDecision, LocationPrecision } from './types';

export const RESOLVER_VERSION = 2;

export interface VenueCandidateEvidence {
  venue_id: string;
  name: string;
  latitude: number;
  longitude: number;
  postal_code: string | null;
  city: string | null;
  /** Wodurch der Kandidat über den Namen hinaus belegt ist. */
  matched_by: Array<'street' | 'source_coords' | 'alias' | 'source_venue_id'>;
}

export interface AddressGeocodeEvidence {
  latitude: number;
  longitude: number;
  /** Trefferebene des Geocoders (Gebäude/Straße/Ort). */
  precision: 'building' | 'street' | 'locality';
  provider: string;
  cache_key: string;
}

export interface SourceVenueMapEvidence {
  venue_id: string | null;
  latitude: number;
  longitude: number;
  precision: LocationPrecision;
  confirmed_by: string;
}

export interface LocationEvidence {
  venueCandidate?: VenueCandidateEvidence | null;
  addressGeocode?: AddressGeocodeEvidence | null;
  sourceVenueMap?: SourceVenueMapEvidence | null;
}

export interface ResolvedLocation extends LocationDecision {
  venue_id: string | null;
}

const CONFLICT_KM = 30;
const NEARBY_M = 300;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Passt eine Position zur genannten PLZ? (kein Urteil ohne PLZ) */
function fitsPlz(decision: LocationDecision, lat: number, lng: number): { ok: boolean; km: number | null } {
  if (!decision.postal_code || decision.country !== 'AT') return { ok: true, km: null };
  const c = plzCentroid(decision.postal_code, decision.gemeinde?.name ?? decision.location_name);
  if (!c || c.ambiguous) return { ok: true, km: null };
  const km = haversineKm(lat, lng, c.lat, c.lng);
  return { ok: km <= CONFLICT_KM, km };
}

function conflict(base: LocationDecision, reason: string, rejectedPos: string): ResolvedLocation {
  return {
    ...base,
    status: 'conflict',
    precision: 'unknown',
    latitude: null,
    longitude: null,
    geocoding_confidence: null,
    geocoding_source: null,
    reasons: [...base.reasons, reason],
    rejected: [...base.rejected, rejectedPos],
    allowed: { pin: false, route: false, distance: false, municipality_page: false },
    venue_id: null,
  };
}

export function resolveEventLocation(
  input: LocationInput,
  evidence: LocationEvidence = {},
  now: Date = new Date(),
): ResolvedLocation {
  const base = resolveConservativeLocation(input, now);
  const decision: ResolvedLocation = { ...base, version: RESOLVER_VERSION, venue_id: null };
  const routable = hasHouseNumber(input.address);

  // Keine Aufwertung für Online-Events oder belegte Widersprüche.
  if (base.status === 'online' || base.status === 'conflict') return decision;

  // 1. Quellkoordinate mit belegter Genauigkeit bleibt maßgeblich.
  if (base.latitude != null && base.longitude != null && (base.status === 'venue_confirmed' || base.status === 'address_confirmed')) {
    const cand = evidence.venueCandidate;
    if (cand && haversineKm(base.latitude, base.longitude, cand.latitude, cand.longitude) * 1000 <= NEARBY_M) {
      decision.venue_id = cand.venue_id;
      decision.evidence = [...decision.evidence, `venue_candidate:${cand.venue_id}:nearby`];
    }
    return decision;
  }

  // 2. Bestätigte Zuordnung der Quellen-Venue-Kennung.
  const map = evidence.sourceVenueMap;
  if (map) {
    const fit = fitsPlz(base, map.latitude, map.longitude);
    if (!fit.ok) return conflict(base, `source_venue_map_vs_plz_conflict:${Math.round(fit.km ?? 0)}km`, `source_venue_map:${map.latitude.toFixed(4)},${map.longitude.toFixed(4)}`);
    return {
      ...decision,
      status: 'venue_confirmed',
      precision: map.precision,
      latitude: map.latitude,
      longitude: map.longitude,
      geocoding_confidence: 'venue',
      geocoding_source: 'source_venue_map',
      venue_id: map.venue_id,
      evidence: [...decision.evidence, `source_venue_map:${map.confirmed_by}`],
      reasons: [...decision.reasons, 'position_from_source_venue_map'],
      provenance: { ...decision.provenance, latitude: 'registry' },
      allowed: { pin: true, route: true, distance: true, municipality_page: !!(decision.gemeinde || decision.postal_code) },
    };
  }

  // 3. Venue-Kandidat mit zweitem Beleg.
  const cand = evidence.venueCandidate;
  if (cand && cand.matched_by.length > 0) {
    const fit = fitsPlz(base, cand.latitude, cand.longitude);
    if (!fit.ok) return conflict(base, `venue_candidate_vs_plz_conflict:${Math.round(fit.km ?? 0)}km`, `venue_candidate:${cand.venue_id}`);
    return {
      ...decision,
      status: 'venue_confirmed',
      precision: 'building',
      latitude: cand.latitude,
      longitude: cand.longitude,
      geocoding_confidence: 'venue',
      geocoding_source: 'venue_candidate',
      venue_id: cand.venue_id,
      evidence: [...decision.evidence, `venue_candidate:${cand.venue_id}:${cand.matched_by.join('+')}`],
      reasons: [...decision.reasons, 'position_from_venue_candidate'],
      provenance: { ...decision.provenance, latitude: 'registry' },
      allowed: { pin: true, route: true, distance: true, municipality_page: !!(decision.gemeinde || decision.postal_code) },
    };
  }

  // 4. Geocodierte Eventadresse (nur mit Hausnummer im Quelltext).
  const geo = evidence.addressGeocode;
  if (geo && routable && geo.precision !== 'locality') {
    const fit = fitsPlz(base, geo.latitude, geo.longitude);
    if (!fit.ok) return conflict(base, `address_geocode_vs_plz_conflict:${Math.round(fit.km ?? 0)}km`, `address_geocode:${geo.latitude.toFixed(4)},${geo.longitude.toFixed(4)}`);
    return {
      ...decision,
      status: 'address_confirmed',
      precision: geo.precision,
      latitude: geo.latitude,
      longitude: geo.longitude,
      geocoding_confidence: 'address',
      geocoding_source: `address_geocode:${geo.provider}`,
      evidence: [...decision.evidence, `address_geocode:${geo.provider}:${geo.precision}`],
      reasons: [...decision.reasons, 'position_from_address_geocode'],
      provenance: { ...decision.provenance, latitude: 'address_text' },
      allowed: {
        pin: true,
        route: geo.precision === 'building',
        distance: true,
        municipality_page: !!(decision.gemeinde || decision.postal_code),
      },
    };
  }

  // 5. Bleibt bei Gemeinde/Zurückhaltung. Ein Kandidat ohne zweiten Beleg
  //    wird protokolliert, aber nicht übernommen.
  if (cand) decision.rejected = [...decision.rejected, `venue_candidate:${cand.venue_id}:name_only`];
  return decision;
}
