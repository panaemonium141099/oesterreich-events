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
 * Davor steht die manuelle Korrektur (`event_location_corrections`, Scope
 * event): Sie gilt nur, solange die Quelle dieselben Ortsangaben liefert wie
 * zum Zeitpunkt der Korrektur (`before.location_basis_hash`). Liefert die
 * Quelle andere Ortsangaben (Verlegung), ist die Korrektur veraltet und die
 * Entscheidung wird neu getroffen; es gibt keine ewige Koordinatensperre
 * (Review §7, §9 „Venue-Verlegung nach einer früheren manuellen Korrektur").
 *
 * Jede so gewonnene Position muss zur genannten PLZ passen (≤ 30 km),
 * sonst `conflict`. Rein: alle Belege kommen von außen (`evidence.ts`).
 */
import { resolveConservativeLocation, hasHouseNumber, locationBasisHash, type LocationInput } from './conservative-resolution';
import { gemeindenByPlz } from './gemeinde-index';
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

/** Gültige manuelle Korrektur für genau dieses Event. */
export interface CorrectionEvidence {
  id: string;
  latitude: number;
  longitude: number;
  precision: LocationPrecision;
  venue_id: string | null;
  /** Dokumentierte Anzeigebezeichnung (optional). */
  location_name: string | null;
  /** Korrigierte PLZ (optional; sonst bleibt die PLZ der Quelle). */
  postal_code: string | null;
  /** Ortsangaben-Hash der Quelle, auf den sich die Korrektur bezog; null = unabhängig vom Quellenstand. */
  basis_hash: string | null;
  corrected_by: string;
}

export interface LocationEvidence {
  venueCandidate?: VenueCandidateEvidence | null;
  addressGeocode?: AddressGeocodeEvidence | null;
  sourceVenueMap?: SourceVenueMapEvidence | null;
  correction?: CorrectionEvidence | null;
  /** true, wenn die Korrekturtabelle für diesen Batch erfolgreich gelesen
   *  wurde (auch ohne Treffer). Nur dann darf ein altes `manual`-Label in
   *  der Zeile fallen gelassen werden. */
  correctionsLoaded?: boolean;
  /** true, wenn ALLE Belegquellen für diesen Batch erfolgreich gelesen
   *  wurden. Bei Ausfall bleibt ein belegter Bestand unverändert (kein
   *  Abstufen auf die Quellkoordinate, Review §9 „Geocoder-Ausfall"). */
  complete?: boolean;
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

function applyCorrection(decision: ResolvedLocation, corr: CorrectionEvidence): ResolvedLocation {
  const status: LocationDecision['status'] = corr.venue_id ? 'venue_confirmed' : 'address_confirmed';
  const routable = status === 'venue_confirmed' || corr.precision === 'entrance' || corr.precision === 'building' || corr.precision === 'site';
  let postal_code = decision.postal_code;
  let gemeinde = decision.gemeinde;
  const provenance = { ...decision.provenance, latitude: 'manual' as const };
  if (corr.postal_code && corr.postal_code !== decision.postal_code) {
    postal_code = corr.postal_code;
    provenance.postal_code = 'manual';
    const g = gemeindenByPlz(corr.postal_code);
    gemeinde = g.length === 1 ? { name: g[0].name, plz: g[0].plz, bundesland: g[0].bundesland, bezirk: g[0].bezirk ?? null } : null;
    if (gemeinde) provenance.gemeinde = 'manual';
  }
  return {
    ...decision,
    status,
    precision: corr.precision,
    location_name: corr.location_name ?? decision.location_name,
    postal_code,
    gemeinde,
    latitude: corr.latitude,
    longitude: corr.longitude,
    geocoding_confidence: 'manual',
    geocoding_source: 'event_location_corrections',
    venue_id: corr.venue_id,
    provenance: corr.location_name ? { ...provenance, location_name: 'manual' } : provenance,
    evidence: [...decision.evidence, `correction:${corr.id}:${corr.corrected_by}`],
    reasons: [...decision.reasons, 'position_from_manual_correction'],
    allowed: { pin: true, route: routable, distance: true, municipality_page: !!(gemeinde || postal_code) },
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

  // 0. Manuelle Korrektur für dieses Event — nur zum passenden Quellenstand.
  const corr = evidence.correction;
  if (corr) {
    const basisNow = locationBasisHash(input);
    if (corr.basis_hash && corr.basis_hash !== basisNow) {
      decision.reasons = [...decision.reasons, `correction_stale:${corr.id}`];
      decision.rejected = [...decision.rejected, `correction:${corr.id}:source_location_changed`];
    } else {
      return applyCorrection(decision, corr);
    }
  }

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
