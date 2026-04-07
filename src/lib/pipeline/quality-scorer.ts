/**
 * Quality Scorer — computes quality scores and manages quality flags.
 *
 * Pure functions (no Supabase) are exported for unit testing.
 * Supabase functions handle persistence and orchestration.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  FlagType,
  PublishStatus,
  QualityFlag,
  QualityResults,
  QualityScoreRow,
  Severity,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORING_VERSION = 1;

/** Austria bounding box */
const AT_BOUNDS = {
  latMin: 46.3,
  latMax: 49.1,
  lngMin: 9.5,
  lngMax: 17.2,
};

// ---------------------------------------------------------------------------
// Pure helper functions (testable without Supabase)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given coordinates are outside Austria's bounding box.
 * Returns false when coords are null (no data to judge).
 */
export function isOutsideAustria(
  lat: number | null,
  lng: number | null,
): boolean {
  if (lat === null || lng === null) return false;
  return (
    lat < AT_BOUNDS.latMin ||
    lat > AT_BOUNDS.latMax ||
    lng < AT_BOUNDS.lngMin ||
    lng > AT_BOUNDS.lngMax
  );
}

/**
 * Map a numeric quality score to a publish status bucket.
 */
export function scoreToPublishStatus(score: number): PublishStatus {
  if (score >= 60) return 'published';
  if (score >= 40) return 'published_low_confidence';
  if (score >= 20) return 'needs_review';
  return 'suppressed';
}

// ---------------------------------------------------------------------------
// Score dimension functions (0-max each)
// ---------------------------------------------------------------------------

/**
 * Completeness score: 0-25 points.
 */
export function computeCompletenessScore(input: {
  title?: string;
  startDate?: string;
  locationName?: string;
  category?: string;
  description?: string;
}): number {
  let score = 0;
  if (input.title && input.title.length > 5) score += 5;
  if (input.startDate) score += 5;
  if (input.locationName) score += 5;
  if (input.category) score += 3;
  if (input.description && input.description.length > 50) score += 4;
  if (input.description && input.description.length > 200) score += 3;
  return score;
}

/**
 * Date quality score: 0-15 points.
 */
export function computeDateScore(event: {
  start_date?: string;
  start_precision?: string;
  end_date?: string;
}): number {
  let score = 0;
  if (!event.start_date) return 0;

  // Parseable date
  const parsed = new Date(event.start_date);
  if (isNaN(parsed.getTime())) return 0;
  score += 5;

  // Exact precision
  if (event.start_precision === 'exact') score += 5;

  // Plausible: not in the past, not more than 2 years out
  const now = new Date();
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
  if (parsed >= now && parsed <= twoYearsOut) score += 3;

  // Has end date
  if (event.end_date) {
    const parsedEnd = new Date(event.end_date);
    if (!isNaN(parsedEnd.getTime())) score += 2;
  }

  return score;
}

/**
 * Location quality score: 0-25 points.
 */
export function computeLocationScore(event: {
  latitude?: number;
  longitude?: number;
  address?: string;
  location_name?: string;
  bundesland?: string;
  postal_code?: string;
}): number {
  let score = 0;

  if (event.latitude != null && event.longitude != null) score += 7;
  if (event.address) score += 5;
  if (event.location_name) score += 3;

  // AT-check: coords present and inside Austria
  if (
    event.latitude != null &&
    event.longitude != null &&
    !isOutsideAustria(event.latitude, event.longitude)
  ) {
    score += 5;
  }

  // Bundesland + postal code
  if (event.bundesland && event.postal_code) score += 5;

  return score;
}

/**
 * Image score: 0-10 points.
 */
export function computeImageScore(event: { image_url?: string }): number {
  if (!event.image_url) return 0;
  // Present +5, assume reachable +5 (batch check later)
  return 10;
}

/**
 * Link score: 0-10 points.
 */
export function computeLinkScore(event: {
  source_url?: string;
  ticket_url?: string;
}): number {
  let score = 0;
  if (event.source_url) score += 3;
  if (event.ticket_url) score += 3;
  if (event.source_url || event.ticket_url) score += 4;
  return score;
}

// ---------------------------------------------------------------------------
// Flag generation
// ---------------------------------------------------------------------------

/**
 * Generate quality flags for an event based on its data.
 */
export function generateQualityFlags(
  event: Record<string, unknown>,
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const eventId = String(event.id ?? '');

  const push = (
    flag_type: FlagType,
    severity: Severity,
    details_json: Record<string, unknown> | null = null,
  ) => {
    flags.push({ event_id: eventId, flag_type, severity, details_json });
  };

  // --- Coordinates / Location ---
  const lat = event.latitude as number | null | undefined;
  const lng = event.longitude as number | null | undefined;

  if (lat != null && lng != null && isOutsideAustria(lat, lng)) {
    push('outside_austria', 'critical', { latitude: lat, longitude: lng });
  }

  if (lat == null && lng == null && !event.address && !event.location_name) {
    push('missing_location', 'high');
  }

  // --- Date ---
  if (!event.start_date) {
    push('missing_date_context', 'high');
  } else {
    const parsed = new Date(event.start_date as string);
    if (!isNaN(parsed.getTime())) {
      const now = new Date();
      if (parsed < now) push('date_in_past', 'medium');

      const twoYears = new Date();
      twoYears.setFullYear(twoYears.getFullYear() + 2);
      if (parsed > twoYears) push('date_implausible', 'high');
    }
  }

  if (
    event.start_precision === 'day_only' ||
    event.start_precision === 'inferred'
  ) {
    push('missing_time', 'low');
  }

  // --- Content ---
  if (!event.description) {
    push('missing_description', 'medium');
  } else if (typeof event.description === 'string' && event.description.length < 50) {
    push('description_too_short', 'low', {
      length: event.description.length,
    });
  }

  // --- Image ---
  if (!event.image_url) {
    push('missing_image', 'low');
  }

  // --- Links ---
  // dead_source_url / dead_ticket_url are checked in batch, not here

  return flags;
}

// ---------------------------------------------------------------------------
// Supabase client (lazy)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Source trust score
// ---------------------------------------------------------------------------

/**
 * Compute source trust score (0-5) based on last 10 scrape runs.
 */
export async function computeSourceTrustScore(
  sourceName: string,
): Promise<number> {
  const supabase = getSupabase();

  const { data: runs, error } = await supabase
    .from('scrape_runs')
    .select(
      'status, avg_quality_score, parser_errors, items_parsed',
    )
    .eq('source_name', sourceName)
    .order('started_at', { ascending: false })
    .limit(10);

  if (error || !runs || runs.length === 0) return 0;

  let score = 0;

  // Success rate > 95% → +2
  const successCount = runs.filter(
    (r: Record<string, unknown>) => r.status === 'success',
  ).length;
  if (successCount / runs.length > 0.95) score += 2;

  // Avg quality > 60 → +2
  const qualityScores = runs
    .map((r: Record<string, unknown>) => r.avg_quality_score as number | null)
    .filter((q): q is number => q !== null);
  if (qualityScores.length > 0) {
    const avgQuality =
      qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    if (avgQuality > 60) score += 2;
  }

  // Parser error rate < 5% → +1
  const totalParsed = runs.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + ((r.items_parsed as number) || 0),
    0,
  );
  const totalParserErrors = runs.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + ((r.parser_errors as number) || 0),
    0,
  );
  if (totalParsed > 0 && totalParserErrors / totalParsed < 0.05) score += 1;

  return score;
}

// ---------------------------------------------------------------------------
// Score & Publish orchestrator
// ---------------------------------------------------------------------------

/**
 * Score a batch of events and set their publish status.
 */
export async function scoreAndPublish(
  eventIds: string[],
): Promise<QualityResults> {
  const supabase = getSupabase();
  const results: QualityResults = {
    suppressed: 0,
    needsReview: 0,
    published: 0,
    publishedLowConfidence: 0,
  };

  for (const eventId of eventIds) {
    // 1. Fetch full event
    const { data: event, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchErr || !event) continue;

    // 2. Generate flags, replace old ones
    const flags = generateQualityFlags(event);

    await supabase
      .from('quality_flags')
      .delete()
      .eq('event_id', eventId);

    if (flags.length > 0) {
      await supabase.from('quality_flags').insert(flags);
    }

    // 3. Blocking rules
    const outsideAT = flags.some((f) => f.flag_type === 'outside_austria');
    if (outsideAT) {
      // Suppress with score=0, permanent
      const scoreRow: QualityScoreRow = {
        event_id: eventId,
        completeness_score: 0,
        date_score: 0,
        location_score: 0,
        image_score: 0,
        link_score: 0,
        dedup_confidence_score: 0,
        source_trust_score: 0,
        final_quality_score: 0,
        scoring_version: SCORING_VERSION,
      };

      await supabase
        .from('event_quality_scores')
        .upsert(scoreRow, { onConflict: 'event_id,scoring_version' });

      await supabase
        .from('events')
        .update({ publish_status: 'suppressed', quality_score: 0 })
        .eq('id', eventId);

      results.suppressed++;
      continue;
    }

    // 4. Compute all score dimensions
    const completeness = computeCompletenessScore({
      title: event.title,
      startDate: event.start_date,
      locationName: event.location_name,
      category: event.category,
      description: event.description,
    });

    const dateScore = computeDateScore({
      start_date: event.start_date,
      start_precision: event.start_precision,
      end_date: event.end_date,
    });

    const locationScore = computeLocationScore({
      latitude: event.latitude,
      longitude: event.longitude,
      address: event.address,
      location_name: event.location_name,
      bundesland: event.bundesland,
      postal_code: event.postal_code,
    });

    const imageScore = computeImageScore({ image_url: event.image_url });
    const linkScore = computeLinkScore({
      source_url: event.source_url,
      ticket_url: event.ticket_url,
    });

    // Dedup confidence: default 5 (Phase 2 will refine)
    const dedupConfidence = 5;

    // Source trust
    const sourceTrust = await computeSourceTrustScore(
      event.source_name ?? '',
    );

    const finalScore =
      completeness +
      dateScore +
      locationScore +
      imageScore +
      linkScore +
      dedupConfidence +
      sourceTrust;

    // 5. Write quality scores
    const scoreRow: QualityScoreRow = {
      event_id: eventId,
      completeness_score: completeness,
      date_score: dateScore,
      location_score: locationScore,
      image_score: imageScore,
      link_score: linkScore,
      dedup_confidence_score: dedupConfidence,
      source_trust_score: sourceTrust,
      final_quality_score: finalScore,
      scoring_version: SCORING_VERSION,
    };

    await supabase
      .from('event_quality_scores')
      .upsert(scoreRow, { onConflict: 'event_id,scoring_version' });

    // 6. Set publish_status and quality_score on events
    const status = scoreToPublishStatus(finalScore);

    await supabase
      .from('events')
      .update({ publish_status: status, quality_score: finalScore })
      .eq('id', eventId);

    // 7. Track results
    switch (status) {
      case 'published':
        results.published++;
        break;
      case 'published_low_confidence':
        results.publishedLowConfidence++;
        break;
      case 'needs_review':
        results.needsReview++;
        break;
      case 'suppressed':
        results.suppressed++;
        break;
    }
  }

  return results;
}
