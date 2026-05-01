/**
 * fix-duplicate-coords.ts — verifizierte Master-Koordinaten pro
 * (location_name, postal_code) Cluster ermitteln und in
 * `location_master_coords` schreiben.
 *
 * Hintergrund: Audit (siehe data/classifier-audit/duplicate-locations-*) zeigt
 * ~2.000 Ortsnamen mit unterschiedlichen Geocodes für identische Live-Events.
 * Der DB-Trigger `trg_apply_master_coords` zieht aus dieser Tabelle die
 * verifizierte Koord und überschreibt jeden zukünftigen Insert/Update auf
 * `events`.
 *
 * Lookup-Kette:
 *   1) KNOWN_VENUES (in-memory)
 *   2) venues + venue_aliases (DB)
 *   3) geocode_cache (DB)
 *   4) GeoNames AT (in-memory via location-normalizer)
 *   5) Nominatim (Netzwerk, 1 req/s) — mit "Name, PLZ, City, Austria"
 *   6) OpenAI (Netzwerk, 200 ms) — Fallback
 *
 * Validierung pro Treffer:
 *   - In Austria-Bbox
 *   - Sanity: ≤ 100 km Entfernung zum existierenden Cluster-Schwerpunkt
 *     ⇒ confidence='verified'. ≤ 200 km ⇒ 'review'. Sonst verworfen.
 *
 * Usage:
 *   npx tsx src/scripts/fix-duplicate-coords.ts --dry-run --limit=20
 *   npx tsx src/scripts/fix-duplicate-coords.ts --dry-run
 *   npx tsx src/scripts/fix-duplicate-coords.ts            # Vollausführung
 *   npx tsx src/scripts/fix-duplicate-coords.ts --skip-openai
 *   npx tsx src/scripts/fix-duplicate-coords.ts --review-only  # nur Review-Liste schreiben
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// .env.local laden (Next.js macht das, tsx nicht)
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

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { normalizeString, normalizeEventLocation } from '../lib/location-normalizer';
import { KNOWN_VENUES } from '../lib/known-venues';
import { matchPlaceName } from '../lib/utils/place-match';

const AUSTRIA_BBOX = { minLat: 46.3, maxLat: 49.1, minLng: 9.5, maxLng: 17.2 };
const NOMINATIM_DELAY_MS = 1100;
const OPENAI_DELAY_MS = 200;

type Confidence = 'verified' | 'review';
interface Master {
  lat: number;
  lng: number;
  source: string; // 'known_venues' | 'venues' | 'geocode_cache' | 'geonames' | 'nominatim' | 'openai'
  confidence: Confidence;
}
interface ClusterCoord { lat: number; lng: number; count: number }
interface Cluster {
  location_name: string;
  postal_code: string | null;
  city: string | null;
  bundesland: string | null;
  event_count: number;
  coord_groups: number;
  existing_coords: ClusterCoord[];
  centroid: { lat: number; lng: number } | null;
}

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const SKIP_OPENAI = argv.includes('--skip-openai');
const SKIP_NOMINATIM = argv.includes('--skip-nominatim');
const REVIEW_ONLY = argv.includes('--review-only');
// --pipeline-mode: wird im scrape-pipeline.ts genutzt. Überspringt bereits aufgelöste
// (location_name, postal_code) Tupel und macht am Ende einen Bulk-Apply auf events.
// Idempotent + schnell wenn nichts neu ist (~Sekunden).
const PIPELINE_MODE = argv.includes('--pipeline-mode');
const limitArg = argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function inAustria(lat: number, lng: number): boolean {
  return lat >= AUSTRIA_BBOX.minLat && lat <= AUSTRIA_BBOX.maxLat
      && lng >= AUSTRIA_BBOX.minLng && lng <= AUSTRIA_BBOX.maxLng;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function classifyResult(master: { lat: number; lng: number }, cluster: Cluster): Confidence | 'reject' {
  if (!inAustria(master.lat, master.lng)) return 'reject';
  if (cluster.existing_coords.length === 0) return 'verified';
  const closest = Math.min(...cluster.existing_coords.map(c => haversineKm({ lat: master.lat, lng: master.lng }, { lat: c.lat, lng: c.lng })));
  if (closest <= 100) return 'verified';
  if (closest <= 200) return 'review';
  return 'reject';
}

// ─── Cluster fetch ──────────────────────────────────────────────────────────

async function fetchExistingMasterKeys(supabase: SupabaseClient): Promise<Set<string>> {
  // Holt alle bereits resolved (location_name, postal_code) Tupel als Set für schnellen Lookup.
  // Wird beim Pipeline-Run genutzt um bereits aufgelöste Cluster zu überspringen.
  const keys = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('location_master_coords')
      .select('location_name, postal_code, confidence')
      .eq('confidence', 'verified')
      .range(from, from + PAGE - 1);
    if (error) { console.warn('[fetch-master-keys]', error.message); break; }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const norm = normalizeString((r as any).location_name || '');
      keys.add(`${norm}|${(r as any).postal_code ?? ''}`);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return keys;
}

async function fetchClusters(supabase: SupabaseClient, skipKeys?: Set<string>): Promise<Cluster[]> {
  // PostgREST kann kein GROUP BY mit HAVING — daher: alle live Events ziehen und
  // clientseitig gruppieren. Bei ~60-80k Events trivial.
  const events: Array<{ location_name: string; postal_code: string | null; bundesland: string | null; latitude: number; longitude: number; address: string | null }> = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data: page, error: pageErr } = await supabase
      .from('events')
      .select('location_name, postal_code, bundesland, latitude, longitude, address, duplicate_of, publish_status, start_date')
      .gte('start_date', new Date().toISOString())
      .is('duplicate_of', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('location_name', 'is', null)
      .range(from, from + PAGE - 1);
    if (pageErr) { console.error('fetch events:', pageErr.message); process.exit(1); }
    if (!page || page.length === 0) break;
    for (const r of page) {
      if (!r.location_name || !r.location_name.trim()) continue;
      if (r.publish_status && !['published', 'public'].includes(r.publish_status)) continue;
      events.push({
        location_name: r.location_name.trim(),
        postal_code: r.postal_code || null,
        bundesland: r.bundesland || null,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        address: r.address || null,
      });
    }
    if (page.length < PAGE) break;
    from += PAGE;
  }

  console.log(`[clusters] Fetched ${events.length} live events`);

  // Group by (location_name) erst, dann nach (location_name, postal_code).
  // Wir behandeln jede (name, plz) Kombi als eigenen Cluster, aber nur wenn
  // der NAME insgesamt mehrere Coord-Gruppen hat (sonst gibt's nichts zu fixen).
  const byName = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byName.get(e.location_name) ?? [];
    arr.push(e);
    byName.set(e.location_name, arr);
  }

  function coordGroups(arr: typeof events): number {
    const set = new Set<string>();
    for (const e of arr) set.add(`${e.latitude.toFixed(3)},${e.longitude.toFixed(3)}`);
    return set.size;
  }

  const clusters: Cluster[] = [];
  for (const [name, arr] of byName) {
    if (coordGroups(arr) <= 1) continue; // nicht betroffen

    // Pro (name, postal_code, bundesland) Sub-Cluster
    const subKey = (e: typeof events[0]) => `${e.postal_code ?? ''}|${e.bundesland ?? ''}`;
    const sub = new Map<string, typeof events>();
    for (const e of arr) {
      const k = subKey(e);
      const list = sub.get(k) ?? [];
      list.push(e);
      sub.set(k, list);
    }

    for (const [, subArr] of sub) {
      const sampleEarly = subArr[0];
      // Skip-Filter (Pipeline-Mode): wenn (norm_name, plz) schon einen verifizierten
      // Master hat, überspringe — der Trigger kümmert sich darum.
      if (skipKeys) {
        const skipKey = `${normalizeString(name)}|${sampleEarly.postal_code ?? ''}`;
        if (skipKeys.has(skipKey)) continue;
      }

      // Coord-Häufung pro Sub-Cluster
      const coordCount = new Map<string, ClusterCoord>();
      for (const e of subArr) {
        const k = `${e.latitude.toFixed(3)},${e.longitude.toFixed(3)}`;
        const existing = coordCount.get(k);
        if (existing) existing.count++;
        else coordCount.set(k, { lat: e.latitude, lng: e.longitude, count: 1 });
      }
      const existing_coords = Array.from(coordCount.values()).sort((a, b) => b.count - a.count);
      const centroid = existing_coords.length === 0 ? null : {
        lat: existing_coords.reduce((s, c) => s + c.lat * c.count, 0) / subArr.length,
        lng: existing_coords.reduce((s, c) => s + c.lng * c.count, 0) / subArr.length,
      };

      const sample = subArr[0];
      clusters.push({
        location_name: name,
        postal_code: sample.postal_code,
        city: extractCityFromAddress(sample.address) ?? null,
        bundesland: sample.bundesland,
        event_count: subArr.length,
        coord_groups: existing_coords.length,
        existing_coords,
        centroid,
      });
    }
  }

  // Nach event_count sortieren (große Cluster zuerst → höchster Impact)
  clusters.sort((a, b) => b.event_count - a.event_count);
  return clusters;
}

function extractCityFromAddress(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  // Letztes Token, mit potenziellem PLZ-Prefix, das wir abstreifen
  const last = parts[parts.length - 1];
  if (!last) return null;
  return last.replace(/^\d{4,5}\s+/, '').trim() || null;
}

// ─── Resolver-Pipeline ──────────────────────────────────────────────────────

let venuesCache: Array<{ name_normalized: string | null; name: string; postal_code: string | null; city: string | null; latitude: number | null; longitude: number | null }> | null = null;
async function loadVenues(supabase: SupabaseClient): Promise<typeof venuesCache> {
  if (venuesCache) return venuesCache;
  const { data, error } = await supabase
    .from('venues')
    .select('name, name_normalized, postal_code, city, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (error) { console.warn('loadVenues:', error.message); venuesCache = []; return venuesCache; }
  venuesCache = (data ?? []) as NonNullable<typeof venuesCache>;
  return venuesCache;
}

function tryKnownVenues(name: string): Master | null {
  for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
    if (matchPlaceName(name, key)) {
      return { lat: coords.latitude, lng: coords.longitude, source: 'known_venues', confidence: 'verified' };
    }
  }
  return null;
}

function tryVenuesTable(name: string, plz: string | null, city: string | null): Master | null {
  if (!venuesCache) return null;
  const norm = normalizeString(name);
  for (const v of venuesCache) {
    if (!v.latitude || !v.longitude) continue;
    const vNorm = (v.name_normalized || normalizeString(v.name)).toLowerCase();
    if (vNorm !== norm) continue;
    // PLZ oder city muss matchen, sonst zu unsicher
    if (plz && v.postal_code && plz === v.postal_code) {
      return { lat: v.latitude, lng: v.longitude, source: 'venues', confidence: 'verified' };
    }
    if (city && v.city && city.toLowerCase() === v.city.toLowerCase()) {
      return { lat: v.latitude, lng: v.longitude, source: 'venues', confidence: 'verified' };
    }
  }
  return null;
}

async function tryGeocodeCache(supabase: SupabaseClient, name: string, plz: string | null, city: string | null): Promise<Master | null> {
  const norm = normalizeString(name);
  // Mehrere Cache-Key-Varianten, die andere Skripte schreiben
  const keys: string[] = [];
  if (plz) keys.push(`${name.toLowerCase().trim()}, ${plz}||Austria`);
  if (city) keys.push(`${name.toLowerCase().trim()}, ${city}||Austria`);
  keys.push(`${name.toLowerCase().trim()}||Austria`);
  keys.push(`gemini::${norm}||${(plz || '')}`);
  for (const k of keys) {
    const { data } = await supabase.from('geocode_cache').select('latitude, longitude').eq('query', k).maybeSingle();
    if (data && data.latitude && data.longitude) {
      return { lat: data.latitude as number, lng: data.longitude as number, source: 'geocode_cache', confidence: 'verified' };
    }
  }
  return null;
}

function tryGeoNames(name: string, plz: string | null, bundesland: string | null): Master | null {
  // Wir lassen den existierenden normalizer arbeiten — der nutzt GeoNames AT.
  // Achtung: extractCityFromVenueName fällt auf Stadt zurück, nicht auf Venue-Adresse.
  // Für Stadtnamen ist das ideal; für spezifische Venues meist Treffer = Venue-Stadt-Centroid.
  const result = normalizeEventLocation({
    location_name: name,
    postal_code: plz || undefined,
    bundesland: bundesland || undefined,
  });
  if (!result) return null;
  if (result.confidence === 'none') return null;
  return { lat: result.latitude, lng: result.longitude, source: 'geonames', confidence: 'verified' };
}

let lastNominatimAt = 0;
async function tryNominatim(name: string, plz: string | null, city: string | null): Promise<Master | null> {
  if (SKIP_NOMINATIM) return null;
  const wait = Math.max(0, lastNominatimAt + NOMINATIM_DELAY_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();

  const parts = [name];
  if (plz) parts.push(plz);
  if (city) parts.push(city);
  parts.push('Austria');
  const q = parts.join(', ');
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=at&addressdetails=0`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'AustriaEvents-FixCoords/1.0' } });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const r = arr[0];
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const placeRank = r.place_rank ?? 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (placeRank < 16) return null; // Stadt/Dorf-Ebene oder genauer
    if (!inAustria(lat, lng)) return null;
    return { lat, lng, source: 'nominatim', confidence: 'verified' };
  } catch (e) {
    return null;
  }
}

let openai: any = null;
let lastOpenaiAt = 0;
async function tryOpenAI(name: string, plz: string | null, city: string | null, bundesland: string | null): Promise<Master | null> {
  if (SKIP_OPENAI) return null;
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) {
    const OpenAIMod = (await import('openai')).default;
    openai = new OpenAIMod({ apiKey: process.env.OPENAI_API_KEY });
  }
  const wait = Math.max(0, lastOpenaiAt + OPENAI_DELAY_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastOpenaiAt = Date.now();

  const ctx = [
    `Location: "${name}"`,
    plz ? `Postal code: ${plz}` : '',
    city ? `City: ${city}` : '',
    bundesland ? `Bundesland: ${bundesland}` : '',
    'Country: Austria',
  ].filter(Boolean).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a precise geocoder for Austrian locations. Return JSON only: {"lat":number,"lng":number,"confidence":"high|medium|low"}. Use WGS-84 decimal degrees. If you cannot resolve with confidence, return low confidence with the bundesland centroid.' },
        { role: 'user', content: ctx },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const txt = completion.choices?.[0]?.message?.content;
    if (!txt) return null;
    const obj = JSON.parse(txt);
    const lat = Number(obj.lat);
    const lng = Number(obj.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!inAustria(lat, lng)) return null;
    if (obj.confidence === 'low') return null;
    return { lat, lng, source: 'openai', confidence: 'verified' };
  } catch (e) {
    return null;
  }
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function resolveMaster(supabase: SupabaseClient, cluster: Cluster): Promise<Master | null> {
  const { location_name: name, postal_code: plz, city, bundesland } = cluster;
  const reviewCandidates: Master[] = [];

  const tryFns: Array<() => Promise<Master | null> | Master | null> = [
    () => tryKnownVenues(name),
    () => tryVenuesTable(name, plz, city),
    () => tryGeocodeCache(supabase, name, plz, city),
    () => tryGeoNames(name, plz, bundesland),
    () => tryNominatim(name, plz, city),
    () => tryOpenAI(name, plz, city, bundesland),
  ];

  for (const fn of tryFns) {
    const m = await fn();
    if (!m) continue;
    const verdict = classifyResult(m, cluster);
    if (verdict === 'verified') return m;
    if (verdict === 'review') reviewCandidates.push({ ...m, confidence: 'review' });
  }

  // Wenn keine 'verified' Quelle: nimm den ersten Review-Kandidat
  return reviewCandidates[0] ?? null;
}

// ─── Persist ───────────────────────────────────────────────────────────────

async function upsertMaster(supabase: SupabaseClient, cluster: Cluster, master: Master): Promise<void> {
  const norm = normalizeString(cluster.location_name);
  const plz = cluster.postal_code;

  // Manuelles Upsert (ON CONFLICT mit COALESCE-Expression-Index ist über PostgREST nicht
  // direkt ansprechbar). NULL postal_code muss mit `.is(...)` abgefragt werden.
  let q = supabase
    .from('location_master_coords')
    .select('id')
    .eq('location_name_normalized', norm);
  q = plz === null ? q.is('postal_code', null) : q.eq('postal_code', plz);
  const { data: existing, error: selErr } = await q.maybeSingle();
  if (selErr) console.warn('[upsert] select:', selErr.message);

  const row = {
    location_name: cluster.location_name,
    location_name_normalized: norm,
    postal_code: cluster.postal_code,
    city: cluster.city,
    bundesland: cluster.bundesland,
    latitude: master.lat,
    longitude: master.lng,
    source: master.source,
    confidence: master.confidence,
    source_event_count: cluster.event_count,
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error } = await supabase.from('location_master_coords').update(row).eq('id', existing.id);
    if (error) console.warn('[upsert] update:', error.message);
  } else {
    const { error } = await supabase.from('location_master_coords').insert(row);
    if (error) console.warn('[upsert] insert:', error.message);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function applyMastersToEvents(supabase: SupabaseClient): Promise<{ touched: number }> {
  // Bulk-Apply: setze events.lat/lng aus location_master_coords für alle live events,
  // deren (location_name, postal_code) einen verifizierten Master hat. Idempotent.
  // Trigger feuert wegen UPDATE auf lat/lng. Date-Range-Chunks halten den
  // RPC-Aufruf unter dem statement_timeout. RPC: public.apply_master_coords_bulk.
  let touched = 0;
  for (const range of [{ from: 0, to: 180 }, { from: 180, to: 1825 }]) {
    const { data, error } = await supabase.rpc('apply_master_coords_bulk', {
      days_from: range.from,
      days_to: range.to,
    });
    if (error) {
      console.warn(`[apply-masters] range ${range.from}-${range.to}d: ${error.message}`);
      continue;
    }
    const n = typeof data === 'number' ? data : (Array.isArray(data) && data[0]?.count) || 0;
    touched += n;
    console.log(`[apply-masters] range ${range.from}-${range.to}d: ${n} events updated`);
  }
  return { touched };
}

async function main() {
  const supabase = getSupabase();

  console.log(`[fix-coords] Starting${DRY_RUN ? ' (DRY RUN)' : ''}${PIPELINE_MODE ? ' [PIPELINE-MODE]' : ''}, limit=${LIMIT === Infinity ? 'all' : LIMIT}`);
  console.log(`[fix-coords] Loading venues cache…`);
  await loadVenues(supabase);
  console.log(`[fix-coords] Loaded ${venuesCache?.length ?? 0} venues`);

  let skipKeys: Set<string> | undefined;
  if (PIPELINE_MODE) {
    console.log(`[fix-coords] Loading existing master keys (pipeline-mode skip filter)…`);
    skipKeys = await fetchExistingMasterKeys(supabase);
    console.log(`[fix-coords] ${skipKeys.size} (name, plz) tuples already resolved — will skip`);
  }

  console.log(`[fix-coords] Fetching event clusters…`);
  const clusters = await fetchClusters(supabase, skipKeys);
  console.log(`[fix-coords] ${clusters.length} new (name, plz, bundesland) clusters with multiple coords, total ${clusters.reduce((s, c) => s + c.event_count, 0)} events`);

  const todo = clusters.slice(0, LIMIT);
  let stats = { verified: 0, review: 0, unresolved: 0, bySource: new Map<string, number>() };
  const reviewLog: any[] = [];
  const unresolvedLog: any[] = [];
  const verifiedLog: any[] = [];

  let i = 0;
  for (const c of todo) {
    i++;
    const master = await resolveMaster(supabase, c);
    if (!master) {
      stats.unresolved++;
      unresolvedLog.push({ ...c, existing_coords: c.existing_coords.length });
      if (i % 25 === 0 || i === todo.length) console.log(`[${i}/${todo.length}] ${c.location_name} (${c.postal_code ?? '-'}) → UNRESOLVED`);
      continue;
    }
    stats.bySource.set(master.source, (stats.bySource.get(master.source) ?? 0) + 1);
    if (master.confidence === 'verified') stats.verified++;
    else stats.review++;

    const logRow = {
      name: c.location_name,
      plz: c.postal_code,
      bundesland: c.bundesland,
      event_count: c.event_count,
      coord_groups: c.coord_groups,
      master_lat: master.lat,
      master_lng: master.lng,
      source: master.source,
      confidence: master.confidence,
    };
    if (master.confidence === 'review') reviewLog.push(logRow);
    else verifiedLog.push(logRow);

    if (i % 25 === 0 || i === todo.length) {
      console.log(`[${i}/${todo.length}] ${c.location_name} (${c.postal_code ?? '-'}) → ${master.lat.toFixed(4)},${master.lng.toFixed(4)} [${master.source}/${master.confidence}]`);
    }

    if (!DRY_RUN && !REVIEW_ONLY) {
      await upsertMaster(supabase, c, master);
    }
  }

  // Logs schreiben
  const logDir = join(process.cwd(), 'data', 'classifier-audit');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, 'master-coords-verified.json'), JSON.stringify(verifiedLog, null, 2));
  writeFileSync(join(logDir, 'master-coords-review.json'), JSON.stringify(reviewLog, null, 2));
  writeFileSync(join(logDir, 'master-coords-unresolved.json'), JSON.stringify(unresolvedLog, null, 2));

  console.log(`\n=== Resolution ===`);
  console.log(`verified=${stats.verified} review=${stats.review} unresolved=${stats.unresolved}`);
  console.log(`by source:`);
  for (const [src, n] of [...stats.bySource].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${n}`);
  }
  console.log(`\nLogs: data/classifier-audit/master-coords-{verified,review,unresolved}.json`);

  // Final-Phase: events.lat/lng aus master_coords anwenden (Bulk-Update). Idempotent.
  // Wichtig im Pipeline-Mode für frische Events, aber auch sinnvoll bei manuellen Runs.
  if (!DRY_RUN && !REVIEW_ONLY) {
    console.log(`\n=== Apply masters to events (bulk) ===`);
    try {
      const { touched } = await applyMastersToEvents(supabase);
      console.log(`Total events updated: ${touched}`);
    } catch (e: any) {
      console.warn(`[apply-masters] failed: ${e?.message ?? e}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
