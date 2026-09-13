/**
 * Belegquellen für die Ortsentscheidung (fn-25 C3), batchweise aus der DB.
 *
 * Der Resolver selbst ist rein; dieses Modul holt je Batch die Belege, die
 * er bewerten darf:
 *  - `source_venue_map`: bestätigte Zuordnung einer Quellen-Venue-Kennung
 *    zu Position/Venue (gepflegt in Phase D/E, manuell oder aus geprüften
 *    Feed-Venues).
 *  - `venues` + `venue_aliases`: Kandidatenbestand (OSM/Registry). Ein
 *    Kandidat gilt nur mit zweitem Beleg (Straße, Quellkoordinate, Alias).
 *  - `geocode_cache` (Schlüssel `addr:v1:…`): geocodierte Eventadressen aus
 *    dem Nachtjob `geocode-addresses.ts`. Im Schreibpfad wird NIE live
 *    geocodiert.
 *
 * PostgREST-Regeln: `.in()`-Listen ≤ 200 Elemente.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationInput } from './conservative-resolution';
import { extractPlzFromAddress, extractCityFromAddress } from './conservative-resolution';
import { normalizeGemeindeName } from './gemeinde-index';
import type { LocationEvidence, VenueCandidateEvidence, AddressGeocodeEvidence, SourceVenueMapEvidence } from './resolver';

const CHUNK = 200;
const NEARBY_M = 300;

/** Venue-Namen für den Vergleich: klein, Leerraum gefaltet, Diakritika weg. */
export function foldVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[„“"'`´’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Straßenname ohne Hausnummer und Zusätze, gefaltet. */
export function streetKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const first = address.split(',')[0] ?? '';
  const m = /^(.*?[A-Za-zÄÖÜäöüß.])\s+\d{1,4}[a-zA-Z]?(\s*[-/]\s*\d{1,4}[a-zA-Z]?)?(?=[\s,;]|$)/.exec(first.trim());
  const street = (m ? m[1] : first).trim();
  if (street.length < 4) return null;
  return foldVenueName(street).replace(/\bstr\.?$/, 'strasse').replace(/strasse$/, 'str');
}

/** Cache-Schlüssel einer Eventadresse (nur mit Hausnummer sinnvoll). */
export function addressCacheKey(input: LocationInput): string | null {
  if (!input.address) return null;
  const plz = input.postal_code?.trim() || extractPlzFromAddress(input.address);
  const city = input.city?.trim() || extractCityFromAddress(input.address);
  const street = input.address.split(',')[0]?.trim();
  if (!street || !/\d/.test(street)) return null;
  if (!plz && !city) return null;
  return `addr:v1:${foldVenueName(street)}|${plz ?? ''}|${city ? normalizeGemeindeName(city) : ''}`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface VenueRow {
  id: string;
  name: string;
  name_normalized: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function inChunks<T>(values: string[], fn: (slice: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += CHUNK) out.push(...(await fn(values.slice(i, i + CHUNK))));
  return out;
}

/**
 * Lädt je Eingabe (Index) die Belege. Fehler einer Quelle führen zu „kein
 * Beleg", nie zu einem Abbruch des Schreibpfads.
 */
export async function loadLocationEvidence(
  supabase: SupabaseClient,
  inputs: LocationInput[],
): Promise<LocationEvidence[]> {
  const out: LocationEvidence[] = inputs.map(() => ({}));

  // ── source_venue_map ────────────────────────────────────────────────
  const svids = [...new Set(inputs.map(i => i.source_venue_id?.trim()).filter((v): v is string => !!v))];
  if (svids.length > 0) {
    try {
      const rows = await inChunks(svids, async slice => {
        const { data, error } = await supabase
          .from('source_venue_map')
          .select('source_venue_id, venue_id, latitude, longitude, precision, confirmed_by, valid_from, valid_to')
          .in('source_venue_id', slice);
        if (error) throw error;
        return (data ?? []) as Array<{ source_venue_id: string; venue_id: string | null; latitude: number; longitude: number; precision: string; confirmed_by: string; valid_from: string | null; valid_to: string | null }>;
      });
      const nowIso = new Date().toISOString();
      const byId = new Map<string, SourceVenueMapEvidence>();
      for (const r of rows) {
        if (r.valid_from && r.valid_from > nowIso) continue;
        if (r.valid_to && r.valid_to < nowIso) continue;
        byId.set(r.source_venue_id, {
          venue_id: r.venue_id,
          latitude: r.latitude,
          longitude: r.longitude,
          precision: (r.precision as SourceVenueMapEvidence['precision']) ?? 'building',
          confirmed_by: r.confirmed_by,
        });
      }
      inputs.forEach((inp, i) => {
        const hit = inp.source_venue_id ? byId.get(inp.source_venue_id.trim()) : undefined;
        if (hit) out[i].sourceVenueMap = hit;
      });
    } catch (e) {
      console.warn('[location-evidence] source_venue_map:', e instanceof Error ? e.message : e);
    }
  }

  // ── Venue-Kandidaten ────────────────────────────────────────────────
  const nameKeys = new Map<string, number[]>();
  inputs.forEach((inp, i) => {
    if (!inp.location_name || (inp.country ?? 'AT').toUpperCase() !== 'AT') return;
    const key = inp.location_name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key.length < 3) return;
    const list = nameKeys.get(key) ?? [];
    list.push(i);
    nameKeys.set(key, list);
  });
  if (nameKeys.size > 0) {
    try {
      const names = [...nameKeys.keys()];
      const venueRows = await inChunks(names, async slice => {
        const { data, error } = await supabase
          .from('venues')
          .select('id, name, name_normalized, address, postal_code, city, latitude, longitude')
          .in('name_normalized', slice)
          .not('latitude', 'is', null);
        if (error) throw error;
        return (data ?? []) as VenueRow[];
      });
      const aliasRows = await inChunks(names, async slice => {
        const { data, error } = await supabase
          .from('venue_aliases')
          .select('alias_normalized, confidence, venues(id, name, name_normalized, address, postal_code, city, latitude, longitude)')
          .in('alias_normalized', slice);
        if (error) throw error;
        return (data ?? []) as Array<{ alias_normalized: string; confidence: number | null; venues: VenueRow | VenueRow[] | null }>;
      });

      const byName = new Map<string, Array<{ row: VenueRow; viaAlias: boolean }>>();
      for (const r of venueRows) {
        const key = (r.name_normalized ?? r.name.toLowerCase()).replace(/\s+/g, ' ').trim();
        const list = byName.get(key) ?? [];
        list.push({ row: r, viaAlias: false });
        byName.set(key, list);
      }
      for (const a of aliasRows) {
        if ((a.confidence ?? 1) < 0.9) continue;
        const v = Array.isArray(a.venues) ? a.venues[0] : a.venues;
        if (!v || v.latitude == null || v.longitude == null) continue;
        const list = byName.get(a.alias_normalized) ?? [];
        list.push({ row: v, viaAlias: true });
        byName.set(a.alias_normalized, list);
      }

      for (const [key, idxs] of nameKeys) {
        const cands = byName.get(key);
        if (!cands || cands.length === 0) continue;
        for (const i of idxs) {
          const inp = inputs[i];
          const plz = inp.postal_code?.trim() || extractPlzFromAddress(inp.address);
          const city = inp.city?.trim() || extractCityFromAddress(inp.address);
          const cityKey = city ? normalizeGemeindeName(city) : null;
          const street = streetKey(inp.address);
          const scored: VenueCandidateEvidence[] = [];
          for (const { row, viaAlias } of cands) {
            const samePlz = !!plz && row.postal_code === plz;
            const sameCity = !!cityKey && !!row.city && normalizeGemeindeName(row.city) === cityKey;
            if (!samePlz && !sameCity) continue;
            const matched: VenueCandidateEvidence['matched_by'] = [];
            if (street && row.address && streetKey(row.address) === street) matched.push('street');
            if (
              typeof inp.latitude === 'number' && typeof inp.longitude === 'number' &&
              haversineM(inp.latitude, inp.longitude, row.latitude!, row.longitude!) <= NEARBY_M
            ) matched.push('source_coords');
            if (viaAlias) matched.push('alias');
            scored.push({
              venue_id: row.id,
              name: row.name,
              latitude: row.latitude!,
              longitude: row.longitude!,
              postal_code: row.postal_code,
              city: row.city,
              matched_by: matched,
            });
          }
          const withEvidence = scored.filter(c => c.matched_by.length > 0);
          if (withEvidence.length === 1) out[i].venueCandidate = withEvidence[0];
          else if (withEvidence.length === 0 && scored.length === 1) out[i].venueCandidate = scored[0]; // Name+Ort, ohne zweiten Beleg → Resolver protokolliert nur
          // mehrere belegte Kandidaten: Mehrdeutigkeit, kein Beleg
        }
      }
    } catch (e) {
      console.warn('[location-evidence] venues:', e instanceof Error ? e.message : e);
    }
  }

  // ── Adress-Geocoding aus dem Cache ──────────────────────────────────
  const keyByIdx = new Map<number, string>();
  inputs.forEach((inp, i) => {
    if ((inp.country ?? 'AT').toUpperCase() !== 'AT') return;
    const k = addressCacheKey(inp);
    if (k) keyByIdx.set(i, k);
  });
  if (keyByIdx.size > 0) {
    try {
      const keys = [...new Set(keyByIdx.values())];
      const rows = await inChunks(keys, async slice => {
        const { data, error } = await supabase
          .from('geocode_cache')
          .select('query, latitude, longitude, status, precision, provider')
          .in('query', slice);
        if (error) throw error;
        return (data ?? []) as Array<{ query: string; latitude: number | null; longitude: number | null; status: string | null; precision: string | null; provider: string | null }>;
      });
      const byKey = new Map<string, AddressGeocodeEvidence>();
      for (const r of rows) {
        if ((r.status ?? 'ok') !== 'ok' || r.latitude == null || r.longitude == null) continue;
        const precision = r.precision === 'building' || r.precision === 'street' || r.precision === 'locality' ? r.precision : 'street';
        byKey.set(r.query, { latitude: r.latitude, longitude: r.longitude, precision, provider: r.provider ?? 'nominatim', cache_key: r.query });
      }
      for (const [i, k] of keyByIdx) {
        const hit = byKey.get(k);
        if (hit) out[i].addressGeocode = hit;
      }
    } catch (e) {
      console.warn('[location-evidence] geocode_cache:', e instanceof Error ? e.message : e);
    }
  }

  return out;
}
