/**
 * Fetch ALL Austrian named POIs from OpenStreetMap via Overpass API.
 *
 * Goal: build the most comprehensive venue dataset possible. We query every
 * tag family that could plausibly host or be associated with events:
 *
 *   amenity   — restaurants, cafes, theatres, cinemas, libraries, schools,
 *               community centres, places of worship, casinos, etc.
 *   leisure   — sports centres, stadiums, arenas, dance halls, marinas,
 *               escape rooms, hackerspaces, parks, etc.
 *   tourism   — museums, galleries, hotels, hostels, attractions, zoos,
 *               viewpoints, alpine huts, wine cellars, picnic sites, etc.
 *   shop      — record stores, bookshops, wine shops, art galleries, etc.
 *   sport     — explicit sport=* tags on facilities
 *   office    — NGOs, associations, foundations, cultural offices
 *   club      — sport clubs, social clubs, music clubs, hobby clubs
 *   historic  — castles, monasteries, monuments, archaeological sites
 *   craft     — workshops with named studios (potter, brewery, etc.)
 *   healthcare — clinics, sometimes host info events
 *   building  — buildings with explicit type tags (church, stadium, etc.)
 *
 * Strategy:
 *   - Iterate the 9 Bundesland bounding boxes
 *   - Per region, run multiple smaller queries grouped by tag family
 *   - Each element MUST have a `name` tag (otherwise unusable as a venue)
 *   - Use `out center tags` to get coordinates for ways/relations
 *   - Cache each (region, family) result to disk so re-runs skip completed work
 *   - Consolidate to data/overpass-venues.json
 *
 * Run:
 *   npx tsx src/scripts/fetch-overpass-all-venues.ts
 *   npx tsx src/scripts/fetch-overpass-all-venues.ts --region Burgenland
 *   npx tsx src/scripts/fetch-overpass-all-venues.ts --family tourism
 *   npx tsx src/scripts/fetch-overpass-all-venues.ts --skip-cache
 *
 * ODbL: Data (c) OpenStreetMap contributors, ODbL 1.0
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { OverpassElement, OverpassResponse } from './lib/osm-venue-utils';

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const OUT_DIR = join(process.cwd(), 'data', 'overpass-cache');
const CONSOLIDATED_OUT = join(process.cwd(), 'data', 'overpass-venues.json');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
let endpointIdx = 0;
const overpassUrl = (): string => OVERPASS_ENDPOINTS[endpointIdx % OVERPASS_ENDPOINTS.length];

/** Per-region polite delay (Overpass fair-use ≥ 15s between heavy queries). */
const REGION_DELAY_MS = 18_000;
/** Per-family delay within a region (lighter — same instance, smaller queries). */
const FAMILY_DELAY_MS = 8_000;
/** Per-query timeout (sent to Overpass via `[timeout:N]`). */
const QUERY_TIMEOUT_S = 240;
/** Fetch timeout (slightly more than QUERY_TIMEOUT_S to allow for transit). */
const FETCH_TIMEOUT_MS = 300_000;

// ─── BUNDESLAND BBOXES ──────────────────────────────────────────────────────

interface Region {
  name: string;
  /** Overpass bbox order: south,west,north,east */
  bbox: string;
  /** Heavy regions need finer family splits. */
  heavy?: boolean;
}

const REGIONS: Region[] = [
  { name: 'Burgenland', bbox: '46.83,16.00,48.12,17.17' },
  { name: 'Vorarlberg', bbox: '46.84,9.52,47.59,10.24' },
  { name: 'Kaernten', bbox: '46.37,12.65,47.13,15.05' },
  { name: 'Salzburg', bbox: '46.95,12.05,48.05,14.00' },
  { name: 'Tirol', bbox: '46.65,10.10,47.75,12.97' },
  { name: 'Steiermark', bbox: '46.60,13.55,47.83,16.17', heavy: true },
  { name: 'Oberoesterreich', bbox: '47.46,13.00,48.77,14.99', heavy: true },
  { name: 'Niederoesterreich', bbox: '47.40,14.45,49.02,17.07', heavy: true },
  { name: 'Wien', bbox: '48.10,16.18,48.33,16.58' },
];

// ─── TAG FAMILIES ───────────────────────────────────────────────────────────

interface Family {
  name: string;
  /** OQL fragment(s). Each fragment must be a complete `nwr[...]` clause
   *  WITHOUT the trailing bbox or `;`. The runner adds those. */
  clauses: string[];
  /** True = always split this family into its own query (even on light regions). */
  heavyOnly?: boolean;
}

const FAMILIES: Family[] = [
  {
    name: 'amenity',
    clauses: [
      'nwr["name"]["amenity"]',
    ],
  },
  {
    name: 'leisure',
    clauses: [
      'nwr["name"]["leisure"]',
    ],
  },
  {
    name: 'tourism',
    clauses: [
      'nwr["name"]["tourism"]',
    ],
  },
  {
    name: 'shop',
    clauses: [
      'nwr["name"]["shop"]',
    ],
  },
  {
    name: 'sport',
    clauses: [
      // Pure sport=* — many overlap with leisure but some standalone facilities
      'nwr["name"]["sport"]',
    ],
  },
  {
    name: 'office',
    clauses: [
      'nwr["name"]["office"]',
    ],
  },
  {
    name: 'club',
    clauses: [
      'nwr["name"]["club"]',
    ],
  },
  {
    name: 'historic',
    clauses: [
      'nwr["name"]["historic"]',
    ],
  },
  {
    name: 'craft',
    clauses: [
      'nwr["name"]["craft"]',
    ],
  },
  {
    name: 'healthcare',
    clauses: [
      'nwr["name"]["healthcare"]',
    ],
  },
  {
    name: 'building-typed',
    clauses: [
      // Buildings with semantic types that often host events / are landmarks.
      // Using regex to grab church/cathedral/stadium/etc. in one clause.
      'nwr["name"]["building"~"^(church|cathedral|chapel|monastery|mosque|temple|synagogue|stadium|sports_hall|arena|conference|exhibition|civic|government|university|college|kindergarten|public|presbytery|religious)$"]',
    ],
  },
  {
    name: 'public_transport',
    clauses: [
      // Major stations sometimes host events / are venues
      'nwr["name"]["public_transport"="station"]',
    ],
  },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function buildQuery(family: Family, bbox: string): string {
  const clauses = family.clauses.map((c) => `  ${c}(${bbox});`).join('\n');
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];
(
${clauses}
);
out center tags;`;
}

async function checkOverpassStatus(): Promise<number> {
  try {
    const baseUrl = overpassUrl().replace('/interpreter', '/status');
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    const slot = text.match(/Slot available after:.*?(\d+) seconds/);
    if (slot) return parseInt(slot[1], 10) + 5;
    if (text.includes('available now')) return 0;
    return 0;
  } catch {
    return 0;
  }
}

async function fetchFamily(
  family: Family,
  region: Region,
  retries = 4,
): Promise<OverpassElement[]> {
  const query = buildQuery(family, region.bbox);
  for (let attempt = 1; attempt <= retries; attempt++) {
    const wait = await checkOverpassStatus();
    if (wait > 0) {
      console.log(`    [${region.name}/${family.name}] Slot busy, waiting ${wait}s…`);
      await sleep(wait * 1000);
    }
    const url = overpassUrl();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Several Overpass mirrors return 406 without a UA. Identify
          // ourselves as a polite, contactable bot.
          'User-Agent':
            'OesterreichEventsBot/1.0 (+https://lasstreffen.at; venue-import; contact info via website)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (res.status === 429 || res.status === 504) {
        const retryAfter = res.headers.get('Retry-After');
        const waitSec = retryAfter ? parseInt(retryAfter, 10) + 5 : attempt * 60;
        console.log(`    [${region.name}/${family.name}] HTTP ${res.status} from ${new URL(url).hostname}, retry in ${waitSec}s (attempt ${attempt}/${retries})`);
        if (attempt >= 2) endpointIdx++;
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }

      const data: OverpassResponse = await res.json();
      return data.elements;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    [${region.name}/${family.name}] ${msg}`);
      if (attempt === retries) throw err;
      const waitSec = attempt * 45;
      if (attempt >= 2) endpointIdx++;
      console.log(`    Retrying in ${waitSec}s…`);
      await sleep(waitSec * 1000);
    }
  }
  return [];
}

// ─── CACHE ──────────────────────────────────────────────────────────────────

function cachePath(region: Region, family: Family): string {
  return join(OUT_DIR, `${region.name.toLowerCase()}__${family.name}.json`);
}

function readCache(region: Region, family: Family): OverpassElement[] | null {
  const p = cachePath(region, family);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as OverpassElement[];
  } catch {
    return null;
  }
}

function writeCache(region: Region, family: Family, elements: OverpassElement[]): void {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(cachePath(region, family), JSON.stringify(elements));
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

interface RunOpts {
  regionFilter?: string;
  familyFilter?: string;
  skipCache?: boolean;
}

async function run(opts: RunOpts) {
  const targetRegions = opts.regionFilter
    ? REGIONS.filter((r) => r.name.toLowerCase() === opts.regionFilter!.toLowerCase())
    : REGIONS;
  const targetFamilies = opts.familyFilter
    ? FAMILIES.filter((f) => f.name === opts.familyFilter)
    : FAMILIES;

  if (!targetRegions.length) {
    console.error(`No region matches "${opts.regionFilter}". Available: ${REGIONS.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }
  if (!targetFamilies.length) {
    console.error(`No family matches "${opts.familyFilter}". Available: ${FAMILIES.map((f) => f.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`Overpass fetch: ${targetRegions.length} regions × ${targetFamilies.length} families = ${targetRegions.length * targetFamilies.length} queries\n`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const all: OverpassElement[] = [];
  const stats: Record<string, Record<string, number>> = {};
  let queryCount = 0;
  const totalQueries = targetRegions.length * targetFamilies.length;

  for (const region of targetRegions) {
    stats[region.name] = {};
    console.log(`\n=== ${region.name} (${region.bbox}) ===`);

    for (const family of targetFamilies) {
      queryCount++;
      const tag = `[${queryCount}/${totalQueries}] ${region.name}/${family.name}`;

      // Cache check
      if (!opts.skipCache) {
        const cached = readCache(region, family);
        if (cached) {
          stats[region.name][family.name] = cached.length;
          console.log(`  ${tag}: ${cached.length} (cached)`);
          all.push(...cached);
          continue;
        }
      }

      try {
        const start = Date.now();
        const elements = await fetchFamily(family, region);
        const ms = Date.now() - start;
        stats[region.name][family.name] = elements.length;
        console.log(`  ${tag}: ${elements.length} elements (${(ms / 1000).toFixed(1)}s)`);
        writeCache(region, family, elements);
        all.push(...elements);
      } catch (err) {
        console.error(`  ${tag}: FAILED — ${err instanceof Error ? err.message : err}`);
        stats[region.name][family.name] = -1;
      }

      // Family delay (only between non-final families)
      if (family !== targetFamilies[targetFamilies.length - 1]) {
        await sleep(FAMILY_DELAY_MS);
      }
    }

    // Region delay (only between non-final regions)
    if (region !== targetRegions[targetRegions.length - 1]) {
      console.log(`  Sleeping ${REGION_DELAY_MS / 1000}s before next region…`);
      await sleep(REGION_DELAY_MS);
    }
  }

  // Deduplicate by type:id (Overpass returns same node multiple times if it
  // matches multiple tag families — e.g. amenity=cafe + shop=coffee).
  const seen = new Map<string, OverpassElement>();
  for (const el of all) {
    const key = `${el.type}:${el.id}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, el);
    } else {
      // Merge tags (later occurrence may have richer data — Overpass usually
      // returns identical, but defensive merge doesn't hurt)
      existing.tags = { ...(existing.tags || {}), ...(el.tags || {}) };
    }
  }

  const consolidated = Array.from(seen.values());
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total raw elements: ${all.length}`);
  console.log(`Deduplicated: ${consolidated.length}`);
  console.log(`Cache dir: ${OUT_DIR}`);
  console.log(`Output: ${CONSOLIDATED_OUT}`);

  console.log(`\nPer-region/family counts:`);
  for (const [region, fam] of Object.entries(stats)) {
    const total = Object.values(fam).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    const failed = Object.entries(fam).filter(([, v]) => v === -1).map(([k]) => k);
    console.log(`  ${region}: ${total} total${failed.length ? ` (FAILED: ${failed.join(', ')})` : ''}`);
  }

  writeFileSync(CONSOLIDATED_OUT, JSON.stringify(consolidated));
  console.log(`\nWrote ${consolidated.length} unique elements to ${CONSOLIDATED_OUT}`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(): RunOpts {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx === -1) return undefined;
    return args[idx + 1];
  };
  return {
    regionFilter: get('--region'),
    familyFilter: get('--family'),
    skipCache: args.includes('--skip-cache'),
  };
}

run(parseArgs()).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
