/**
 * Seed venue_aliases from existing venue data.
 *
 * Generates normalized aliases for all venues and upserts them into
 * the venue_aliases table. Also backfills venues.website_host and
 * venues.display_name where missing.
 *
 * Run BEFORE the venue matching backfill.
 *
 * Usage:
 *   npx tsx src/scripts/seed-venue-aliases.ts --dry-run
 *   npx tsx src/scripts/seed-venue-aliases.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeVenueName,
  normalizeVenueNameCompact,
  isGenericVenueName,
  extractHost,
} from '../lib/pipeline/normalize-venue';

// ─── ENV LOADING ────────────────────────────────────────────────────────────
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
} catch { /* ignore missing .env.local */ }

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const FETCH_BATCH_SIZE = 1000;
const UPSERT_BATCH_SIZE = 200;

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface VenueRecord {
  id: string;
  name: string;
  name_normalized: string | null;
  display_name: string | null;
  city: string | null;
  website: string | null;
  website_host: string | null;
}

interface AliasCandidate {
  venue_id: string;
  alias_normalized: string;
  alias_source: string;
  confidence: number;
}

// ─── FETCH ALL VENUES ───────────────────────────────────────────────────────

async function fetchAllVenues(supabase: SupabaseClient): Promise<VenueRecord[]> {
  const venues: VenueRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, name_normalized, display_name, city, website, website_host')
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) throw new Error(`Failed to fetch venues: ${error.message}`);
    if (!data || data.length === 0) break;

    venues.push(...data);
    if (data.length < FETCH_BATCH_SIZE) break;
    from += FETCH_BATCH_SIZE;
  }

  return venues;
}

// ─── ALIAS GENERATION ───────────────────────────────────────────────────────

/**
 * Strip city suffix from a venue name to produce a short display name.
 * "Flex Wien" → "Flex"
 * "Stadthalle Graz" → "Stadthalle Graz" (generic, keep city)
 */
function extractDisplayName(name: string, city: string | null): string | null {
  if (!city) return null;

  // Try stripping city from end: "Flex Wien" → "Flex"
  const cityLower = city.toLowerCase().trim();
  const nameLower = name.toLowerCase().trim();

  // Patterns: "Name City", "Name, City", "Name - City", "Name (City)"
  const patterns = [
    new RegExp(`\\s*[,\\-–]\\s*${escapeRegex(cityLower)}\\s*$`, 'i'),
    new RegExp(`\\s*\\(${escapeRegex(cityLower)}\\)\\s*$`, 'i'),
    new RegExp(`\\s+${escapeRegex(cityLower)}\\s*$`, 'i'),
  ];

  for (const pattern of patterns) {
    if (pattern.test(name)) {
      const short = name.replace(pattern, '').trim();
      if (short.length >= 2) return short;
    }
  }

  // Also try with common city abbreviations
  if (cityLower === 'wien' || cityLower === 'vienna') {
    const viennaPatterns = [
      /\s*[,\-–]\s*(?:wien|vienna)\s*$/i,
      /\s*\((?:wien|vienna)\)\s*$/i,
      /\s+(?:wien|vienna)\s*$/i,
    ];
    for (const pattern of viennaPatterns) {
      if (pattern.test(name)) {
        const short = name.replace(pattern, '').trim();
        if (short.length >= 2) return short;
      }
    }
  }

  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate alias candidates for a single venue.
 */
function generateAliases(venue: VenueRecord): AliasCandidate[] {
  const aliases: AliasCandidate[] = [];
  const seen = new Set<string>();

  function addAlias(normalized: string, source: string, confidence: number) {
    if (!normalized || normalized.length < 2) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const generic = isGenericVenueName(normalized);

    if (generic) {
      // Generic names without city context: skip entirely
      // Generic names with city: seed with reduced confidence 0.5
      const hasCity = normalizeVenueName(venue.name) !== normalizeVenueNameCompact(venue.name);
      if (!hasCity) return; // Skip generic name without city
      confidence = 0.5;
    }

    aliases.push({
      venue_id: venue.id,
      alias_normalized: normalized,
      alias_source: source,
      confidence,
    });
  }

  // a. name → normalized alias (confidence 1.0)
  const normalizedName = normalizeVenueName(venue.name);
  addAlias(normalizedName, 'name', 1.0);

  // b. name_normalized → alias if different from name (confidence 1.0)
  if (venue.name_normalized) {
    const normalizedExisting = normalizeVenueName(venue.name_normalized);
    if (normalizedExisting !== normalizedName) {
      addAlias(normalizedExisting, 'name_normalized', 1.0);
    }
  }

  // c. display_name → alias if present and different (confidence 0.9)
  if (venue.display_name) {
    const normalizedDisplay = normalizeVenueName(venue.display_name);
    addAlias(normalizedDisplay, 'display_name', 0.9);
  }

  // d. City variant: strip city to generate short alias (confidence 0.8)
  const compact = normalizeVenueNameCompact(venue.name);
  if (compact !== normalizedName && compact.length >= 2) {
    addAlias(compact, 'city_variant', 0.8);
  }

  return aliases;
}

// ─── WEBSITE HOST EXTRACTION ────────────────────────────────────────────────

interface VenueUpdate {
  id: string;
  website_host?: string;
  display_name?: string;
}

function computeVenueUpdates(venues: VenueRecord[]): VenueUpdate[] {
  const updates: VenueUpdate[] = [];

  for (const venue of venues) {
    const patch: VenueUpdate = { id: venue.id };
    let needsUpdate = false;

    // Extract website_host if not already set
    if (!venue.website_host && venue.website) {
      const host = extractHost(venue.website);
      if (host) {
        patch.website_host = host;
        needsUpdate = true;
      }
    }

    // Compute display_name if not already set
    if (!venue.display_name && venue.city) {
      const displayName = extractDisplayName(venue.name, venue.city);
      if (displayName) {
        patch.display_name = displayName;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.push(patch);
    }
  }

  return updates;
}

// ─── UPSERT ALIASES ────────────────────────────────────────────────────────

async function upsertAliases(
  supabase: SupabaseClient,
  aliases: AliasCandidate[],
): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < aliases.length; i += UPSERT_BATCH_SIZE) {
    const batch = aliases.slice(i, i + UPSERT_BATCH_SIZE);
    const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(aliases.length / UPSERT_BATCH_SIZE);

    const { error } = await supabase
      .from('venue_aliases')
      .upsert(
        batch.map(a => ({
          venue_id: a.venue_id,
          alias_normalized: a.alias_normalized,
          alias_source: a.alias_source,
          confidence: a.confidence,
        })),
        {
          onConflict: 'venue_id,alias_normalized',
          ignoreDuplicates: false,
        },
      );

    if (error) {
      console.error(`  Alias batch ${batchNum}/${totalBatches} error: ${error.message}`);
      errors += batch.length;
    } else {
      upserted += batch.length;
    }

    if (batchNum % 20 === 0 || batchNum === totalBatches) {
      console.log(`  Alias batch ${batchNum}/${totalBatches}: ${upserted} upserted so far`);
    }
  }

  return { upserted, errors };
}

async function applyVenueUpdates(
  supabase: SupabaseClient,
  updates: VenueUpdate[],
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += UPSERT_BATCH_SIZE) {
    const batch = updates.slice(i, i + UPSERT_BATCH_SIZE);
    const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;

    for (const update of batch) {
      const { id, ...fields } = update;
      const { error } = await supabase
        .from('venues')
        .update(fields)
        .eq('id', id);

      if (error) {
        errors++;
      } else {
        updated++;
      }
    }

    if (batchNum % 10 === 0) {
      console.log(`  Venue update batch ${batchNum}: ${updated} updated so far`);
    }
  }

  return { updated, errors };
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) console.log('DRY RUN: No data will be written to Supabase\n');

  // Validate env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Fetch all venues
  console.log('Fetching all venues...');
  const venues = await fetchAllVenues(supabase);
  console.log(`Loaded ${venues.length} venues`);

  if (venues.length === 0) {
    console.log('No venues found. Nothing to do.');
    process.exit(0);
  }

  // 2. Generate aliases for all venues
  console.log('\nGenerating aliases...');
  const allAliases: AliasCandidate[] = [];
  let genericSkipped = 0;

  for (const venue of venues) {
    const candidates = generateAliases(venue);
    allAliases.push(...candidates);
  }

  // Count generics that were skipped (venues with generic name and no city)
  for (const venue of venues) {
    const normalized = normalizeVenueName(venue.name);
    const compact = normalizeVenueNameCompact(venue.name);
    if (isGenericVenueName(normalized) && normalized === compact) {
      genericSkipped++;
    }
  }

  console.log(`Generated ${allAliases.length} aliases`);
  console.log(`Generic names skipped (no city): ${genericSkipped}`);

  // Count by source
  const bySource = new Map<string, number>();
  for (const a of allAliases) {
    bySource.set(a.alias_source, (bySource.get(a.alias_source) || 0) + 1);
  }
  console.log('\nAliases by source:');
  for (const [source, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }

  // 3. Compute venue updates (website_host, display_name)
  console.log('\nComputing venue updates (website_host, display_name)...');
  const venueUpdates = computeVenueUpdates(venues);
  const hostUpdates = venueUpdates.filter(u => u.website_host);
  const displayNameUpdates = venueUpdates.filter(u => u.display_name);
  console.log(`Website hosts to extract: ${hostUpdates.length}`);
  console.log(`Display names to set: ${displayNameUpdates.length}`);

  // 4. Print sample
  console.log('\nSample aliases (first 20):');
  for (const a of allAliases.slice(0, 20)) {
    const genericTag = a.confidence === 0.5 ? ' [GENERIC]' : '';
    console.log(
      `  venue=${a.venue_id.substring(0, 8)}... alias="${a.alias_normalized}" ` +
        `source=${a.alias_source} confidence=${a.confidence}${genericTag}`,
    );
  }

  if (hostUpdates.length > 0) {
    console.log('\nSample website_host extractions (first 10):');
    for (const u of hostUpdates.slice(0, 10)) {
      const venue = venues.find(v => v.id === u.id);
      console.log(`  ${venue?.name} → ${u.website_host}`);
    }
  }

  if (displayNameUpdates.length > 0) {
    console.log('\nSample display_name extractions (first 10):');
    for (const u of displayNameUpdates.slice(0, 10)) {
      const venue = venues.find(v => v.id === u.id);
      console.log(`  "${venue?.name}" → "${u.display_name}"`);
    }
  }

  // 5. Apply changes
  if (!dryRun) {
    // Upsert aliases
    if (allAliases.length > 0) {
      console.log(`\nUpserting ${allAliases.length} aliases...`);
      const aliasResult = await upsertAliases(supabase, allAliases);
      console.log(
        `Aliases: ${aliasResult.upserted} upserted, ${aliasResult.errors} errors`,
      );
    }

    // Update venues
    if (venueUpdates.length > 0) {
      console.log(`\nUpdating ${venueUpdates.length} venues (website_host, display_name)...`);
      const venueResult = await applyVenueUpdates(supabase, venueUpdates);
      console.log(
        `Venues: ${venueResult.updated} updated, ${venueResult.errors} errors`,
      );
    }

    console.log('\nDone.');
  } else {
    console.log('\n=== DRY RUN SUMMARY ===');
    console.log(`Total aliases to create: ${allAliases.length}`);
    console.log(`Generic names skipped: ${genericSkipped}`);
    console.log(`Website hosts to extract: ${hostUpdates.length}`);
    console.log(`Display names to set: ${displayNameUpdates.length}`);
    console.log(`Venue updates total: ${venueUpdates.length}`);
    console.log('\nDry run complete. No data written.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
