// Pipeline types for the Quality System Phase 1
// Spec: docs/superpowers/specs/2026-04-07-quality-system-phase1-design.md

// --- Raw Layer ---

export interface ScrapeRunRow {
  id: string;
  source_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error' | 'partial';
  duration_ms: number | null;
  items_found: number;
  items_parsed: number;
  raw_written: number;
  normalized_count: number;
  matched_count: number;
  items_inserted: number;
  items_updated: number;
  items_skipped: number;
  suppressed_count: number;
  needs_review_count: number;
  successful_batches: number;
  parser_errors: number;
  http_errors: number;
  batch_errors: number;
  duplicate_candidates: number;
  events_without_date: number;
  events_without_location: number;
  events_without_coords: number;
  avg_quality_score: number | null;
  notes_json: Record<string, unknown> | null;
  error_message: string | null;
}

export interface RawEventRow {
  id: string;
  scrape_run_id: string;
  source_name: string;
  source_event_id: string | null;
  source_url: string | null;
  raw_title: string | null;
  raw_description: string | null;
  raw_start_text: string | null;
  raw_end_text: string | null;
  raw_location_name: string | null;
  raw_address: string | null;
  raw_image_url: string | null;
  raw_ticket_url: string | null;
  raw_payload_json: Record<string, unknown> | null;
  content_hash: string;
  fetched_at: string;
}

// --- Normalization ---

export type DatePrecision = 'exact' | 'day_only' | 'inferred';
export type EndDatePrecision = DatePrecision | 'missing';

export interface NormalizedDateResult {
  startAt: Date | null;
  endAt: Date | null;
  startPrecision: DatePrecision | null;
  endPrecision: EndDatePrecision;
}

export interface NormalizedCandidate {
  id?: string;
  raw_event_id: string;
  normalized_title: string | null;
  normalized_title_compact: string | null;
  normalized_start_at: string | null;
  normalized_end_at: string | null;
  start_precision: DatePrecision | null;
  end_precision: EndDatePrecision;
  normalized_location_name: string | null;
  normalized_address: string | null;
  normalized_city: string | null;
  normalized_postal_code: string | null;
  normalized_bundesland: string | null;
  normalized_category: string | null;
  normalized_organizer: string | null;
  normalized_ticket_url: string | null;
  normalized_source_url: string | null;
  normalized_image_url: string | null;
  language_code: string;
  parse_confidence: number | null;
  normalization_version: number;
}

// --- Matching ---

export interface UpsertResults {
  matched: number;
  inserted: number;
  updated: number;
  eventIds: string[];
  skipped: number;
}

// --- Quality ---

export type FlagType =
  | 'missing_time'
  | 'missing_location'
  | 'missing_description'
  | 'description_too_short'
  | 'missing_image'
  | 'outside_austria'
  | 'location_ambiguous'
  | 'dead_source_url'
  | 'dead_ticket_url'
  | 'date_in_past'
  | 'date_implausible'
  | 'duplicate_uncertain'
  | 'missing_date_context';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type PublishStatus =
  | 'draft'
  | 'published'
  | 'published_low_confidence'
  | 'suppressed'
  | 'needs_review'
  | 'expired';

export interface QualityFlag {
  event_id: string;
  flag_type: FlagType;
  severity: Severity;
  details_json: Record<string, unknown> | null;
}

export interface QualityScoreRow {
  event_id: string;
  completeness_score: number;
  date_score: number;
  location_score: number;
  image_score: number;
  link_score: number;
  dedup_confidence_score: number;
  source_trust_score: number;
  final_quality_score: number;
  scoring_version: number;
}

export interface QualityResults {
  suppressed: number;
  needsReview: number;
  published: number;
  publishedLowConfidence: number;
}

// --- Orchestrator ---

export interface MetricsAccumulator {
  items_found: number;
  items_parsed: number;
  raw_written: number;
  normalized_count: number;
  matched_count: number;
  items_inserted: number;
  items_updated: number;
  items_skipped: number;
  suppressed_count: number;
  needs_review_count: number;
  successful_batches: number;
  parser_errors: number;
  http_errors: number;
  batch_errors: number;
  duplicate_candidates: number;
  events_without_date: number;
  events_without_location: number;
  events_without_coords: number;
}

export function createMetricsAccumulator(): MetricsAccumulator {
  return {
    items_found: 0,
    items_parsed: 0,
    raw_written: 0,
    normalized_count: 0,
    matched_count: 0,
    items_inserted: 0,
    items_updated: 0,
    items_skipped: 0,
    suppressed_count: 0,
    needs_review_count: 0,
    successful_batches: 0,
    parser_errors: 0,
    http_errors: 0,
    batch_errors: 0,
    duplicate_candidates: 0,
    events_without_date: 0,
    events_without_location: 0,
    events_without_coords: 0,
  };
}

export interface PipelineResult {
  runId: string;
  metrics: MetricsAccumulator;
  status: 'success' | 'error' | 'partial';
}

/** Chunk array into batches of given size */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
