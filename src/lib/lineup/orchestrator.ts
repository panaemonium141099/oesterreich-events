/**
 * Festival Lineup Orchestrator
 *
 * Reads festivals from the database, dispatches to the correct lineup scraper,
 * upserts festival_artists rows (with app-normalized names), generates derived
 * events, and backlinks festival_artists.derived_event_id + touches updated_at.
 *
 * Pattern adapted from src/lib/scrapers/RegistryBasedScraper.ts.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.6
 */

import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Festival, FestivalArtist as DbFestivalArtist } from '@/types/festivals';
import type { FestivalArtist as ScrapedArtist, FestivalLineupResult } from './types';
import { normalizeArtistName } from './normalize';
import { BaseLineupScraper } from './BaseLineupScraper';
import { createLineupScraper } from './scrapers';
import { deriveFestivalEvents, type DeriveEventsResult } from './derive-events';

// ── Types ───────────────────────────────────────────────────────────────────

export interface OrchestratorOptions {
  /** Only process this festival slug */
  festivalSlug?: string;
  /** Ignore lineup_hash, force re-scrape */
  force?: boolean;
  /** Dry-run: scrape + compute diff but skip all DB writes */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export interface OrchestratorStats {
  festivals_checked: number;
  festivals_skipped_no_scraper: number;
  festivals_skipped_unchanged: number;
  festivals_changed: number;
  festivals_errored: number;
  artists_added: number;
  artists_removed: number;
  events_derived: number;
  events_backlinked: number;
  duration_ms: number;
}

// ── Scraper registry ────────────────────────────────────────────────────────
// Uses the centralized LINEUP_SCRAPER_REGISTRY from ./scrapers/index.ts.
// All 9 festival scrapers are registered there with DB-matching slugs.

/**
 * Look up a scraper by festival slug.
 * Delegates to the centralized registry in ./scrapers/index.ts.
 */
export function getScraperForSlug(slug: string): BaseLineupScraper | null {
  return createLineupScraper(slug);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function log(message: string, verbose = true): void {
  if (!verbose) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [lineup-orchestrator] ${message}`);
}

/**
 * Compute a lineup hash from sorted normalized artist names.
 * Used to detect whether a festival's lineup has changed.
 */
function computeLineupHash(artists: ScrapedArtist[]): string {
  const sorted = artists
    .map((a) => a.artist_name_normalized)
    .sort()
    .join('|');
  return createHash('sha256').update(sorted, 'utf8').digest('hex');
}

// ── Core orchestration ──────────────────────────────────────────────────────

/**
 * Fetch festivals eligible for lineup scraping.
 */
async function fetchEligibleFestivals(
  supabase: SupabaseClient,
  options: OrchestratorOptions
): Promise<Festival[]> {
  let query = supabase
    .from('festivals')
    .select('*')
    .eq('direct_lineup_candidate', true)
    .not('lineup_url', 'is', null);

  if (options.festivalSlug) {
    query = query.eq('slug', options.festivalSlug);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch festivals: ${error.message}`);
  }

  return (data ?? []) as Festival[];
}

/**
 * Fetch existing festival_artists rows for a festival.
 */
async function fetchExistingArtists(
  supabase: SupabaseClient,
  festivalId: string
): Promise<DbFestivalArtist[]> {
  const { data, error } = await supabase
    .from('festival_artists')
    .select('*')
    .eq('festival_id', festivalId);

  if (error) {
    throw new Error(`Failed to fetch festival_artists: ${error.message}`);
  }

  return (data ?? []) as DbFestivalArtist[];
}

/**
 * Process a single festival: scrape lineup, compute diff, upsert/remove artists.
 */
async function processFestival(
  supabase: SupabaseClient,
  festival: Festival,
  options: OrchestratorOptions,
  stats: OrchestratorStats
): Promise<void> {
  const verbose = options.verbose ?? false;

  // 1. Look up scraper
  const scraper = getScraperForSlug(festival.slug);
  if (!scraper) {
    log(`No scraper registered for "${festival.slug}", skipping`, verbose);
    stats.festivals_skipped_no_scraper++;
    return;
  }

  // 2. Run scraper
  log(`Scraping lineup for "${festival.canonical_name}" (${festival.slug})...`, verbose);
  let result: FestivalLineupResult;
  try {
    result = await scraper.run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Scraper error for "${festival.slug}": ${msg}`, true);
    stats.festivals_errored++;

    // Update lineup_status to 'error' even if dry-run? No, respect dry-run.
    if (!options.dryRun) {
      await supabase
        .from('festivals')
        .update({
          lineup_status: 'error',
          lineup_last_checked_at: new Date().toISOString(),
        })
        .eq('id', festival.id);
    }
    return;
  }

  if (!result.success || result.artists.length === 0) {
    log(
      `Scraper returned ${result.success ? '0 artists' : `error: ${result.error}`} for "${festival.slug}"`,
      verbose
    );
    stats.festivals_errored++;
    if (!options.dryRun) {
      await supabase
        .from('festivals')
        .update({
          lineup_status: result.success ? 'no_lineup' : 'error',
          lineup_last_checked_at: new Date().toISOString(),
        })
        .eq('id', festival.id);
    }
    return;
  }

  // 3. Compute lineup hash
  const newHash = computeLineupHash(result.artists);

  // 4. Compare with existing hash -- skip if unchanged (unless --force)
  if (!options.force && festival.lineup_hash === newHash) {
    log(`Lineup unchanged for "${festival.slug}" (hash match), skipping`, verbose);
    stats.festivals_skipped_unchanged++;

    if (!options.dryRun) {
      await supabase
        .from('festivals')
        .update({ lineup_last_checked_at: new Date().toISOString() })
        .eq('id', festival.id);
    }
    return;
  }

  log(
    `Lineup changed for "${festival.slug}": ${result.artists.length} artists scraped` +
      (festival.lineup_hash ? ' (hash mismatch)' : ' (first scrape)'),
    verbose
  );

  // 5. Fetch existing festival_artists for diff computation
  const existingArtists = await fetchExistingArtists(supabase, festival.id);
  const existingByNormalized = new Map(
    existingArtists.map((a) => [a.artist_name_normalized, a])
  );

  // Build set of scraped normalized names
  const scrapedNormalized = new Set(
    result.artists.map((a) => a.artist_name_normalized)
  );

  // 6. Compute diff: added and removed artists
  const addedArtists = result.artists.filter(
    (a) => !existingByNormalized.has(a.artist_name_normalized)
  );
  const removedArtists = existingArtists.filter(
    (a) => !scrapedNormalized.has(a.artist_name_normalized)
  );

  // Also find updated artists (exist in both but may have new day/stage info)
  const updatedArtists = result.artists.filter(
    (a) => existingByNormalized.has(a.artist_name_normalized)
  );

  if (options.dryRun) {
    log(
      `[DRY-RUN] "${festival.slug}": ` +
        `${addedArtists.length} to add, ${removedArtists.length} to remove, ` +
        `${updatedArtists.length} unchanged/updated`,
      true
    );
    if (addedArtists.length > 0) {
      log(`  Added: ${addedArtists.map((a) => a.artist_name_raw).join(', ')}`, true);
    }
    if (removedArtists.length > 0) {
      log(
        `  Removed: ${removedArtists.map((a) => a.artist_name_raw).join(', ')}`,
        true
      );
    }
    stats.festivals_changed++;
    stats.artists_added += addedArtists.length;
    stats.artists_removed += removedArtists.length;
    return;
  }

  // 7. Remove artists that are no longer in the lineup
  for (const removed of removedArtists) {
    if (removed.derived_event_id) {
      // Use delete_derived_event RPC for atomic cleanup
      const { error } = await supabase.rpc('delete_derived_event', {
        p_event_id: removed.derived_event_id,
      });
      if (error) {
        log(
          `Error deleting derived event ${removed.derived_event_id} for "${removed.artist_name_raw}": ${error.message}`,
          true
        );
      } else {
        log(`Deleted derived event for removed artist "${removed.artist_name_raw}"`, verbose);
      }
    } else {
      // No derived event -- delete the festival_artists row directly
      const { error } = await supabase
        .from('festival_artists')
        .delete()
        .eq('id', removed.id);
      if (error) {
        log(
          `Error deleting festival_artist row for "${removed.artist_name_raw}": ${error.message}`,
          true
        );
      }
    }
  }
  stats.artists_removed += removedArtists.length;

  // 8. Upsert new + updated artists
  //    ON CONFLICT (festival_id, artist_name_normalized) DO UPDATE
  const upsertRows = result.artists.map((a) => ({
    festival_id: festival.id,
    artist_name_raw: a.artist_name_raw,
    artist_name_normalized: normalizeArtistName(a.artist_name_raw),
    day_label: a.day_label,
    stage_name: a.stage_name,
    billing: a.billing,
    source_url: a.source_url,
    source_type: 'scraper',
    confidence_score: a.confidence_score,
  }));

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
    const batch = upsertRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('festival_artists')
      .upsert(batch, {
        onConflict: 'festival_id,artist_name_normalized',
      });

    if (error) {
      log(`Error upserting festival_artists batch: ${error.message}`, true);
    }
  }
  stats.artists_added += addedArtists.length;

  // 9. Update festival metadata
  await supabase
    .from('festivals')
    .update({
      lineup_hash: newHash,
      lineup_status: 'fetched',
      lineup_last_checked_at: new Date().toISOString(),
    })
    .eq('id', festival.id);

  stats.festivals_changed++;
  log(
    `Updated "${festival.slug}": +${addedArtists.length} artists, -${removedArtists.length} removed`,
    verbose
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the full lineup orchestration pipeline.
 *
 * 1. Fetch eligible festivals (direct_lineup_candidate = true, lineup_url set)
 * 2. For each festival: scrape lineup, compute diff, upsert/remove artists
 * 3. Generate derived events for un-derived festival_artists rows
 * 4. Return stats
 */
export async function runLineupOrchestrator(
  options: OrchestratorOptions = {}
): Promise<OrchestratorStats> {
  const startTime = Date.now();
  const verbose = options.verbose ?? false;

  const stats: OrchestratorStats = {
    festivals_checked: 0,
    festivals_skipped_no_scraper: 0,
    festivals_skipped_unchanged: 0,
    festivals_changed: 0,
    festivals_errored: 0,
    artists_added: 0,
    artists_removed: 0,
    events_derived: 0,
    events_backlinked: 0,
    duration_ms: 0,
  };

  const supabase = getSupabaseAdmin();

  // 1. Fetch eligible festivals
  log('Fetching eligible festivals...', verbose);
  const festivals = await fetchEligibleFestivals(supabase, options);
  stats.festivals_checked = festivals.length;
  log(`Found ${festivals.length} eligible festivals`, verbose);

  if (festivals.length === 0) {
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  // 2. Process each festival sequentially (scrapers have rate limiting)
  for (const festival of festivals) {
    await processFestival(supabase, festival, options, stats);
  }

  // 3. Generate derived events (skip in dry-run)
  if (!options.dryRun) {
    log('Generating derived events...', verbose);
    const deriveResult = await deriveFestivalEvents(supabase, {
      festivalSlug: options.festivalSlug,
      verbose,
    });
    stats.events_derived = deriveResult.events_created;
    stats.events_backlinked = deriveResult.events_backlinked;
    log(
      `Derived events: ${deriveResult.events_created} created, ${deriveResult.events_backlinked} backlinked`,
      verbose
    );
  }

  stats.duration_ms = Date.now() - startTime;
  return stats;
}
