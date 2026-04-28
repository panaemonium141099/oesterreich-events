/**
 * One-time migration: normalize location names and coordinates for all existing events in Supabase.
 *
 * Run: npx tsx src/scripts/normalize-locations.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { normalizeEventLocation } from '../lib/location-normalizer';
import { makeBulkUpdater } from '../lib/db/bulk-update';

// Load .env.local
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* */ }

const BATCH_SIZE = 500;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const updater = makeBulkUpdater(supabase, 'bulk_update_event_geocoding');

  // Count total events
  const { count } = await supabase.from('events').select('id', { count: 'exact', head: true });
  console.log(`Total events in Supabase: ${count}`);

  let offset = 0;
  // Resume from where we left off (pass --offset=N to skip already processed)
  const offsetArg = process.argv.find(a => a.startsWith('--offset='));
  if (offsetArg) offset = parseInt(offsetArg.split('=')[1]) || 0;
  if (offset > 0) console.log(`Resuming from offset ${offset}...`);

  let updated = 0;
  let coordsFixed = 0;
  let namesFixed = 0;
  let noMatch = 0;
  let alreadyGood = 0;

  while (true) {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, location_name, address, postal_code, bundesland, latitude, longitude')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id', { ascending: true });

    if (error) {
      console.error('Query error at offset', offset, ':', error.message);
      console.log('Resume with: npx tsx src/scripts/normalize-locations.ts --offset=' + offset);
      break;
    }
    if (!events || events.length === 0) break;

    const updates: { id: string; location_name?: string; latitude?: number; longitude?: number }[] = [];

    for (const event of events) {
      const result = normalizeEventLocation({
        location_name: event.location_name,
        address: event.address,
        postal_code: event.postal_code,
        bundesland: event.bundesland,
        latitude: event.latitude,
        longitude: event.longitude,
      });

      if (!result) {
        noMatch++;
        continue;
      }

      const update: typeof updates[0] = { id: event.id };
      let changed = false;

      // Fix coordinates if missing or clearly wrong (0,0)
      if ((!event.latitude || !event.longitude || (event.latitude === 0 && event.longitude === 0)) && result.latitude && result.longitude) {
        update.latitude = result.latitude;
        update.longitude = result.longitude;
        coordsFixed++;
        changed = true;
      }

      // Fix location name if we have a canonical version
      if (result.location_name && result.location_name !== event.location_name) {
        update.location_name = result.location_name;
        namesFixed++;
        changed = true;
      }

      if (changed) {
        updates.push(update);
      } else {
        alreadyGood++;
      }
    }

    // Batch update via bulk_update_event_geocoding RPC.
    // Pre-Refactor: 500 single-row UPDATEs pro Batch (Promise.all hatte
    // sich getarnt als parallel, aber war 500× Round-Trip via PostgREST).
    // Jetzt: ein RPC-Call pro 500 events. queue() flusht automatisch
    // wenn >=500 — am Ende des Scripts ein finaler flush().
    if (updates.length > 0) {
      for (const upd of updates) {
        const payload: Record<string, unknown> = { id: upd.id };
        if (upd.location_name !== undefined) payload.location_name = upd.location_name;
        if (upd.latitude !== undefined) {
          payload.latitude = upd.latitude;
          payload.longitude = upd.longitude;
        }
        await updater.add(payload as { id: string });
      }
      // queue() auto-flusht bei >=500. Hier zählen wir die enqueued als
      // "updated" optimistisch — der finale flush() liefert die echte
      // affected-Zahl, die wir am Ende loggen.
      updated += updates.length;
    }

    offset += events.length;
    if (offset % 5000 === 0 || events.length < BATCH_SIZE) {
      console.log(`Progress: ${offset}/${count} — ${updated} queued, ${coordsFixed} coords fixed, ${namesFixed} names fixed, ${noMatch} no match`);
    }

    if (events.length < BATCH_SIZE) break;
  }

  // Letzter Flush — die übriggebliebenen <500 Rows raus
  const finalAffected = await updater.flush();
  console.log(`Final flush: ${finalAffected} affected`);

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Total processed: ${offset}`);
  console.log(`Queued (sent to RPC): ${updated}`);
  console.log(`DB-affected: ${updater.stats.affected}`);
  console.log(`RPC calls: ${updater.stats.flushes} (retries: ${updater.stats.retries}, errors: ${updater.stats.errors})`);
  console.log(`Coordinates fixed: ${coordsFixed}`);
  console.log(`Names normalized: ${namesFixed}`);
  console.log(`Already correct: ${alreadyGood}`);
  console.log(`No match: ${noMatch}`);
}

main().catch(console.error);
