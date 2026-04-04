/**
 * Fix Geocoding — Re-geocode wrongly-placed events using enhanced location normalizer.
 *
 * Two modes:
 * 1. Default (jitter): Detects events placed at Bundesland capitals via the old
 *    +/-0.02 degree jitter fallback, re-normalizes them, and updates or NULLs their coords.
 * 2. --venue: Detects events with venue-name location_name (e.g., "Schloss Esterhazy")
 *    that got wrong coordinates from the old word-matching bug. Also fixes events
 *    whose coords differ from KNOWN_VENUES by >1km.
 *
 * Features:
 * - Durable backup to data/coord-backup-YYYY-MM-DD.json before any changes
 * - Dry-run mode: --dry-run shows what WOULD change without modifying DB
 * - Batch processing with checkpoint/resume: --resume continues from last checkpoint
 * - Requires SUPABASE_SERVICE_ROLE_KEY (no anon key fallback)
 *
 * Usage:
 *   npx tsx src/scripts/fix-geocoding.ts --dry-run
 *   npx tsx src/scripts/fix-geocoding.ts
 *   npx tsx src/scripts/fix-geocoding.ts --resume
 *   npx tsx src/scripts/fix-geocoding.ts --venue --dry-run
 *   npx tsx src/scripts/fix-geocoding.ts --venue
 *   npx tsx src/scripts/fix-geocoding.ts --venue --resume
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeEventLocation, isVenueName } from '../lib/location-normalizer';
import { KNOWN_VENUES } from '../lib/known-venues';
import { matchPlaceName } from '../lib/utils/place-match';
import * as fs from 'fs';
import * as path from 'path';

// ─── Auth: service role key ONLY ───────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL');
  console.error('Run with: source .env.local && npx tsx src/scripts/fix-geocoding.ts');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('This script requires the service role key. The anon key is NOT accepted.');
  console.error('Run with: source .env.local && npx tsx src/scripts/fix-geocoding.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── CLI args ──────────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');
const isResume = process.argv.includes('--resume');
const isVenueMode = process.argv.includes('--venue');

// ─── Constants ─────────────────────────────────────────────────────────────

// Bundesland capital centers — the old fallback assigned these + random jitter of +/- 0.02 degrees
const BUNDESLAND_CENTERS: Record<string, [number, number]> = {
  'wien': [48.2082, 16.3738],
  'niederoesterreich': [48.2000, 15.6333],
  'oberoesterreich': [48.3064, 14.2858],
  'salzburg': [47.8000, 13.0400],
  'steiermark': [47.0707, 15.4395],
  'kaernten': [46.6247, 14.3089],
  'tirol': [47.2654, 11.3928],
  'vorarlberg': [47.5000, 9.7500],
  'burgenland': [47.8453, 16.5189],
};

// The old jitter was +/- 0.02 degrees on both axes
const JITTER_ENVELOPE = 0.02;

const BATCH_SIZE = 100;
const CHECKPOINT_FILE = path.resolve(
  isVenueMode ? 'data/fix-geocoding-venue-checkpoint.json' : 'data/fix-geocoding-checkpoint.json'
);

// ─── Helpers ───────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detect if an event's coordinates fall within the 0.02-degree jitter envelope
 * of any Bundesland capital center.
 */
function isWithinJitterEnvelope(lat: number, lng: number): string | null {
  for (const [bundesland, [centerLat, centerLng]] of Object.entries(BUNDESLAND_CENTERS)) {
    if (
      Math.abs(lat - centerLat) <= JITTER_ENVELOPE &&
      Math.abs(lng - centerLng) <= JITTER_ENVELOPE
    ) {
      return bundesland;
    }
  }
  return null;
}

function getDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function saveCheckpoint(batchNumber: number, lastEventId: string, backupPath: string): void {
  const data = { batchNumber, lastEventId, backupPath, timestamp: new Date().toISOString() };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint(): { batchNumber: number; lastEventId: string; backupPath?: string } | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

// ─── Backup ────────────────────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  old_latitude: number | null;
  old_longitude: number | null;
  old_geocoding_confidence: string | null;
  old_geocoding_source: string | null;
}

async function createBackup(events: Array<Record<string, unknown>>): Promise<string> {
  const backupDir = path.resolve('data');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const prefix = isVenueMode ? 'coord-backup-venue' : 'coord-backup';
  const backupPath = path.join(backupDir, `${prefix}-${getDateString()}.json`);

  const entries: BackupEntry[] = events.map(e => ({
    id: e.id as string,
    old_latitude: (e.latitude as number | null) ?? null,
    old_longitude: (e.longitude as number | null) ?? null,
    old_geocoding_confidence: (e.geocoding_confidence as string | null) ?? null,
    old_geocoding_source: (e.geocoding_source as string | null) ?? null,
  }));

  fs.writeFileSync(backupPath, JSON.stringify(entries, null, 2));
  console.log(`  Backup created: ${backupPath} (${entries.length} events)`);
  return backupPath;
}

// ─── Main ──────────────────────────────────────────────────────────────────

interface CandidateEvent {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
  reason: string; // why it's a candidate
}

interface DryRunEntry {
  event_id: string;
  location_name: string | null;
  old_lat: number | null;
  old_lng: number | null;
  new_lat: number | null;
  new_lng: number | null;
  old_confidence: string | null;
  new_confidence: string | null;
  distance_km: number | null;
  action: 'correct' | 'null' | 'unchanged';
}

async function fetchAllEvents(): Promise<Array<Record<string, unknown>>> {
  const allEvents: Array<Record<string, unknown>> = [];
  let offset = 0;
  const pageSize = 1000;

  console.log('\nFetching events from Supabase...');

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, location_name, address, postal_code, bundesland, latitude, longitude, geocoding_confidence, geocoding_source')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    allEvents.push(...data);
    offset += data.length;
    process.stdout.write(`  Fetched ${allEvents.length} events...\r`);
    if (data.length < pageSize) break;
  }

  console.log(`  Total events: ${allEvents.length}`);
  return allEvents;
}

function identifyCandidates(events: Array<Record<string, unknown>>): CandidateEvent[] {
  const candidates: CandidateEvent[] = [];

  for (const e of events) {
    const lat = e.latitude as number | null;
    const lng = e.longitude as number | null;
    let reason = '';

    // Candidate 1: within jitter envelope of any Bundesland center
    if (lat != null && lng != null) {
      const matchedBundesland = isWithinJitterEnvelope(lat, lng);
      if (matchedBundesland) {
        reason = `within jitter envelope of ${matchedBundesland} center`;
      }
    }

    // Candidate 2: NULL geocoding_confidence (legacy/unknown placement)
    if (!reason && (e.geocoding_confidence == null)) {
      reason = 'geocoding_confidence is NULL';
    }

    if (reason) {
      candidates.push({
        id: e.id as string,
        title: e.title as string,
        description: (e.description as string | null) ?? null,
        location_name: (e.location_name as string | null) ?? null,
        address: (e.address as string | null) ?? null,
        postal_code: (e.postal_code as string | null) ?? null,
        bundesland: (e.bundesland as string | null) ?? null,
        latitude: lat,
        longitude: lng,
        geocoding_confidence: (e.geocoding_confidence as string | null) ?? null,
        geocoding_source: (e.geocoding_source as string | null) ?? null,
        reason,
      });
    }
  }

  return candidates;
}

// ─── Venue-mode candidate identification ──────────────────────────────────

/**
 * Confidences that must NOT be touched — these were set by scrapers or manual edits.
 */
const PROTECTED_CONFIDENCES = new Set(['scraper', 'manual']);

/**
 * Match an event's location_name against KNOWN_VENUES keys.
 * Uses matchPlaceName() for Unicode-aware token matching with umlaut normalization.
 * This ensures "Seefestspiele Mörbisch" matches "seefestspiele moerbisch" and
 * prevents false positives from substring matching.
 */
function matchKnownVenue(locationName: string): { key: string; latitude: number; longitude: number } | null {
  for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
    if (matchPlaceName(locationName, key)) {
      return { key, latitude: coords.latitude, longitude: coords.longitude };
    }
  }
  return null;
}

/**
 * Identify events affected by the venue-name word-matching bug.
 *
 * Two identification vectors:
 * 1. location_name starts with a venue prefix AND geocoding_confidence = "normalized"
 *    AND geocoding_source = "geonames" (these got word-matched to wrong GeoNames entries)
 * 2. location_name matches a KNOWN_VENUES key but current coords differ by > 1km
 *    (confirmed wrong regardless of confidence/source)
 *
 * Events with confidence "scraper" or "manual" are NEVER touched.
 */
function identifyVenueCandidates(events: Array<Record<string, unknown>>): CandidateEvent[] {
  const candidates: CandidateEvent[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    const id = e.id as string;
    const locationName = (e.location_name as string | null) ?? '';
    const confidence = (e.geocoding_confidence as string | null) ?? null;
    const source = (e.geocoding_source as string | null) ?? null;
    const lat = e.latitude as number | null;
    const lng = e.longitude as number | null;

    // Never touch scraper or manual confidence
    if (confidence && PROTECTED_CONFIDENCES.has(confidence)) continue;

    let reason = '';

    // Vector 1: venue-prefix location_name + normalized confidence + geonames source
    if (locationName && isVenueName(locationName) && confidence === 'normalized' && source === 'geonames') {
      reason = `venue-prefix location "${locationName}" with normalized/geonames confidence`;
    }

    // Vector 2: KNOWN_VENUES mismatch (coords differ by > 1km)
    if (!reason && locationName && lat != null && lng != null) {
      const knownMatch = matchKnownVenue(locationName);
      if (knownMatch) {
        const distKm = haversineKm(lat, lng, knownMatch.latitude, knownMatch.longitude);
        if (distKm > 1.0) {
          reason = `KNOWN_VENUES mismatch: "${locationName}" matches "${knownMatch.key}" but ${distKm.toFixed(1)}km away`;
        }
      }
    }

    if (reason && !seen.has(id)) {
      seen.add(id);
      candidates.push({
        id,
        title: e.title as string,
        description: (e.description as string | null) ?? null,
        location_name: (e.location_name as string | null) ?? null,
        address: (e.address as string | null) ?? null,
        postal_code: (e.postal_code as string | null) ?? null,
        bundesland: (e.bundesland as string | null) ?? null,
        latitude: lat,
        longitude: lng,
        geocoding_confidence: confidence,
        geocoding_source: source,
        reason,
      });
    }
  }

  return candidates;
}

async function main() {
  const modeLabel = isVenueMode ? 'VENUE' : 'JITTER';
  console.log(`\nFix Geocoding Migration [${modeLabel}] — ${isDryRun ? 'DRY RUN' : 'LIVE MODE'}${isResume ? ' (RESUME)' : ''}`);
  console.log('='.repeat(60));

  // 1. Fetch all events
  const allEvents = await fetchAllEvents();

  // 2. Handle resume checkpoint (read before backup decision)
  let resumeAfterEventId: string | null = null;
  let backupPath: string | null = null;
  if (isResume) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      resumeAfterEventId = checkpoint.lastEventId;
      backupPath = checkpoint.backupPath ?? null;
      console.log(`\n  Resuming after event: ${resumeAfterEventId}`);
      if (backupPath) {
        console.log(`  Using original backup: ${backupPath}`);
      }
    } else {
      console.log('\n  No checkpoint found, starting from beginning');
    }
  }

  // 3. Create durable backup BEFORE any changes (skip on resume — original backup preserved)
  if (!isDryRun && !backupPath) {
    console.log('\nCreating durable backup...');
    backupPath = await createBackup(allEvents);
  }

  // 4. Identify migration candidates (mode-dependent)
  console.log(`\nIdentifying ${isVenueMode ? 'venue' : 'jitter'} migration candidates...`);
  const candidates = isVenueMode ? identifyVenueCandidates(allEvents) : identifyCandidates(allEvents);
  console.log(`  Found ${candidates.length} candidates out of ${allEvents.length} total events`);

  const byReason: Record<string, number> = {};
  for (const c of candidates) {
    byReason[c.reason] = (byReason[c.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(byReason)) {
    console.log(`    ${reason}: ${count}`);
  }

  // Skip candidates that were already processed (by stable ID ordering)
  let candidatesToProcess = candidates;
  if (resumeAfterEventId) {
    const resumeIdx = candidates.findIndex(c => c.id === resumeAfterEventId);
    if (resumeIdx >= 0) {
      candidatesToProcess = candidates.slice(resumeIdx + 1);
      console.log(`  Skipped ${resumeIdx + 1} already-processed candidates, ${candidatesToProcess.length} remaining`);
    } else {
      console.log(`  WARNING: Resume event ID not found in candidates, starting from beginning`);
    }
  }

  // 5. Process candidates in batches
  let corrected = 0;
  let nulled = 0;
  let unchanged = 0;
  const dryRunLog: DryRunEntry[] = [];

  const totalBatches = Math.ceil(candidatesToProcess.length / BATCH_SIZE);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * BATCH_SIZE;
    const batch = candidatesToProcess.slice(batchStart, batchStart + BATCH_SIZE);

    for (const event of batch) {
      // Re-run normalizer with enhanced pipeline
      const result = normalizeEventLocation({
        title: event.title,
        description: event.description?.slice(0, 300),
        location_name: event.location_name ?? undefined,
        address: event.address ?? undefined,
        postal_code: event.postal_code ?? undefined,
        bundesland: event.bundesland ?? undefined,
        latitude: event.latitude ?? undefined,
        longitude: event.longitude ?? undefined,
      });

      // Check if result has acceptable confidence (not fuzzy)
      const acceptableConfidence = result && (
        result.confidence === 'exact' ||
        result.confidence === 'normalized' ||
        result.confidence === 'from_title' ||
        result.confidence === 'from_description'
      );

      if (acceptableConfidence && result) {
        // Event resolves correctly now
        const distKm = (event.latitude != null && event.longitude != null)
          ? haversineKm(event.latitude, event.longitude, result.latitude, result.longitude)
          : null;

        if (isDryRun) {
          dryRunLog.push({
            event_id: event.id,
            location_name: event.location_name,
            old_lat: event.latitude,
            old_lng: event.longitude,
            new_lat: result.latitude,
            new_lng: result.longitude,
            old_confidence: event.geocoding_confidence,
            new_confidence: result.confidence,
            distance_km: distKm != null ? Math.round(distKm * 10) / 10 : null,
            action: 'correct',
          });
        } else {
          const { error } = await supabase
            .from('events')
            .update({
              latitude: result.latitude,
              longitude: result.longitude,
              geocoding_confidence: result.confidence,
              geocoding_source: 'geonames',
            })
            .eq('id', event.id);

          if (error) {
            console.error(`  Error updating event ${event.id}: ${error.message}`);
          }
        }
        corrected++;
      } else {
        // Cannot resolve — set to NULL (better than wrong location)
        if (event.latitude != null || event.longitude != null) {
          if (isDryRun) {
            dryRunLog.push({
              event_id: event.id,
              location_name: event.location_name,
              old_lat: event.latitude,
              old_lng: event.longitude,
              new_lat: null,
              new_lng: null,
              old_confidence: event.geocoding_confidence,
              new_confidence: null,
              distance_km: null,
              action: 'null',
            });
          } else {
            const { error } = await supabase
              .from('events')
              .update({
                latitude: null,
                longitude: null,
                geocoding_confidence: null,
                geocoding_source: null,
              })
              .eq('id', event.id);

            if (error) {
              console.error(`  Error nulling event ${event.id}: ${error.message}`);
            }
          }
          nulled++;
        } else {
          // Already NULL coords, already NULL confidence — nothing to do
          unchanged++;
        }
      }
    }

    // Save checkpoint after each batch (live mode only)
    if (!isDryRun && batch.length > 0) {
      saveCheckpoint(batchNum + 1, batch[batch.length - 1].id, backupPath ?? '');
    }

    process.stdout.write(`  Batch ${batchNum + 1}/${totalBatches} processed (${corrected} corrected, ${nulled} nulled, ${unchanged} unchanged)\r`);
  }

  // 6. Report
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('MIGRATION REPORT');
  console.log('='.repeat(60));
  console.log(`  Total candidates:  ${candidates.length}`);
  console.log(`  Corrected:         ${corrected} (re-resolved with acceptable confidence)`);
  console.log(`  Set to NULL:       ${nulled} (could not resolve, coords removed)`);
  console.log(`  Unchanged:         ${unchanged} (already NULL, no resolution found)`);
  console.log(`  Total processed:   ${corrected + nulled + unchanged}`);

  if (isDryRun && dryRunLog.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('DRY RUN DETAILS (first 100):');
    console.log('─'.repeat(80));

    const locCol = isVenueMode ? 'location'.padEnd(30) : '';
    console.log(
      'event_id'.padEnd(40) +
      locCol +
      'old_lat'.padEnd(10) +
      'old_lng'.padEnd(10) +
      'new_lat'.padEnd(10) +
      'new_lng'.padEnd(10) +
      'dist_km'.padEnd(10) +
      'old_conf'.padEnd(15) +
      'new_conf'.padEnd(15) +
      'action'
    );
    console.log('─'.repeat(isVenueMode ? 160 : 130));

    for (const entry of dryRunLog.slice(0, 100)) {
      const locVal = isVenueMode ? (entry.location_name?.slice(0, 28) ?? '').padEnd(30) : '';
      console.log(
        entry.event_id.slice(0, 38).padEnd(40) +
        locVal +
        (entry.old_lat?.toFixed(4) ?? 'NULL').padEnd(10) +
        (entry.old_lng?.toFixed(4) ?? 'NULL').padEnd(10) +
        (entry.new_lat?.toFixed(4) ?? 'NULL').padEnd(10) +
        (entry.new_lng?.toFixed(4) ?? 'NULL').padEnd(10) +
        (entry.distance_km?.toString() ?? '-').padEnd(10) +
        (entry.old_confidence ?? 'NULL').padEnd(15) +
        (entry.new_confidence ?? 'NULL').padEnd(15) +
        entry.action
      );
    }

    if (dryRunLog.length > 100) {
      console.log(`  ... and ${dryRunLog.length - 100} more entries`);
    }
  }

  // Clean up checkpoint on successful completion
  if (!isDryRun) {
    clearCheckpoint();
    console.log('\n  Migration complete. Checkpoint cleared.');
  } else {
    console.log(`\n  DRY RUN complete. Run without --dry-run to apply changes.`);
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
