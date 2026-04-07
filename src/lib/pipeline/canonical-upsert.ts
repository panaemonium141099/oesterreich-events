// src/lib/pipeline/canonical-upsert.ts

import { createClient } from '@supabase/supabase-js';
import type { NormalizedCandidate, UpsertResult } from './types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Match normalized candidates against canonical events and upsert.
 *
 * Matching strategy:
 * 1. source_id + scraper_name (exact match — same source)
 * 2. title + start_date + city (fuzzy dedup)
 *
 * Venue conflict rule:
 * Only overwrite venue_id if new confidence is higher OR existing has no venue.
 */
export async function matchAndUpsert(
  candidates: NormalizedCandidate[],
): Promise<UpsertResult> {
  const supabase = getSupabaseAdmin();
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const candidate of candidates) {
    try {
      // Try to find existing event by source_id + scraper_name
      const { data: existing } = await supabase
        .from('events')
        .select('id, venue_id, venue_match_confidence')
        .eq('source_id', candidate.source_id)
        .eq('scraper_name', candidate.scraper_name)
        .maybeSingle();

      // Build the upsert payload
      const payload: Record<string, unknown> = {
        source_id: candidate.source_id,
        scraper_name: candidate.scraper_name,
        title: candidate.normalized_title,
        description: candidate.normalized_description ?? null,
        start_date: candidate.normalized_start_date,
        end_date: candidate.normalized_end_date ?? null,
        location_name: candidate.normalized_location_name ?? null,
        address: candidate.normalized_address ?? null,
        city: candidate.normalized_city ?? null,
        postal_code: candidate.normalized_postal_code ?? null,
        bundesland: candidate.normalized_bundesland ?? null,
        latitude: candidate.normalized_latitude ?? null,
        longitude: candidate.normalized_longitude ?? null,
        source_url: candidate.normalized_source_url ?? null,
        ticket_url: candidate.normalized_ticket_url ?? null,
        image_url: candidate.normalized_image_url ?? null,
        category: candidate.normalized_category ?? null,
        tags: candidate.normalized_tags ?? null,
        quality_score: candidate.quality_score ?? null,
      };

      // Venue fields — apply conflict rule
      if (candidate.venue_id) {
        if (existing) {
          const existingConfidence =
            (existing.venue_match_confidence as number | null) ?? 0;
          const newConfidence = candidate.venue_match_confidence ?? 0;

          if (!existing.venue_id || newConfidence > existingConfidence) {
            payload.venue_id = candidate.venue_id;
            payload.venue_match_confidence =
              candidate.venue_match_confidence ?? null;
            payload.venue_match_stage =
              candidate.venue_match_stage ?? null;
          }
          // else: keep existing venue (higher confidence)
        } else {
          // New event — always set venue
          payload.venue_id = candidate.venue_id;
          payload.venue_match_confidence =
            candidate.venue_match_confidence ?? null;
          payload.venue_match_stage = candidate.venue_match_stage ?? null;
        }
      }

      if (existing) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', existing.id);

        if (error) {
          result.errors.push(
            `Update failed for ${candidate.source_id}: ${error.message}`,
          );
        } else {
          result.updated++;
        }
      } else {
        // Insert new event
        const { error } = await supabase.from('events').insert(payload);

        if (error) {
          result.errors.push(
            `Insert failed for ${candidate.source_id}: ${error.message}`,
          );
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(
        `Exception for ${candidate.source_id}: ${msg}`,
      );
    }
  }

  return result;
}
