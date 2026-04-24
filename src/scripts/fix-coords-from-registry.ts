#!/usr/bin/env npx tsx
/**
 * Bulk-fix event coordinates using the Austrian gemeinden registry as
 * the authoritative source of truth for PLZ → (lat, lng) mappings.
 *
 * Scenario: scrapers occasionally emit garbage coordinates for real
 * Austrian events (e.g. "Muttertagsbrunch der SPÖ in Zillingtal" with
 * coords `(48.1667, 13.2)` — that's Oberösterreich, 248 km off). The
 * PLZ field is still correct, so we can use our own gemeinden-registry
 * (1933 entries, hand-verified) to override the bogus coords.
 *
 * Criteria (all four required):
 *   1. event.start_date >= today (we only care about future events)
 *   2. event.publish_status = 'published'
 *   3. event.postal_code matches a gemeinde in our registry
 *   4. distance(event_coords, registry_coords) > 2 km
 *   5. event.geocoding_source NOT IN (manual, gemini, openai)
 *      — never overwrite AI-refined or hand-fixed placements.
 *
 * Updates set:
 *   latitude, longitude → registry centre
 *   geocoding_source   → 'gemeinde-registry'
 *   geocoding_confidence → 'normalized'
 *
 * Idempotent. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx src/scripts/fix-coords-from-registry.ts                # dry-run summary
 *   npx tsx src/scripts/fix-coords-from-registry.ts --apply        # actually write
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ALL_GEMEINDEN } from '../lib/gemeinden/data';

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
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes('--apply');
const PROTECTED = new Set(['manual', 'gemini', 'openai']);
const DISTANCE_THRESHOLD_KM = 2;

function haversineKm(a: number, b: number, c: number, d: number): number {
  const R = 6371;
  const dLat = (c - a) * Math.PI / 180;
  const dLng = (d - b) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa = sinLat * sinLat + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

// Build PLZ → gemeinde lookup (first match wins when multiple gemeinden share a PLZ)
const BY_PLZ = new Map<string, (typeof ALL_GEMEINDEN)[number]>();
for (const g of ALL_GEMEINDEN) {
  if (!BY_PLZ.has(g.plz)) BY_PLZ.set(g.plz, g);
}
console.log(`Registry covers ${BY_PLZ.size.toLocaleString()} unique PLZ codes (${ALL_GEMEINDEN.length.toLocaleString()} gemeinden total).\n`);

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const PAGE = 1000;

  const stats = {
    total_scanned: 0,
    no_plz: 0,
    plz_not_in_registry: 0,
    no_coords: 0,
    protected_source: 0,
    within_threshold: 0,
    candidates: 0,
    by_distance_bucket: { '2-5km': 0, '5-10km': 0, '10-50km': 0, '50km+': 0 },
    updated: 0,
    update_errors: 0,
  };

  console.log(APPLY ? 'APPLY mode — will write to DB.\n' : 'DRY RUN — no writes.\n');
  const samples: Array<{ id: string; title: string; dist: number; from: [number, number]; to: [number, number]; plz: string }> = [];

  // Cursor-based pagination on `id`. The earlier OFFSET-based version hit
  // Supabase's statement_timeout (~8-15s) once offset grew past ~14k rows:
  // PostgreSQL had to scan+skip every earlier row on each page. Cursor
  // pagination uses `id > lastSeen` which rides the primary-key btree and
  // stays fast regardless of how deep we are.
  let cursorId: string | null = null;
  while (true) {
    let q = supabase
      .from('events')
      .select('id, title, postal_code, latitude, longitude, geocoding_source, geocoding_confidence')
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .order('id', { ascending: true })
      .limit(PAGE);
    if (cursorId) q = q.gt('id', cursorId);
    const { data, error } = await q;

    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;

    for (const e of data) {
      stats.total_scanned++;
      const plz = (e.postal_code ?? '').trim();
      if (!/^\d{4}$/.test(plz)) { stats.no_plz++; continue; }

      const g = BY_PLZ.get(plz);
      if (!g) { stats.plz_not_in_registry++; continue; }

      if (e.latitude == null || e.longitude == null) { stats.no_coords++; continue; }
      if (PROTECTED.has(e.geocoding_source ?? '')) { stats.protected_source++; continue; }

      const dist = haversineKm(e.latitude, e.longitude, g.lat, g.lng);
      if (dist < DISTANCE_THRESHOLD_KM) { stats.within_threshold++; continue; }

      stats.candidates++;
      if (dist < 5) stats.by_distance_bucket['2-5km']++;
      else if (dist < 10) stats.by_distance_bucket['5-10km']++;
      else if (dist < 50) stats.by_distance_bucket['10-50km']++;
      else stats.by_distance_bucket['50km+']++;

      if (samples.length < 10) {
        samples.push({
          id: e.id, title: e.title?.slice(0, 50) ?? '',
          dist,
          from: [e.latitude, e.longitude],
          to: [g.lat, g.lng],
          plz,
        });
      }

      if (APPLY) {
        // `geocoding_confidence: 'gemeinde-registry'` is at rank 0 in
        // supabase-sync.ts CONFIDENCE_RANK — tied with 'manual'. That means
        // future scraper/normalizer passes cannot overwrite these coords.
        // This is the whole point of this script: once a PLZ+name match
        // lands, the pin sticks.
        const { error: upErr } = await supabase
          .from('events')
          .update({
            latitude: g.lat,
            longitude: g.lng,
            geocoding_source: 'gemeinde-registry',
            geocoding_confidence: 'gemeinde-registry',
          })
          .eq('id', e.id);
        if (upErr) {
          stats.update_errors++;
          console.error(`  update failed for ${e.id}:`, upErr.message);
        } else {
          stats.updated++;
        }
      }
    }

    // Advance cursor to the last id of this page.
    cursorId = data[data.length - 1].id;
    if (data.length < PAGE) break;
    process.stdout.write(`\r  scanned ${stats.total_scanned.toLocaleString()} events, ${stats.candidates.toLocaleString()} candidates so far …`);
  }

  console.log(`\n\n─── Summary ───`);
  console.log(`  Total scanned:             ${stats.total_scanned.toLocaleString()}`);
  console.log(`  No PLZ:                    ${stats.no_plz.toLocaleString()}`);
  console.log(`  PLZ not in registry:       ${stats.plz_not_in_registry.toLocaleString()}`);
  console.log(`  No coords:                 ${stats.no_coords.toLocaleString()}`);
  console.log(`  Protected (manual/gemini): ${stats.protected_source.toLocaleString()}`);
  console.log(`  Within threshold (<2km):   ${stats.within_threshold.toLocaleString()}`);
  console.log(`  CANDIDATES for fix:        ${stats.candidates.toLocaleString()}`);
  console.log();
  console.log(`  Distance breakdown:`);
  console.log(`    2-5 km:    ${stats.by_distance_bucket['2-5km'].toLocaleString()}`);
  console.log(`    5-10 km:   ${stats.by_distance_bucket['5-10km'].toLocaleString()}`);
  console.log(`    10-50 km:  ${stats.by_distance_bucket['10-50km'].toLocaleString()}`);
  console.log(`    >50 km:    ${stats.by_distance_bucket['50km+'].toLocaleString()}`);
  if (APPLY) {
    console.log();
    console.log(`  Updated:                   ${stats.updated.toLocaleString()}`);
    console.log(`  Update errors:             ${stats.update_errors.toLocaleString()}`);
  }

  if (samples.length > 0) {
    console.log('\n─── Samples ───');
    samples.forEach(s => {
      console.log(`  [${s.dist.toFixed(1)} km off]  ${s.title}`);
      console.log(`    plz=${s.plz}  from=(${s.from[0]}, ${s.from[1]})  →  to=(${s.to[0]}, ${s.to[1]})`);
    });
  }

  if (!APPLY && stats.candidates > 0) {
    console.log('\nRun again with --apply to actually update these rows.');
  }
})();
