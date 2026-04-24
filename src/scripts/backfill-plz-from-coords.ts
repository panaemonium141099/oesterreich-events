#!/usr/bin/env npx tsx
/**
 * Backfill `postal_code` for events that have coords but no PLZ.
 *
 * Problem: many events sit in the DB with valid lat/lng (from the scraper,
 * the normalizer's GeoNames match, or the AI geocoder) but `postal_code`
 * is NULL. Root cause — those code paths historically only wrote coords,
 * not PLZ, so the PLZ field drifted empty even when the source *knew* it.
 *
 * Effect: our gemeinden-registry-based coord-fix script (`fix-coords-from-
 * registry.ts`) indexes on PLZ, so rows without PLZ fall through untouched.
 * Currently ~16,700 published future events are in that blind spot.
 *
 * Fix: reverse-geocode each (lat, lng) via Mapbox Geocoding v6, take the
 * postcode context, persist it. One Mapbox request per event, ~150 ms
 * pace (well under the 600/min quota). Cache responses on disk so re-runs
 * cost zero API calls. Only writes `postal_code`; never touches coords,
 * confidence, or source.
 *
 * Idempotent — re-running skips events that now have a PLZ (either because
 * we wrote one last time, or because another job set one in the meantime).
 *
 * Usage:
 *   npx tsx src/scripts/backfill-plz-from-coords.ts              # dry run
 *   npx tsx src/scripts/backfill-plz-from-coords.ts --apply      # write to DB
 *   npx tsx src/scripts/backfill-plz-from-coords.ts --apply --limit 200
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ─── env bootstrap ────────────────────────────────────────────────────────
try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  });
} catch { /* no .env.local is fine */ }

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) { console.error('NEXT_PUBLIC_MAPBOX_TOKEN missing'); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) || Infinity : Infinity;
})();
const RATE_LIMIT_MS = 150;
const CACHE_DIR = join(process.cwd(), '.cache/mapbox-reverse');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(lat: number, lng: number): string {
  // 5 decimal places ≈ 1.1 m resolution — plenty to dedup re-requests for
  // the same point while still letting different venues at the same
  // gemeinde have distinct keys if their coords differ at all.
  return `${lat.toFixed(5)}_${lng.toFixed(5)}.json`;
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithBackoff(url: string, attempt = 0): Promise<Response> {
  const resp = await fetch(url);
  if (resp.ok || resp.status === 404) return resp;
  if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
    const wait = 2_000 * 2 ** attempt;
    console.warn(`    ${resp.status} — backoff ${wait}ms (${attempt + 1}/3)`);
    await sleep(wait);
    return fetchWithBackoff(url, attempt + 1);
  }
  return resp;
}

interface MapboxFeature {
  properties: {
    feature_type?: string;
    context?: { postcode?: { name?: string; mapbox_id?: string } };
  };
}

async function reverseLookupPlz(lat: number, lng: number): Promise<string | null> {
  const cacheFile = join(CACHE_DIR, cacheKey(lat, lng));
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8')) as string | null;
      return cached;
    } catch { /* fall through */ }
  }

  // Mapbox Reverse v6. `types=postcode` asks explicitly for the postcode
  // feature at that point — Austrian postcodes are 4-digit, which Mapbox
  // indexes as admin postcodes.
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&country=at&types=postcode&limit=1&access_token=${MAPBOX_TOKEN}`;
  const resp = await fetchWithBackoff(url);
  if (!resp.ok) {
    console.warn(`    mapbox ${resp.status} for (${lat}, ${lng})`);
    return null;
  }
  const json = await resp.json() as { features?: MapboxFeature[] };
  const first = json.features?.[0];
  // Primary source: the feature itself when feature_type=postcode.
  // Fallback: context.postcode.name (present when we asked types=postcode
  // but Mapbox returned a broader feature with postcode in its context).
  let plz: string | null = null;
  if (first?.properties.feature_type === 'postcode') {
    // Look for the postcode name in properties.name (not always present
    // with types=postcode, but common). The cleanest source is the feature's
    // "name" — Mapbox stringifies it to the 4-digit code for AT postcodes.
    // Since the v6 response doesn't expose a top-level name in our type, we
    // fall back to context.postcode.name which IS always present.
    plz = first.properties.context?.postcode?.name ?? null;
    // When the feature IS a postcode, the postcode context is usually
    // self-referential. If missing, try parsing from a hypothetical name.
    if (!plz) {
      const anyFirst = first as unknown as { properties: { name?: string } };
      plz = anyFirst.properties?.name ?? null;
    }
  }
  if (!plz && first?.properties.context?.postcode?.name) {
    plz = first.properties.context.postcode.name;
  }

  // Validate: 4-digit Austrian PLZ
  if (plz && !/^\d{4}$/.test(plz.trim())) plz = null;

  // Negative cache OK — tells re-runs "this point has no postcode per Mapbox"
  writeFileSync(cacheFile, JSON.stringify(plz));
  return plz;
}

interface EventRow {
  id: string;
  latitude: number;
  longitude: number;
  geocoding_source: string | null;
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  console.log(APPLY ? 'APPLY mode — will write postal_code to DB.\n' : 'DRY RUN — no writes.\n');
  console.log(`Rate limit: ~6 req/s   Cache: ${CACHE_DIR}`);
  if (LIMIT !== Infinity) console.log(`Limit: ${LIMIT} events (rest of batch skipped this run)`);

  // Cursor-paginate every published future event that:
  //   - has coords (needed for reverse geocoding)
  //   - has NULL postal_code (the whole point of this script)
  let cursor: string | null = null;
  const queue: EventRow[] = [];
  while (queue.length < LIMIT) {
    let q = supabase
      .from('events')
      .select('id, latitude, longitude, geocoding_source')
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .is('postal_code', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('id', { ascending: true })
      .limit(1000);
    if (cursor) q = q.gt('id', cursor);
    const { data, error } = await q;
    if (error) { console.error('fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    queue.push(...(data as EventRow[]));
    cursor = data[data.length - 1].id;
    if (data.length < 1000) break;
  }

  const total = Math.min(queue.length, LIMIT);
  console.log(`\nEvents to backfill: ${total.toLocaleString()}`);

  const stats = {
    processed: 0,
    resolved: 0,
    notResolved: 0,
    updated: 0,
    updateErrors: 0,
    cacheHits: 0,
  };
  const samples: Array<{ id: string; coord: [number, number]; plz: string }> = [];

  for (let i = 0; i < total; i++) {
    const e = queue[i];
    stats.processed++;

    const cacheFile = join(CACHE_DIR, cacheKey(e.latitude, e.longitude));
    const hadCache = existsSync(cacheFile);
    const plz = await reverseLookupPlz(e.latitude, e.longitude);
    if (hadCache) stats.cacheHits++;

    if (!plz) { stats.notResolved++; }
    else {
      stats.resolved++;
      if (samples.length < 10) {
        samples.push({ id: e.id, coord: [e.latitude, e.longitude], plz });
      }

      if (APPLY) {
        const { error: upErr } = await supabase
          .from('events')
          .update({ postal_code: plz })
          .eq('id', e.id);
        if (upErr) {
          stats.updateErrors++;
          console.error(`  update fail ${e.id}: ${upErr.message}`);
        } else {
          stats.updated++;
        }
      }
    }

    // Only rate-limit between real API calls; cache hits are free.
    if (!hadCache) await sleep(RATE_LIMIT_MS);

    if ((i + 1) % 50 === 0) {
      process.stdout.write(
        `\r  ${i + 1}/${total}  resolved=${stats.resolved} notResolved=${stats.notResolved}` +
        (APPLY ? ` updated=${stats.updated}` : '') +
        ` cache=${stats.cacheHits}`,
      );
    }
  }

  console.log('\n\n─── Summary ───');
  console.log(`  Processed:         ${stats.processed.toLocaleString()}`);
  console.log(`  Resolved PLZ:      ${stats.resolved.toLocaleString()}`);
  console.log(`  Not resolved:      ${stats.notResolved.toLocaleString()}`);
  console.log(`  Cache hits:        ${stats.cacheHits.toLocaleString()}`);
  if (APPLY) {
    console.log(`  Updated:           ${stats.updated.toLocaleString()}`);
    console.log(`  Update errors:     ${stats.updateErrors.toLocaleString()}`);
  }
  if (samples.length > 0) {
    console.log('\n─── Samples ───');
    for (const s of samples) {
      console.log(`  ${s.id.slice(0, 8)}…  (${s.coord[0].toFixed(4)}, ${s.coord[1].toFixed(4)}) → PLZ ${s.plz}`);
    }
  }
  if (!APPLY) console.log('\nRun with --apply to write postal_code.');
})();
