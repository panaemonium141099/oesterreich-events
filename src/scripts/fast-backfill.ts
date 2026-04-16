import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const AT_LAT_MIN = 46.3, AT_LAT_MAX = 49.1, AT_LNG_MIN = 9.5, AT_LNG_MAX = 17.2;
const CURSOR_FILE = join(process.cwd(), '.backfill-cursor.txt');

function isOutsideAustria(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat < AT_LAT_MIN || lat > AT_LAT_MAX || lng < AT_LNG_MIN || lng > AT_LNG_MAX;
}

function scoreToPublishStatus(score: number): string {
  if (score >= 60) return 'published';
  if (score >= 40) return 'published_low_confidence';
  if (score >= 20) return 'needs_review';
  return 'suppressed';
}

function computeScore(e: Record<string, unknown>): { score: number; status: string } {
  if (isOutsideAustria(e.latitude as number | null, e.longitude as number | null)) {
    return { score: 0, status: 'suppressed' };
  }

  let s = 0;
  // Completeness (max 25)
  if (e.title && (e.title as string).length > 5) s += 5;
  if (e.start_date) s += 5;
  if (e.location_name) s += 5;
  if (e.category) s += 3;
  if (e.description && (e.description as string).length > 50) s += 4;
  if (e.description && (e.description as string).length > 200) s += 3;

  // Date (max 15)
  if (e.start_date) s += 5;
  const sd = e.start_date as string | null;
  if (sd && sd.includes('T') && !sd.endsWith('T00:00:00')) s += 5;
  if (sd) {
    const d = new Date(sd);
    const now = new Date();
    const twoYears = new Date(); twoYears.setFullYear(twoYears.getFullYear() + 2);
    if (d >= now && d <= twoYears) s += 3;
  }
  if (e.end_date) s += 2;

  // Location (max 25)
  let loc = 0;
  if (e.latitude && e.longitude) loc += 7;
  if (e.address) loc += 5;
  if (e.location_name) loc += 3;
  if (e.latitude && e.longitude) loc += 5;
  if (e.bundesland && e.postal_code) loc += 5;
  s += Math.min(25, loc);

  // Image (10)
  if (e.image_url) s += 10;

  // Links (10)
  if (e.source_url) s += 3;
  if (e.ticket_url) s += 3;
  if (e.source_url || e.ticket_url) s += 4;

  // Dedup (10) + Source trust (2) defaults
  s += 12;

  return { score: s, status: scoreToPublishStatus(s) };
}

const BATCH_SIZE = 50;

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Load cursor from file (survives restarts)
function loadCursor(): string {
  try {
    if (existsSync(CURSOR_FILE)) {
      return readFileSync(CURSOR_FILE, 'utf8').trim();
    }
  } catch {}
  return '';
}

function saveCursor(cursor: string) {
  try { writeFileSync(CURSOR_FILE, cursor); } catch {}
}

async function main() {
  let total = 0;
  let scored = 0;
  let skipped = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  let cursor = loadCursor();

  console.log(`Starting quality score backfill (ID-cursor approach)...`);
  if (cursor) console.log(`Resuming from cursor: ${cursor}`);

  while (true) {
    // Fetch batch by ID order (uses primary key index, always fast)
    let query = sb
      .from('events')
      .select('id,title,description,start_date,end_date,location_name,category,latitude,longitude,address,bundesland,postal_code,image_url,source_url,ticket_url,quality_score')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (cursor) {
      query = query.gt('id', cursor);
    }

    const { data: batch, error: fetchErr } = await query;

    if (fetchErr) {
      console.error(`\nFetch error: ${fetchErr.message}`);
      errors++;
      consecutiveErrors++;
      if (consecutiveErrors > 10) {
        console.log('\n10 consecutive errors, waiting 30s...');
        await sleep(30000);
        consecutiveErrors = 0;
      } else {
        await sleep(2000);
      }
      if (errors > 500) break;
      continue;
    }

    if (!batch || batch.length === 0) break;

    // Update cursor to last ID in batch
    cursor = batch[batch.length - 1].id;
    saveCursor(cursor);

    // Filter to only unscored events
    const unscored = batch.filter(e => e.quality_score === null);
    skipped += batch.length - unscored.length;

    if (unscored.length === 0) {
      total += batch.length;
      process.stderr.write(`\rProcessed: ${total} (scored: ${scored}, skipped: ${skipped})`);
      continue;
    }

    // Score and group by score+status
    const updates: Map<string, string[]> = new Map();
    for (const event of unscored) {
      const { score, status } = computeScore(event);
      const key = `${score}|${status}`;
      if (!updates.has(key)) updates.set(key, []);
      updates.get(key)!.push(event.id);
    }

    // Apply updates
    let batchSuccess = true;
    for (const [key, ids] of updates) {
      const [scoreStr, status] = key.split('|');
      const score = parseInt(scoreStr);

      const { error: updateErr } = await sb
        .from('events')
        .update({ quality_score: score, publish_status: status })
        .in('id', ids);

      if (updateErr) {
        console.error(`\nUpdate error (score=${score}): ${updateErr.message}`);
        errors++;
        batchSuccess = false;
        await sleep(2000);
        break;
      }
    }

    if (batchSuccess) {
      scored += unscored.length;
      total += batch.length;
      consecutiveErrors = 0;
      process.stderr.write(`\rProcessed: ${total} (scored: ${scored}, skipped: ${skipped}, errors: ${errors})`);
    } else {
      consecutiveErrors++;
      if (consecutiveErrors > 10) {
        console.log('\n10 consecutive errors, waiting 30s...');
        await sleep(30000);
        consecutiveErrors = 0;
      }
    }

    // Small delay
    await sleep(50);
  }

  // Clean up cursor file on completion
  try { if (existsSync(CURSOR_FILE)) { writeFileSync(CURSOR_FILE, ''); } } catch {}

  console.log(`\nDone. Processed: ${total}, scored: ${scored}, skipped: ${skipped}, errors: ${errors}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
