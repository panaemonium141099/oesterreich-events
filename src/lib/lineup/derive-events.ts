/**
 * Derived Event Generator for Festival Lineups
 *
 * For each festival_artists row WHERE derived_event_id IS NULL:
 *   1. Compose title: "{artist_name_raw} at {festival.canonical_name}"
 *   2. Inherit location from parent event (via festivals.parent_event_id)
 *   3. Set source_type = 'derived', source_name = 'festival-lineup'
 *   4. Generate content_fingerprint via generateFingerprint()
 *   5. Upsert into events (ON CONFLICT content_fingerprint for derived)
 *   6. Backlink: UPDATE festival_artists SET derived_event_id, updated_at
 *
 * Derived events bypass deduplicateEvents() entirely -- the unique partial
 * index on events(content_fingerprint) WHERE source_type = 'derived'
 * handles conflicts via ON CONFLICT DO UPDATE.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Festival, FestivalArtist } from '@/types/festivals';
import type { Event } from '@/types/events';
import { generateFingerprint } from '@/lib/dedup/fingerprint';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeriveEventsOptions {
  /** Only derive events for a specific festival slug */
  festivalSlug?: string;
  /** Verbose logging */
  verbose?: boolean;
}

export interface DeriveEventsResult {
  events_created: number;
  events_backlinked: number;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string, verbose = true): void {
  if (!verbose) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [derive-events] ${message}`);
}

/**
 * Resolve the start_date for a derived event.
 *
 * Priority:
 *   1. day_label if it looks like an ISO date (YYYY-MM-DD)
 *   2. festival.starts_at
 *   3. null (caller must handle)
 */
function resolveStartDate(
  dayLabel: string | null,
  festival: Festival
): string | null {
  // Try day_label as ISO date
  if (dayLabel) {
    const isoDateMatch = dayLabel.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      return isoDateMatch[1];
    }
  }

  // Fall back to festival start date
  if (festival.starts_at) {
    return festival.starts_at.slice(0, 10);
  }

  return null;
}

/**
 * Fetch the parent event for a festival (to inherit location data).
 */
async function fetchParentEvent(
  supabase: SupabaseClient,
  parentEventId: string
): Promise<Partial<Event> | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, location_name, address, postal_code, bundesland, district, latitude, longitude, category, image_url'
    )
    .eq('id', parentEventId)
    .single();

  if (error || !data) return null;
  return data as Partial<Event>;
}

// ── Core derivation ─────────────────────────────────────────────────────────

/**
 * Generate derived events for un-derived festival_artists rows.
 *
 * For each row where derived_event_id IS NULL:
 *   - Build a "{Artist} at {Festival}" event
 *   - Upsert with content_fingerprint conflict handling
 *   - Backlink the returned event id + touch updated_at
 */
export async function deriveFestivalEvents(
  supabase: SupabaseClient,
  options: DeriveEventsOptions = {}
): Promise<DeriveEventsResult> {
  const verbose = options.verbose ?? false;
  const result: DeriveEventsResult = {
    events_created: 0,
    events_backlinked: 0,
    errors: [],
  };

  // 1. Fetch un-derived festival_artists rows
  let query = supabase
    .from('festival_artists')
    .select('*, festivals!inner(*)')
    .is('derived_event_id', null);

  // If filtering by slug, join through to festivals.slug
  // The join syntax festivals!inner(*) gives us the festival data
  // We filter on the joined table
  if (options.festivalSlug) {
    query = query.eq('festivals.slug', options.festivalSlug);
  }

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) {
    result.errors.push(`Failed to fetch un-derived artists: ${fetchErr.message}`);
    return result;
  }

  if (!rows || rows.length === 0) {
    log('No un-derived festival_artists rows found', verbose);
    return result;
  }

  log(`Found ${rows.length} un-derived festival_artists rows`, verbose);

  // 2. Group by festival to batch parent event lookups
  //    Each row has the joined festival data under the 'festivals' key
  const parentEventCache = new Map<string, Partial<Event> | null>();

  for (const row of rows) {
    const artist = row as FestivalArtist & { festivals: Festival };
    const festival = artist.festivals;

    if (!festival) {
      result.errors.push(
        `Artist row ${artist.id} has no festival data (festival_id: ${artist.festival_id})`
      );
      continue;
    }

    // 3. Compose the derived event title
    const title = `${artist.artist_name_raw} at ${festival.canonical_name}`;

    // 4. Resolve start_date
    const startDate = resolveStartDate(artist.day_label, festival);
    if (!startDate) {
      log(
        `Skipping "${title}": no resolvable start_date (day_label=${artist.day_label}, festival.starts_at=${festival.starts_at})`,
        verbose
      );
      result.errors.push(`No start_date for "${title}"`);
      continue;
    }

    // 5. Generate content fingerprint
    const fingerprint = generateFingerprint(title, startDate);
    if (!fingerprint) {
      log(`Skipping "${title}": could not generate fingerprint`, verbose);
      result.errors.push(`No fingerprint for "${title}"`);
      continue;
    }

    // 6. Inherit location from parent event
    let locationData: Partial<Event> | null = null;
    if (festival.parent_event_id) {
      if (parentEventCache.has(festival.parent_event_id)) {
        locationData = parentEventCache.get(festival.parent_event_id) ?? null;
      } else {
        locationData = await fetchParentEvent(supabase, festival.parent_event_id);
        parentEventCache.set(festival.parent_event_id, locationData);
      }
    }

    // 7. Build the derived event row
    const eventRow = {
      source_type: 'derived',
      source_name: 'festival-lineup',
      // source_id: deterministic from fingerprint for ON CONFLICT
      source_id: `lineup-${festival.slug}-${fingerprint.slice(0, 16)}`,
      source_url: festival.lineup_url ?? festival.website_url ?? null,
      title,
      description: artist.stage_name
        ? `${artist.artist_name_raw} performing at ${festival.canonical_name} (${artist.stage_name})`
        : `${artist.artist_name_raw} performing at ${festival.canonical_name}`,
      start_date: startDate,
      end_date: null as string | null,
      location_name: locationData?.location_name ?? festival.city ?? null,
      address: locationData?.address ?? null,
      postal_code: locationData?.postal_code ?? null,
      bundesland: locationData?.bundesland ?? festival.state ?? null,
      district: locationData?.district ?? null,
      latitude: locationData?.latitude ?? null,
      longitude: locationData?.longitude ?? null,
      category: locationData?.category ?? 'Musik',
      image_url: locationData?.image_url ?? null,
      tags: ['Festival', 'Lineup'],
      parent_event_id: festival.parent_event_id ?? null,
      content_fingerprint: fingerprint,
      visibility: 'public',
    };

    // 8. Upsert into events
    //    The unique partial index idx_events_derived_fingerprint handles conflicts
    //    for derived events by content_fingerprint.
    //    We use source_name + source_id as the conflict target since that's the
    //    standard upsert key for the events table.
    const { data: upsertedData, error: upsertErr } = await supabase
      .from('events')
      .upsert(eventRow, {
        onConflict: 'source_name,source_id',
      })
      .select('id')
      .single();

    if (upsertErr) {
      log(`Error upserting derived event "${title}": ${upsertErr.message}`, true);
      result.errors.push(`Upsert error for "${title}": ${upsertErr.message}`);
      continue;
    }

    const eventId = upsertedData?.id;
    if (!eventId) {
      result.errors.push(`No event id returned for "${title}"`);
      continue;
    }

    result.events_created++;

    // 9. Backlink: update festival_artists.derived_event_id + touch updated_at
    const { error: backlinkErr } = await supabase
      .from('festival_artists')
      .update({
        derived_event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artist.id);

    if (backlinkErr) {
      log(
        `Error backlinking artist "${artist.artist_name_raw}" to event ${eventId}: ${backlinkErr.message}`,
        true
      );
      result.errors.push(`Backlink error for "${artist.artist_name_raw}": ${backlinkErr.message}`);
    } else {
      result.events_backlinked++;
      log(
        `Derived event for "${artist.artist_name_raw}" at "${festival.canonical_name}" -> ${eventId}`,
        verbose
      );
    }
  }

  return result;
}
