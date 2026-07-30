/**
 * fn-18.7 — Freizeit-/Ausflugs-POIs aus OpenStreetMap nach `osm_pois`.
 *
 *   npm run import-osm-pois                    # fetch (mit Disk-Cache) + Upsert
 *   npm run import-osm-pois -- --fetch-only    # nur Overpass -> data/osm-pois-cache
 *   npm run import-osm-pois -- --skip-fetch    # nur Cache -> DB
 *   npm run import-osm-pois -- --region Tirol --key leisure
 *   npm run import-osm-pois -- --dry-run       # transformiert + reportet, schreibt nichts
 *
 * ── Warum Overpass und nicht Geofabrik/osmium ──────────────────────────────
 * Der Epic-Plan nannte `austria-latest.osm.pbf` + `osmium tags-filter` als
 * bevorzugten Weg und Overpass-batched als Fallback. Entscheidung nach
 * Probelauf: OVERPASS-BATCHED.
 *   * osmium ist eine native Toolchain (libosmium/C++) — auf der Windows-
 *     Dev-Maschine dieses Projekts nicht verfuegbar und im CI ein
 *     zusaetzlicher Build-/Install-Schritt plus ~1,5 GB PBF-Download pro Lauf.
 *   * Die kuratierte Whitelist trifft in ganz Oesterreich eine Groessenordnung
 *     von ~10^5 Objekten (per `out count` verprobt, s. Task-Doku) — das ist
 *     fuer Overpass in 9 Bundesland-BBoxen x 7 Tag-Familien voellig
 *     unproblematisch, wenn man die Fair-Use-Delays einhaelt.
 *   * Der Disk-Cache macht den Lauf resumierbar: abgebrochene Laeufe holen
 *     nur die fehlenden (Region, Familie)-Paare nach.
 * Muster/Vorlage: src/scripts/fetch-overpass-all-venues.ts (Venue-Import).
 *
 * ── ODbL ───────────────────────────────────────────────────────────────────
 * Daten (c) OpenStreetMap contributors, ODbL 1.0. Dieses Script schreibt
 * AUSSCHLIESSLICH nach `osm_pois` und liest NIE poi_activities/venues —
 * es gibt keinen Merge-/Dedup-/Join-Schreibpfad zwischen den Bestaenden
 * (Begruendung im Header von supabase/migrations/20260727090000_osm_pois.sql).
 *
 * ── Betriebs-Lehren aus fn-18.2 (uebernommen) ──────────────────────────────
 *   * Write-Batches <= 500 Rows (Supabase Micro, MASTERPLAN §10).
 *   * Es gibt hier bewusst KEINE .in()-Filter (Upsert braucht keinen
 *     Prefetch) — die 200er-Chunk-Regel fuer PostgREST-Query-String-Filter
 *     kann also gar nicht verletzt werden.
 *   * Alle NOT-NULL-Spalten sind im Upsert-Payload gefuehrt (poi-transform.ts).
 *   * Dauerhafte vs. transiente Fehler: HTTP 429/504 + Netz-Timeouts werden
 *     mit Backoff und Endpoint-Rotation wiederholt; HTTP 401/403/406 ist
 *     dauerhaft (der Mirror bedient uns generell nicht) und nimmt den
 *     Endpoint sofort und ohne Backoff aus der Rotation. Eine (Region,
 *     Familie), die alle Versuche verbraucht, wird als FAILED gezaehlt und
 *     laesst den Lauf weiterlaufen (der Cache sorgt dafuer, dass ein Re-Run
 *     genau diese Luecke nachholt).
 *
 * ── Verprobt (2026-07-27) — Reproduzierbarkeit ─────────────────────────────
 * A) Mengengeruest per Overpass `out count` ueber area(3600016239) = Oesterreich,
 *    benannte Objekte der Whitelist:
 *        leisure + sport                  19.770  (105 s)
 *        tourism + attraction + historic  21.188  (126 s)
 *        natural + amenity              ~26.300  (aus 40.293 abzueglich der
 *                                        ~14.000 route-Relationen, die NICHT
 *                                        Teil der finalen Whitelist sind)
 *    -> Groessenordnung ~67.000 AT-POIs vor Mehrfach-Tagging-Ueberschneidung,
 *       d. h. die Whitelist traegt das Volumen-Ziel des Tasks (>= 50.000).
 * B) Echter Lauf `npx tsx src/scripts/import-osm-pois.ts --region Burgenland
 *    --dry-run` (5 von 7 Familien erfolgreich, natural/amenity liefen in
 *    Overpass-504/429 und blieben fuer den Re-Run offen):
 *        5.643 Roh-Elemente -> 5.062 eindeutige POIs, ~13 min inkl. Backoffs
 *        Skips: no-name 0, not-whitelisted 0, no-coords 0,
 *               no-gemeinde-match 398 (Ungarn/Slowakei im BBox-Ueberhang)
 *    Der Vollauf (9 Regionen x 7 Familien) laeuft entsprechend mehrere
 *    Stunden Wall-Clock — deshalb Disk-Cache + Resume statt Cron.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { osmKeys, overpassClauseFor, type OsmKey } from '@/lib/osm/poi-whitelist';
import {
  dedupeOsmRows,
  transformOsmPoi,
  type OsmPoiRow,
  type OsmSkipReason,
  type OverpassPoiElement,
} from '@/lib/osm/poi-transform';

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const CACHE_DIR = join(process.cwd(), 'data', 'osm-pois-cache');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  // Nur als letzter Fallback: openstreetmap.fr antwortet fuer nicht
  // gewhitelistete Clients mit 403 (im Probelauf 2026-07-27 reproduziert)
  // und wird dann fuer den restlichen Lauf deaktiviert (s. disableEndpoint).
  'https://overpass.openstreetmap.fr/api/interpreter',
];

/**
 * Dauerhafte vs. transiente Quell-Fehler (Betriebs-Lehre fn-18.2):
 *   transient  = 429/504/Netz-Timeout -> warten, spaeter derselbe Endpoint ok
 *   dauerhaft  = 401/403/406 -> dieser Endpoint nimmt uns generell nicht
 *                (openstreetmap.fr: "only available to white-listed usages").
 * Dauerhafte Fehler duerfen keine Backoff-Minuten verbrennen: der Endpoint
 * fliegt fuer den Rest des Laufs raus und der naechste uebernimmt sofort.
 */
const disabledEndpoints = new Set<number>();
let endpointIdx = 0;

function overpassUrl(): string {
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const idx = (endpointIdx + i) % OVERPASS_ENDPOINTS.length;
    if (!disabledEndpoints.has(idx)) {
      endpointIdx = idx;
      return OVERPASS_ENDPOINTS[idx];
    }
  }
  throw new Error('Alle Overpass-Endpoints sind dauerhaft abgelehnt (401/403/406) — Lauf abgebrochen.');
}

/** Endpoint dauerhaft aus der Rotation nehmen und zum naechsten springen. */
function disableEndpoint(url: string): void {
  const idx = OVERPASS_ENDPOINTS.indexOf(url);
  if (idx >= 0) disabledEndpoints.add(idx);
  endpointIdx++;
}

const REGION_DELAY_MS = 18_000; // Overpass Fair-Use zwischen schweren Laeufen
const FAMILY_DELAY_MS = 8_000;
const QUERY_TIMEOUT_S = 300;
const FETCH_TIMEOUT_MS = 360_000;
const FETCH_RETRIES = 4;

/** Write-Batch fuer Supabase Micro (MASTERPLAN §10) — nie groesser. */
const WRITE_BATCH = 500;

interface Region {
  name: string;
  /** Overpass-BBox-Reihenfolge: south,west,north,east */
  bbox: string;
}

/** Identische BBoxen wie fetch-overpass-all-venues.ts (bewaehrt, ueberlappen
 *  an den Raendern — Doppel-Treffer faengt dedupeOsmRows ab). */
const REGIONS: Region[] = [
  { name: 'Burgenland', bbox: '46.83,16.00,48.12,17.17' },
  { name: 'Vorarlberg', bbox: '46.84,9.52,47.59,10.24' },
  { name: 'Kaernten', bbox: '46.37,12.65,47.13,15.05' },
  { name: 'Salzburg', bbox: '46.95,12.05,48.05,14.00' },
  { name: 'Tirol', bbox: '46.65,10.10,47.75,12.97' },
  { name: 'Steiermark', bbox: '46.60,13.55,47.83,16.17' },
  { name: 'Oberoesterreich', bbox: '47.46,13.00,48.77,14.99' },
  { name: 'Niederoesterreich', bbox: '47.40,14.45,49.02,17.07' },
  { name: 'Wien', bbox: '48.10,16.18,48.33,16.58' },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildQuery(key: OsmKey, bbox: string): string {
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];
(
  ${overpassClauseFor(key)}(${bbox});
);
out center tags;`;
}

async function slotWaitSeconds(): Promise<number> {
  try {
    const statusUrl = overpassUrl().replace('/interpreter', '/status');
    const res = await fetch(statusUrl, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    const slot = text.match(/Slot available after:.*?(\d+) seconds/);
    if (slot) return parseInt(slot[1], 10) + 5;
    return 0;
  } catch {
    return 0;
  }
}

async function fetchFamily(key: OsmKey, region: Region): Promise<OverpassPoiElement[]> {
  const query = buildQuery(key, region.bbox);
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const wait = await slotWaitSeconds();
    if (wait > 0) {
      console.log(`    [${region.name}/${key}] Slot belegt, warte ${wait}s…`);
      await sleep(wait * 1000);
    }
    const url = overpassUrl();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'OesterreichEventsBot/1.0 (+https://lasstreffen.at; leisure-poi-import; contact via website)',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      // Dauerhaft: dieser Endpoint bedient uns generell nicht -> sofort raus
      // aus der Rotation, ohne Backoff (sonst frisst ein 403-Mirror bei jeder
      // Familie mehrere Minuten Wartezeit).
      if (res.status === 401 || res.status === 403 || res.status === 406) {
        const detail = await res.text().catch(() => '');
        console.log(
          `    [${region.name}/${key}] HTTP ${res.status} von ${new URL(url).hostname} — Endpoint dauerhaft deaktiviert: ${detail.slice(0, 120)}`,
        );
        disableEndpoint(url);
        // Kein verbrauchter Versuch: der naechste Endpoint hat die volle
        // Retry-Budget-Chance. Terminiert garantiert — jeder Durchlauf
        // deaktiviert einen Endpoint, danach wirft overpassUrl().
        attempt--;
        continue;
      }

      // Transient: Rate-Limit / Gateway-Timeout -> warten + Endpoint rotieren.
      if (res.status === 429 || res.status === 504) {
        const retryAfter = res.headers.get('Retry-After');
        const waitSec = retryAfter ? parseInt(retryAfter, 10) + 5 : attempt * 60;
        console.log(
          `    [${region.name}/${key}] HTTP ${res.status} (${new URL(url).hostname}), retry in ${waitSec}s (${attempt}/${FETCH_RETRIES})`,
        );
        if (attempt >= 2) endpointIdx++;
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }

      const data = (await res.json()) as { elements?: OverpassPoiElement[] };
      return data.elements ?? [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    [${region.name}/${key}] ${msg}`);
      if (attempt === FETCH_RETRIES) throw err;
      if (attempt >= 2) endpointIdx++;
      const waitSec = attempt * 45;
      console.log(`    Retry in ${waitSec}s…`);
      await sleep(waitSec * 1000);
    }
  }
  return [];
}

// ─── CACHE ──────────────────────────────────────────────────────────────────

const cachePath = (region: Region, key: OsmKey): string =>
  join(CACHE_DIR, `${region.name.toLowerCase()}__${key}.json`);

function readCache(region: Region, key: OsmKey): OverpassPoiElement[] | null {
  const p = cachePath(region, key);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as OverpassPoiElement[];
  } catch {
    return null;
  }
}

function writeCache(region: Region, key: OsmKey, elements: OverpassPoiElement[]): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(region, key), JSON.stringify(elements));
}

// ─── DB ─────────────────────────────────────────────────────────────────────

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL) und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Upsert in 500er-Batches auf (osm_type, osm_id). Reine Idempotenz: derselbe
 * Lauf zweimal ergibt denselben Bestand. Kein Prune — OSM-Objekte
 * verschwinden praktisch nie, und ein Loesch-Pfad auf Basis eines evtl.
 * unvollstaendigen Laufs waere gefaehrlicher als eine veraltete Row.
 */
async function upsertRows(supabase: SupabaseClient, rows: OsmPoiRow[]): Promise<number> {
  let written = 0;
  const batches = chunk(rows, WRITE_BATCH);
  for (let i = 0; i < batches.length; i++) {
    const payload = batches[i].map((r) => ({ ...r, updated_at: r.last_seen_at }));
    const { error } = await supabase
      .from('osm_pois')
      .upsert(payload, { onConflict: 'osm_type,osm_id' });
    if (error) {
      throw new Error(`Upsert-Batch ${i + 1}/${batches.length} fehlgeschlagen: ${error.message}`);
    }
    written += payload.length;
    if ((i + 1) % 20 === 0 || i === batches.length - 1) {
      console.log(`  Upsert ${written}/${rows.length}`);
    }
  }
  return written;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

interface Opts {
  region?: string;
  key?: string;
  fetchOnly: boolean;
  skipFetch: boolean;
  skipCache: boolean;
  dryRun: boolean;
  limit?: number;
}

async function run(opts: Opts): Promise<void> {
  const regions = opts.region
    ? REGIONS.filter((r) => r.name.toLowerCase() === opts.region!.toLowerCase())
    : REGIONS;
  const keys = opts.key
    ? osmKeys().filter((k) => k === opts.key)
    : osmKeys();

  if (!regions.length) {
    console.error(`Keine Region "${opts.region}". Verfuegbar: ${REGIONS.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }
  if (!keys.length) {
    console.error(`Kein Tag-Key "${opts.key}". Verfuegbar: ${osmKeys().join(', ')}`);
    process.exit(1);
  }

  const seenAtIso = new Date().toISOString();
  const totalQueries = regions.length * keys.length;
  console.log(
    `OSM-POI-Import: ${regions.length} Regionen x ${keys.length} Tag-Familien = ${totalQueries} Overpass-Queries`,
  );
  console.log(`Cache: ${CACHE_DIR}\n`);

  const elements: OverpassPoiElement[] = [];
  const failures: string[] = [];
  let queryNo = 0;

  for (const region of regions) {
    console.log(`=== ${region.name} (${region.bbox}) ===`);
    for (const key of keys) {
      queryNo++;
      const tag = `[${queryNo}/${totalQueries}] ${region.name}/${key}`;

      if (!opts.skipCache) {
        const cached = readCache(region, key);
        if (cached) {
          console.log(`  ${tag}: ${cached.length} (Cache)`);
          elements.push(...cached);
          continue;
        }
      }
      if (opts.skipFetch) {
        console.log(`  ${tag}: kein Cache, --skip-fetch -> uebersprungen`);
        continue;
      }

      try {
        const start = Date.now();
        const fetched = await fetchFamily(key, region);
        console.log(
          `  ${tag}: ${fetched.length} Elemente (${((Date.now() - start) / 1000).toFixed(1)}s)`,
        );
        writeCache(region, key, fetched);
        elements.push(...fetched);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ${tag}: FEHLGESCHLAGEN — ${msg}`);
        failures.push(`${region.name}/${key}`);
      }

      if (key !== keys[keys.length - 1]) await sleep(FAMILY_DELAY_MS);
    }
    if (region !== regions[regions.length - 1]) {
      console.log(`  Pause ${REGION_DELAY_MS / 1000}s vor der naechsten Region…\n`);
      await sleep(REGION_DELAY_MS);
    }
  }

  console.log(`\n=== TRANSFORM ===`);
  console.log(`Overpass-Elemente (roh, mit Ueberlappungen): ${elements.length}`);

  const skips: Record<OsmSkipReason, number> = {
    'no-name': 0,
    'not-whitelisted': 0,
    'no-coords': 0,
    'no-gemeinde-match': 0,
  };
  const rows: OsmPoiRow[] = [];
  for (const el of elements) {
    const result = transformOsmPoi(el, seenAtIso);
    if (result.ok) rows.push(result.row);
    else skips[result.reason]++;
  }

  let unique = dedupeOsmRows(rows);
  if (opts.limit && opts.limit > 0) unique = unique.slice(0, opts.limit);

  const perBundesland = new Map<string, number>();
  const perCategory = new Map<string, number>();
  for (const r of unique) {
    perBundesland.set(r.bundesland, (perBundesland.get(r.bundesland) ?? 0) + 1);
    perCategory.set(r.category, (perCategory.get(r.category) ?? 0) + 1);
  }

  console.log(`Uebersprungen: ${Object.entries(skips).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`Eindeutige POIs: ${unique.length}`);
  console.log(`\nPro Bundesland:`);
  for (const [bl, n] of [...perBundesland].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bl}: ${n}`);
  }
  console.log(`\nPro Kategorie:`);
  for (const [cat, n] of [...perCategory].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}`);
  }
  if (failures.length) {
    console.log(`\nFehlgeschlagene Queries (Re-Run holt sie per Cache-Luecke nach): ${failures.join(', ')}`);
  }

  if (opts.fetchOnly) {
    console.log(`\n--fetch-only: kein DB-Write.`);
    return;
  }
  if (opts.dryRun) {
    console.log(`\n--dry-run: kein DB-Write.`);
    return;
  }
  if (!unique.length) {
    console.log(`\nNichts zu schreiben.`);
    return;
  }

  console.log(`\n=== UPSERT (Batches a ${WRITE_BATCH}) ===`);
  const supabase = createServiceClient();
  const start = Date.now();
  const written = await upsertRows(supabase, unique);
  console.log(
    `\nFertig: ${written} Rows nach osm_pois (${((Date.now() - start) / 1000 / 60).toFixed(1)} min).`,
  );
  console.log(
    `OPS-SCHRITT: Index-Migration 20260727091000_osm_pois_indexes.sql anwenden, danach "ANALYZE public.osm_pois;" im Dashboard.`,
  );
}

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  const limitRaw = get('--limit');
  return {
    region: get('--region'),
    key: get('--key'),
    fetchOnly: args.includes('--fetch-only'),
    skipFetch: args.includes('--skip-fetch'),
    skipCache: args.includes('--skip-cache'),
    dryRun: args.includes('--dry-run'),
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
  };
}

run(parseArgs())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
