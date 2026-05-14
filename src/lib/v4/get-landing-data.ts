import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Event } from '@/types/events';
import type { Festival } from '@/types/festivals';
import { deriveEventState, type V4EventState } from './derive-event-state';
import type { LandingContext } from './get-landing-context';

export interface LandingArtist {
  name: string;
  genre?: string | null;
  slug?: string | null;
}

export interface LandingData {
  todayWeekend: Array<Event & { state: V4EventState }>;
  concerts: Array<Event & { state: V4EventState }>;
  festivals: Array<Festival & { lineupMatch: boolean }>;
  matches: Array<Event & { state: V4EventState }>;
  popularArtists: LandingArtist[];
}

const FALLBACK_ARTISTS: LandingArtist[] = [
  { name: 'Bilderbuch', genre: 'Indie · Austropop' },
  { name: 'Wanda', genre: 'Wienerlied-Rock' },
  { name: 'Pizzera & Jaus', genre: 'Comedy-Pop' },
];

function enrichEvents(rows: Event[], ctx: LandingContext): Array<Event & { state: V4EventState }> {
  return rows.map(e => ({ ...e, state: deriveEventState(e, ctx) }));
}

/**
 * Single entry point for all landing sections. Issues queries in parallel,
 * then enriches with per-event state via deriveEventState. Fires queries
 * for matches only if signedIn AND we have match candidate IDs.
 *
 * Festival `lineupMatch` is set to false in Phase 2 — computing per-festival
 * lineup matches requires another join we're not optimizing for here. The
 * MatchesSection handles per-event lineup matches (via lineupMatchEventIds)
 * which is the higher-signal surface anyway.
 */
export async function getLandingData(ctx: LandingContext): Promise<LandingData> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString();
  const weekendEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // Base column list — kept tight to what the cards consume.
  const eventCols = 'id,slug,title,description,start_date,end_date,location_name,bundesland,district,category,image_url,ticket_url,price_text,price_min,price_max,price_tier,price_flags,publish_status,event_score,tags,created_at,updated_at,source_id,source_name,source_url';

  // Match query needs candidate event IDs from the pre-computed context.
  const matchEventIds = Array.from(ctx.artistMatchEventIds)
    .concat(Array.from(ctx.lineupMatchEventIds));

  const matchQuery = ctx.signedIn && matchEventIds.length > 0
    ? supabase
        .from('events')
        .select(eventCols)
        .in('id', matchEventIds)
        .gte('start_date', today)
        .eq('publish_status', 'published')
        .order('start_date', { ascending: true })
        .limit(6)
    : Promise.resolve({ data: [] as Event[], error: null });

  const [weekendRes, concertsRes, festivalsRes, matchesRes] = await Promise.all([
    // todayWeekend: top events in next 7 days
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', weekendEnd)
      .eq('publish_status', 'published')
      .order('event_score', { ascending: false })
      .limit(7),
    // concerts: music in next 7 days
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', weekendEnd)
      .eq('publish_status', 'published')
      .or('category.eq.music,category.eq.konzerte')
      .order('event_score', { ascending: false })
      .limit(3),
    // festivals: upcoming (use real column names: starts_at, ends_at)
    supabase
      .from('festivals')
      .select('*')
      .gte('ends_at', today.split('T')[0])
      .order('starts_at', { ascending: true })
      .limit(4),
    matchQuery,
  ]);

  const todayWeekend = enrichEvents((weekendRes.data ?? []) as unknown as Event[], ctx);
  const concerts = enrichEvents((concertsRes.data ?? []) as unknown as Event[], ctx);
  const matches = enrichEvents((matchesRes.data ?? []) as unknown as Event[], ctx);

  const festivals = ((festivalsRes.data ?? []) as Festival[]).map(f => ({
    ...f,
    lineupMatch: false, // Phase 2 best-effort — see fn-docstring above
  }));

  return {
    todayWeekend,
    concerts,
    festivals,
    matches,
    popularArtists: FALLBACK_ARTISTS,
  };
}
