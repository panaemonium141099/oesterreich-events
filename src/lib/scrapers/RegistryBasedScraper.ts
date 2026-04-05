/**
 * Registry-Based Scraper — Orchestrates venue feed ingestion pipeline.
 *
 * Instead of one-scraper-per-source, this scraper iterates over venues
 * in the Supabase registry that have a detected event feed, and uses the
 * appropriate connector (ICS, JSON-LD) to ingest events.
 *
 * Pipeline per venue:
 * 1. Read venue record (feed URL + type)
 * 2. Dispatch to ICS or JSON-LD connector
 * 3. Attach venue_id to each scraped event
 * 4. Collect all events across venues
 * 5. Run content deduplication (fingerprint + fuzzy)
 * 6. Return deduplicated ScrapedEvent[] for standard sync pipeline
 *
 * Used by:
 * - `npx tsx src/scripts/scrape-venues.ts` (standalone)
 * - Can be added to the main scraper registry in index.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ICSConnector } from '../connectors/ics-connector';
import { fetchAndExtractEvents } from '../connectors/json-ld-connector';
import { deduplicateEvents } from '../dedup';
import type { ScrapedEvent } from '@/types/events';
import type { Venue, EventFeedType } from '@/types/venues';

// ── Public types ─────────────────────────────────────────────────────────────

export interface VenueIngestionResult {
  venue_id: string;
  venue_name: string;
  feed_type: EventFeedType;
  events_found: number;
  errors: string[];
  duration_ms: number;
}

export interface RegistryScraperResult {
  venues_processed: number;
  venues_with_events: number;
  venues_errored: number;
  total_events_raw: number;
  total_events_deduped: number;
  duplicates_removed: number;
  venue_results: VenueIngestionResult[];
  events: ScrapedEvent[];
}

export interface RegistryScraperOptions {
  /** Maximum venues to process in one run (default: 500) */
  maxVenues?: number;
  /** Concurrency for venue processing (default: 5) */
  concurrency?: number;
  /** Only process venues with this feed type */
  feedType?: EventFeedType;
  /** Only process venues in this bundesland */
  bundesland?: string;
  /** Only process student-relevant venues */
  studentOnly?: boolean;
  /** Re-scrape venues even if recently scraped (ignores last_scraped_at) */
  force?: boolean;
  /** Minimum hours since last scrape before re-scraping (default: 12) */
  minHoursSinceLastScrape?: number;
  /** Specific venue IDs to process (overrides other filters) */
  venueIds?: string[];
  /** Verbose logging */
  verbose?: boolean;
}

// ── Helper: Supabase client ──────────────────────────────────────────────────

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Fetch venues eligible for feed ingestion from Supabase.
 */
export async function fetchEligibleVenues(
  supabase: SupabaseClient,
  options: RegistryScraperOptions = {},
): Promise<Venue[]> {
  const {
    maxVenues = 500,
    feedType,
    bundesland,
    studentOnly = false,
    force = false,
    minHoursSinceLastScrape = 12,
    venueIds,
  } = options;

  let query = supabase
    .from('venues')
    .select('*')
    .not('event_feed_url', 'is', null)
    .not('event_feed_type', 'is', null)
    .neq('scrape_status', 'inactive')
    .limit(maxVenues)
    .order('last_scraped_at', { ascending: true, nullsFirst: true });

  // Apply filters
  if (venueIds && venueIds.length > 0) {
    query = query.in('id', venueIds);
  } else {
    if (feedType) {
      query = query.eq('event_feed_type', feedType);
    }
    if (bundesland) {
      query = query.eq('bundesland', bundesland);
    }
    if (studentOnly) {
      query = query.eq('is_student_relevant', true);
    }

    // Skip recently scraped venues unless forced
    if (!force) {
      const cutoff = new Date(
        Date.now() - minHoursSinceLastScrape * 60 * 60 * 1000
      ).toISOString();
      query = query.or(`last_scraped_at.is.null,last_scraped_at.lt.${cutoff}`);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch venues: ${error.message}`);
  }

  return (data ?? []) as Venue[];
}

/**
 * Ingest events from a single venue's feed.
 */
export async function ingestVenueFeed(
  venue: Venue,
  verbose = false,
): Promise<{ events: ScrapedEvent[]; errors: string[] }> {
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];

  if (!venue.event_feed_url || !venue.event_feed_type) {
    errors.push(`Venue ${venue.name}: no feed URL or type`);
    return { events, errors };
  }

  const log = (msg: string) => {
    if (verbose) {
      const ts = new Date().toISOString().slice(11, 19);
      console.log(`[${ts}] [registry:${venue.name}] ${msg}`);
    }
  };

  try {
    switch (venue.event_feed_type) {
      case 'ics': {
        log(`Fetching ICS feed: ${venue.event_feed_url}`);
        const connector = new ICSConnector({
          sourceName: `registry:${slugify(venue.name)}`,
          sourceUrl: venue.website ?? venue.event_feed_url,
          venueId: venue.id,
          defaultBundesland: venue.bundesland ?? undefined,
          defaultLocationName: venue.name,
          defaultLatitude: venue.latitude ?? undefined,
          defaultLongitude: venue.longitude ?? undefined,
          expandDays: 90,
        });

        const result = await connector.fromURL(venue.event_feed_url);
        log(
          `ICS: ${result.rawEventCount} raw, ${result.expandedEventCount} expanded`
        );

        // Attach venue_id to all events
        for (const event of result.events) {
          events.push({ ...event, venue_id: venue.id });
        }

        if (result.warnings.length > 0) {
          errors.push(...result.warnings);
        }
        break;
      }

      case 'json-ld': {
        log(`Fetching JSON-LD from: ${venue.event_feed_url}`);
        const result = await fetchAndExtractEvents(
          venue.event_feed_url,
          {
            name: venue.name,
            city: venue.city ?? '',
            bundesland: venue.bundesland ?? '',
            latitude: venue.latitude,
            longitude: venue.longitude,
            address: venue.address,
            postal_code: venue.postal_code,
          },
          { maxEventsPerPage: 100 },
        );

        log(
          `JSON-LD: ${result.jsonLdBlocksFound} blocks, ${result.eventsFound} events found, ${result.events.length} after date filter`
        );

        // Set source_name to registry pattern and attach venue_id
        for (const event of result.events) {
          events.push({
            ...event,
            source_name: `registry:${slugify(venue.name)}`,
            venue_id: venue.id,
          });
        }

        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }
        break;
      }

      case 'rss': {
        // RSS connector not yet implemented for venue feeds.
        // RSS events from venues are rare; most use ICS or JSON-LD.
        log('RSS feed type not yet supported for venue ingestion');
        errors.push(
          `Venue ${venue.name}: RSS feed ingestion not yet implemented`
        );
        break;
      }

      case 'html':
      case 'api': {
        log(`Feed type '${venue.event_feed_type}' requires custom scraper logic`);
        errors.push(
          `Venue ${venue.name}: feed type '${venue.event_feed_type}' not supported in registry scraper`
        );
        break;
      }

      default: {
        errors.push(
          `Venue ${venue.name}: unknown feed type '${venue.event_feed_type}'`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Venue ${venue.name}: ${msg}`);
    log(`ERROR: ${msg}`);
  }

  return { events, errors };
}

/**
 * Update venue scrape status in Supabase after ingestion.
 */
async function updateVenueScrapeStatus(
  supabase: SupabaseClient,
  venueId: string,
  status: 'active' | 'error',
  eventsFound: number,
): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .update({
      last_scraped_at: new Date().toISOString(),
      scrape_status: status,
    })
    .eq('id', venueId);

  if (error) {
    console.error(
      `[registry] Failed to update venue ${venueId} status: ${error.message}`
    );
  }
}

/**
 * Run the full registry-based scraper pipeline.
 *
 * 1. Fetch eligible venues from Supabase
 * 2. Ingest events from each venue's feed (with concurrency control)
 * 3. Deduplicate collected events
 * 4. Return events ready for sync
 */
export async function runRegistryScraper(
  options: RegistryScraperOptions = {},
): Promise<RegistryScraperResult> {
  const {
    concurrency = 5,
    verbose = false,
  } = options;

  const supabase = getSupabaseAdmin();

  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] [registry] ${msg}`);
  };

  // Step 1: Fetch eligible venues
  log('Fetching eligible venues...');
  const venues = await fetchEligibleVenues(supabase, options);
  log(`Found ${venues.length} venues with active feeds`);

  if (venues.length === 0) {
    return {
      venues_processed: 0,
      venues_with_events: 0,
      venues_errored: 0,
      total_events_raw: 0,
      total_events_deduped: 0,
      duplicates_removed: 0,
      venue_results: [],
      events: [],
    };
  }

  // Step 2: Process venues with concurrency control
  const venueResults: VenueIngestionResult[] = [];
  const allRawEvents: ScrapedEvent[] = [];
  let venuesWithEvents = 0;
  let venuesErrored = 0;

  const queue = [...venues];

  const processVenue = async () => {
    while (queue.length > 0) {
      const venue = queue.shift();
      if (!venue) break;

      const start = Date.now();
      const { events, errors } = await ingestVenueFeed(venue, verbose);
      const durationMs = Date.now() - start;

      const result: VenueIngestionResult = {
        venue_id: venue.id,
        venue_name: venue.name,
        feed_type: venue.event_feed_type!,
        events_found: events.length,
        errors,
        duration_ms: durationMs,
      };
      venueResults.push(result);

      if (events.length > 0) {
        allRawEvents.push(...events);
        venuesWithEvents++;
        await updateVenueScrapeStatus(supabase, venue.id, 'active', events.length);
      } else if (errors.length > 0 && !errors.every(e => e.includes('not yet'))) {
        venuesErrored++;
        await updateVenueScrapeStatus(supabase, venue.id, 'error', 0);
      } else {
        // No events but no real errors -- might just be empty calendar
        await updateVenueScrapeStatus(supabase, venue.id, 'active', 0);
      }

      log(
        `[${venueResults.length}/${venues.length}] ${venue.name}: ${events.length} events` +
          (errors.length > 0 ? ` (${errors.length} warnings)` : '') +
          ` [${durationMs}ms]`
      );
    }
  };

  const workers = Array.from({ length: concurrency }, () => processVenue());
  await Promise.all(workers);

  // Step 3: Deduplicate across all venue events
  log(`Deduplicating ${allRawEvents.length} raw events...`);

  const { unique, removed } = deduplicateEvents(
    allRawEvents.map((e) => ({
      ...e,
      city: e.location_name?.split(',').pop()?.trim() ?? null,
    }))
  );

  const dedupedEvents: ScrapedEvent[] = unique.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ content_fingerprint, city, ...rest }) => rest as ScrapedEvent
  );

  log(
    `Dedup complete: ${allRawEvents.length} raw -> ${dedupedEvents.length} unique (${removed.length} duplicates removed)`
  );

  return {
    venues_processed: venues.length,
    venues_with_events: venuesWithEvents,
    venues_errored: venuesErrored,
    total_events_raw: allRawEvents.length,
    total_events_deduped: dedupedEvents.length,
    duplicates_removed: removed.length,
    venue_results: venueResults,
    events: dedupedEvents,
  };
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Create a URL-safe slug from a venue name for use in source_name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export { slugify };
