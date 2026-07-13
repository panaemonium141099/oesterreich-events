import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export interface ListedEvent {
  id: string;
  title: string;
  url: string; // absolute lasstreffen.at event URL
  startDate: string;
  /** Detailseiten-Aufrufe der letzten 30 Tage (aus analytics_events) —
   *  Social Proof für den Draft-Einstieg. undefined wenn nicht ermittelbar. */
  views?: number;
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

  const listed: ListedEvent[] = rows.slice(0, limit).map((e) => ({
    id: e.id as string,
    title: (e.title as string) ?? '',
    startDate: (e.start_date as string) ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: `https://lasstreffen.at${buildEventUrlV2(e as any)}`,
  }));

  // Social Proof: Detailseiten-Aufrufe (30 Tage) je Event — der globale
  // PageviewTracker schreibt window.location.pathname nach analytics_events,
  // die kanonische Event-URL matcht also exakt. Best-effort: Fehler hier
  // dürfen das Event-Linking nie kippen.
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    await Promise.all(listed.map(async (ev) => {
      const path = ev.url.replace('https://lasstreffen.at', '');
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'page_view')
        .eq('page', path)
        .gte('created_at', since);
      if (typeof count === 'number') ev.views = count;
    }));
  } catch {
    /* ohne Zahlen weiterarbeiten */
  }

  return listed;
}
