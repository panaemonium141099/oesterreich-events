/**
 * Pipeline Orchestrator — replaces the old runScraper() flow.
 *
 * Flow: Scraper.scrape() → Raw Layer → Normalization → Matching + Upsert → Quality Scoring
 * All steps run in batches of BATCH_SIZE for stability and granular metrics.
 *
 * Spec: docs/superpowers/specs/2026-04-07-quality-system-phase1-design.md §2.4
 */
import type { BaseScraper } from '@/lib/scrapers/BaseScraper';
import type { ScrapedEvent } from '@/types/events';
import type { PipelineResult, MetricsAccumulator } from './types';
import { createMetricsAccumulator, chunk } from './types';
import { createScrapeRun, writeRawEvents, finalizeScrapeRun } from './raw-layer';
import { normalizeEvents } from './normalizer';
import { matchAndUpsert } from './canonical-upsert';
import { scoreAndPublish } from './quality-scorer';

const BATCH_SIZE = 100;

export async function runPipeline(scraper: BaseScraper): Promise<PipelineResult> {
  const runId = await createScrapeRun(scraper.name);
  const metrics = createMetricsAccumulator();
  const startTime = Date.now();

  try {
    // 1. Execute scraper
    const scrapedEvents: ScrapedEvent[] = await scraper.scrape();
    metrics.items_found = scrapedEvents.length;

    if (scrapedEvents.length === 0) {
      await finalizeScrapeRun(runId, {
        status: 'success',
        duration_ms: Date.now() - startTime,
        ...metrics,
      });
      return { runId, metrics, status: 'success' };
    }

    // 2. Process in batches
    const batches = chunk(scrapedEvents, BATCH_SIZE);

    for (const batch of batches) {
      try {
        // Raw Layer
        const rawEvents = await writeRawEvents(runId, batch);
        metrics.raw_written += rawEvents.length;
        metrics.items_parsed += rawEvents.length;

        // Normalization
        const { candidates, errors: parseErrors } = await normalizeEvents(rawEvents);
        metrics.normalized_count += candidates.length;
        metrics.parser_errors += parseErrors.length;

        // Track events without date/location
        for (const c of candidates) {
          if (!c.normalized_start_at) metrics.events_without_date++;
          if (!c.normalized_location_name && !c.normalized_address) metrics.events_without_location++;
        }

        // Skip candidates without start date (items_skipped)
        const validCandidates = candidates.filter(c => {
          if (!c.normalized_start_at) {
            metrics.items_skipped++;
            return false;
          }
          return true;
        });

        if (validCandidates.length === 0) {
          metrics.successful_batches++;
          continue;
        }

        // Matching + Canonical Upsert
        const upsertResults = await matchAndUpsert(validCandidates);
        metrics.matched_count += upsertResults.matched;
        metrics.items_inserted += upsertResults.inserted;
        metrics.items_updated += upsertResults.updated;
        metrics.items_skipped += upsertResults.skipped;
        metrics.duplicate_candidates += upsertResults.matched;

        // Quality Scoring
        if (upsertResults.eventIds.length > 0) {
          const qualityResults = await scoreAndPublish(upsertResults.eventIds);
          metrics.suppressed_count += qualityResults.suppressed;
          metrics.needs_review_count += qualityResults.needsReview;
        }

        metrics.successful_batches++;
      } catch (batchError) {
        metrics.batch_errors++;
        console.error(`[Pipeline] Batch error in ${scraper.name}:`, batchError);
      }
    }

    // http_errors from scraper (optional, backwards-compatible)
    metrics.http_errors = (scraper as unknown as { httpErrorCount?: number }).httpErrorCount ?? 0;

    // Compute avg quality score
    const totalProcessed = metrics.items_inserted + metrics.items_updated;
    // avg_quality_score will be computed from event_quality_scores table if needed

    // Status determination
    const totalBatches = metrics.successful_batches + metrics.batch_errors;
    const status: PipelineResult['status'] =
      metrics.successful_batches === 0 && totalBatches > 0
        ? 'error'
        : metrics.batch_errors > 0
          ? 'partial'
          : 'success';

    await finalizeScrapeRun(runId, {
      status,
      duration_ms: Date.now() - startTime,
      ...metrics,
    });

    console.log(`[Pipeline] ${scraper.name}: ${status} — ${metrics.items_found} found, ${metrics.items_inserted} new, ${metrics.items_updated} updated, ${metrics.suppressed_count} suppressed`);

    return { runId, metrics, status };
  } catch (error) {
    // Scraper-level failure (before batch processing)
    const message = error instanceof Error ? error.message : String(error);
    await finalizeScrapeRun(runId, {
      status: 'error',
      duration_ms: Date.now() - startTime,
      error_message: message,
      ...metrics,
    });
    console.error(`[Pipeline] ${scraper.name}: ERROR — ${message}`);
    return { runId, metrics, status: 'error' };
  }
}
