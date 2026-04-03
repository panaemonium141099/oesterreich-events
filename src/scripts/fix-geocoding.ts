/**
 * Fix Geocoding — Re-normalize all event coordinates using enhanced location normalizer.
 *
 * Checks title, location_name, address, description against GeoNames AT database (34k entries).
 * Uses closest-match disambiguation instead of population-based.
 * Updates events in Supabase where the new coordinates differ by >5km from current.
 *
 * Usage: npx tsx src/scripts/fix-geocoding.ts [--dry-run] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeEventLocation } from '../lib/location-normalizer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run with: source .env.local && npx tsx src/scripts/fix-geocoding.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log(`\n🔍 Fix Geocoding — ${isDryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));

  // Fetch all events
  let allEvents: Array<Record<string, unknown>> = [];
  let offset = 0;
  const pageSize = 1000;

  console.log('\nFetching events from Supabase...');

  while (true) {
    const query = supabase
      .from('events')
      .select('id, title, description, location_name, address, postal_code, bundesland, latitude, longitude')
      .range(offset, offset + pageSize - 1);

    if (limit && offset >= limit) break;

    const { data, error } = await query;
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    allEvents = allEvents.concat(data);
    offset += data.length;
    process.stdout.write(`  Fetched ${allEvents.length} events...\r`);
    if (data.length < pageSize) break;
  }

  console.log(`\n  Total events: ${allEvents.length}`);

  if (limit) {
    allEvents = allEvents.slice(0, limit);
    console.log(`  Limited to: ${allEvents.length}`);
  }

  // Process each event
  let checked = 0;
  let corrected = 0;
  let noMatch = 0;
  let unchanged = 0;
  let newCoords = 0;
  const corrections: Array<{ title: string; location: string; oldLat: number; oldLng: number; newLat: number; newLng: number; dist: number; confidence: string }> = [];
  const updates: Array<{ id: string; latitude: number; longitude: number }> = [];

  for (const event of allEvents) {
    checked++;
    if (checked % 500 === 0) {
      process.stdout.write(`  Processing ${checked}/${allEvents.length}...\r`);
    }

    const result = normalizeEventLocation({
      title: event.title as string,
      description: (event.description as string)?.slice(0, 300),
      location_name: event.location_name as string,
      address: event.address as string,
      postal_code: event.postal_code as string,
      bundesland: event.bundesland as string,
      latitude: event.latitude as number,
      longitude: event.longitude as number,
    });

    if (!result) {
      noMatch++;
      continue;
    }

    const oldLat = event.latitude as number | null;
    const oldLng = event.longitude as number | null;

    // Event has no coordinates yet → assign
    if (!oldLat || !oldLng) {
      newCoords++;
      updates.push({ id: event.id as string, latitude: result.latitude, longitude: result.longitude });
      corrections.push({
        title: (event.title as string).slice(0, 50),
        location: (event.location_name as string) || '(none)',
        oldLat: 0, oldLng: 0,
        newLat: result.latitude, newLng: result.longitude,
        dist: 0,
        confidence: result.confidence,
      });
      continue;
    }

    // Event has coordinates → check if they differ significantly
    const dist = haversineKm(oldLat, oldLng, result.latitude, result.longitude);

    if (dist > 5 && (result.confidence === 'exact' || result.confidence === 'normalized')) {
      corrected++;
      updates.push({ id: event.id as string, latitude: result.latitude, longitude: result.longitude });
      corrections.push({
        title: (event.title as string).slice(0, 50),
        location: (event.location_name as string) || '(none)',
        oldLat, oldLng,
        newLat: result.latitude, newLng: result.longitude,
        dist: Math.round(dist),
        confidence: result.confidence,
      });
    } else {
      unchanged++;
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`  Checked:     ${checked}`);
  console.log(`  No match:    ${noMatch}`);
  console.log(`  Unchanged:   ${unchanged} (diff < 5km or low confidence)`);
  console.log(`  Corrected:   ${corrected} (coords moved > 5km, high confidence)`);
  console.log(`  New coords:  ${newCoords} (had no coordinates before)`);
  console.log(`  Total updates: ${updates.length}`);

  // Show corrections
  if (corrections.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('CORRECTIONS (showing first 50):');
    console.log('─'.repeat(60));
    for (const c of corrections.slice(0, 50)) {
      if (c.dist === 0) {
        console.log(`  NEW  "${c.title}" | ${c.location} → [${c.newLat.toFixed(4)}, ${c.newLng.toFixed(4)}] (${c.confidence})`);
      } else {
        console.log(`  FIX  "${c.title}" | ${c.location} | ${c.dist}km off → [${c.newLat.toFixed(4)}, ${c.newLng.toFixed(4)}] (${c.confidence})`);
      }
    }
  }

  // Apply updates
  if (!isDryRun && updates.length > 0) {
    console.log(`\n\nApplying ${updates.length} updates to Supabase...`);
    const BATCH_SIZE = 100;
    let applied = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      // Supabase doesn't support bulk update by different IDs in one call,
      // so we use Promise.all with individual updates
      const promises = batch.map(u =>
        supabase.from('events').update({ latitude: u.latitude, longitude: u.longitude }).eq('id', u.id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error(`  Batch ${i / BATCH_SIZE + 1}: ${errors.length} errors`);
      }

      applied += batch.length;
      process.stdout.write(`  Applied ${applied}/${updates.length}...\r`);
    }

    console.log(`\n  ✅ Done! Applied ${applied} updates.`);
  } else if (isDryRun) {
    console.log(`\n  🔍 DRY RUN — no changes applied. Run without --dry-run to apply.`);
  }
}

main().catch(console.error);
