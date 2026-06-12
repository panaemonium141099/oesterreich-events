import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export interface ListedEvent {
  id: string;
  title: string;
  url: string; // absolute lasstreffen.at event URL
  startDate: string;
}

const SELECT = 'id, title, slug, start_date, postal_code, address, bundesland, location_name';

/**
 * The (future, published) events we already list for a prospect domain — via
 * matching events.organizer_url OR the prospect's venue website. These power
 * the "wir featuren bereits eure Events X, Y" personalization.
 */
export async function linkListedEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  domain: string,
  limit = 5,
): Promise<ListedEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const like = `%${domain}%`;
  const seen = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];

  const { data: byOrg } = await supabase
    .from('events').select(SELECT)
    .ilike('organizer_url', like)
    .eq('publish_status', 'published').gte('start_date', today)
    .order('start_date', { ascending: true }).limit(limit);
  for (const r of (byOrg ?? []) as Array<Record<string, unknown>>) {
    if (!seen.has(r.id as string)) { seen.add(r.id as string); rows.push(r); }
  }

  if (rows.length < limit) {
    const { data: venues } = await supabase.from('venues').select('id').ilike('website', like).limit(50);
    const vids = ((venues ?? []) as Array<{ id: string }>).map((v) => v.id);
    if (vids.length > 0) {
      const { data: byVenue } = await supabase
        .from('events').select(SELECT)
        .in('venue_id', vids)
        .eq('publish_status', 'published').gte('start_date', today)
        .order('start_date', { ascending: true }).limit(limit);
      for (const r of (byVenue ?? []) as Array<Record<string, unknown>>) {
        if (!seen.has(r.id as string)) { seen.add(r.id as string); rows.push(r); }
      }
    }
  }

  return rows.slice(0, limit).map((e) => ({
    id: e.id as string,
    title: (e.title as string) ?? '',
    startDate: (e.start_date as string) ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: `https://lasstreffen.at${buildEventUrlV2(e as any)}`,
  }));
}
