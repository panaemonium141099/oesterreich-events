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

/**
 * Festival as returned by the landing query — augmented with:
 *   - `lineupMatch`: whether any followed artist appears in this festival's
 *     line-up (Phase 2 best-effort: hardcoded false until we wire the join)
 *   - `image_url`: pulled from the JOINed parent event so the card has a
 *     real photo instead of the SVG placeholder. Falls back to null when
 *     a festival has no parent event or its parent has no image.
 */
export type LandingFestival = Festival & {
  lineupMatch: boolean;
  image_url: string | null;
};

export interface LandingData {
  todayWeekend: Array<Event & { state: V4EventState }>;
  concerts: Array<Event & { state: V4EventState }>;
  festivals: LandingFestival[];
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

/* Deterministic category-image fallback for festivals whose parent_event
   has no image_url (90 %+ of the registry data right now). Picks one of
   30 musik-N.jpg from /public/images/categories/ based on a stable hash
   of the festival id, so the same festival always gets the same picture.
   Better than the SVG placeholder, less data debt than scraping per-
   festival hero images. */
const FESTIVAL_FALLBACK_COUNT = 30;
function festivalCategoryFallback(festivalId: string): string {
  let h = 0;
  for (let i = 0; i < festivalId.length; i++) {
    h = (h * 31 + festivalId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(h) % FESTIVAL_FALLBACK_COUNT) + 1;
  return `/images/categories/musik-${idx}.jpg`;
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
    // festivals: upcoming. JOIN parent event to grab its image_url so the
    // card has a real photo (festivals table has no image column of its own).
    supabase
      .from('festivals')
      .select('*, parent_event:events!parent_event_id(image_url)')
      .gte('ends_at', today.split('T')[0])
      .order('starts_at', { ascending: true })
      .limit(4),
    matchQuery,
  ]);

  const todayWeekend = enrichEvents((weekendRes.data ?? []) as unknown as Event[], ctx);
  const concerts = enrichEvents((concertsRes.data ?? []) as unknown as Event[], ctx);
  const matches = enrichEvents((matchesRes.data ?? []) as unknown as Event[], ctx);

  type FestivalRow = Festival & {
    parent_event: { image_url: string | null } | Array<{ image_url: string | null }> | null;
  };
  const festivals: LandingFestival[] = ((festivalsRes.data ?? []) as unknown as FestivalRow[]).map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;
    return {
      ...(rest as Festival),
      lineupMatch: false, // Phase 2 best-effort — see fn-docstring above
      image_url: parentEvent?.image_url ?? festivalCategoryFallback(f.id),
    };
  });

  return {
    todayWeekend,
    concerts,
    festivals,
    matches,
    popularArtists: FALLBACK_ARTISTS,
  };
}
