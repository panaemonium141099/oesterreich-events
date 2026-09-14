/**
 * Adress-Geocoder (fn-25 C3): geocodiert EVENTADRESSEN (Straße + Hausnummer
 * + PLZ/Ort) über Nominatim, schreibt Treffer und Nicht-Treffer in
 * `geocode_cache` (Schlüssel `addr:v1:…`) und entscheidet die betroffenen
 * Events über den gemeinsamen Resolver neu.
 *
 * Regeln (Nominatim-Nutzungsbedingungen, Review §5):
 *  - höchstens 1 Anfrage/s, hier 1,2 s Abstand, plus Tagesbudget (`--limit`),
 *  - identifizierender User-Agent mit Kontakt,
 *  - jedes Ergebnis wird gecacht, Nicht-Treffer 30 Tage,
 *  - strukturierte Anfrage (street/postalcode/city), nie der Venue-Name,
 *  - Treffer nur, wenn PLZ (falls geliefert) passt und der Punkt in
 *    Österreich liegt; Trefferebene aus der Antwort (Hausnummer → building,
 *    Straße → street, sonst locality).
 *
 * Reverse-Geocoding oder Namenssuche findet hier nicht statt.
 *
 * Aufruf: npx tsx src/scripts/geocode-addresses.ts [--limit 600] [--dry-run]
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

try {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch { /* ignore */ }

import { createClient } from '@supabase/supabase-js';
import { addressCacheKey } from '../lib/location/evidence';
import { extractCityFromAddress, extractPlzFromAddress, hasHouseNumber } from '../lib/location/conservative-resolution';
import { reResolveStoredEvents, inputFromStoredRow, STORED_LOCATION_COLUMNS, type StoredEventLocationRow } from '../lib/location/re-resolve';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const limitIdx = argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(argv[limitIdx + 1], 10) : 600;
const DELAY_MS = 1200;
const USER_AGENT = 'lasstreffen.at Adress-Geocoder (kontakt@lasstreffen.at)';
const AT_BOX = { latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 };
const NEGATIVE_TTL_DAYS = 30;

interface NominatimHit {
  lat: string;
  lon: string;
  osm_type?: string;
  osm_id?: number;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: { house_number?: string; road?: string; postcode?: string; town?: string; village?: string; city?: string; municipality?: string };
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function precisionOf(hit: NominatimHit, wantedNumber: string | null): 'building' | 'street' | 'locality' {
  const hn = hit.address?.house_number ?? null;
  if (hn && wantedNumber && hn.toLowerCase().replace(/\s/g, '') === wantedNumber.toLowerCase().replace(/\s/g, '')) return 'building';
  if (hn && !wantedNumber) return 'building';
  if (hit.class === 'highway' || hit.addresstype === 'road' || hit.address?.road) return 'street';
  return 'locality';
}

async function geocode(street: string, plz: string | null, city: string | null): Promise<NominatimHit | null> {
  const params = new URLSearchParams({ street, format: 'jsonv2', addressdetails: '1', limit: '1', countrycodes: 'at' });
  if (plz) params.set('postalcode', plz);
  if (city) params.set('city', city);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' },
  });
  if (res.status === 429 || res.status === 403) throw new Error(`nominatim ${res.status}`);
  if (!res.ok) return null;
  const arr = (await res.json()) as NominatimHit[];
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen'); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Kandidaten: künftige Events mit Hausnummer, aber ohne belegte Position.
  const candidates: StoredEventLocationRow[] = [];
  const PAGE = 500;
  // Alle Kandidaten einlesen (nicht nur die nächsten Termine): die
  // Reihenfolge der Abfragen richtet sich nach der Zahl der Events je
  // Adresse, damit das Tagesbudget zuerst die Spielstätten mit den meisten
  // Terminen trifft (Eventim: 989 Adressen tragen 6.812 Events, Stand
  // 2026-09-14). Vorher ging es nach Datum, also viele Einzeltermine zuerst.
  for (let from = 0; from < 60000; from += PAGE) {
    const { data, error } = await supabase
      .from('events')
      .select(STORED_LOCATION_COLUMNS)
      .gte('start_date', new Date().toISOString())
      .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
      .eq('country', 'AT')
      .or('location_status.in.(municipality_only,unresolved,region_only),location_status.is.null')
      .not('address', 'is', null)
      .order('start_date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('Kandidaten:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const r of data as unknown as StoredEventLocationRow[]) {
      const input = inputFromStoredRow(r);
      if (!hasHouseNumber(input.address)) continue;
      if (input.latitude != null && (input.coords_precision === 'venue' || input.coords_precision === 'address')) continue;
      candidates.push(r);
    }
    if (data.length < PAGE) break;
  }
  console.log(`[geocode-addresses] ${candidates.length} Kandidaten mit Hausnummer (Budget ${LIMIT})`);

  // Cache-Schlüssel je Kandidat; bereits bekannte Schlüssel überspringen.
  const byKey = new Map<string, StoredEventLocationRow[]>();
  for (const r of candidates) {
    const k = addressCacheKey(inputFromStoredRow(r));
    if (!k) continue;
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }
  const keys = [...byKey.keys()];
  const known = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const slice = keys.slice(i, i + 200);
    const { data } = await supabase.from('geocode_cache').select('query, status, expires_at').in('query', slice);
    for (const row of data ?? []) {
      const r = row as { query: string; status: string | null; expires_at: string | null };
      if ((r.status ?? 'ok') === 'ok') known.add(r.query);
      else if (r.expires_at && r.expires_at > new Date().toISOString()) known.add(r.query);
    }
  }
  const todo = keys
    .filter(k => !known.has(k))
    .sort((a, b) => (byKey.get(b)?.length ?? 0) - (byKey.get(a)?.length ?? 0))
    .slice(0, LIMIT);
  const todoEvents = todo.reduce((n, k) => n + (byKey.get(k)?.length ?? 0), 0);
  console.log(`[geocode-addresses] ${keys.length} Adressen, ${known.size} im Cache, ${todo.length} werden abgefragt (${todoEvents} Events, nach Eventzahl je Adresse)`);

  let ok = 0, none = 0, errors = 0;
  const touched: StoredEventLocationRow[] = [];
  for (const k of keys.filter(kk => known.has(kk))) touched.push(...(byKey.get(k) ?? []));

  for (const k of todo) {
    const sample = byKey.get(k)![0];
    const input = inputFromStoredRow(sample);
    const street = input.address!.split(',')[0]!.trim();
    const plz = input.postal_code?.trim() || extractPlzFromAddress(input.address);
    const city = input.city?.trim() || extractCityFromAddress(input.address);
    const numberMatch = /\s(\d{1,4}[a-zA-Z]?)(?:\s*[-/]\s*\d{1,4}[a-zA-Z]?)?(?=[\s,;]|$)/.exec(street);
    const wantedNumber = numberMatch ? numberMatch[1] : null;
    let row: Record<string, unknown>;
    try {
      const hit = await geocode(street, plz, city);
      const lat = hit ? parseFloat(hit.lat) : NaN;
      const lng = hit ? parseFloat(hit.lon) : NaN;
      const plzOk = !hit?.address?.postcode || !plz || hit.address.postcode === plz;
      const inAt = Number.isFinite(lat) && Number.isFinite(lng) && lat >= AT_BOX.latMin && lat <= AT_BOX.latMax && lng >= AT_BOX.lngMin && lng <= AT_BOX.lngMax;
      if (hit && plzOk && inAt) {
        const precision = precisionOf(hit, wantedNumber);
        row = { query: k, latitude: lat, longitude: lng, status: 'ok', precision, provider: 'nominatim', expires_at: null,
          raw: { osm_type: hit.osm_type, osm_id: hit.osm_id, class: hit.class, type: hit.type, addresstype: hit.addresstype, address: hit.address }, cached_at: new Date().toISOString() };
        ok++;
      } else {
        row = { query: k, latitude: null, longitude: null, status: 'none', precision: null, provider: 'nominatim',
          expires_at: new Date(Date.now() + NEGATIVE_TTL_DAYS * 86400000).toISOString(),
          raw: hit ? { rejected: !plzOk ? 'postcode_mismatch' : 'outside_at', got_postcode: hit.address?.postcode } : null, cached_at: new Date().toISOString() };
        none++;
      }
    } catch (e) {
      errors++;
      console.error(`[geocode-addresses] ${k}: ${e instanceof Error ? e.message : e}`);
      if (String(e).includes('429') || String(e).includes('403')) { console.error('Rate-Limit: Abbruch'); break; }
      await sleep(DELAY_MS);
      continue;
    }
    if (!DRY_RUN) {
      const { error } = await supabase.from('geocode_cache').upsert(row, { onConflict: 'query' });
      if (error) console.error(`[geocode-addresses] cache ${k}: ${error.message}`);
    } else {
      console.log('DRY', k, row.status, row.precision, row.latitude, row.longitude);
    }
    if (row.status === 'ok') touched.push(...(byKey.get(k) ?? []));
    await sleep(DELAY_MS);
  }
  console.log(`[geocode-addresses] Abfragen: ${ok} Treffer, ${none} ohne Treffer, ${errors} Fehler`);

  // Betroffene Events neu entscheiden (Cache-Treffer alt und neu).
  let written = 0, unchanged = 0, concurrent = 0;
  for (let i = 0; i < touched.length; i += 100) {
    const results = await reResolveStoredEvents(supabase, touched.slice(i, i + 100), { dryRun: DRY_RUN, phase: 'geocode-addresses' });
    for (const r of results) {
      if (r.written) written++;
      else if (r.skipped_reason === 'unchanged') unchanged++;
      else if (r.skipped_reason === 'concurrent_update') concurrent++;
    }
  }
  console.log(`[geocode-addresses] Events neu entschieden: ${written} geschrieben, ${unchanged} unverändert, ${concurrent} parallel geändert`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
