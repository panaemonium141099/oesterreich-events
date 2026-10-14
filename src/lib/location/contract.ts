/**
 * Freigabevertrag auf die Ortsentscheidung anwenden (fn-25, Review §6/§7).
 *
 * Der Vertrag (`evaluateAdmission`) prüft die FINALEN Werte gegen Polygon
 * und PLZ. Eine verworfene Koordinate oder ein Orts-Widerspruch macht aus
 * der Entscheidung einen Konflikt (ohne Position, zurückgehalten), eine
 * sonstige Orts-Quarantäne einen ungeklärten Ort. Diese Abbildung gilt für JEDEN
 * Schreibpfad gleich: Scraper-Sync und erneute Entscheidung im Bestand
 * (Backfill, Adress-Geocoder, Admin-Korrektur). Vorher kannte nur der Sync
 * den Vertrag; der Backfill schrieb dieselbe Zeile ohne ihn zurück, und die
 * Wiederholbarkeits-Stichprobe fand den Widerspruch (Galtür, 2026-09-14).
 */
import { NON_LOCATION_REASONS, type AdmissionVerdict } from '@/lib/quality/admission';
import type { LocationDecision, LocationPrecision, LocationStatus } from './types';

export interface ContractedPosition {
  status: LocationStatus;
  precision: LocationPrecision;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: LocationDecision['geocoding_confidence'] | string | null;
  geocoding_source: string | null;
  /** Zusätzliche Gründe aus dem Vertrag (Reihenfolge = Anwendung). */
  reasons: string[];
  /** Die entfernte Position, falls der Vertrag sie verworfen hat. */
  revoked: { latitude: number; longitude: number; geocoding_confidence: string | null } | null;
}

export function applyAdmissionToPosition(
  loc: Pick<ContractedPosition, 'status' | 'precision' | 'latitude' | 'longitude' | 'geocoding_confidence' | 'geocoding_source'>,
  admission: Pick<AdmissionVerdict, 'decision' | 'reasons' | 'corrections'>,
): ContractedPosition {
  const out: ContractedPosition = { ...loc, reasons: [], revoked: null };
  let status = loc.status;
  let precision = loc.precision;

  if (admission.corrections.includes('drop_coordinates')) {
    status = 'conflict';
    precision = 'unknown';
    out.reasons.push('admission:drop_coordinates');
  }
  if (admission.decision === 'quarantine') {
    // Alle Gründe ins Protokoll, auch die ohne Ortsbezug: daran erkennt die
    // erneute Entscheidung im Bestand, dass der Vertrag die Zeile hält
    // (`publishChangeFor`). Den Ort ändern nur die Ortsgründe; ein Termin
    // jenseits des Horizonts macht aus einer bestätigten Adresse keinen
    // ungeklärten Ort.
    for (const r of admission.reasons) out.reasons.push(`admission:${r}`);
    const locationReasons = admission.reasons.filter(r => !NON_LOCATION_REASONS.has(r));
    if (locationReasons.includes('region_contradicts_coords') || locationReasons.includes('foreign_place_signal')) {
      status = 'conflict';
      precision = 'unknown';
    } else if (locationReasons.length > 0 && status !== 'conflict' && status !== 'online') {
      status = 'unresolved';
      precision = 'unknown';
    }
  }

  // Ein Konflikt hat KEINE Position (DB-Check events_location_conflict_no_position).
  if (status === 'conflict' && out.latitude != null && out.longitude != null) {
    out.revoked = { latitude: out.latitude, longitude: out.longitude, geocoding_confidence: (out.geocoding_confidence as string | null) ?? null };
    out.reasons.push('conflict_position_revoked');
    out.latitude = null;
    out.longitude = null;
    out.geocoding_confidence = null;
    out.geocoding_source = null;
  }
  if (out.latitude == null || out.longitude == null) {
    out.geocoding_confidence = null;
    out.geocoding_source = null;
  }
  out.status = status;
  out.precision = precision;
  return out;
}
