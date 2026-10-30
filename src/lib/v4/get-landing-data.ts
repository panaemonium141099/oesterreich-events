import type { Event } from '@/types/events';
import type { Festival } from '@/types/festivals';
import type { PublicActivity } from '@/lib/activities/public-types';
import { buildEventUrlV2, EVENT_URL_COLUMNS } from '@/lib/utils/slugify';
import { createClient } from '@supabase/supabase-js';
import { MIN_TRUSTED_EVENT_IMAGE_WIDTH } from '@/lib/event-images/resolveEventImage';
import overridesJson from '../../../data/festival-overrides.json';
import { currentSeason, titleMatchesSeason } from '@/lib/landing/seasons';
import { SITE_COUNTRY } from '@/lib/site-country';
import { ALL_POSTS } from '@/content/blog/index';
import { addViennaDays, viennaDayRange, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import {
  arrangeBySharpness,
  festivalActs,
  pickActivities,
  pickArtistsLive,
  pickFestivals,
  pickLandingSelection,
  pickPosts,
  readCountryTotal,
  unresolvedPrimaryIds,
  weekendWindow,
  type ArtistEventRow,
  type LandingArtistLive,
  type LandingPin,
  type LandingPost,
  type LandingTip,
} from './landing-picks';
import { collectMapPins, type MapPin } from './map-static-url';
import { DORFFEST_TAGS, DORFFEST_TITLE_FILTER, DORFFESTE_DAYS } from '@/lib/landing/dorffeste';

// Reine Auswahl-Logik lebt in landing-picks.ts; die bisherigen Importpfade
// bleiben für Tests und Komponenten gültig.
export {
  arrangeBySharpness,
  hourlyShuffle,
  pickFestivals,
  pickSeasonEvents,
  SEASON_ROTATION_POOL,
  uniqueByTitleAndImage,
} from './landing-picks';
export type { LandingArtistLive, LandingPin, LandingPost, LandingTip, TipKind } from './landing-picks';
export type { MapPin } from './map-static-url';

const FESTIVAL_OVERRIDES = overridesJson as Record<string, { imageUrl?: string | null }>;

/**
 * Festival der Tagesausgabe:
 *   - `acts`: bis zu drei Namen in Headliner-Reihenfolge (festival_artists)
 *   - `image_url`: Bild des Elternevents, sonst kuratiertes Bild, sonst
 *     Override, sonst deterministischer Kategorie-Fallback
 *   - `href`: V2-URL des Elternevents, sonst /festivals/[slug]
 *   - `lineupMatch`: Platzhalter für eine spätere Personalisierung (false)
 */
export type LandingFestival = Festival & {
  lineupMatch: boolean;
  image_url: string | null;
  href: string | null;
  acts: string[];
};

/** Saison-Karte: gepinnte Events (editorial) zuerst, dann die Stundenrotation. */
export interface LandingSeason {
  seasonId: string;
  picks: Array<Event & { featured: boolean }>;
}

export type LandingActivity = Pick<
  PublicActivity,
  'id' | 'slug' | 'name' | 'tags' | 'town' | 'bundesland' | 'setting' | 'price_hint' | 'images'
>;

/** Daten der Tagesausgabe, eine ISR-Regenerierung = eine Ausgabe. */
export interface LandingData {
  /** Wiener Kalendertag der Ausgabe (YYYY-MM-DD). */
  today: string;
  /** Kommende veröffentlichte Events in Österreich (event_stats_cache.country_total). */
  countryTotal: number | null;
  tip: LandingTip | null;
  season: LandingSeason;
  /** Heute Abend: ab 17:00 Wien, nach Uhrzeit. */
  program: Event[];
  weekend: Event[];
  /** Fr bis So in Wiener Tagen, für den Link nach /entdecken?von=&bis=. */
  weekendRange: { from: string; to: string };
  /** Dorffeste der nächsten 30 Tage (Fest-Tags + Fest im Titel), in Terminfolge. */
  dorffeste: Event[];
  artistsLive: LandingArtistLive[];
  festivals: LandingFestival[];
  posts: LandingPost[];
  activities: LandingActivity[];
  mapPins: MapPin[];
}

/* Deterministischer Kategorie-Fallback für Festivals ohne Bild: eines von
   30 musik-N.jpg aus /public/images/categories/, stabil je Festival-ID. */
const FESTIVAL_FALLBACK_COUNT = 30;
function festivalCategoryFallback(festivalId: string): string {
  let h = 0;
  for (let i = 0; i < festivalId.length; i++) {
    h = (h * 31 + festivalId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(h) % FESTIVAL_FALLBACK_COUNT) + 1;
  return `/images/categories/musik-${idx}.jpg`;
}

const emptyLanding = (now: Date = new Date()): LandingData => {
  const today = viennaToday(now);
  return {
    today,
    countryTotal: null,
    tip: null,
    season: { seasonId: currentSeason(now).id, picks: [] },
    program: [],
    weekend: [],
    weekendRange: weekendWindow(today),
    dorffeste: [],
    artistsLive: [],
    festivals: [],
    posts: [],
    activities: [],
    mapPins: [],
  };
};

/** Läuft gerade `next build` (Prerender) statt einer Laufzeit-Revalidierung? */
const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Quellen, deren Ausfall die Seite nicht blockieren darf: Buchung (Tipp
 * fällt auf die redaktionelle Wahl zurück), Künstler-Kachel (entfällt) und
 * die Event-Zahl. Sie hängen an den fn-30-Migrationen (`landing_features.kind`,
 * `event_artists`, `country_total`); fehlen die in einer Umgebung, rendert die
 * Startseite trotzdem, statt dass ein Deploy ohne letzte gute Seite die
 * Fehlerseite zeigt (Befund 2026-10-30 im Dev-Server gegen die alte DB).
 * Alle anderen Abfragen werfen zur Laufzeit weiter, Next behält dann die
 * letzte gute Seite.
 */
const OPTIONAL_SOURCES = new Set(['featured', 'artists', 'artistPrimaries', 'stats']);

/**
 * Single entry point der Startseite. Abfragen parallel über einen
 * cookie-freien Anon-Key-Client (STATISCH-SICHER: createServerSupabaseClient
 * liest cookies() und würde die Route aus dem ISR-Cache kippen). Alle
 * Abfragen lesen nur veröffentlichte, öffentliche Daten; Personalisierung
 * lebt client-seitig in /api/me/landing.
 *
 * Fehlerbehandlung, zwei Fälle:
 *
 *  - Build (2026-08-26): ein Deploy darf nie an der Tagesform der DB
 *    scheitern. Gescheiterte Sektionen bleiben leer, der Rest wird gebaut.
 *  - Laufzeit (ISR-Revalidierung): NICHT still leer rendern, sondern
 *    werfen. Next behält dann die letzte gute Seite und versucht es beim
 *    nächsten Aufruf erneut. Vorher wurde eine leere Sektion für eine
 *    Stunde gecacht (Saison-Karte leer, 2026-09-25: statement timeout der
 *    Saison-Abfrage unter Build-Last).
 */
export async function getLandingData(now: Date = new Date()): Promise<LandingData> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      getLandingDataInner(now),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 15_000); }),
    ]);
    if (!result) {
      if (!isBuildPhase()) throw new Error('[landing] getLandingData timeout (15s)');
      console.error('[landing] getLandingData timeout (15s) im Build: leere Sektionen');
      return emptyLanding(now);
    }
    if (result.failed.length > 0) {
      const fatal = result.failed.filter(label => !OPTIONAL_SOURCES.has(label));
      if (fatal.length > 0 && !isBuildPhase()) {
        throw new Error(`[landing] Abfragen gescheitert: ${result.failed.join(', ')}`);
      }
      console.error(`[landing] Abfragen gescheitert, Sektionen leer: ${result.failed.join(', ')}`);
    }
    return result.data;
  } catch (err) {
    if (!isBuildPhase()) throw err;
    console.error('[landing] getLandingData failed im Build: leere Sektionen:', err);
    return emptyLanding(now);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type QueryResult<T = unknown> = { data: T | null; error: { message: string } | null };

/**
 * Eine Abfrage mit bis zu zwei Wiederholungen. Unter Last (Build rendert
 * hunderte Seiten parallel) scheitern Abfragen vereinzelt am
 * statement_timeout; ein zweiter Versuch geht fast immer durch.
 */
async function withRetry<T = unknown[]>(
  label: string,
  run: () => PromiseLike<QueryResult<T>>,
  failed: string[],
): Promise<QueryResult<T>> {
  let res: QueryResult<T> = { data: null, error: { message: 'nicht ausgeführt' } };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 400 * attempt));
    try {
      res = await run();
    } catch (err) {
      res = { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
    if (!res.error) return res;
    console.error(`[landing] ${label} Versuch ${attempt + 1}: ${res.error.message}`);
  }
  failed.push(label);
  return res;
}

const rows = <T,>(res: QueryResult<unknown>): T[] => (Array.isArray(res.data) ? (res.data as T[]) : []);

/** Pool-Größen (klein halten: Supabase Micro, Statement-Timeouts sind real). */
const TIP_POOL = 12;
const SEASON_POOL = 40;
const PROGRAM_POOL = 60;
const PINS_POOL = 60;
const WEEKEND_POOL = 40;
const DORFFESTE_POOL = 40;
const ARTISTS_POOL = 120;
const FESTIVALS_POOL = 48;
const ACTIVITIES_POOL = 40;

async function getLandingDataInner(now: Date): Promise<{ data: LandingData; failed: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // Alle Fenster in Wiener Kalendertagen: der Server läuft in UTC, ein
  // Event um 00:30 Wien gehört zum Wiener Tag, nicht zum UTC-Vortag.
  const nowIso = now.toISOString();
  const today = viennaToday(now);
  const todayRange = viennaDayRange(today);
  const programFrom = new Date(todayRange.start.getTime() + 17 * 3_600_000);
  const next7Start = viennaDayStart(addViennaDays(today, 7));
  const seasonEnd = viennaDayRange(addViennaDays(today, 13)).end;
  const weekendRange = weekendWindow(today);
  const weekendStart = weekendRange.from === today ? now : viennaDayStart(weekendRange.from);
  const weekendEnd = viennaDayRange(weekendRange.to).end;
  const dorffesteEnd = viennaDayRange(addViennaDays(today, DORFFESTE_DAYS - 1)).end;

  // Spalten, die die Karten brauchen. image_width MUSS mit: ohne sie greift
  // die MIN_TRUSTED_EVENT_IMAGE_WIDTH-Regel in EventImage nicht und 222px-
  // Teaser werden hochgezogen. EVENT_URL_COLUMNS MUSS mit: ohne postal_code
  // zeigten alle Karten auf 1010-wien bzw. 8010-graz. Die Ortsspalten
  // (latitude … location_resolution) steuern den Karten-Pin (gating.ts), die
  // Zeitspalten (is_all_day, duration_type) die Uhrzeit im Programm.
  const eventCols = `${EVENT_URL_COLUMNS},title,description,end_date,district,country,category,image_url,image_width,ticket_url,price_text,price_min,price_max,price_tier,price_flags,publish_status,event_score,tags,created_at,updated_at,source_id,source_name,source_url,latitude,longitude,geocoding_confidence,location_status,location_resolution,is_all_day,duration_type`;
  // Karten-Pins brauchen nur Ort und Gating; die URL-Spalten bleiben für den Wächter.
  const pinCols = `${EVENT_URL_COLUMNS},country,publish_status,latitude,longitude,geocoding_confidence,location_status,location_resolution`;
  const activityCols = 'id, slug, name, tags, town, bundesland, setting, price_hint, images';

  // Nur Events des Landes der Seite: nach Score standen sonst Eventim-
  // Konzerte aus Deutschland im Wochenend-Hero (2026-10).
  const publishedAt = () => supabase
    .from('events')
    .select(eventCols)
    .eq('publish_status', 'published')
    .eq('country', SITE_COUNTRY);
  const byScore = <Q extends { order: (c: string, o: { ascending: boolean }) => Q }>(q: Q) =>
    q.order('event_score', { ascending: false });

  // Scharfe Bilder zuerst (Befund 2026-09-24): die Top-30 nach Score waren
  // ausnahmslos 222px-Teaser. Deshalb je ein zweiter Pool nur mit
  // vermessenen Bildern >= MIN_TRUSTED_EVENT_IMAGE_WIDTH (arrangeBySharpness).
  const sharp = <Q extends { gte: (c: string, v: number) => Q }>(q: Q) => q.gte('image_width', MIN_TRUSTED_EVENT_IMAGE_WIDTH);

  const tipBase = () => publishedAt().gte('start_date', nowIso).lt('start_date', next7Start.toISOString());
  const weekendBase = () => publishedAt().gte('start_date', weekendStart.toISOString()).lte('start_date', weekendEnd.toISOString());
  // Dorffeste: Fest-Tags (GIN-Index idx_events_tags_published_gin) UND ein
  // Fest-Wort im Titel; die Tags allein streuen (dorffeste.ts).
  const dorffesteBase = () => publishedAt()
    .gte('start_date', nowIso)
    .lte('start_date', dorffesteEnd.toISOString())
    .overlaps('tags', [...DORFFEST_TAGS])
    .or(DORFFEST_TITLE_FILTER);

  const season = currentSeason(now);
  const failed: string[] = [];

  const [
    tipSharpRes, tipRes, featuredRes, seasonRes, programRes, pinsRes,
    weekendSharpRes, weekendRes, dorffesteSharpRes, dorffesteRes, artistsRes, festivalsRes, activitiesRes, statsRes,
  ] = await Promise.all([
    // Tipp-Fallback: bestgescortes Event mit scharfem Bild der nächsten 7 Tage.
    withRetry('tipSharp', () => byScore(sharp(tipBase())).limit(TIP_POOL), failed),
    withRetry('tip', () => byScore(tipBase()).limit(TIP_POOL), failed),
    // Pins (landing_features): sponsored → Tipp des Tages, editorial → Saison.
    // Fenster überlappt den Wiener Tag; die Feinauswahl (Tag gedeckt bzw.
    // jetzt aktiv) trifft landing-picks. events!inner: ein Pin aus einem
    // anderen Land, unveröffentlicht oder vorbei fällt serverseitig weg
    // (Enddatum: end_date, sonst start_date) und noch einmal in isPinnable.
    withRetry('featured', () => supabase
      .from('landing_features')
      .select(`created_at, kind, sponsor_name, starts_at, ends_at, event:events!inner(${eventCols})`)
      .eq('event.country', SITE_COUNTRY)
      .eq('event.publish_status', 'published')
      .or(`end_date.gte.${todayRange.start.toISOString()},and(end_date.is.null,start_date.gte.${todayRange.start.toISOString()})`, { referencedTable: 'event' })
      .lte('starts_at', todayRange.end.toISOString())
      .or(`ends_at.is.null,ends_at.gt.${todayRange.start.toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(8), failed),
    // Saison-Karte: 14 Tage voraus, Tag-Overlap mit der Saison.
    // EXPLAIN 2026-09-24: Bitmap über idx_events_start_date, ~130 ms.
    withRetry('season', () => byScore(publishedAt()
      .gte('start_date', nowIso)
      .lte('start_date', seasonEnd.toISOString())
      .overlaps('tags', season.tags))
      .limit(SEASON_POOL), failed),
    // Heute Abend: ab 17:00 Wien bis Tagesende, Pool nach Score.
    withRetry('program', () => byScore(publishedAt()
      .gte('start_date', programFrom.toISOString())
      .lte('start_date', todayRange.end.toISOString()))
      .limit(PROGRAM_POOL), failed),
    // Karten-Pins: der ganze Wiener Tag, nur Orts- und Gating-Spalten.
    withRetry('pins', () => supabase
      .from('events')
      .select(pinCols)
      .eq('publish_status', 'published')
      .eq('country', SITE_COUNTRY)
      .gte('start_date', todayRange.start.toISOString())
      .lte('start_date', todayRange.end.toISOString())
      .order('event_score', { ascending: false })
      .limit(PINS_POOL), failed),
    // Wochenende: Fr bis So (Wiener Tage), ab jetzt, wenn das Wochenende läuft.
    withRetry('weekendSharp', () => byScore(sharp(weekendBase())).limit(WEEKEND_POOL), failed),
    withRetry('weekend', () => byScore(weekendBase()).limit(WEEKEND_POOL), failed),
    // Dorffeste: 30 Tage voraus, scharfe Bilder zuerst wie beim Wochenende.
    withRetry('dorffesteSharp', () => byScore(sharp(dorffesteBase())).limit(DORFFESTE_POOL), failed),
    withRetry('dorffeste', () => byScore(dorffesteBase()).limit(DORFFESTE_POOL), failed),
    // Diese Woche live: Events der nächsten 7 Tage mit Feed-Künstlern
    // (event_artists!inner), Pool nach Score. Die Eventim-Zeile kann durch
    // den Dedup unterdrückt sein (duplicate_of): dann zählt der sichtbare
    // Primary, der unten nachgeladen wird.
    withRetry('artists', () => supabase
      .from('events')
      .select(`${eventCols},duplicate_of,artists:event_artists!inner(artist_id, artist_name, artist_image, evo_link)`)
      .eq('country', SITE_COUNTRY)
      .or('publish_status.eq.published,duplicate_of.not.is.null')
      .gte('start_date', nowIso)
      .lt('start_date', next7Start.toISOString())
      .order('event_score', { ascending: false })
      .limit(ARTISTS_POOL), failed),
    // Festivals: noch nicht vorbei, bestätigter Termin. Elternevent für Bild
    // und URL; der Länderfilter auf der (nicht inner) Einbettung setzt ein
    // ausländisches Elternevent auf null, pickFestivals prüft dann `state`.
    withRetry('festivals', () => supabase
      .from('festivals')
      .select('*, parent_event:events!parent_event_id(id, slug, start_date, postal_code, address, bundesland, location_name, image_url, country)')
      .eq('parent_event.country', SITE_COUNTRY)
      .gte('ends_at', today)
      .eq('date_status', 'confirmed')
      .order('starts_at', { ascending: true })
      .limit(FESTIVALS_POOL), failed),
    // Freizeit unter Dach: Pool aus der öffentlichen View (sichtbar, nicht
    // geschlossen), nur mit Bild; die Rotation wählt stündlich acht.
    withRetry('activities', () => supabase
      .from('poi_activities_public')
      .select(activityCols)
      .eq('setting', 'indoor')
      .not('images', 'is', null)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(ACTIVITIES_POOL), failed),
    // Event-Zahl: country_total aus der MV (Migration 20261029200200).
    withRetry<unknown>('stats', () => supabase.rpc('event_counts_for_stats'), failed),
  ]);

  // ── Bühne und Unterbau: Tipp → Saison → Programm → Wochenende ─────────
  type FeaturedRow = {
    created_at: string;
    kind: 'sponsored' | 'editorial' | null;
    sponsor_name: string | null;
    starts_at: string;
    ends_at: string | null;
    event: Event | Event[] | null;
  };
  const pins: LandingPin[] = rows<FeaturedRow>(featuredRes).flatMap(r => {
    const event = Array.isArray(r.event) ? r.event[0] : r.event;
    if (!event) return [];
    return [{
      event,
      kind: r.kind === 'sponsored' ? 'sponsored' : 'editorial',
      sponsorName: r.sponsor_name ?? null,
      startsAt: r.starts_at,
      endsAt: r.ends_at ?? null,
      createdAt: r.created_at ?? '',
    }];
  });

  const selection = pickLandingSelection({
    pins,
    tipPool: arrangeBySharpness(tipSharpRes.data, tipRes.data),
    // Saison-Wort im Titel zuerst, sonst Score-Reihenfolge (sort ist stabil)
    seasonPool: rows<Event>(seasonRes)
      .sort((a, b) => Number(titleMatchesSeason(b.title, season)) - Number(titleMatchesSeason(a.title, season))),
    programPool: rows<Event>(programRes),
    weekendPool: arrangeBySharpness(weekendSharpRes.data, weekendRes.data),
    dorffestePool: arrangeBySharpness(dorffesteSharpRes.data, dorffesteRes.data),
    today,
    now,
  });

  // ── Festivals mit Acts ───────────────────────────────────────────────
  type ParentEventRow = {
    id: string;
    slug: string | null;
    start_date: string | null;
    postal_code: string | null;
    address: string | null;
    bundesland: string | null;
    location_name: string | null;
    image_url: string | null;
    country: string | null;
  };
  type FestivalRow = Festival & { parent_event: ParentEventRow | ParentEventRow[] | null };
  const festivalRows = pickFestivals(rows<FestivalRow>(festivalsRes), today);

  // ── Nachlade-Phase: Acts der gewählten Festivals, Primaries der Künstler ──
  const artistRows = rows<Event & { duplicate_of?: string | null; artists?: ArtistEventRow['artists'] | null }>(artistsRes)
    .map((e): ArtistEventRow => ({ event: e, artists: e.artists ?? [] }));
  const primaryIds = unresolvedPrimaryIds(artistRows).slice(0, 200);
  const festivalIds = festivalRows.map(f => f.id);

  type ActRow = { festival_id: string; artist_name_raw: string; billing: string | null; day_label: string | null; stage_name: string | null };
  const [actsRes, primariesRes] = await Promise.all([
    festivalIds.length
      ? withRetry('festivalActs', () => supabase
          .from('festival_artists')
          .select('festival_id, artist_name_raw, billing, day_label, stage_name')
          .in('festival_id', festivalIds), failed)
      : Promise.resolve<QueryResult>({ data: [], error: null }),
    primaryIds.length
      ? withRetry('artistPrimaries', () => supabase
          .from('events')
          .select(eventCols)
          .in('id', primaryIds)
          .eq('publish_status', 'published')
          .eq('country', SITE_COUNTRY), failed)
      : Promise.resolve<QueryResult>({ data: [], error: null }),
  ]);

  const actsByFestival = new Map<string, ActRow[]>();
  for (const a of rows<ActRow>(actsRes)) {
    const list = actsByFestival.get(a.festival_id) ?? [];
    list.push(a);
    actsByFestival.set(a.festival_id, list);
  }

  const festivals: LandingFestival[] = festivalRows.map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;

    // Detail-URL: die V2-URL des Elternevents, sonst /festivals/[slug].
    const href = parentEvent && parentEvent.slug && parentEvent.start_date
      ? buildEventUrlV2({
          id: parentEvent.id,
          slug: parentEvent.slug,
          start_date: parentEvent.start_date,
          postal_code: parentEvent.postal_code,
          address: parentEvent.address,
          bundesland: parentEvent.bundesland,
          location_name: parentEvent.location_name,
        })
      : `/festivals/${f.slug}`;

    return {
      ...(rest as Festival),
      lineupMatch: false,
      image_url:
        parentEvent?.image_url
        ?? f.image_url
        ?? FESTIVAL_OVERRIDES[f.slug]?.imageUrl
        ?? festivalCategoryFallback(f.id),
      href,
      acts: festivalActs(actsByFestival.get(f.id) ?? []),
    };
  });

  const primaries = new Map(rows<Event>(primariesRes).map(e => [e.id, e]));
  const artistsLive = pickArtistsLive(artistRows, primaries, now);

  return {
    data: {
      today,
      countryTotal: readCountryTotal(statsRes.data),
      tip: selection.tip,
      season: { seasonId: season.id, picks: selection.season },
      program: selection.program,
      weekend: selection.weekend,
      weekendRange,
      dorffeste: selection.dorffeste,
      artistsLive,
      festivals,
      posts: pickPosts(ALL_POSTS, festivals, today),
      activities: pickActivities(rows<LandingActivity>(activitiesRes), now),
      mapPins: collectMapPins(rows<Event>(pinsRes)),
    },
    failed,
  };
}
