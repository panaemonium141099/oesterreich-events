// src/lib/pipeline/orchestrator.ts

import { loadVenueCache, matchVenue, clearVenueCache } from './venue-matcher';
import { scoreAndPublish } from './quality-scorer';
import { matchAndUpsert } from './canonical-upsert';
import { checkLiveDedup } from './dedup-live';
import { isGarbageTitle } from './garbage-filter';
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
  garbageFiltered: number;
  dedupMerged: number;
  dedupUncertain: number;
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
 * 1. Normalize + garbage filter
 * 2. Venue matching
 * 3. Live dedup (check against existing events)
 * 4. Canonical upsert (with dedup-aware merge)
 * 5. Quality scoring (after upsert, uses dedup status)
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
  let garbageFiltered = 0;
  let dedupMerged = 0;
  let dedupUncertain = 0;

  try {
    // Process in batches
    for (let i = 0; i < rawEvents.length; i += batchSize) {
      const batch = rawEvents.slice(i, i + batchSize);

      // Step 1: Normalize + garbage filter
      const normalized = normalizeEvents(batch);
      const validCandidates: NormalizedCandidate[] = [];
      for (const c of normalized) {
        if (isGarbageTitle(c.normalized_title)) {
          garbageFiltered++;
          continue;
        }
        validCandidates.push(c);
      }
      totalValid += validCandidates.length;

      // Step 2: Venue Matching
      for (const candidate of validCandidates) {
        const venueResult = await matchVenue({
          location_name: candidate.normalized_location_name,
          address: candidate.normalized_address,
          city: candidate.normalized_city,
          postal_code: candidate.normalized_postal_code,
          latitude: null,
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

      // Step 3: Live dedup + Step 4: Canonical upsert
      if (!options.dryRun) {
        for (const candidate of validCandidates) {
          // Check for duplicates among existing events
          const dedupResult = await checkLiveDedup(candidate);

          if (dedupResult.mergeTargetId) {
            // Merge: update the existing primary event instead of inserting
            dedupMerged++;
            candidate.id = dedupResult.mergeTargetId;
            // Mark as update so matchAndUpsert updates the existing event
          } else if (dedupResult.isUncertain) {
            dedupUncertain++;
            // Insert normally but add flag
            if (!candidate.quality_flags) candidate.quality_flags = [];
            candidate.quality_flags.push({
              type: 'duplicate_uncertain',
              severity: 'info',
              detail: `Possible duplicate (score: ${dedupResult.score?.toFixed(2)})`,
            });
          }
        }

        const batchResult = await matchAndUpsert(validCandidates);
        allUpsertResult.inserted += batchResult.inserted;
        allUpsertResult.updated += batchResult.updated;
        allUpsertResult.skipped += batchResult.skipped;
        allUpsertResult.errors.push(...batchResult.errors);
      }

      // Step 5: Quality Scoring (after upsert so dedup status is known)
      scoreAndPublish(validCandidates);

      console.log(
        `[Pipeline] Batch ${Math.floor(i / batchSize) + 1}: ${validCandidates.length} valid, ${batch.length - validCandidates.length} filtered, ${garbageFiltered} garbage`,
      );
    }
  } finally {
    clearVenueCache();
  }

  const durationMs = Date.now() - start;
  console.log(
    `[Pipeline] Complete: ${totalValid} valid of ${rawEvents.length} total in ${durationMs}ms (${dedupMerged} merged, ${dedupUncertain} uncertain, ${garbageFiltered} garbage)`,
  );

  return {
    totalCandidates: rawEvents.length,
    totalValid,
    garbageFiltered,
    dedupMerged,
    dedupUncertain,
    upsert: allUpsertResult,
    durationMs,
  };
}
