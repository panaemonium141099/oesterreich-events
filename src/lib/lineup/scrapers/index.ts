/**
 * Festival Lineup Scrapers - barrel export + registry.
 *
 * These scrapers are NOT registered in src/lib/scrapers/index.ts.
 * They run in a separate pipeline via the lineup orchestrator (task 6).
 *
 * The `LINEUP_SCRAPER_REGISTRY` maps festival slug to scraper class,
 * allowing the orchestrator to look up which scraper handles each festival.
 *
 * Tasks: fn-12-festival-lineup-ingestion-pipeline.4, .5
 */

import type { BaseLineupScraper } from '../BaseLineupScraper';

// ── Imports ───────────────────────────────────────────────────────────
// Batch 1 (task 4)
import { FrequencyLineupScraper } from './frequency';
import { NovaRockLineupScraper } from './nova-rock';
import { ElectricLoveLineupScraper } from './electric-love';
import { ShutdownLineupScraper } from './shutdown';
// Batch 2 (task 5)
import { IsleOfSummerLineupScraper } from './isle-of-summer';
import { OneLoveLineupScraper } from './one-love';
import { WoodstockBlasmusikLineupScraper } from './woodstock-blasmusik';
import { PoolbarLineupScraper } from './poolbar';
import { SbamFestLineupScraper } from './sbam-fest';

// ── Re-exports ────────────────────────────────────────────────────────
export {
  // Batch 1 (task 4)
  FrequencyLineupScraper,
  NovaRockLineupScraper,
  ElectricLoveLineupScraper,
  ShutdownLineupScraper,
  // Batch 2 (task 5)
  IsleOfSummerLineupScraper,
  OneLoveLineupScraper,
  WoodstockBlasmusikLineupScraper,
  PoolbarLineupScraper,
  SbamFestLineupScraper,
};

// ── Registry ──────────────────────────────────────────────────────────

/**
 * Registry mapping festival slug -> scraper class constructor.
 * Used by the lineup orchestrator to dispatch the correct scraper
 * for each festival in the database.
 */
export const LINEUP_SCRAPER_REGISTRY: Record<
  string,
  new () => BaseLineupScraper
> = {
  // Batch 1 (task 4) — slugs match festivals.slug in DB
  'fm4-frequency-festival': FrequencyLineupScraper,
  'nova-rock': NovaRockLineupScraper,
  'electric-love-festival': ElectricLoveLineupScraper,
  'shutdown-festival': ShutdownLineupScraper,

  // Batch 2 (task 5)
  'isle-of-summer': IsleOfSummerLineupScraper,
  'one-love-festival': OneLoveLineupScraper,
  'woodstock-der-blasmusik-festival': WoodstockBlasmusikLineupScraper,
  'poolbar-festival': PoolbarLineupScraper,
  'sbam-fest': SbamFestLineupScraper,
};

/**
 * Get a list of all registered festival slugs that have lineup scrapers.
 */
export function getRegisteredFestivalSlugs(): string[] {
  return Object.keys(LINEUP_SCRAPER_REGISTRY);
}

/**
 * Create a scraper instance for a given festival slug.
 * Returns null if no scraper is registered for the slug.
 */
export function createLineupScraper(
  slug: string
): BaseLineupScraper | null {
  const ScraperClass = LINEUP_SCRAPER_REGISTRY[slug];
  if (!ScraperClass) return null;
  return new ScraperClass();
}
