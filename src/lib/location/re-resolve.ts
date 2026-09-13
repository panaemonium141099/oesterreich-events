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
import type { SourceCoordsPrecision } from './types';

export interface StoredEventLocationRow {
  id: string;
  title: string | null;
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
  latitude: number | null;
  longitude: number | null;
  latitude_raw: number | null;
  longitude_raw: number | null;
  coords_precision_raw: string | null;
  source_venue_id: string | null;
  geocoding_confidence: string | null;
  location_status: string | null;
  location_resolution: { input_hash?: string } | null;
  updated_at: string | null;
}

export const STORED_LOCATION_COLUMNS =
  'id, title, location_name, location_name_raw, address, address_raw, postal_code, postal_code_raw, city_raw, ' +
  'country, country_raw, bundesland, latitude, longitude, latitude_raw, longitude_raw, coords_precision_raw, ' +
  'source_venue_id, geocoding_confidence, location_status, location_resolution, updated_at';

/**
 * Eingabe aus der Zeile. Rohspalten haben Vorrang; fehlen sie (Zeile seit
 * der Umstellung nicht neu geschrieben), gelten die Anzeigespalten als
 * Quellwert, Koordinaten aber nur, wenn sie von der Quelle stammen
 * (`geocoding_confidence = 'scraper'`), und dann mit unbekannter
 * Genauigkeit.
 */
export function inputFromStoredRow(row: StoredEventLocationRow): LocationInput {
  const hasRaw = row.location_name_raw !== null || row.address_raw !== null || row.latitude_raw !== null || row.postal_code_raw !== null;
  if (hasRaw) {
    return {
      title: row.title,
      location_name: row.location_name_raw,
      address: row.address_raw,
      postal_code: row.postal_code_raw,
      city: row.city_raw,
      bundesland: row.bundesland,
      country: row.country_raw ?? row.country,
      latitude: row.latitude_raw,
      longitude: row.longitude_raw,
      coords_precision: (row.coords_precision_raw as SourceCoordsPrecision | null) ?? null,
      source_venue_id: row.source_venue_id,
    };
  }
  const sourceCoords = row.geocoding_confidence === 'scraper';
  return {
    title: row.title,
    location_name: row.location_name,
    address: row.address,
    postal_code: row.postal_code,
    city: null,
    bundesland: row.bundesland,
    country: row.country,
    latitude: sourceCoords ? row.latitude : null,
    longitude: sourceCoords ? row.longitude : null,
    coords_precision: sourceCoords ? 'unknown' : null,
    source_venue_id: row.source_venue_id,
  };
}

export interface ReResolveResult {
  id: string;
  decision: ResolvedLocation;
  written: boolean;
  skipped_reason?: 'unchanged' | 'concurrent_update' | 'write_error';
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
    const decision = resolveEventLocation(inputs[i], evidence[i]);
    const unchanged =
      row.location_status === decision.status &&
      row.latitude === decision.latitude &&
      row.longitude === decision.longitude &&
      row.location_resolution?.input_hash === decision.input_hash;
    if (unchanged) {
      results.push({ id: row.id, decision, written: false, skipped_reason: 'unchanged' });
      continue;
    }
    if (opts.dryRun) {
      results.push({ id: row.id, decision, written: false });
      continue;
    }
    const payload = {
      latitude: decision.latitude,
      longitude: decision.longitude,
      geocoding_confidence: decision.geocoding_confidence,
      geocoding_source: decision.geocoding_source,
      location_status: decision.status,
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
      results.push({ id: row.id, decision, written: true });
    }
  }
  return results;
}
