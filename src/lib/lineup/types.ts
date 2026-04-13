/**
 * Types for the Festival Lineup Ingestion Pipeline.
 *
 * These are the scraper-facing types used by BaseLineupScraper and
 * individual festival scrapers. The full database-mapped types
 * (Festival, FestivalArtist with DB fields) live in src/types/festivals.ts
 * once task 2 lands. These types are intentionally minimal and
 * self-contained so scrapers can ship independently.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

/**
 * A single artist extracted from a festival lineup page.
 * One entry per individual artist (collaborative bookings are pre-split).
 */
export interface FestivalArtist {
  /** Raw artist name as scraped from the page */
  artist_name_raw: string;

  /** Normalized name via normalizeArtistName() for matching */
  artist_name_normalized: string;

  /** Day label (e.g. "Thursday", "2026-06-11", "Day 1") or null if unknown */
  day_label: string | null;

  /** Stage name (e.g. "Mainstage", "Tent Stage") or null if unknown */
  stage_name: string | null;

  /** Billing tier: headliner, support, or null if indeterminate */
  billing: 'headliner' | 'support' | null;

  /** URL of the source page where this artist was found */
  source_url: string;

  /** How the data was sourced */
  source_type: 'official_lineup';

  /** Confidence in the extraction (1.0 = official page, scraped directly) */
  confidence_score: number;
}

/**
 * Result returned by a lineup scraper's run() method.
 */
export interface FestivalLineupResult {
  /** Identifier for the festival (slug or canonical name) */
  festivalId: string;

  /** Extracted artists (empty array on failure) */
  artists: FestivalArtist[];

  /** ISO timestamp of when the scrape completed */
  scrapedAt: string;

  /** Whether the scrape succeeded */
  success: boolean;

  /** Error message if success is false */
  error?: string;
}
