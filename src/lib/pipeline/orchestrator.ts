// src/lib/pipeline/orchestrator.ts

import { loadVenueCache, matchVenue, clearVenueCache } from './venue-matcher';
import { scoreAndPublish } from './quality-scorer';
import { matchAndUpsert } from './canonical-upsert';
import type { NormalizedCandidate, UpsertResult } from './types';

export interface PipelineOptions {
  /** Maximum candidates per batch. Default: 100 */
  batchSize?: number;
  /** If true, skip the canonical upsert step (dry-run). */
  dryRun?: boolean;
}

export interface PipelineResult {
  totalCandidates: number;
  totalValid: number;
  upsert: UpsertResult;
  durationMs: number;
}

/**
 * Normalize raw scraped events into NormalizedCandidates.
 * This is a placeholder — each scraper adapter will provide its own normalization.
 */
export function normalizeEvents(
  rawEvents: NormalizedCandidate[],
): NormalizedCandidate[] {
  // In a full implementation, this would apply field-level normalization,
  // date parsing, location resolution, etc.
  // For now, pass through — callers are expected to provide pre-normalized candidates.
  return rawEvents.filter(
    (c) => c.normalized_title && c.normalized_start_date,
  );
}

/**
 * Run the full ingestion pipeline:
 * 1. Normalize
 * 2. Venue matching
 * 3. Quality scoring
 * 4. Canonical upsert
 */
export async function runPipeline(
  rawEvents: NormalizedCandidate[],
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const start = Date.now();
  const batchSize = options.batchSize ?? 100;

  // Pre-load venue cache once before processing
  await loadVenueCache();

  const allUpsertResult: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  let totalValid = 0;

  try {
    // Process in batches
    for (let i = 0; i < rawEvents.length; i += batchSize) {
      const batch = rawEvents.slice(i, i + batchSize);

      // Step 1: Normalize
      const validCandidates = normalizeEvents(batch);
      totalValid += validCandidates.length;

      // Step 2: Venue Matching
      for (const candidate of validCandidates) {
        const venueResult = await matchVenue({
          location_name: candidate.normalized_location_name,
          address: candidate.normalized_address,
          city: candidate.normalized_city,
          postal_code: candidate.normalized_postal_code,
          latitude: null, // coords not on candidate in Phase 2
          longitude: null,
          source_url: candidate.normalized_source_url,
          ticket_url: candidate.normalized_ticket_url,
        });
        if (venueResult.venueId) {
          candidate.venue_id = venueResult.venueId;
          candidate.venue_match_confidence = venueResult.confidence;
          candidate.venue_match_stage = venueResult.stage;
        }
      }

      // Step 3: Quality Scoring
      scoreAndPublish(validCandidates);

      // Step 4: Canonical Upsert
      if (!options.dryRun) {
        const batchResult = await matchAndUpsert(validCandidates);
        allUpsertResult.inserted += batchResult.inserted;
        allUpsertResult.updated += batchResult.updated;
        allUpsertResult.skipped += batchResult.skipped;
        allUpsertResult.errors.push(...batchResult.errors);
      }

      console.log(
        `[Pipeline] Batch ${Math.floor(i / batchSize) + 1}: ${validCandidates.length} valid, ${batch.length - validCandidates.length} filtered`,
      );
    }
  } finally {
    clearVenueCache();
  }

  const durationMs = Date.now() - start;
  console.log(
    `[Pipeline] Complete: ${totalValid} valid of ${rawEvents.length} total in ${durationMs}ms`,
  );

  return {
    totalCandidates: rawEvents.length,
    totalValid,
    upsert: allUpsertResult,
    durationMs,
  };
}
