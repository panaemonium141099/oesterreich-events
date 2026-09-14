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
 *  - `event_location_corrections` (Scope event): manuelle Korrekturen mit
 *    Gültigkeit; der Resolver prüft, ob sie noch zum Quellenstand passen.
 *
 * PostgREST-Regeln: `.in()`-Listen ≤ 200 Elemente.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationInput } from './conservative-resolution';
import { extractPlzFromAddress, extractCityFromAddress } from './conservative-resolution';
import { normalizeGemeindeName } from './gemeinde-index';
import type { LocationEvidence, VenueCandidateEvidence, AddressGeocodeEvidence, SourceVenueMapEvidence, CorrectionEvidence } from './resolver';
import { venueMapKey } from './venue-key';
import type { LocationPrecision } from './types';

const CHUNK = 200;
const NEARBY_M = 300;
/** Toleranz für Uhrenabweichung zwischen DB (`valid_from default now()`) und
 *  Aufrufer: eine soeben gespeicherte Bestätigung gilt sofort. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

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

export interface VenueRow {
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

export interface VenueCandidateRow {
  row: VenueRow;
  viaAlias: boolean;
}

/**
 * Wählt aus namensgleichen Kandidaten den EINEN mit zweitem Beleg (Straße,
 * Quellkoordinate ≤ 300 m, Alias) im Ortskontext (PLZ oder Ort). Mehrere
 * belegte Kandidaten → Mehrdeutigkeit, kein Ergebnis. Genau ein Kandidat
 * ohne zweiten Beleg wird zurückgegeben, aber mit leerem `matched_by` — der
 * Resolver protokolliert ihn nur. Reihenfolge, Name allein oder Anzahl
 * entscheiden nie (Review §4/§9).
 */
export function selectVenueCandidate(inp: LocationInput, cands: VenueCandidateRow[]): VenueCandidateEvidence | null {
  const plz = inp.postal_code?.trim() || extractPlzFromAddress(inp.address);
  const city = inp.city?.trim() || extractCityFromAddress(inp.address);
  const cityKey = city ? normalizeGemeindeName(city) : null;
  const street = streetKey(inp.address);
  const scored: VenueCandidateEvidence[] = [];
  for (const { row, viaAlias } of cands) {
    if (row.latitude == null || row.longitude == null) continue;
    const samePlz = !!plz && row.postal_code === plz;
    const sameCity = !!cityKey && !!row.city && normalizeGemeindeName(row.city) === cityKey;
    if (!samePlz && !sameCity) continue;
    const matched: VenueCandidateEvidence['matched_by'] = [];
    if (street && row.address && streetKey(row.address) === street) matched.push('street');
    if (
      typeof inp.latitude === 'number' && typeof inp.longitude === 'number' &&
      haversineM(inp.latitude, inp.longitude, row.latitude, row.longitude) <= NEARBY_M
    ) matched.push('source_coords');
    if (viaAlias) matched.push('alias');
    scored.push({ venue_id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude, postal_code: row.postal_code, city: row.city, matched_by: matched });
  }
  const withEvidence = scored.filter(c => c.matched_by.length > 0);
  if (withEvidence.length === 1) return withEvidence[0];
  if (withEvidence.length === 0 && scored.length === 1) return scored[0];
  return null;
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
  let failures = 0;

  // ── source_venue_map ────────────────────────────────────────────────
  // Schlüssel je Eingabe: Quellen-Venue-Kennung des Feeds, sonst der
  // Namensschlüssel (Quelle + Name + PLZ/Ort) für Admin-Bestätigungen.
  const mapKeyOf = (i: LocationInput): string | null => i.source_venue_id?.trim() || venueMapKey(i);
  const svids = [...new Set(inputs.map(mapKeyOf).filter((v): v is string => !!v))];
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
      const notBefore = new Date(Date.now() + CLOCK_SKEW_MS).toISOString();
      const byId = new Map<string, SourceVenueMapEvidence>();
      for (const r of rows) {
        if (r.valid_from && r.valid_from > notBefore) continue;
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
        const key = mapKeyOf(inp);
        const hit = key ? byId.get(key) : undefined;
        if (hit) out[i].sourceVenueMap = hit;
      });
    } catch (e) {
      failures++;
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
          const pick = selectVenueCandidate(inputs[i], cands);
          if (pick) out[i].venueCandidate = pick;
        }
      }
    } catch (e) {
      failures++;
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
      failures++;
      console.warn('[location-evidence] geocode_cache:', e instanceof Error ? e.message : e);
    }
  }

  // ── Manuelle Korrekturen (Scope event) ──────────────────────────────
  const eventIds = [...new Set(inputs.map(i => i.event_id?.trim()).filter((v): v is string => !!v))];
  if (eventIds.length > 0) {
    try {
      const rows = await inChunks(eventIds, async slice => {
        const { data, error } = await supabase
          .from('event_location_corrections')
          .select('id, scope_id, before, after, corrected_by, valid_from, valid_to, created_at')
          .eq('scope', 'event')
          .in('scope_id', slice);
        if (error) throw error;
        return (data ?? []) as CorrectionRow[];
      });
      const byEvent = pickCorrections(rows, new Date());
      inputs.forEach((inp, i) => {
        out[i].correctionsLoaded = true;
        const hit = inp.event_id ? byEvent.get(inp.event_id.trim()) : undefined;
        if (hit) out[i].correction = hit;
      });
    } catch (e) {
      failures++;
      console.warn('[location-evidence] event_location_corrections:', e instanceof Error ? e.message : e);
    }
  } else {
    // Ohne bestehende Zeilen gibt es nichts zu laden; die Tabelle gilt als gelesen.
    for (const o of out) o.correctionsLoaded = true;
  }

  for (const o of out) o.complete = failures === 0;
  return out;
}

export interface CorrectionRow {
  id: string;
  scope_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  corrected_by: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string | null;
}

const PRECISIONS = new Set<LocationPrecision>(['entrance', 'building', 'site', 'street', 'locality', 'municipality', 'postcode', 'region', 'unknown']);

/**
 * Je Event die jüngste zum Zeitpunkt gültige Korrektur mit Position. Rein,
 * damit Gültigkeit und Auswahl testbar sind.
 */
export function pickCorrections(rows: CorrectionRow[], now: Date): Map<string, CorrectionEvidence> {
  const nowIso = now.toISOString();
  const notBefore = new Date(now.getTime() + CLOCK_SKEW_MS).toISOString();
  const best = new Map<string, { row: CorrectionRow; ev: CorrectionEvidence }>();
  for (const r of rows) {
    if (r.valid_from && r.valid_from > notBefore) continue;
    if (r.valid_to && r.valid_to <= nowIso) continue;
    const after = r.after ?? {};
    const lat = typeof after.latitude === 'number' ? after.latitude : null;
    const lng = typeof after.longitude === 'number' ? after.longitude : null;
    if (lat == null || lng == null) continue;
    const precision = PRECISIONS.has(after.precision as LocationPrecision) ? (after.precision as LocationPrecision) : 'building';
    const basis = r.before && typeof r.before.location_basis_hash === 'string' ? (r.before.location_basis_hash as string) : null;
    const ev: CorrectionEvidence = {
      id: r.id,
      latitude: lat,
      longitude: lng,
      precision,
      venue_id: typeof after.venue_id === 'string' && after.venue_id ? after.venue_id : null,
      location_name: typeof after.location_name === 'string' && after.location_name.trim() ? after.location_name.trim() : null,
      postal_code: typeof after.postal_code === 'string' && /^\d{4}$/.test(after.postal_code) ? after.postal_code : null,
      basis_hash: basis,
      corrected_by: r.corrected_by,
    };
    const prev = best.get(r.scope_id);
    const stamp = r.valid_from ?? r.created_at ?? '';
    const prevStamp = prev ? (prev.row.valid_from ?? prev.row.created_at ?? '') : '';
    if (!prev || stamp >= prevStamp) best.set(r.scope_id, { row: r, ev });
  }
  return new Map([...best.entries()].map(([k, v]) => [k, v.ev]));
}
