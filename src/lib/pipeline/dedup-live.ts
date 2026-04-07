// src/lib/pipeline/dedup-live.ts

/**
 * Live dedup — lightweight dedup check during scraper ingestion.
 *
 * Checks a candidate against existing events on the same day.
 * Performance budget: < 50ms per candidate.
 * Does NOT write to event_dedup_log (batch dedup does that).
 */

import { createClient } from '@supabase/supabase-js';
import { scorePair } from './dedup-scorer';
import type { EventRow, NormalizedCandidate } from './types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface LiveDedupResult {
  /** If merge: the existing event ID to update instead of insert */
  mergeTargetId: string | null;
  /** If uncertain: flag to set on the new event */
  isUncertain: boolean;
  /** The dedup score if a match was found */
  score: number | null;
}

/**
 * Check a normalized candidate against existing events for dedup.
 *
 * Returns:
 * - mergeTargetId if the candidate should be merged into an existing event
 * - isUncertain if the candidate should be inserted with a duplicate_uncertain flag
 * - null/false if no match found (insert as new)
 */
export async function checkLiveDedup(
  candidate: NormalizedCandidate,
): Promise<LiveDedupResult> {
  const noMatch: LiveDedupResult = { mergeTargetId: null, isUncertain: false, score: null };

  if (!candidate.normalized_start_date || !candidate.normalized_title) {
    return noMatch;
  }

  const supabase = getSupabaseAdmin();
  const day = candidate.normalized_start_date.slice(0, 10);

  // Fast query: same day, only published/low_confidence events, limit 100
  const { data: sameDayEvents } = await supabase
    .from('events')
    .select('id,title,description,start_date,end_date,location_name,address,district,postal_code,bundesland,latitude,longitude,source_url,ticket_url,image_url,category,tags,source_id,source_name,venue_id,venue_match_confidence,venue_match_stage,quality_score,publish_status,content_fingerprint,duplicate_of,organizer,price_text,created_at')
    .gte('start_date', `${day}T00:00:00`)
    .lt('start_date', `${day}T23:59:59.999`)
    .in('publish_status', ['published', 'published_low_confidence'])
    .limit(100);

  if (!sameDayEvents || sameDayEvents.length === 0) return noMatch;

  // Convert candidate to EventRow-like shape for scoring
  const candidateAsRow: EventRow = {
    id: '',
    title: candidate.normalized_title,
    description: candidate.normalized_description ?? null,
    start_date: candidate.normalized_start_date,
    end_date: candidate.normalized_end_date ?? null,
    location_name: candidate.normalized_location_name ?? null,
    address: candidate.normalized_address ?? null,
    district: null, // NormalizedCandidate doesn't track district; DB events will have it
    postal_code: candidate.normalized_postal_code ?? null,
    bundesland: candidate.normalized_bundesland ?? null,
    latitude: candidate.normalized_latitude ?? null,
    longitude: candidate.normalized_longitude ?? null,
    source_url: candidate.normalized_source_url ?? null,
    ticket_url: candidate.normalized_ticket_url ?? null,
    image_url: candidate.normalized_image_url ?? null,
    category: candidate.normalized_category ?? null,
    tags: candidate.normalized_tags ?? null,
    source_id: candidate.source_id ?? null,
    source_name: candidate.scraper_name ?? null,
    venue_id: candidate.venue_id ?? null,
    venue_match_confidence: candidate.venue_match_confidence ?? null,
    venue_match_stage: candidate.venue_match_stage ?? null,
    quality_score: candidate.quality_score ?? null,
  };

  let bestMatch: { id: string; score: number; decision: string } | null = null;

  for (const existing of sameDayEvents) {
    const result = scorePair(candidateAsRow, existing as EventRow);

    if (result.decision === 'merge' && (!bestMatch || result.overallScore > bestMatch.score)) {
      // Resolve primary if the match target is itself a duplicate
      let targetId = existing.id;
      if (existing.duplicate_of) {
        targetId = existing.duplicate_of;
      }
      bestMatch = { id: targetId, score: result.overallScore, decision: 'merge' };
    } else if (result.decision === 'uncertain' && !bestMatch) {
      bestMatch = { id: existing.id, score: result.overallScore, decision: 'uncertain' };
    }
  }

  if (!bestMatch) return noMatch;

  if (bestMatch.decision === 'merge') {
    return { mergeTargetId: bestMatch.id, isUncertain: false, score: bestMatch.score };
  }

  return { mergeTargetId: null, isUncertain: true, score: bestMatch.score };
}
