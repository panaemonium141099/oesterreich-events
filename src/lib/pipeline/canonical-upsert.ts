import { createClient } from '@supabase/supabase-js';
import type { NormalizedCandidate, UpsertResults } from './types';
import { findMatchCandidates } from './matcher';
import { generateFingerprint } from '@/lib/dedup/fingerprint';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Match candidates against existing events and upsert to canonical events table.
 * Sets publish_status = 'draft' (final status set by quality scorer only).
 */
export async function matchAndUpsert(
  candidates: NormalizedCandidate[],
): Promise<UpsertResults> {
  const supabase = getSupabaseAdmin();
  const matches = await findMatchCandidates(candidates);

  let matched = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const eventIds: string[] = [];

  for (const candidate of candidates) {
    const match = matches.get(candidate.raw_event_id);

    // Build fingerprint for content_fingerprint column
    const fingerprint = candidate.normalized_title && candidate.normalized_start_at
      ? generateFingerprint(candidate.normalized_title, candidate.normalized_start_at)
      : null;

    if (match?.decision === 'merge' && match.eventId) {
      // Update existing event
      matched++;
      const { data } = await supabase
        .from('events')
        .update({
          title: candidate.normalized_title ?? undefined,
          start_date: candidate.normalized_start_at ?? undefined,
          end_date: candidate.normalized_end_at ?? undefined,
          location_name: candidate.normalized_location_name ?? undefined,
          address: candidate.normalized_address ?? undefined,
          postal_code: candidate.normalized_postal_code ?? undefined,
          bundesland: candidate.normalized_bundesland ?? undefined,
          category: candidate.normalized_category ?? undefined,
          ticket_url: candidate.normalized_ticket_url ?? undefined,
          source_url: candidate.normalized_source_url ?? undefined,
          image_url: candidate.normalized_image_url ?? undefined,
          organizer: candidate.normalized_organizer ?? undefined,
          raw_event_id: candidate.raw_event_id,
          publish_status: 'draft',
          content_fingerprint: fingerprint ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.eventId)
        .select('id')
        .single();

      if (data) {
        updated++;
        eventIds.push(data.id);
      } else {
        skipped++;
      }
    } else {
      // Insert new event
      // Extract source_name from URL
      const sourceName = candidate.normalized_source_url
        ? (() => { try { return new URL(candidate.normalized_source_url).hostname; } catch { return 'unknown'; } })()
        : 'unknown';

      const { data } = await supabase
        .from('events')
        .insert({
          source_type: 'scraped' as const,
          source_name: sourceName,
          source_id: candidate.raw_event_id,
          title: candidate.normalized_title ?? 'Untitled',
          start_date: candidate.normalized_start_at ?? new Date().toISOString(),
          end_date: candidate.normalized_end_at,
          location_name: candidate.normalized_location_name,
          address: candidate.normalized_address,
          postal_code: candidate.normalized_postal_code,
          bundesland: candidate.normalized_bundesland,
          category: candidate.normalized_category,
          ticket_url: candidate.normalized_ticket_url,
          source_url: candidate.normalized_source_url,
          image_url: candidate.normalized_image_url,
          organizer: candidate.normalized_organizer,
          raw_event_id: candidate.raw_event_id,
          publish_status: 'draft',
          content_fingerprint: fingerprint,
        })
        .select('id')
        .single();

      if (data) {
        inserted++;
        eventIds.push(data.id);
      } else {
        skipped++;
      }
    }
  }

  return { matched, inserted, updated, eventIds, skipped };
}
