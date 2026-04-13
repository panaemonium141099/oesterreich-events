/**
 * Festival Lineup Watcher
 *
 * Detects lineup changes by comparing normalized artist name sets, and
 * triggers the orchestrator for festivals with stale lineup_last_checked_at.
 *
 * The watcher does NOT own deletion or derivation logic -- it triggers
 * the orchestrator (task 6) which handles the full add/remove/derive cycle.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.8
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runLineupOrchestrator } from './orchestrator';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LineupDiff {
  /** Artists present in new set but not in old set */
  added: string[];
  /** Artists present in old set but not in new set */
  removed: string[];
  /** Artists present in both sets */
  unchanged: string[];
}

export interface WatcherOptions {
  /** Stale threshold in hours (default: 24) */
  staleThresholdHours?: number;
  /** Only check this festival slug */
  festivalSlug?: string;
  /** Force re-scrape regardless of staleness */
  force?: boolean;
  /** Dry-run mode */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export interface WatcherStats {
  festivals_checked: number;
  festivals_stale: number;
  festivals_triggered: number;
  festivals_skipped_fresh: number;
  orchestrator_stats: {
    festivals_changed: number;
    artists_added: number;
    artists_removed: number;
    events_derived: number;
  } | null;
  duration_ms: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string, verbose = true): void {
  if (!verbose) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [lineup-watcher] ${message}`);
}

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

// ── Core functions ──────────────────────────────────────────────────────────

/**
 * Detect lineup changes by comparing two sets of normalized artist names.
 *
 * Returns the diff: added, removed, and unchanged artists.
 */
export function detectLineupChanges(
  oldNames: string[],
  newNames: string[]
): LineupDiff {
  const oldSet = new Set(oldNames);
  const newSet = new Set(newNames);

  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  // Find added and unchanged
  for (const name of newSet) {
    if (oldSet.has(name)) {
      unchanged.push(name);
    } else {
      added.push(name);
    }
  }

  // Find removed
  for (const name of oldSet) {
    if (!newSet.has(name)) {
      removed.push(name);
    }
  }

  return { added, removed, unchanged };
}

/**
 * Run the lineup watcher: find festivals with stale lineup_last_checked_at
 * and trigger the orchestrator for re-scrape.
 *
 * The orchestrator owns the full diff + deletion + derivation logic.
 * The watcher just identifies which festivals need re-checking and
 * delegates to the orchestrator.
 */
export async function runLineupWatcher(
  options: WatcherOptions = {}
): Promise<WatcherStats> {
  const startTime = Date.now();
  const verbose = options.verbose ?? false;
  const staleThresholdHours = options.staleThresholdHours ?? 24;

  const stats: WatcherStats = {
    festivals_checked: 0,
    festivals_stale: 0,
    festivals_triggered: 0,
    festivals_skipped_fresh: 0,
    orchestrator_stats: null,
    duration_ms: 0,
  };

  const supabase = getSupabaseAdmin();

  // 1. Fetch festivals that are eligible for lineup scraping
  log('Checking for festivals with stale lineups...', verbose);

  let query = supabase
    .from('festivals')
    .select('id, slug, canonical_name, lineup_last_checked_at, lineup_status')
    .eq('direct_lineup_candidate', true)
    .not('lineup_url', 'is', null);

  if (options.festivalSlug) {
    query = query.eq('slug', options.festivalSlug);
  }

  const { data: festivals, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch festivals: ${error.message}`);
  }

  if (!festivals || festivals.length === 0) {
    log('No eligible festivals found', verbose);
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  stats.festivals_checked = festivals.length;
  log(`Found ${festivals.length} eligible festivals`, verbose);

  // 2. Filter to stale festivals (lineup_last_checked_at older than threshold)
  const staleThresholdMs = staleThresholdHours * 60 * 60 * 1000;
  const now = Date.now();

  const staleSlugs: string[] = [];

  for (const festival of festivals) {
    const isStale = options.force ||
      !festival.lineup_last_checked_at ||
      (now - new Date(festival.lineup_last_checked_at).getTime()) > staleThresholdMs;

    if (isStale) {
      staleSlugs.push(festival.slug);
      log(
        `Stale: "${festival.canonical_name}" (last checked: ${festival.lineup_last_checked_at ?? 'never'})`,
        verbose
      );
    } else {
      stats.festivals_skipped_fresh++;
      log(
        `Fresh: "${festival.canonical_name}" (last checked: ${festival.lineup_last_checked_at})`,
        verbose
      );
    }
  }

  stats.festivals_stale = staleSlugs.length;

  if (staleSlugs.length === 0) {
    log('All festivals are fresh, nothing to do', verbose);
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  log(`${staleSlugs.length} stale festivals need re-checking`, verbose);

  // 3. Trigger the orchestrator for each stale festival
  //    The orchestrator handles scraping, diffing, upserts, deletions, and derivation.
  for (const slug of staleSlugs) {
    log(`Triggering orchestrator for "${slug}"...`, verbose);

    const orchStats = await runLineupOrchestrator({
      festivalSlug: slug,
      force: options.force,
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    stats.festivals_triggered++;

    // Accumulate orchestrator stats
    if (!stats.orchestrator_stats) {
      stats.orchestrator_stats = {
        festivals_changed: 0,
        artists_added: 0,
        artists_removed: 0,
        events_derived: 0,
      };
    }
    stats.orchestrator_stats.festivals_changed += orchStats.festivals_changed;
    stats.orchestrator_stats.artists_added += orchStats.artists_added;
    stats.orchestrator_stats.artists_removed += orchStats.artists_removed;
    stats.orchestrator_stats.events_derived += orchStats.events_derived;
  }

  stats.duration_ms = Date.now() - startTime;
  return stats;
}
