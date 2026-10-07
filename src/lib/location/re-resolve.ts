/**
 * Erneute Ortsentscheidung für gespeicherte Events (fn-25 C3/D/E).
 *
 * Rekonstruiert die Eingabe aus den Rohspalten der Zeile (nie aus den
 * abgeleiteten Werten), lädt Belege, entscheidet neu und schreibt die
 * Entscheidung als Ganzes zurück. Schreibt nur, wenn die Zeile seit dem
 * Lesen unverändert ist (`updated_at`-Vergleich), damit ein paralleler
 * Scrape oder eine Admin-Korrektur nicht überrollt wird.
 *
 * Verwendet vom Adress-Geocoder-Nachtjob und von der Bestandssanierung.
 * Der Scraper-Sync hat seinen eigenen Pfad (er kennt die frischen
 * Quellwerte); beide nutzen denselben Resolver.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationInput } from './conservative-resolution';
import { loadLocationEvidence } from './evidence';
import { resolveEventLocation, type ResolvedLocation } from './resolver';
import { applyAdmissionToPosition } from './contract';
import { evaluateAdmission, type AdmissionVerdict } from '@/lib/quality/admission';
import { bundeslandFromPolygon } from '@/lib/eventim/bundesland-from-geo';
import { getBundeslandFromPLZ } from '@/lib/location/plz-bundesland';
import { districtForLocation, bundeslandForLocation } from '@/lib/plz-district';
import type { SourceCoordsPrecision } from './types';

export interface StoredEventLocationRow {
  id: string;
  source_name?: string | null;
  title: string | null;
  start_date?: string | null;
  location_name: string | null;
  location_name_raw: string | null;
  address: string | null;
  address_raw: string | null;
  postal_code: string | null;
  postal_code_raw: string | null;
  city_raw: string | null;
  country: string | null;
  country_raw: string | null;
  bundesland: string | null;
  district?: string | null;
  latitude: number | null;
  longitude: number | null;
  latitude_raw: number | null;
  longitude_raw: number | null;
  coords_precision_raw: string | null;
  source_venue_id: string | null;
  geocoding_confidence: string | null;
  location_status: string | null;
  location_status_changed_at?: string | null;
  location_resolution: { input_hash?: string; reasons?: string[]; evidence?: string[] } | null;
  publish_status?: string | null;
  updated_at: string | null;
}

/**
 * Das Bundesland, das die QUELLE genannt hat. Die Spalte `bundesland` taugt
 * dafür nicht: sie trägt auch das aus Gemeinde oder PLZ abgeleitete und das
 * vom Freigabevertrag korrigierte Bundesland (`bundeslandForLocation`). Als
 * Eingabe zurückgespielt, sähe es aus wie eine Angabe der Quelle: anderer
 * Eingabehash als im Sync, Gegenprobe gegen einen abgeleiteten Wert. Die
 * Angabe der Quelle protokolliert die Entscheidung als `bundesland:source:`;
 * ohne gespeicherte Entscheidung (Altbestand) bleibt nur die Spalte.
 */
export function sourceBundeslandOf(row: Pick<StoredEventLocationRow, 'bundesland' | 'location_resolution'>): string | null {
  const evidence = row.location_resolution?.evidence;
  if (!Array.isArray(evidence)) return row.bundesland;
  for (const e of evidence) {
    if (typeof e === 'string' && e.startsWith('bundesland:source:')) return e.slice('bundesland:source:'.length);
  }
  return null;
}

export const STORED_LOCATION_COLUMNS =
  'id, source_name, title, start_date, location_name, location_name_raw, address, address_raw, postal_code, postal_code_raw, city_raw, ' +
  'country, country_raw, bundesland, district, latitude, longitude, latitude_raw, longitude_raw, coords_precision_raw, ' +
  'source_venue_id, geocoding_confidence, location_status, location_status_changed_at, location_resolution, publish_status, updated_at';

/**
 * Eingabe aus der Zeile. Rohspalten haben Vorrang; fehlen sie (Zeile seit
 * der Umstellung nicht neu geschrieben), gelten die Anzeigespalten als
 * Quellwert, Koordinaten aber nur, wenn sie von der Quelle stammen
 * (`geocoding_confidence = 'scraper'`), und dann mit unbekannter
 * Genauigkeit.
 */
function hasRawLocation(row: StoredEventLocationRow): boolean {
  return row.location_name_raw !== null || row.address_raw !== null || row.latitude_raw !== null || row.postal_code_raw !== null;
}

export function inputFromStoredRow(row: StoredEventLocationRow): LocationInput {
  if (hasRawLocation(row)) {
    return {
      title: row.title,
      location_name: row.location_name_raw,
      address: row.address_raw,
      postal_code: row.postal_code_raw,
      city: row.city_raw,
      bundesland: sourceBundeslandOf(row),
      country: row.country_raw ?? row.country,
      latitude: row.latitude_raw,
      longitude: row.longitude_raw,
      coords_precision: (row.coords_precision_raw as SourceCoordsPrecision | null) ?? null,
      source_venue_id: row.source_venue_id,
      event_id: row.id,
      source_name: row.source_name ?? null,
    };
  }
  const sourceCoords = row.geocoding_confidence === 'scraper';
  return {
    title: row.title,
    location_name: row.location_name,
    address: row.address,
    postal_code: row.postal_code,
    city: null,
    bundesland: sourceBundeslandOf(row),
    country: row.country,
    latitude: sourceCoords ? row.latitude : null,
    longitude: sourceCoords ? row.longitude : null,
    coords_precision: sourceCoords ? 'unknown' : null,
    source_venue_id: row.source_venue_id,
    event_id: row.id,
    source_name: row.source_name ?? null,
  };
}

export interface ReResolveResult {
  id: string;
  decision: ResolvedLocation;
  written: boolean;
  skipped_reason?: 'unchanged' | 'concurrent_update' | 'write_error';
  /** Veröffentlichung wegen Ortskonflikt zurückgehalten bzw. nach Auflösung wieder freigegeben. */
  publish_change?: 'withheld' | 'republished';
}

/** Gründe, die nur von der Ortsentscheidung stammen (A6, Vertrag, Sync). */
const LOCATION_HOLD_REASONS = /^(a6_|location_conflict_withheld$|coords_vs_plz_conflict|.*_vs_plz_conflict|admission:|conflict_position_revoked$)/;

/**
 * Veröffentlichungsregel der Ortsentscheidung (Review §6: Konflikt =
 * zurückhalten), für jeden Pfad, der eine Entscheidung in den Bestand
 * schreibt. Ein Konflikt nimmt der Zeile die Veröffentlichung; ist eine
 * Zeile NUR wegen eines früheren Ortskonflikts zurückgehalten und der
 * Konflikt ist weg, wird sie wieder veröffentlicht. Vorher kannte nur der
 * Backfill-Aufrufer diese Regel; der Adress-Geocoder-Nachtjob schrieb
 * Konflikte, die veröffentlicht blieben (Prod 2026-09-14: 61 Zeilen, dazu
 * 831 aus A6/Stale).
 */
export function publishChangeFor(row: Pick<StoredEventLocationRow, 'publish_status' | 'location_resolution'>, decision: Pick<ResolvedLocation, 'status'>): { publish_status: string } | null {
  const current = row.publish_status ?? null;
  if (decision.status === 'conflict') {
    return current === 'published' || current === 'published_low_confidence' ? { publish_status: 'needs_review' } : null;
  }
  if (current === 'needs_review') {
    const prev = row.location_resolution?.reasons ?? [];
    const heldByLocation = prev.some(r => LOCATION_HOLD_REASONS.test(r));
    if (heldByLocation) return { publish_status: 'published' };
  }
  return null;
}

let regionWarned = false;
function regionOfCoords(lat: number, lng: number): string | null {
  try {
    return bundeslandFromPolygon(lat, lng);
  } catch (e) {
    if (!regionWarned) {
      regionWarned = true;
      console.warn('[re-resolve] Bundesland-Polygone nicht verfügbar, Regions-Gegenprobe entfällt:', e instanceof Error ? e.message : e);
    }
    return null;
  }
}

/**
 * Freigabevertrag auf die Entscheidung anwenden, genau wie im Sync: die
 * ortsbezogenen Prüfungen (Polygon gegen deklariertes Bundesland, PLZ als
 * dritte Stimme, Auslandssignal) laufen gegen die FINALEN Werte. Ohne das
 * schrieb der Backfill eine Position zurück, die der Sync in der nächsten
 * Nacht wieder verwarf (Wiederholbarkeits-Befund Galtür, 2026-09-14).
 */
export function contractedDecision(row: StoredEventLocationRow, decision: ResolvedLocation): ResolvedLocation {
  return contract(row, decision).decision;
}

function contract(row: StoredEventLocationRow, decision: ResolvedLocation): { decision: ResolvedLocation; admission: AdmissionVerdict } {
  const admission = evaluateAdmission(
    {
      title: row.title ?? 'Bestand',
      // Vergangene Termine würden abgewiesen; hier zählt nur der Ortsvertrag.
      start_date: row.start_date && row.start_date > new Date().toISOString() ? row.start_date : '2999-01-01T00:00:00.000Z',
      location_name: decision.location_name,
      address: row.address_raw ?? row.address,
      postal_code: decision.postal_code,
      // Wie im Sync: geprüft wird die Angabe der Quelle, nicht die abgeleitete Spalte.
      bundesland: sourceBundeslandOf(row),
      country: decision.country,
      latitude: decision.latitude,
      longitude: decision.longitude,
    },
    { regionOf: regionOfCoords, plzRegionOf: getBundeslandFromPLZ },
  );
  const c = applyAdmissionToPosition(decision, admission);
  if (c.reasons.length === 0 && c.status === decision.status) return { decision, admission };
  const hasCoords = c.latitude != null && c.longitude != null;
  const precise = c.status === 'venue_confirmed' || c.status === 'address_confirmed';
  const contracted = {
    ...decision,
    status: c.status,
    precision: c.precision,
    latitude: c.latitude,
    longitude: c.longitude,
    geocoding_confidence: c.geocoding_confidence as ResolvedLocation['geocoding_confidence'],
    geocoding_source: c.geocoding_source,
    reasons: [...decision.reasons, ...c.reasons],
    allowed: {
      pin: hasCoords && precise && decision.allowed.pin,
      route: hasCoords && precise && decision.allowed.route,
      distance: hasCoords && precise && decision.allowed.distance,
      municipality_page: decision.allowed.municipality_page && c.status !== 'conflict' && c.status !== 'unresolved',
    },
    ...(c.revoked ? { revoked: c.revoked } : {}),
  } as ResolvedLocation;
  return { decision: contracted, admission };
}

/** Entscheidet die Zeilen neu und schreibt geänderte Entscheidungen zurück. */
export async function reResolveStoredEvents(
  supabase: SupabaseClient,
  rows: StoredEventLocationRow[],
  opts: { dryRun?: boolean; phase: string } ,
): Promise<ReResolveResult[]> {
  const inputs = rows.map(inputFromStoredRow);
  const evidence = await loadLocationEvidence(supabase, inputs);
  const results: ReResolveResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { decision, admission } = contract(row, resolveEventLocation(inputs[i], evidence[i]));
    const publishChange = publishChangeFor(row, decision);
    // Bundesland und Bezirk über dieselben Funktionen wie der Schreibpfad:
    // Quelle (nach Korrektur des Vertrags), sonst Gemeinde bzw. PLZ.
    const bundesland = bundeslandForLocation(admission.correctedBundesland ?? inputs[i].bundesland, decision.gemeinde, decision.postal_code);
    // Altzeilen ohne Rohwerte tragen oft die Amts-PLZ ihrer Gemeinde aus dem
    // früheren Koordinatenabgleich (Boudicca: Stadthalle „Roland-Rainer-Platz
    // 1, 1150 Wien" mit PLZ 1010); die Entscheidung hält sie für eine
    // Quellangabe. Sie zählt wie eine übernommene PLZ.
    const postalCode = decision.postal_code ?? row.postal_code;
    const postalCodeProvenance =
      !hasRawLocation(row) && decision.gemeinde && postalCode === decision.gemeinde.plz
        ? 'registry'
        : decision.postal_code ? decision.provenance.postal_code : null;
    const district = districtForLocation(decision.gemeinde, postalCode, bundesland, row.district, postalCodeProvenance);
    const unchanged =
      (row.bundesland ?? null) === bundesland &&
      (row.district ?? null) === district &&
      row.location_status === decision.status &&
      row.geocoding_confidence === decision.geocoding_confidence &&
      row.latitude === decision.latitude &&
      row.longitude === decision.longitude &&
      row.location_resolution?.input_hash === decision.input_hash;
    if (unchanged && !publishChange) {
      results.push({ id: row.id, decision, written: false, skipped_reason: 'unchanged' });
      continue;
    }
    if (opts.dryRun) {
      results.push({ id: row.id, decision, written: false, ...(publishChange ? { publish_change: publishChange.publish_status === 'needs_review' ? 'withheld' as const : 'republished' as const } : {}) });
      continue;
    }
    if (unchanged && publishChange) {
      // Nur die Veröffentlichung nachziehen, die Entscheidung steht schon so in der Zeile.
      const { error } = await supabase.from('events').update(publishChange).eq('id', row.id);
      results.push({ id: row.id, decision, written: !error, skipped_reason: error ? 'write_error' : undefined, publish_change: publishChange.publish_status === 'needs_review' ? 'withheld' : 'republished' });
      continue;
    }
    const payload = {
      ...(publishChange ?? {}),
      bundesland,
      district,
      latitude: decision.latitude,
      longitude: decision.longitude,
      geocoding_confidence: decision.geocoding_confidence,
      geocoding_source: decision.geocoding_source,
      location_status: decision.status,
      location_status_changed_at: row.location_status === decision.status ? (row.location_status_changed_at ?? null) : new Date().toISOString(),
      location_precision: decision.precision,
      location_resolution: { ...decision, phase: opts.phase },
      location_provenance: decision.provenance,
      ...(decision.venue_id ? { venue_id: decision.venue_id } : {}),
      ...(decision.location_name && !row.location_name ? { location_name: decision.location_name } : {}),
    };
    let q = supabase.from('events').update(payload).eq('id', row.id);
    q = row.updated_at ? q.eq('updated_at', row.updated_at) : q.is('updated_at', null);
    const { data, error } = await q.select('id');
    if (error) {
      console.error(`[re-resolve] ${row.id}: ${error.message}`);
      results.push({ id: row.id, decision, written: false, skipped_reason: 'write_error' });
    } else if (!data || data.length === 0) {
      results.push({ id: row.id, decision, written: false, skipped_reason: 'concurrent_update' });
    } else {
      results.push({ id: row.id, decision, written: true, ...(publishChange ? { publish_change: publishChange.publish_status === 'needs_review' ? 'withheld' as const : 'republished' as const } : {}) });
    }
  }
  return results;
}
