/**
 * Dump every event in Supabase to a single .txt file for feeding into an LLM.
 *
 * Format: JSONL (one JSON object per line). Tools like ChatGPT's file upload,
 * Claude's context window, and local LLMs all parse JSONL reliably and it
 * loses zero structure vs. a flattened CSV.
 *
 * Usage:
 *   npm run dump-events
 *
 * Output: data/events-dump.jsonl
 */

import { readFileSync, writeFileSync, appendFileSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Load .env.local so this runs standalone.
try {
  const envPath = join(process.cwd(), '.env.local');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* absent, fall through */ }

import { createClient } from '@supabase/supabase-js';

const OUT_PATH = join(process.cwd(), 'data', 'events-dump.jsonl');
const PAGE = 1000;

// The columns we hand to the LLM. Kept narrow-ish so tokens don't blow up —
// drop UI-only fields like source_url, raw_event_id, content_fingerprint,
// geocoding_source / geocoding_confidence, category_candidates, tracking
// metadata. If the LLM needs more, add to this list.
const COLUMNS = [
  'id',
  'title',
  'description',
  'start_date',
  'end_date',
  'location_name',
  'address',
  'postal_code',
  'bundesland',
  'district',
  'latitude',
  'longitude',
  'category',
  'tags',
  'source_category_raw',
  'source_tags_raw',
  'price_text',
  'price_min',
  'price_max',
  'organizer',
  'source_name',
  'quality_score',
  'publish_status',
  'slug',
].join(',');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const onlyPublished = !args.includes('--all');
  const onlyFuture = !args.includes('--all');
  const limit = (() => {
    const idx = args.indexOf('--limit');
    if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10);
    return Infinity;
  })();

  const dir = dirname(OUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const supabase = createClient(url, key);
  const today = new Date().toISOString().split('T')[0];

  console.log(`Dumping events → ${OUT_PATH}`);
  console.log(`  published-only: ${onlyPublished}  future-only: ${onlyFuture}  limit: ${limit === Infinity ? 'none' : limit}`);

  const start = Date.now();
  let offset = 0;
  let total = 0;
  // Truncate the target file up front so this is a clean write, not append.
  writeFileSync(OUT_PATH, '');

  while (total < limit) {
    let query = supabase
      .from('events')
      .select(COLUMNS)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (onlyPublished) query = query.eq('publish_status', 'published');
    if (onlyFuture) query = query.gte('start_date', today);

    const { data, error } = await query;
    if (error) {
      console.error('query error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    const lines = data.map((row) => JSON.stringify(row)).join('\n') + '\n';
    // appendFileSync keeps memory flat — never holds the whole output in RAM.
    appendFileSync(OUT_PATH, lines);

    total += data.length;
    offset += PAGE;
    const elapsed = (Date.now() - start) / 1000;
    process.stdout.write(
      `  dumped=${total} rate=${(total / Math.max(elapsed, 0.001)).toFixed(0)}/s\r`,
    );

    if (data.length < PAGE) break;
  }

  const elapsed = (Date.now() - start) / 1000;
  process.stdout.write('\n');
  const sizeMB = (statSync(OUT_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`Done. ${total} events, ${sizeMB} MB, elapsed ${elapsed.toFixed(1)}s`);
  console.log(`File: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('dump-events failed:', err);
  process.exit(1);
});
