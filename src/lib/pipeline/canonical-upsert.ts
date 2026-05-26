// src/lib/pipeline/canonical-upsert.ts

import { createClient } from '@supabase/supabase-js';
import type { NormalizedCandidate, UpsertResult } from './types';
import { generateEventSlug } from '@/lib/utils/slugify';

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
      // Try to find existing event by source_id + scraper_name.
      // Include the coordinate + geocoding fields so we can decide whether
      // to let this scraper run clobber already-refined coords.
      const { data: existing } = await supabase
        .from('events')
        .select('id, venue_id, venue_match_confidence, latitude, longitude, location_name, geocoding_source, slug, address, description, image_url, postal_code, city, bundesland, ticket_url')
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
        // Slug preservation — once persisted the slug is a path segment
        // of the canonical URL `/events/{plz-ort}/{date}/{slug}` and is
        // used as the primary lookup key in the catch-all page handler.
        // Regenerating on every scrape would silently break every
        // Google-indexed URL. If the existing row already has a slug we
        // keep it; only new rows (or legacy rows without a slug) get a
        // freshly generated one.
        slug: existing?.slug ?? generateEventSlug(
          candidate.normalized_title,
          candidate.normalized_location_name,
        ),
      };

      // ─── Coordinate protection ──────────────────────────────────────
      // If the row has been refined by a targeted geocoder or the user
      // (geocoding_source ∈ {manual, openai, gemini, nominatim, exact,
      // normalized}), don't let a plain scraper re-upsert blow it away.
      // This is the same rule supabase-sync applies via shouldOverwriteCoords,
      // ported here because the pipeline's NormalizedCandidate has no
      // confidence metadata to compare ranks with — we just defer to the
      // more-informed existing value.
      //
      // Two preservation cases:
      //   a) existing was refined (source set) AND has coords        → keep
      //   b) existing has coords AND candidate would write NULL      → keep
      if (existing) {
        const existingHasCoords =
          existing.latitude != null && existing.longitude != null;
        const existingRefined =
          typeof existing.geocoding_source === 'string' &&
          existing.geocoding_source.length > 0 &&
          existing.geocoding_source !== 'scraper';
        const newHasCoords =
          candidate.normalized_latitude != null &&
          candidate.normalized_longitude != null;

        if (
          (existingHasCoords && existingRefined) ||
          (existingHasCoords && !newHasCoords)
        ) {
          delete payload.latitude;
          delete payload.longitude;
          // The refined location_name is usually the canonical venue string
          // the geocoder resolved — keep it in sync with the preserved coords.
          delete payload.location_name;
        }

        // ─── Don't-NULL-on-missing protection ────────────────────────────
        // A re-scrape that simply doesn't carry a field anymore (e.g. a
        // listing-only Feratel pull whose detail page is gone) must NOT
        // erase data that an earlier run / detail-fetch / enrichment had
        // populated. For each "soft" field: if the new payload would write
        // null/empty but the existing row already has a value, drop the
        // key from the payload so the existing value is preserved.
        const SOFT_FIELDS: ReadonlyArray<keyof typeof payload & string> = [
          'address',
          'description',
          'image_url',
          'postal_code',
          'city',
          'bundesland',
          'ticket_url',
          'location_name',
        ];
        for (const f of SOFT_FIELDS) {
          if (!(f in payload)) continue;
          const newValRaw = payload[f];
          const newVal = typeof newValRaw === 'string' ? newValRaw.trim() : newValRaw;
          const isEmpty = newVal == null || newVal === '';
          const existingVal = (existing as Record<string, unknown>)[f];
          const existingHasValue =
            typeof existingVal === 'string'
              ? existingVal.trim().length > 0
              : existingVal != null;
          if (isEmpty && existingHasValue) {
            delete payload[f];
          }
        }
      }

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
