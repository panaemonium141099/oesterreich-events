// src/lib/pipeline/types.ts

/**
 * Quality flags that can be attached to events during the pipeline.
 */
export type FlagType =
  | 'missing_coords'
  | 'missing_date'
  | 'missing_title'
  | 'missing_location'
  | 'outside_austria'
  | 'short_title'
  | 'duplicate_suspect'
  | 'venue_unmatched'
  | 'venue_geo_mismatch';

export interface QualityFlag {
  type: FlagType;
  severity: 'info' | 'warning' | 'error';
  detail?: string;
}

/**
 * A normalized event candidate as it flows through the pipeline.
 * Fields prefixed with `normalized_` are the cleaned/validated versions.
 */
export interface NormalizedCandidate {
  // Identity
  id?: string;
  source_id: string;
  scraper_name: string;

  // Core fields
  normalized_title: string;
  normalized_description?: string | null;
  normalized_start_date: string; // ISO 8601
  normalized_end_date?: string | null;

  // Location fields
  normalized_location_name?: string | null;
  normalized_address?: string | null;
  normalized_city?: string | null;
  normalized_postal_code?: string | null;
  normalized_bundesland?: string | null;
  normalized_latitude?: number | null;
  normalized_longitude?: number | null;

  // URLs
  normalized_source_url?: string | null;
  normalized_ticket_url?: string | null;
  normalized_image_url?: string | null;

  // Classification
  normalized_category?: string | null;
  normalized_tags?: string[] | null;

  // Venue matching (set at runtime, NOT persisted in normalized_event_candidates table)
  venue_id?: string | null;
  venue_match_confidence?: number | null;
  venue_match_stage?: number | null;

  // Quality
  quality_score?: number | null;
  quality_flags?: QualityFlag[];
}

/**
 * Result of the canonical upsert step.
 */
export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}
