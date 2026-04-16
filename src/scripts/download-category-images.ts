/**
 * Fetch category fallback images from Pexels.
 *
 * Why: the map/list view shows the same 5 stock photos per category whenever
 * a scraped event has no own image. Bumping that to 20-50+ variants kills
 * the "same guy everywhere" feeling.
 *
 * Usage:
 *   PEXELS_API_KEY=xxx npm run download-category-images
 *   PEXELS_API_KEY=xxx npm run download-category-images -- --target 40
 *   PEXELS_API_KEY=xxx npm run download-category-images -- --slug musik,sport
 *
 * After running, bump `imageCount` for each affected slug in
 * src/lib/event-images/categoryMeta.ts — the final log prints a ready-to-paste
 * summary.
 *
 * Pexels attribution: each image's photographer + source URL is written to
 * public/images/categories/manifest.json for downstream credit display.
 * Free tier limits: 200 req/h, 20k req/month.
 */

import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('[error] PEXELS_API_KEY env var is required.');
  console.error('        Get a free key at https://www.pexels.com/api/');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve('public/images/categories');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

// ── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getFlag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};
const TARGET_PER_SLUG = Number(getFlag('--target') ?? '25');
const ONLY_SLUGS = (getFlag('--slug') ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const DRY_RUN = args.includes('--dry-run');

// ── Queries ────────────────────────────────────────────────────────────
// One slug → many queries. Queries are ordered most-representative first so
// the early-indexed images (which get picked for events with short titles /
// no good hash entropy) are the strongest.
const QUERIES: Record<string, string[]> = {
  musik: [
    'live concert audience',
    'jazz band stage',
    'acoustic guitar performer',
    'pianist concert',
    'orchestra performance',
    'rock band live stage',
    'singer microphone stage',
    'street musician',
    'music festival crowd',
  ],
  rave: [
    'dj mixing console',
    'nightclub lights',
    'electronic music party',
    'neon club night',
    'dance floor crowd',
    'rave laser lights',
    'club dj booth',
  ],
  wein: [
    'wine glass vineyard',
    'austrian heuriger',
    'wine tasting cellar',
    'vineyard harvest autumn',
    'rustic dinner wine table',
    'cheese board wine',
    'traditional austrian food plate',
    'wine bottles display',
  ],
  kultur: [
    'art gallery exhibition',
    'classical museum interior',
    'theatre stage velvet curtain',
    'opera house auditorium',
    'bronze sculpture',
    'painter studio canvas',
    'ballet performance',
    'library old books',
  ],
  maerkte: [
    'european farmers market stall',
    'christmas market lights evening',
    'flea market vintage',
    'fresh produce market',
    'artisan food market',
    'fruit vegetable stall',
    'craft market outdoor',
  ],
  // One "Sport" event can be a marathon, a hike, a football match, yoga —
  // keep the pool wide so a hike event doesn't pull a running-race photo.
  // Round-robin ensures each sub-sport gets ~equal representation.
  sport: [
    'hiking trail mountains',
    'wanderung alpen',
    'trail running forest',
    'mountain biking austria',
    'road cycling tour',
    'football amateur match',
    'ski touring powder',
    'cross country skiing',
    'tennis club match',
    'yoga class studio',
    'climbing indoor wall',
    'volleyball beach',
    'swimming lake',
    'marathon runners city',
    'gym workout',
  ],
  familie: [
    'family picnic park',
    'children playground sunny',
    'parents children outdoors',
    'family hike forest',
    'kids painting crafts',
    'family lake summer',
    'grandparents grandchildren',
  ],
  natur: [
    'austria alps scenic',
    'forest sunbeam path',
    'mountain lake reflection',
    'wildflower meadow alps',
    'autumn forest golden',
    'sunset mountains panorama',
    'waterfall rock forest',
    'winter snow mountain',
  ],
  // Austrian / Alpine village + tradition. Used by Feste & Brauchtum.
  // Queries are intentionally German / place-specific — generic "folk costume
  // parade" returned Vietnamese / Turkish / Bulgarian results before.
  fest: [
    'oktoberfest tent',
    'bavarian beer garden people',
    'tracht dirndl lederhosen',
    'alpine village festival',
    'maypole bavaria',
    'christkindlmarkt vienna',
    'wiesn munich crowd',
    'alpine brass band',
    'tyrolean parade',
    'almabtrieb cows',
    'austrian wedding country',
    'folk music bavaria',
  ],
  // Shared by Bildung, Gesundheit, Religion, Sonstiges.
  // Neutral alpine / Austrian landscape + architecture so a lecture event or
  // a yoga retreat still shows an Austria-feeling photo.
  default: [
    'hallstatt austria',
    'salzburg old town',
    'vienna coffeehouse interior',
    'austrian alps village',
    'tyrolean village mountains',
    'wachau danube vineyards',
    'alpine mountain hut',
    'austrian church alps',
    'alpine pasture summer',
    'innsbruck old town',
    'vienna street evening',
    'alpine meadow wildflowers',
  ],
  wirtschaft: [
    'business conference room',
    'office meeting presentation',
    'networking event handshake',
    'coworking space laptops',
    'professional summit stage',
    'startup team whiteboard',
    'trade fair booth',
  ],

  // ─── Regional pools ───────────────────────────────────────────
  // Burgenland + NÖ: pannonian plain, Neusiedler See, wine country
  'fest-bgld': [
    'austrian wine festival',
    'heuriger music wine',
    'burgenland vineyard festival',
    'wine harvest celebration',
    'outdoor wine garden people',
    'folk music austria wine',
    'village wine fest',
  ],
  'default-bgld': [
    'neusiedler see lake',
    'burgenland vineyards',
    'austrian wine village',
    'pannonian plain sunset',
    'rust austria town',
    'eisenstadt palace',
    'rolling hills vineyards austria',
    'lake neusiedl boats',
  ],
  'natur-bgld': [
    'neusiedler see reeds',
    'lavender field sunset',
    'sunflower field austria',
    'lake sunset reeds',
    'pannonian plain grass',
    'vineyard rolling hills',
    'austrian steppe flat',
    'marshland birds europe',
  ],

  // Wien: urban, cafes, architecture, parks
  'fest-wien': [
    'christkindlmarkt vienna',
    'vienna street festival',
    'vienna opera ball',
    'vienna new year fireworks',
    'vienna food festival',
    'vienna christmas market night',
    'vienna concert urban',
  ],
  'default-wien': [
    'vienna stephansdom',
    'vienna coffeehouse interior',
    'vienna tram street',
    'vienna opera house',
    'vienna hofburg palace',
    'vienna old town evening',
    'vienna ringstrasse',
    'schönbrunn palace',
  ],
  'natur-wien': [
    'vienna stadtpark',
    'vienna prater park',
    'wienerwald forest',
    'danube vienna riverside',
    'botanical garden vienna',
    'schönbrunn gardens',
    'vienna park autumn',
    'urban garden green city',
  ],
};

// ── Types ──────────────────────────────────────────────────────────────
interface PexelsPhoto {
  id: number;
  src: { large: string; large2x: string; medium: string };
  alt: string;
  photographer: string;
  photographer_url: string;
  url: string;
}

interface ManifestEntry {
  file: string;
  alt: string;
  photographer: string;
  photographer_url: string;
  source_url: string;
}

// ── HTTP ───────────────────────────────────────────────────────────────
async function searchPexels(query: string, perPage: number): Promise<PexelsPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query,
  )}&per_page=${perPage}&orientation=landscape&size=medium`;
  const res = await fetch(url, { headers: { Authorization: API_KEY! } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pexels ${res.status} on "${query}": ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { photos: PexelsPhoto[] };
  return json.photos ?? [];
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

// ── Existing-file scanning ─────────────────────────────────────────────
async function highestExistingIndex(slug: string): Promise<number> {
  if (!existsSync(OUTPUT_DIR)) return 0;
  const entries = await readdir(OUTPUT_DIR);
  const pattern = new RegExp(`^${slug}-(\\d+)\\.jpg$`);
  let max = 0;
  for (const e of entries) {
    const m = e.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// ── Manifest ───────────────────────────────────────────────────────────
async function loadManifest(): Promise<Record<string, ManifestEntry[]>> {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  const manifest = await loadManifest();
  const allSlugs = Object.keys(QUERIES);
  const slugsToProcess = ONLY_SLUGS.length ? allSlugs.filter(s => ONLY_SLUGS.includes(s)) : allSlugs;

  if (slugsToProcess.length === 0) {
    console.error(`[error] no matching slugs. Known: ${allSlugs.join(', ')}`);
    process.exit(1);
  }

  console.log(`▶ target=${TARGET_PER_SLUG} per slug, dry-run=${DRY_RUN}`);
  console.log(`▶ slugs: ${slugsToProcess.join(', ')}\n`);

  const summary: Record<string, number> = {};

  for (const slug of slugsToProcess) {
    const queries = QUERIES[slug];
    console.log(`─── ${slug} ─────────────────────────`);

    const startIndex = (await highestExistingIndex(slug)) + 1;
    console.log(`   existing: ${startIndex - 1}, starting at index ${startIndex}`);

    // Fetch first — round-robin picks one from each query per round so no
    // single query dominates (the earlier greedy version filled 8 marathon
    // photos from "running race outdoors" before moving to hike queries).
    const photosByQuery: Array<{ query: string; photos: PexelsPhoto[] }> = [];
    const perQuery = Math.max(2, Math.ceil((TARGET_PER_SLUG - startIndex + 1) / queries.length) + 1);
    for (const query of queries) {
      try {
        const photos = await searchPexels(query, Math.min(perQuery, 10));
        photosByQuery.push({ query, photos });
      } catch (err) {
        console.warn(`   ✗ query "${query}": ${(err as Error).message}`);
        photosByQuery.push({ query, photos: [] });
      }
    }

    let index = startIndex;
    const entries: ManifestEntry[] = manifest[slug] ?? [];
    const seenIds = new Set<number>();
    const maxRounds = Math.max(...photosByQuery.map(q => q.photos.length));

    outer: for (let round = 0; round < maxRounds; round++) {
      for (const { query, photos } of photosByQuery) {
        if (index > TARGET_PER_SLUG) break outer;
        const photo = photos[round];
        if (!photo || seenIds.has(photo.id)) continue;
        seenIds.add(photo.id);
        const file = `${slug}-${index}.jpg`;
        const dest = path.join(OUTPUT_DIR, file);

        if (DRY_RUN) {
          console.log(`   [dry] ${file}  ← "${query}" (${photo.photographer})`);
          index++;
          continue;
        }

        try {
          await downloadImage(photo.src.large2x || photo.src.large, dest);
          entries.push({
            file,
            alt: photo.alt,
            photographer: photo.photographer,
            photographer_url: photo.photographer_url,
            source_url: photo.url,
          });
          console.log(`   ✓ ${file}  ← "${query}" (${photo.photographer})`);
          index++;
        } catch (err) {
          console.warn(`   ✗ ${file}: ${(err as Error).message}`);
        }
      }
    }

    manifest[slug] = entries;
    summary[slug] = index - 1; // final highest index for this slug
  }

  if (!DRY_RUN) {
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n✓ manifest → ${MANIFEST_PATH}`);
  }

  console.log('\n─── Summary — paste into src/lib/event-images/categoryMeta.ts ───');
  for (const [slug, count] of Object.entries(summary)) {
    console.log(`   ${slug.padEnd(12)} imageCount: ${count}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
