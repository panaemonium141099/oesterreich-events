/**
 * Import festival lineups from a hand-curated JSON file into the
 * `festival_artists` table.
 *
 * Why this exists: bespoke per-festival scrapers (src/lib/lineup/scrapers)
 * only cover ~9 festivals. The other ~100 live in the seed registry but
 * we have no automated way to populate their lineups. This tool reads
 * `data/manual-lineups.json` — a flat map of slug → string[] of artist
 * names — and upserts each name as a `festival_artists` row.
 *
 * Usage:
 *   npx tsx src/scripts/import-manual-lineups.ts            # write
 *   npx tsx src/scripts/import-manual-lineups.ts --dry-run  # preview
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * JSON shape:
 *   {
 *     "festival-slug": [
 *       "Artist One",
 *       "Artist Two",
 *       // ...
 *     ],
 *     "headlining-festival": {
 *       "headliner": ["Big Name"],
 *       "support":   ["Smaller Act 1", "Smaller Act 2"]
 *     }
 *   }
 *
 * Both shapes are accepted — flat array → all 'unknown' billing,
 * object with billing keys → explicit grouping.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

const JSON_PATH = resolve(process.cwd(), 'data/manual-lineups.json');

if (!existsSync(JSON_PATH)) {
  console.error(`Not found: ${JSON_PATH}`);
  console.error('Create the file first — see header comment in this script for the JSON shape.');
  process.exit(1);
}

type Billing = 'headliner' | 'sub_headliner' | 'support' | 'opener' | 'unknown';
const VALID_BILLINGS: Billing[] = ['headliner', 'sub_headliner', 'support', 'opener', 'unknown'];

type RawEntry = string[] | Record<string, string[]>;

interface ParsedArtist {
  name: string;
  billing: Billing;
}

function normalizeName(name: string): string {
  // Collapse whitespace, strip surrounding punctuation, keep the
  // original casing — display name is the same as the input.
  return name.replace(/\s+/g, ' ').replace(/^[-•·\s,]+|[-•·\s,]+$/g, '').trim();
}

function normalizeNameForKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseEntry(raw: RawEntry): ParsedArtist[] {
  const out: ParsedArtist[] = [];
  if (Array.isArray(raw)) {
    for (const name of raw) {
      const clean = normalizeName(String(name));
      if (clean) out.push({ name: clean, billing: 'unknown' });
    }
    return out;
  }
  for (const [key, names] of Object.entries(raw)) {
    const billing: Billing = (VALID_BILLINGS as string[]).includes(key)
      ? (key as Billing)
      : 'unknown';
    if (!Array.isArray(names)) continue;
    for (const name of names) {
      const clean = normalizeName(String(name));
      if (clean) out.push({ name: clean, billing });
    }
  }
  return out;
}

async function main() {
  const data = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Record<string, RawEntry>;
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  const slugs = Object.keys(data);
  console.log(`=== Manual lineup import ===`);
  console.log(`Loaded ${slugs.length} festival slugs from ${JSON_PATH}`);
  if (dryRun) console.log('[DRY RUN] no DB writes will happen.');
  console.log('');

  // Fetch the festival rows we need IDs for.
  const { data: rows, error } = await supabase
    .from('festivals')
    .select('id, slug, canonical_name')
    .in('slug', slugs);

  if (error || !rows) {
    console.error('Failed to fetch festivals:', error?.message);
    process.exit(1);
  }
  const byMSlug = new Map(rows.map(r => [r.slug, r]));
  const missing = slugs.filter(s => !byMSlug.has(s));
  if (missing.length) {
    console.warn(`Warning: ${missing.length} slug(s) not found in DB and will be skipped:`);
    for (const s of missing) console.warn(`  - ${s}`);
    console.log('');
  }

  let totalRows = 0;
  let totalFestivals = 0;
  for (const slug of slugs) {
    const fest = byMSlug.get(slug);
    if (!fest) continue;

    const parsed = parseEntry(data[slug]);
    if (parsed.length === 0) {
      if (verbose) console.log(`  [${slug}] empty entry — skipping.`);
      continue;
    }
    totalFestivals++;

    // De-duplicate by normalized name within this festival.
    const seen = new Set<string>();
    const upsertRows = parsed
      .filter(a => {
        const key = normalizeNameForKey(a.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(a => ({
        festival_id: fest.id,
        artist_name_raw: a.name,
        artist_name_normalized: normalizeNameForKey(a.name),
        billing: a.billing,
        source_type: 'manual',
        confidence_score: 1.0,
      }));

    console.log(`[${slug}] ${upsertRows.length} act(s)`);
    if (verbose) for (const r of upsertRows) console.log(`    · ${r.artist_name_raw} (${r.billing})`);
    totalRows += upsertRows.length;

    if (dryRun) continue;

    // Replace strategy: delete manual-source rows for this festival, then
    // insert fresh. We don't touch scraper-source rows so a bespoke
    // scraper run still wins for festivals that have one.
    const { error: delErr } = await supabase
      .from('festival_artists')
      .delete()
      .eq('festival_id', fest.id)
      .eq('source_type', 'manual');
    if (delErr) {
      console.error(`  delete failed for ${slug}: ${delErr.message}`);
      continue;
    }
    const { error: insErr } = await supabase
      .from('festival_artists')
      .insert(upsertRows);
    if (insErr) {
      console.error(`  insert failed for ${slug}: ${insErr.message}`);
      continue;
    }
    await supabase
      .from('festivals')
      .update({
        lineup_status: 'fetched',
        lineup_fetch_mode: 'manual',
        lineup_last_checked_at: new Date().toISOString(),
      })
      .eq('id', fest.id);
  }

  console.log('');
  console.log(`Festivals processed: ${totalFestivals}`);
  console.log(`Artist rows written: ${totalRows}`);
  if (dryRun) console.log('[DRY RUN] no DB writes happened.');
}

main().catch(err => {
  console.error('Manual lineup import failed:', err);
  process.exit(1);
});
