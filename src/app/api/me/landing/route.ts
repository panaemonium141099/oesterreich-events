/**
 * GET /api/me/landing — Personalisierung für die statische Landing (§10.2).
 *
 * Die Landing (`/`) rendert seit dem Umbau für ALLE Besucher identisch aus
 * dem ISR-Cache (kein cookies()/auth im RSC-Pfad mehr). Eingeloggte Clients
 * holen sich hier nach dem First Paint ihre Personalisierung:
 *
 *   - matches: die nächsten Auftritte gefolgter Künstler (max 8, gleiche
 *     RPC wie früher im Server-Render)
 *   - savedEventIds / artistMatchEventIds / lineupMatchEventIds: für
 *     künftige Client-Badge-Hydration der Event-Karten
 *   - followedLive: gefolgte Künstler mit Eventim-Termin in den nächsten
 *     sieben Wiener Tagen, gleiche Form wie die statische Rotation
 *     (LandingArtistLive), damit die Kachel „Diese Woche live" beide Listen
 *     ohne Umbau mischt
 *   - followedNames: alle gefolgten Namen normalisiert, damit die Kachel
 *     auch rotierte Künstler als „Folgst du" markieren kann
 *
 * Anonyme Aufrufer bekommen sofort { signedIn: false, ... } — der Client
 * ruft die Route aber ohnehin nur auf, wenn ein sb-*-auth-token-Cookie
 * sichtbar ist (siehe ArtistsLive), Googlebot & Co. treffen sie nie.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLandingContext } from '@/lib/v4/get-landing-context';
import { fetchArtistAppearances, type ArtistAppearance } from '@/lib/artists/appearances';
import { SITE_COUNTRY } from '@/lib/site-country';
import { EVENT_URL_COLUMNS } from '@/lib/utils/slugify';
import { addViennaDays, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import type { Event } from '@/types/events';
import { unresolvedPrimaryIds, type ArtistEventRow, type ArtistRow, type LandingArtistLive } from '@/lib/v4/landing-picks';
import {
  FOLLOWED_LIVE_POOL,
  artistNameFilter,
  chunkNames,
  normalizeFollowedNames,
  pickFollowedLive,
} from '@/lib/v4/followed-live';

export const dynamic = 'force-dynamic';

// Spalten, die die Kachel braucht: URL (EVENT_URL_COLUMNS, sonst zeigen
// alle Zeilen auf 1010-wien), Uhrzeit (is_all_day, duration_type), Bild,
// Sichtbarkeit und duplicate_of für den Primary-Nachlauf.
const LIVE_EVENT_COLS = `${EVENT_URL_COLUMNS},title,country,category,image_url,image_width,publish_status,event_score,is_all_day,duration_type,duplicate_of`;

type LiveEvent = Event & { duplicate_of?: string | null };
type LiveRow = ArtistRow & { event: LiveEvent | LiveEvent[] | null };

interface FollowedLive {
  followedLive: LandingArtistLive[];
  followedNames: string[];
}

/**
 * Gefolgte Künstler mit Termin in sieben Wiener Tagen. Vorauswahl per
 * `ilike` auf event_artists.artist_name (roh und normalisiert, ≤ 100 Namen
 * je Abfrage), Entscheidung in JS über normalizeArtistName; unterdrückte
 * Eventim-Zeilen zeigen den sichtbaren Primary (Nachladen ≤ 200 IDs).
 */
async function loadFollowedLive(db: SupabaseClient, userId: string, now: Date): Promise<FollowedLive> {
  const { data: followedRows, error } = await db
    .from('followed_artists')
    .select('artist_name')
    .eq('user_id', userId);
  if (error) throw error;

  const rawNames = (followedRows ?? []) as Array<{ artist_name: string | null }>;
  const followedNames = normalizeFollowedNames(rawNames);
  if (followedNames.length === 0) return { followedLive: [], followedNames };

  const today = viennaToday(now);
  const windowEnd = viennaDayStart(addViennaDays(today, 7)).toISOString();
  const nowIso = now.toISOString();

  const filters = chunkNames(rawNames.map(r => r.artist_name ?? ''))
    .map(artistNameFilter)
    .filter(Boolean);
  const results = await Promise.all(filters.map(filter => db
    .from('event_artists')
    .select(`artist_id, artist_name, artist_image, evo_link, event:events!inner(${LIVE_EVENT_COLS})`)
    .or(filter)
    .eq('event.country', SITE_COUNTRY)
    .or('publish_status.eq.published,duplicate_of.not.is.null', { referencedTable: 'event' })
    .gte('event.start_date', nowIso)
    .lt('event.start_date', windowEnd)
    .limit(FOLLOWED_LIVE_POOL)));

  // Zeilen je Event bündeln (ArtistEventRow), wie die Rotation sie sieht.
  const byEvent = new Map<string, ArtistEventRow>();
  for (const res of results) {
    if (res.error) throw res.error;
    for (const r of (res.data ?? []) as unknown as LiveRow[]) {
      const event = Array.isArray(r.event) ? r.event[0] : r.event;
      if (!event) continue;
      const row = byEvent.get(event.id) ?? { event, artists: [] };
      row.artists.push({ artist_id: r.artist_id, artist_name: r.artist_name, artist_image: r.artist_image, evo_link: r.evo_link });
      byEvent.set(event.id, row);
    }
  }
  const rows = [...byEvent.values()];

  const primaryIds = unresolvedPrimaryIds(rows).slice(0, 200);
  const primaries = new Map<string, Event>();
  if (primaryIds.length) {
    const { data, error: primaryError } = await db
      .from('events')
      .select(LIVE_EVENT_COLS)
      .in('id', primaryIds)
      .eq('publish_status', 'published')
      .eq('country', SITE_COUNTRY);
    if (primaryError) throw primaryError;
    for (const e of (data ?? []) as unknown as Event[]) primaries.set(e.id, e);
  }

  return { followedLive: pickFollowedLive(rows, primaries, new Set(followedNames)), followedNames };
}

export async function GET() {
  const ctx = await getLandingContext();

  if (!ctx.signedIn || !ctx.userId) {
    return NextResponse.json(
      { signedIn: false, matches: [], savedEventIds: [], artistMatchEventIds: [], lineupMatchEventIds: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // Künstler-Auftritte via RPC get_artist_appearances (nur an service_role
  // granted) — identische Quelle wie der frühere Server-Render. Die
  // gefolgten Live-Termine laufen daneben; fällt eins aus, bleibt das andere.
  let matches: ArtistAppearance[] = [];
  let live: FollowedLive = { followedLive: [], followedNames: [] };
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const [appearancesRes, liveRes] = await Promise.allSettled([
      fetchArtistAppearances(admin, ctx.userId),
      loadFollowedLive(admin, ctx.userId, new Date()),
    ]);
    if (appearancesRes.status === 'fulfilled') matches = appearancesRes.value.slice(0, 8);
    else console.error('[api/me/landing] appearances failed:', appearancesRes.reason);
    if (liveRes.status === 'fulfilled') live = liveRes.value;
    else console.error('[api/me/landing] followedLive failed:', liveRes.reason);
  }

  return NextResponse.json(
    {
      signedIn: true,
      matches,
      savedEventIds: [...ctx.savedEventIds],
      artistMatchEventIds: [...ctx.artistMatchEventIds],
      lineupMatchEventIds: [...ctx.lineupMatchEventIds],
      followedLive: live.followedLive,
      followedNames: live.followedNames,
    },
    // privat cachen: 60s reicht — die Daten ändern sich nur durch eigene
    // Aktionen (folgen/merken), und die Seite lädt bei Navigation ohnehin neu.
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
