/**
 * Festival Seed Script
 *
 * Imports the 172-entry mica austria 2026 festival registry JSON into the
 * `festivals` table and attempts to link each festival to its parent event
 * in the `events` table using a deterministic scoring heuristic.
 *
 * Usage:
 *   npx tsx src/scripts/seed-festivals.ts              # Seed + link
 *   npx tsx src/scripts/seed-festivals.ts --dry-run     # Preview without writing
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.2
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { SeedRegistryEntry, FestivalInsert } from '../types/festivals';

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const SEED_PATH = resolve(__dirname, '../../data/festival-seed-registry.json');

// ── Genre code expansion (for human-readable logs) ───────────────────────────

const GENRE_MAP: Record<string, string> = {
  K: 'Klassik',
  J: 'Jazz',
  P: 'Pop/Rock',
  E: 'Elektronik',
  H: 'Hip-Hop',
  G: 'Global',
  N: 'Neue Musik',
  I: 'Interdisziplinar',
  R: 'R',
  M: 'M',
  W: 'W',
};

// ── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse M/D/YYYY date string to ISO YYYY-MM-DD.
 * Returns null for empty strings or "tba".
 */
function parseDateMDY(raw: string): string | null {
  if (!raw || raw.toLowerCase() === 'tba') return null;

  const trimmed = raw.trim();
  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  // Validate ranges
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Festival record builder ──────────────────────────────────────────────────

function buildFestivalInsert(entry: SeedRegistryEntry): FestivalInsert {
  return {
    canonical_name: entry.name,
    slug: entry.slug,
    website_url: entry.website || null,
    lineup_url: null, // set by lineup scrapers later
    city: entry.city || null,
    state: entry.state || null,
    starts_at: parseDateMDY(entry.start_date),
    ends_at: parseDateMDY(entry.end_date),
    genres: entry.genres || null,
    registry_source: entry.registry_source || null,
    spotify_priority: (entry.spotify_priority_inferred as 'high' | 'medium' | 'low') || null,
    direct_lineup_candidate: entry.direct_lineup_candidate_inferred ?? false,
    lineup_fetch_mode: null,
    lineup_status: 'unknown',
    lineup_hash: null,
    lineup_last_checked_at: null,
    parent_event_id: null, // set by parent-event linking below
  };
}

// ── Parent-event linking ─────────────────────────────────────────────────────

/**
 * Bundesland name normalization map.
 * The seed JSON uses German display names, the events table may use
 * either display or normalized forms.
 */
const BUNDESLAND_ALIASES: Record<string, string[]> = {
  Wien: ['Wien', 'wien'],
  Niederoesterreich: ['Niederoesterreich', 'Niederösterreich', 'NÖ', 'niederoesterreich'],
  Oberoesterreich: ['Oberoesterreich', 'Oberösterreich', 'OÖ', 'oberoesterreich'],
  Steiermark: ['Steiermark', 'steiermark'],
  Salzburg: ['Salzburg', 'salzburg'],
  Tirol: ['Tirol', 'tirol'],
  Kaernten: ['Kaernten', 'Kärnten', 'kaernten'],
  Vorarlberg: ['Vorarlberg', 'vorarlberg'],
  Burgenland: ['Burgenland', 'burgenland'],
};

/**
 * Get all alias forms for a Bundesland name from the seed data.
 */
function getBundeslandAliases(state: string): string[] {
  for (const [, aliases] of Object.entries(BUNDESLAND_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === state.toLowerCase())) {
      return aliases;
    }
  }
  return [state];
}

/**
 * Extract significant tokens from a festival name for title matching.
 * Strips common noise words and very short tokens.
 */
function extractNameTokens(name: string): string[] {
  const noise = new Set([
    'festival', 'fest', 'the', 'and', 'der', 'die', 'das', 'und', 'in', 'am',
    'im', 'zu', 'bei', 'von', 'fur', 'für',
  ]);

  return name
    .toLowerCase()
    .replace(/[^\w\sÄÖÜäöüß]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !noise.has(t));
}

interface LinkCandidate {
  event_id: string;
  event_title: string;
  score: number;
}

/**
 * Search for and score parent event candidates for a festival.
 * Returns the event_id if exactly ONE candidate scores >= 3.
 *
 * Scoring:
 *   +1 for city found in location_name
 *   +1 for bundesland match
 *   +1 for date overlap (event start_date within festival date range)
 *   +2 for all festival name tokens found in event title
 */
async function findParentEvent(
  supabase: SupabaseClient,
  festival: FestivalInsert,
): Promise<{ eventId: string | null; candidates: LinkCandidate[] }> {
  const tokens = extractNameTokens(festival.canonical_name);

  if (tokens.length === 0) {
    return { eventId: null, candidates: [] };
  }

  // Build a title search pattern using the most distinctive token
  // (longest token as proxy for distinctiveness)
  const longestToken = tokens.sort((a, b) => b.length - a.length)[0];

  // Query events with titles containing the longest token
  let query = supabase
    .from('events')
    .select('id, title, start_date, location_name, bundesland')
    .ilike('title', `%${longestToken}%`)
    .gte('start_date', '2025-01-01')
    .limit(50);

  // If festival has dates, narrow the search window
  if (festival.starts_at) {
    const start = new Date(festival.starts_at);
    const windowStart = new Date(start);
    windowStart.setDate(windowStart.getDate() - 30);
    const windowEnd = new Date(start);
    windowEnd.setDate(windowEnd.getDate() + 30);
    query = query
      .gte('start_date', windowStart.toISOString().split('T')[0])
      .lte('start_date', windowEnd.toISOString().split('T')[0]);
  }

  const { data: events, error } = await query;

  if (error || !events || events.length === 0) {
    return { eventId: null, candidates: [] };
  }

  const candidates: LinkCandidate[] = [];
  const bundeslandAliases = festival.state ? getBundeslandAliases(festival.state) : [];

  for (const event of events) {
    let score = 0;

    // +1 for city found in location_name
    if (festival.city && event.location_name) {
      if (event.location_name.toLowerCase().includes(festival.city.toLowerCase())) {
        score += 1;
      }
    }

    // +1 for bundesland match
    if (festival.state && event.bundesland) {
      if (bundeslandAliases.some((a) => a.toLowerCase() === event.bundesland.toLowerCase())) {
        score += 1;
      }
    }

    // +1 for date overlap (event start_date within festival date range)
    if (festival.starts_at && event.start_date) {
      const eventDate = event.start_date.split('T')[0];
      const festStart = festival.starts_at;
      const festEnd = festival.ends_at || festival.starts_at;
      if (eventDate >= festStart && eventDate <= festEnd) {
        score += 1;
      }
    }

    // +2 for all name tokens found in event title
    const titleLower = event.title.toLowerCase();
    const allTokensFound = tokens.every((t) => titleLower.includes(t));
    if (allTokensFound) {
      score += 2;
    }

    if (score > 0) {
      candidates.push({
        event_id: event.id,
        event_title: event.title,
        score,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Link only if exactly ONE candidate scores >= 3
  const highScoreCandidates = candidates.filter((c) => c.score >= 3);

  if (highScoreCandidates.length === 1) {
    return { eventId: highScoreCandidates[0].event_id, candidates };
  }

  return { eventId: null, candidates };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Festival Seed Import ===');
  if (dryRun) console.log('[DRY RUN MODE]\n');

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  const startTime = Date.now();

  // 1. Read seed JSON
  let seedEntries: SeedRegistryEntry[];
  try {
    const raw = readFileSync(SEED_PATH, 'utf-8');
    seedEntries = JSON.parse(raw) as SeedRegistryEntry[];
  } catch (err) {
    console.error(`Failed to read seed file at ${SEED_PATH}:`, err);
    process.exit(1);
  }

  console.log(`Loaded ${seedEntries.length} festival entries from seed registry\n`);

  // 2. Build festival insert rows
  const festivals: FestivalInsert[] = seedEntries.map(buildFestivalInsert);

  // Validate date parsing
  const withDates = festivals.filter((f) => f.starts_at !== null);
  const tba = festivals.filter((f) => f.starts_at === null);
  console.log(`  With dates:  ${withDates.length}`);
  console.log(`  TBA dates:   ${tba.length}`);
  console.log('');

  // 3. Upsert into festivals table (batch)
  if (!dryRun) {
    // Upsert in batches of 50 for safety
    const BATCH_SIZE = 50;
    let upserted = 0;

    for (let i = 0; i < festivals.length; i += BATCH_SIZE) {
      const batch = festivals.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('festivals')
        .upsert(batch, { onConflict: 'slug' });

      if (error) {
        console.error(`Upsert batch ${i / BATCH_SIZE + 1} failed:`, error.message);
        process.exit(1);
      }
      upserted += batch.length;
    }

    console.log(`Upserted ${upserted} festivals into database\n`);
  } else {
    console.log('Would upsert the following festivals:');
    for (const f of festivals) {
      const dates = f.starts_at
        ? `${f.starts_at}${f.ends_at ? ' - ' + f.ends_at : ''}`
        : 'TBA';
      const genreDisplay = (f.genres || '')
        .split(',')
        .map((g) => g.trim())
        .map((g) => GENRE_MAP[g] || g)
        .join(', ');
      console.log(
        `  ${f.slug.padEnd(45)} ${dates.padEnd(25)} ${f.city?.padEnd(20) || ''.padEnd(20)} ${genreDisplay}`,
      );
    }
    console.log('');
  }

  // 4. Parent-event linking
  console.log('--- Parent-Event Linking ---\n');

  // Fetch the upserted festivals to get their IDs
  let festivalRows: { id: string; slug: string; canonical_name: string }[];

  if (!dryRun) {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, slug, canonical_name')
      .order('slug');

    if (error || !data) {
      console.error('Failed to fetch festivals for linking:', error?.message);
      process.exit(1);
    }
    festivalRows = data;
  } else {
    // In dry-run, use slugs as stand-in IDs
    festivalRows = festivals.map((f) => ({
      id: `dry-run-${f.slug}`,
      slug: f.slug,
      canonical_name: f.canonical_name,
    }));
  }

  let linked = 0;
  let unlinked = 0;
  let ambiguous = 0;
  const unlinkLog: string[] = [];

  for (const festival of festivals) {
    const row = festivalRows.find((r) => r.slug === festival.slug);
    if (!row) continue;

    const { eventId, candidates } = await findParentEvent(supabase, festival);

    if (eventId) {
      linked++;
      const match = candidates.find((c) => c.event_id === eventId);
      console.log(
        `  LINKED: ${festival.canonical_name} -> "${match?.event_title}" (score=${match?.score})`,
      );

      if (!dryRun) {
        const { error } = await supabase
          .from('festivals')
          .update({ parent_event_id: eventId })
          .eq('id', row.id);

        if (error) {
          console.error(`  Failed to link ${festival.slug}:`, error.message);
        }
      }
    } else if (candidates.length > 1 && candidates.filter((c) => c.score >= 3).length > 1) {
      ambiguous++;
      console.log(
        `  AMBIGUOUS: ${festival.canonical_name} (${candidates.filter((c) => c.score >= 3).length} candidates with score >= 3)`,
      );
      for (const c of candidates.filter((c) => c.score >= 3).slice(0, 3)) {
        console.log(`    - "${c.event_title}" (score=${c.score})`);
      }
    } else {
      unlinked++;
      const bestScore = candidates.length > 0 ? candidates[0].score : 0;
      const bestTitle = candidates.length > 0 ? candidates[0].event_title : 'no candidates';
      unlinkLog.push(
        `  ${festival.canonical_name.padEnd(40)} best: "${bestTitle}" (score=${bestScore})`,
      );
    }
  }

  // Print unlinked summary
  if (unlinkLog.length > 0) {
    console.log(`\n  Unlinked festivals (${unlinkLog.length}):`);
    for (const line of unlinkLog) {
      console.log(line);
    }
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Results ===');
  console.log(`  Total festivals:  ${festivals.length}`);
  console.log(`  Linked to events: ${linked}`);
  console.log(`  Ambiguous:        ${ambiguous}`);
  console.log(`  Unlinked:         ${unlinked}`);
  console.log(`  Time elapsed:     ${elapsed}s`);
  if (dryRun) console.log('\n  [DRY RUN] No data was written.');
}

main().catch((err) => {
  console.error('Festival seed import failed:', err);
  process.exit(1);
});
