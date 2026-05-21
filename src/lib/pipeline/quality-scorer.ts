// src/lib/pipeline/quality-scorer.ts

import { isVenueName } from '@/lib/location-normalizer';
import { isValidAddressText } from '@/lib/scrapers/detail-extract/validate';
import { haversineDistance } from './normalize-venue';
import type { NormalizedCandidate, QualityFlag, FlagType } from './types';

// ---------------------------------------------------------------------------
// Score components (max 25 each, 100 total)
// ---------------------------------------------------------------------------

/**
 * Completeness score: how much core data is present (max 25).
 */
export function computeCompletenessScore(event: {
  normalized_title?: string | null;
  normalized_start_date?: string | null;
  normalized_description?: string | null;
  normalized_image_url?: string | null;
  normalized_category?: string | null;
  normalized_source_url?: string | null;
}): number {
  let score = 0;
  if (event.normalized_title) score += 5;
  if (event.normalized_start_date) score += 5;
  if (event.normalized_description) score += 5;
  if (event.normalized_image_url) score += 4;
  if (event.normalized_category) score += 3;
  if (event.normalized_source_url) score += 3;
  return Math.min(25, score);
}

/**
 * Location score: coordinates, address, venue match, geo-validity (max 25).
 */
export function computeLocationScore(event: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  location_name?: string | null;
  bundesland?: string | null;
  postal_code?: string | null;
  venue_id?: string | null;
  venue_match_stage?: number | null;
  venue_match_confidence?: number | null;
}): number {
  let score = 0;

  // Coordinates
  if (event.latitude && event.longitude) score += 7;

  // Address
  if (event.address) score += 3;

  // Venue-based scoring (Phase 2)
  if (event.venue_id && event.venue_match_stage === 1) {
    score += 8; // Hard match — very reliable
  } else if (event.venue_id && event.venue_match_stage === 2) {
    score += 5; // Soft match — decent
  } else if (event.location_name) {
    score += 3; // Phase 1 fallback — name exists but no venue match
  }

  // AT bounding-box check
  if (event.latitude && event.longitude) {
    const isOutside =
      event.latitude < 46.3 ||
      event.latitude > 49.1 ||
      event.longitude < 9.5 ||
      event.longitude > 17.2;
    if (!isOutside) score += 5;
  }

  // Consistency bonus
  if (
    event.venue_id &&
    event.venue_match_confidence &&
    event.venue_match_confidence >= 0.9
  ) {
    score += 5; // venue-geo consistent (high confidence)
  } else if (event.bundesland && event.postal_code) {
    score += 5; // Phase 1 fallback
  }

  return Math.min(25, score);
}

/**
 * Freshness score (max 25) — placeholder for Phase 2.
 * For now returns a constant.
 */
export function computeFreshnessScore(_event: {
  normalized_start_date?: string | null;
}): number {
  // TODO: implement time-decay / recency scoring
  return 15;
}

/**
 * Source trust score (max 25) — placeholder for Phase 2.
 * For now returns a constant per-scraper.
 */
export function computeSourceScore(_event: {
  scraper_name?: string | null;
}): number {
  // TODO: implement per-scraper trust tiers
  return 15;
}

// ---------------------------------------------------------------------------
// Quality flags
// ---------------------------------------------------------------------------

/**
 * Generate quality flags for a candidate.
 */
export function generateQualityFlags(candidate: NormalizedCandidate): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (!candidate.normalized_latitude || !candidate.normalized_longitude) {
    flags.push({ type: 'missing_coords', severity: 'warning' });
  }
  if (!candidate.normalized_start_date) {
    flags.push({ type: 'missing_date', severity: 'error' });
  }
  if (!candidate.normalized_title) {
    flags.push({ type: 'missing_title', severity: 'error' });
  }
  if (!candidate.normalized_location_name && !candidate.normalized_address) {
    flags.push({ type: 'missing_location', severity: 'warning' });
  }

  // Soft-gate: warn when no parseable street address is present. Used by the
  // admin panel as a filter and by the publish pipeline to downgrade to
  // published_low_confidence. See spec §8.
  if (!isValidAddressText(candidate.normalized_address ?? undefined)) {
    flags.push({
      type: 'missing_address_street',
      severity: 'warning',
      detail: candidate.normalized_location_name
        ? `only location_name="${candidate.normalized_location_name}"`
        : 'no street address',
    });
  }

  // Outside Austria check
  if (candidate.normalized_latitude && candidate.normalized_longitude) {
    const lat = candidate.normalized_latitude;
    const lng = candidate.normalized_longitude;
    if (lat < 46.3 || lat > 49.1 || lng < 9.5 || lng > 17.2) {
      flags.push({ type: 'outside_austria', severity: 'error' });
    }
  }

  // Short title
  if (candidate.normalized_title && candidate.normalized_title.length < 5) {
    flags.push({ type: 'short_title', severity: 'info' });
  }

  // Venue unmatched: location_name looks like a venue, has supporting data, but no venue_id
  if (
    candidate.normalized_location_name &&
    isVenueName(candidate.normalized_location_name) &&
    !candidate.venue_id &&
    (candidate.normalized_city ||
      candidate.normalized_postal_code ||
      (candidate.normalized_latitude && candidate.normalized_longitude))
  ) {
    flags.push({
      type: 'venue_unmatched',
      severity: 'info',
      detail: `Location "${candidate.normalized_location_name}" looks like a venue but was not matched`,
    });
  }

  // Venue geo mismatch: venue matched but event coords are >2km from venue
  // We store the confidence drop from applyGeoAdjustment as a proxy;
  // if venue_match_confidence is notably lower than 0.95 for stage 1
  // or 0.70 for stage 2, there may be a geo mismatch.
  // Direct check: if candidate has both venue_id and coords, we can't
  // look up venue coords here without the cache, so we use confidence as a signal.
  if (
    candidate.venue_id &&
    candidate.venue_match_confidence !== null &&
    candidate.venue_match_confidence !== undefined &&
    candidate.venue_match_stage !== null &&
    candidate.venue_match_stage !== undefined
  ) {
    // Stage 1 hard match with low confidence suggests geo penalty was applied
    // Stage 2 soft match with low confidence similarly
    const expectedBase =
      candidate.venue_match_stage === 1 ? 0.95 : 0.7;
    // If confidence dropped below expected - 0.15 (geo penalty is -0.20 for >2km),
    // flag it
    if (candidate.venue_match_confidence < expectedBase - 0.15) {
      flags.push({
        type: 'venue_geo_mismatch',
        severity: 'warning',
        detail: `Venue matched (stage ${candidate.venue_match_stage}) but confidence ${candidate.venue_match_confidence.toFixed(2)} suggests geo mismatch`,
      });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main scoring entry point
// ---------------------------------------------------------------------------

/**
 * Score a candidate and attach quality flags.
 * Mutates the candidate in place.
 */
export function scoreCandidate(candidate: NormalizedCandidate): void {
  const completeness = computeCompletenessScore(candidate);
  const location = computeLocationScore({
    latitude: candidate.normalized_latitude,
    longitude: candidate.normalized_longitude,
    address: candidate.normalized_address,
    location_name: candidate.normalized_location_name,
    bundesland: candidate.normalized_bundesland,
    postal_code: candidate.normalized_postal_code,
    venue_id: candidate.venue_id,
    venue_match_stage: candidate.venue_match_stage,
    venue_match_confidence: candidate.venue_match_confidence,
  });
  const freshness = computeFreshnessScore(candidate);
  const source = computeSourceScore(candidate);

  candidate.quality_score = completeness + location + freshness + source;
  candidate.quality_flags = generateQualityFlags(candidate);
}

/**
 * Score and publish a batch of candidates.
 * This is the pipeline-level entry point.
 */
export function scoreAndPublish(candidates: NormalizedCandidate[]): void {
  for (const candidate of candidates) {
    scoreCandidate(candidate);
  }
}
