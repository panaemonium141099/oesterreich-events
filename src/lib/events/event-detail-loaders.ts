/**
 * Shared event-detail data loaders.
 *
 * Used by both:
 *   - src/app/events/[...slug]/page.tsx          — full event detail page
 *   - src/app/@modal/(.)events/[...slug]/page.tsx — sheet rendered over the map
 *     when the user clicks "Details öffnen" from the bubble popover
 *
 * Both surfaces need the exact same data and the exact same URL-shape
 * resolution. Keeping the loaders in one module guarantees they don't
 * drift, and the unstable_cache tags here are shared so a single
 * `revalidateTag('event')` invalidates both surfaces at once.
 */
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { extractShortId } from '@/lib/utils/slugify';
import type { FriendAttendee, LineupAct } from '@/components/Events/EventDetailV2';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ─────────────────────────────────────────────────────────────────────
// Event lookup (3 strategies for 3 URL shapes)
// ─────────────────────────────────────────────────────────────────────

/**
 * Loads an event by short ID prefix (first 8 chars of UUID).
 * Works for both hybrid slug URLs and legacy full-UUID URLs.
 *
 * Uses UUID range filtering since PostgREST doesn't support LIKE on UUID columns.
 *
 * **ISR-Cache:** wrapped with `unstable_cache` because the Supabase JS client
 * sends `Cache-Control: no-cache` on its internal fetch() calls, which opts
 * the whole page out of Next.js ISR. Without this wrapper we observed
 * `X-Vercel-Cache: MISS` on every request and Google refused to index the
 * ~42 000 event-detail pages.
 */
export const getEventByShortId = unstable_cache(
  async (slugParam: string): Promise<Event | null> => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam)) {
      const { data, error } = await supabase
        .from('events').select('*').eq('id', slugParam).single();
      if (!error && data) return data as Event;
    }
    const shortId = slugParam.slice(0, 8);

    // Defensive: only run the UUID-range query if shortId is exactly
    // 8 hex chars. Bot/Crawler-Traffic with mangled URLs (z.B. die
    // %2F-encoded fully-collapsed paths von ChatGPT/Amazonbot Logs)
    // produzieren sonst kaputte WHERE-Clauses wie
    //   gte('id', '9220-kla-0000-0000-0000-000000000000')
    // die Postgres mit `invalid input syntax for type uuid` ablehnt
    // und unsere Page zum 500 wird → Vercel cacht den 500 stundenlang.
    if (!/^[0-9a-f]{8}$/i.test(shortId)) {
      return null;
    }

    const rangeStart = `${shortId}-0000-0000-0000-000000000000`;
    const rangeEnd = `${shortId}-ffff-ffff-ffff-ffffffffffff`;
    const { data, error } = await supabase
      .from('events').select('*')
      .gte('id', rangeStart).lte('id', rangeEnd).limit(1).single();
    if (error || !data) return null;
    return data as Event;
  },
  ['event-detail'],
  { revalidate: 3600, tags: ['event'] },
);

/**
 * Loads an event by (slug, yyyy-mm-dd). This is the preferred lookup for V2
 * URLs of the shape `/events/{plz-ort}/{date}/{slug}`.
 *
 * **CRITICAL:** filters out `publish_status='duplicate'` rows. Without this
 * filter, a `duplicate` row with the same slug+date as its primary could
 * win the ORDER BY tiebreaker (identical event_score is common because
 * scorer copies from the primary). Then the duplicate's
 * `permanentRedirect()` fires → loops back through the canonical-V3
 * redirect → back to this lookup → infinite loop. See ad29851f /
 * 5a5b2484 "Eisenstadt in Weiß" 2026-04-24.
 */
export const getEventBySlugAndDate = unstable_cache(
  async (slug: string, date: string): Promise<Event | null> => {
    const dayStart = `${date}T00:00:00.000Z`;
    const nextDay = new Date(date + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = nextDay.toISOString();
    const { data, error } = await supabase
      .from('events').select('*')
      .eq('slug', slug).gte('start_date', dayStart).lt('start_date', dayEnd)
      .neq('publish_status', 'duplicate')
      .order('event_score', { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as Event;
  },
  ['event-by-slug-date'],
  // 300s aligns with the page-level ISR stale-time. Was 3600 but that meant
  // a TVB correction synced into Supabase needed up to an hour to appear
  // even after ISR revalidated, because the page got the stale row from
  // this cache instead of refetching. 2026-05-26: dropped to 5min to keep
  // the "hourly sync" promise honest.
  { revalidate: 300, tags: ['event'] },
);

/**
 * Slug-only fallback lookup. Catches the "event got rescheduled" case where
 * the scraper bumped start_date to a later day. The slug itself is stable
 * across re-upserts since phase-1.5; the caller follows up with a 301 to
 * the canonical URL containing the new date.
 */
export const getEventBySlugOnly = unstable_cache(
  async (slug: string): Promise<Event | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('events').select('*')
      .eq('slug', slug).gte('start_date', today)
      .eq('publish_status', 'published')
      .order('event_score', { ascending: false, nullsFirst: false })
      .limit(1);
    if (!error && data && data.length > 0) return data[0] as Event;

    // Zweite Stufe (SEO-Fix 2026-09-01): auch VERGANGENE Ausgaben zulassen.
    // Bei verschobenen Terminen ("Zeltfest 06.08." wurde zu "08.08.") traf
    // weder der Datums- noch dieser Slug-Lookup — die indexierte URL lief
    // in ein 404, obwohl die Zeile unveraendert published in der DB liegt
    // (gemessen: 7 Seiten, ~4.000 Impressions/Woche). Der Aufrufer
    // rendert diese Seiten mit der Termin-vorbei-Box; ein Redirect
    // unterbleibt fuer vergangene Events weiterhin (Loop-Schutz).
    // Juengste Ausgabe zuerst, damit wiederkehrende Feste die letzte
    // stattgefundene Ausgabe zeigen.
    const { data: past } = await supabase
      .from('events').select('*')
      .eq('slug', slug).lt('start_date', today)
      .eq('publish_status', 'published')
      .order('start_date', { ascending: false })
      .limit(1);
    return past && past.length > 0 ? (past[0] as Event) : null;
  },
  ['event-by-slug-only'],
  // 300s — same reason as event-by-slug-date above.
  { revalidate: 300, tags: ['event'] },
);

// ─────────────────────────────────────────────────────────────────────
// Venue lookup
// ─────────────────────────────────────────────────────────────────────

export const getVenue = unstable_cache(
  async (venueId: string): Promise<{ name: string; city: string | null } | null> => {
    const { data, error } = await supabase
      .from('venues').select('name, city').eq('id', venueId).single();
    if (error || !data) return null;
    return data;
  },
  ['venue-detail'],
  { revalidate: 3600, tags: ['venue'] },
);

// ─────────────────────────────────────────────────────────────────────
// Friends + RSVP totals (from any group with linked_event_id = event.id)
// ─────────────────────────────────────────────────────────────────────

export const getFriendsForEvent = unstable_cache(
  async (
    eventId: string,
  ): Promise<{ friends: FriendAttendee[]; rsvpTotals: { going: number; maybe: number } }> => {
    const empty = { friends: [], rsvpTotals: { going: 0, maybe: 0 } };
    const { data: groups, error: gErr } = await supabase
      .from('groups').select('id').eq('linked_event_id', eventId);
    if (gErr || !groups || groups.length === 0) return empty;

    const groupIds = groups.map((g: { id: string }) => g.id);
    const { data: members, error: mErr } = await supabase
      .from('group_members')
      .select('user_id, rsvp, profile:profiles(id, first_name, last_name, avatar_url)')
      .in('group_id', groupIds);
    if (mErr || !members) return empty;

    type RawMember = {
      user_id: string;
      rsvp: 'accepted' | 'maybe' | 'declined' | 'pending' | null;
      profile:
        | { id: string; first_name: string; last_name: string | null; avatar_url: string | null }
        | { id: string; first_name: string; last_name: string | null; avatar_url: string | null }[]
        | null;
    };
    // Strongest-RSVP-wins dedup: a single user appearing in multiple groups
    // attached to the same event collapses to one entry.
    const rank: Record<string, number> = { accepted: 4, maybe: 3, pending: 2, declined: 1 };
    const byUser = new Map<string, FriendAttendee>();
    for (const m of (members as RawMember[])) {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      if (!profile) continue;
      const rsvp = (m.rsvp ?? 'pending') as FriendAttendee['rsvp'];
      const existing = byUser.get(m.user_id);
      if (existing && rank[existing.rsvp] >= rank[rsvp]) continue;
      byUser.set(m.user_id, {
        user_id: m.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        rsvp,
        city: null,
      });
    }
    const friends = Array.from(byUser.values());
    const going = friends.filter(f => f.rsvp === 'accepted').length;
    const maybe = friends.filter(f => f.rsvp === 'maybe').length;
    return { friends, rsvpTotals: { going, maybe } };
  },
  ['event-friends'],
  { revalidate: 3600, tags: ['event'] },
);

// ─────────────────────────────────────────────────────────────────────
// Festival lineup (sorted by day → billing rank → confidence)
// ─────────────────────────────────────────────────────────────────────

export const getLineupForEvent = unstable_cache(
  async (eventId: string): Promise<LineupAct[]> => {
    const { data, error } = await supabase
      .from('festival_artists')
      .select('artist_name_raw, stage_name, day_label, billing, confidence_score')
      .eq('derived_event_id', eventId);
    if (error || !data) return [];
    type RawAct = {
      artist_name_raw: string;
      stage_name: string | null;
      day_label: string | null;
      billing: string | null;
      confidence_score: number | null;
    };
    const billingRank = (b: string | null) => {
      if (!b) return 3;
      const lo = b.toLowerCase();
      if (lo.includes('headliner') || lo.includes('headline')) return 0;
      if (lo.includes('main')) return 1;
      if (lo.includes('support')) return 2;
      return 3;
    };
    return (data as RawAct[])
      .sort((a, b) => {
        const da = a.day_label ?? '~';
        const db = b.day_label ?? '~';
        if (da !== db) return da < db ? -1 : 1;
        const br = billingRank(a.billing) - billingRank(b.billing);
        if (br !== 0) return br;
        return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
      })
      .map(a => ({
        artist_name: a.artist_name_raw,
        stage: a.stage_name,
        start_time: a.day_label,
      }));
  },
  ['event-lineup'],
  { revalidate: 3600, tags: ['event'] },
);

// ─────────────────────────────────────────────────────────────────────
// URL-shape parsing — three URL schemas coexist during the migration
// ─────────────────────────────────────────────────────────────────────

export interface ParsedSlugArray {
  mode: 'legacy-1seg' | 'v2-2seg' | 'v2-3seg';
  shortId?: string;
  slug?: string;
  date?: string;
}

export function parseSlugArray(slug: string[]): ParsedSlugArray {
  // Shape C — /events/{plz-ort}/{yyyy-mm-dd}/{slug}
  if (slug.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(slug[1])) {
    return { mode: 'v2-3seg', date: slug[1], slug: slug[2] };
  }
  // Shape B — /events/{plz-ort}/{slug-shortId}
  if (slug.length === 2) {
    return { mode: 'v2-2seg', shortId: extractShortId(slug[1]) };
  }
  // Shape A — /events/{shortId-slug}
  return { mode: 'legacy-1seg', shortId: extractShortId(slug[0] ?? '') };
}

export async function resolveEvent(parsed: ParsedSlugArray): Promise<Event | null> {
  if (parsed.mode === 'v2-3seg' && parsed.slug && parsed.date) {
    const exact = await getEventBySlugAndDate(parsed.slug, parsed.date);
    if (exact) return exact;
    return getEventBySlugOnly(parsed.slug);
  }
  if (parsed.shortId) {
    return getEventByShortId(parsed.shortId);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────────────

export function buildBundeslandHref(bundesland: string | null): string | null {
  if (!bundesland) return null;
  return `/map?bundesland=${encodeURIComponent(bundesland)}`;
}

/**
 * Nachfolge-Ausgabe eines vergangenen Events finden (SEO-Fix 2026-09-01).
 *
 * Wiederkehrende Dorffeste/Märkte/Kirtage sammeln über Monate Rankings an;
 * nach dem Termin läuft dieser Traffic ins Leere. Wir suchen deshalb die
 * nächste Ausgabe und verlinken sie prominent auf der vergangenen Seite:
 *
 *   1. exakter Slug-Treffer in der Zukunft (deckt jährliche Serien, deren
 *      Slug stabil bleibt: "waldfest-haiming")
 *   2. sonst Titel-Präfix am selben Ort (deckt durchnummerierte Titel:
 *      "44. Hinterglemmer Bauernmarkt" → "45. …"); nutzt den trgm-Index
 *      über title und ist auf 1 Zeile begrenzt.
 *
 * Beide Zweige sind indexiert und laufen nur auf vergangenen Detailseiten.
 */
export const getSuccessorEvent = unstable_cache(
  async (
    slug: string | null,
    title: string,
    locationName: string | null,
  ): Promise<Event | null> => {
    const nowIso = new Date().toISOString();

    if (slug) {
      const { data } = await supabase
        .from('events').select('*')
        .eq('slug', slug).gt('start_date', nowIso)
        .eq('publish_status', 'published').eq('visibility', 'public')
        .order('start_date', { ascending: true })
        .limit(1);
      if (data && data.length > 0) return data[0] as Event;
    }

    // Führende Nummerierung/Jahreszahl abschneiden ("44. Hinterglemmer
    // Bauernmarkt" → "Hinterglemmer Bauernmarkt") und danach suchen.
    const core = title.replace(/^\s*\d+\.?\s*/, '').replace(/\b(19|20)\d{2}\b/g, '').trim();
    if (core.length < 8 || !locationName) return null;
    const { data } = await supabase
      .from('events').select('*')
      .ilike('title', `%${core.slice(0, 60)}%`)
      .eq('location_name', locationName)
      .gt('start_date', nowIso)
      .eq('publish_status', 'published').eq('visibility', 'public')
      .order('start_date', { ascending: true })
      .limit(1);
    return data && data.length > 0 ? (data[0] as Event) : null;
  },
  ['event-successor'],
  { revalidate: 3600, tags: ['event'] },
);
