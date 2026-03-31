/**
 * Supabase sync for scraper pipeline.
 *
 * Upserts a batch of ScrapedEvents into the Supabase `events` table using
 * the service role key (bypasses RLS). Conflict resolution: ON CONFLICT
 * (source_name, source_id) → update all mutable fields.
 *
 * Used by runScraper() so every scraper writes directly to Supabase
 * in addition to SQLite (dual-write pattern).
 */
import { createClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import { categorizeEventMulti } from '@/lib/categories';

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for scraper sync');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Maps a ScrapedEvent to the Supabase events row shape. */
function toSupabaseRow(event: ScrapedEvent) {
  const tags = categorizeEventMulti(event.title, event.description, event.tags);
  return {
    source_type: 'scraped' as const,
    source_name: event.source_name,
    source_id: event.source_id,
    source_url: event.source_url,
    title: event.title,
    description: event.description ?? null,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    postal_code: event.postal_code ?? null,
    bundesland: event.bundesland ?? null,
    district: event.district ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    category: event.category ?? null,
    tags: tags.length > 0 ? tags : null,
    price_text: event.price_text ?? null,
    price_min: event.price_min ?? null,
    price_max: event.price_max ?? null,
    image_url: event.image_url ?? null,
    organizer: event.organizer ?? null,
    visibility: 'public' as const,
  };
}

const BATCH_SIZE = 100;

/**
 * Upserts a list of scraped events into Supabase in batches.
 * Returns counts of inserted/updated rows.
 */
export async function syncEventsToSupabase(
  events: ScrapedEvent[]
): Promise<{ upserted: number; errors: number }> {
  if (events.length === 0) return { upserted: 0, errors: 0 };

  const supabase = getSupabaseAdminClient();
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE).map(toSupabaseRow);
    const { error, count } = await supabase
      .from('events')
      .upsert(batch, {
        onConflict: 'source_name,source_id',
        count: 'exact',
      });

    if (error) {
      console.error(`[supabase-sync] Batch ${i}–${i + batch.length} error:`, error.message);
      errors += batch.length;
    } else {
      upserted += count ?? batch.length;
    }
  }

  return { upserted, errors };
}
