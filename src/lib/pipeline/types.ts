// src/lib/pipeline/types.ts

/**
 * Date normalization result types.
 */
export type DatePrecision = 'exact' | 'day_only' | 'month_only' | 'inferred' | null;
export type EndDatePrecision = 'exact' | 'day_only' | 'inferred' | 'missing';

export interface NormalizedDateResult {
  startAt: Date | string | null;
  endAt: Date | string | null;
  startPrecision: DatePrecision;
  endPrecision: EndDatePrecision;
}

/**
 * Quality flags that can be attached to events during the pipeline.
 */
export type FlagType =
  | 'missing_coords'
  | 'missing_date'
  | 'missing_title'
  | 'missing_location'
  | 'missing_address_street'
  | 'outside_austria'
  | 'short_title'
  | 'duplicate_uncertain'
  | 'duplicate_merged'
  | 'garbage_title'
  | 'venue_unmatched'
  | 'venue_geo_mismatch';

/**
 * Publish status for events.
 */
export type PublishStatus =
  | 'draft'
  | 'published'
  | 'published_low_confidence'
  | 'needs_review'
  | 'suppressed'
  | 'expired'
  | 'duplicate';

/**
 * A persisted event row from the events table (subset of fields used in dedup).
 */
export interface EventRow {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location_name?: string | null;
  address?: string | null;
  district?: string | null;
  postal_code?: string | null;
  bundesland?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_url?: string | null;
  ticket_url?: string | null;
  image_url?: string | null;
  category?: string | null;
  tags?: string[] | null;
  source_id?: string | null;
  source_name?: string | null;
  venue_id?: string | null;
  venue_match_confidence?: number | null;
  venue_match_stage?: number | null;
  quality_score?: number | null;
  publish_status?: string | null;
  content_fingerprint?: string | null;
  duplicate_of?: string | null;
  dedup_score?: number | null;
  dedup_cluster_id?: string | null;
  organizer?: string | null;
  price_text?: string | null;
  created_at?: string | null;
}

/**
 * Dedup score breakdown for a pair of events.
 */
export interface DedupScoreBreakdown {
  titleScore: number;
  datetimeScore: number;
  venueScore: number;
  geoScore: number;
  urlScore: number;
  overallScore: number;
  decision: 'merge' | 'uncertain' | 'distinct';
}

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
