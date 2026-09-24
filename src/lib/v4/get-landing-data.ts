import type { Event } from '@/types/events';
import type { Festival } from '@/types/festivals';
import { deriveEventState, type V4EventState, type DeriveCtx } from './derive-event-state';
import { buildEventUrlV2, EVENT_URL_COLUMNS } from '@/lib/utils/slugify';
import { createClient } from '@supabase/supabase-js';
import { MIN_TRUSTED_EVENT_IMAGE_WIDTH } from '@/lib/event-images/resolveEventImage';
import overridesJson from '../../../data/festival-overrides.json';
import { currentSeason, titleMatchesSeason } from '@/lib/landing/seasons';

const FESTIVAL_OVERRIDES = overridesJson as Record<string, { imageUrl?: string | null }>;

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
 *   - `href`: pre-built canonical V2 URL der parent-event row. NULL wenn
 *     das Festival kein parent_event hat (kein Detail-Page → Card darf
 *     nicht klickbar sein, sonst 404). Wir bauen das hier zentral statt
 *     im Card weil nur hier die Parent-Event-Felder verfügbar sind.
 */
export type LandingFestival = Festival & {
  lineupMatch: boolean;
  image_url: string | null;
  href: string | null;
};

/**
 * Saison-Karte im Hero: erst die im Admin gepinnten Events
 * (landing_features), dann die stündlich rotierende Saison-Auswahl.
 */
export interface LandingSeason {
  seasonId: string;
  moreQuery: string;
  picks: Array<Event & { featured: boolean }>;
}

export interface LandingData {
  season: LandingSeason;
  todayWeekend: Array<Event & { state: V4EventState }>;
  concerts: Array<Event & { state: V4EventState }>;
  festivals: LandingFestival[];
  popularArtists: LandingArtist[];
}

/**
 * Anonymer Ableitungs-Kontext für die statische Landing (§10.2): keine
 * Personalisierung im Server-Render. Karten zeigen die event-basierten
 * States (ticket/free/doorsale); die personalisierten States
 * (inplan/match/lineup) kommen client-seitig via /api/me/landing.
 */
const ANON_CTX: DeriveCtx = {
  savedEventIds: new Set(),
  followedArtistIds: new Set(),
  artistMatchEventIds: new Set(),
  lineupMatchEventIds: new Set(),
};

const FALLBACK_ARTISTS: LandingArtist[] = [
  { name: 'Bilderbuch', genre: 'Indie · Austropop' },
  { name: 'Wanda', genre: 'Wienerlied-Rock' },
  { name: 'Pizzera & Jaus', genre: 'Comedy-Pop' },
];

function enrichEvents(rows: Event[]): Array<Event & { state: V4EventState }> {
  return rows.map(e => ({ ...e, state: deriveEventState(e, ANON_CTX) }));
}

/**
 * Collapse landing-section rows that share the SAME title AND image_url.
 * Use case: recurring events (Tandemspringen Fromberg jeden Tag, Heuriger
 * an mehreren Tagen) sonst beanspruchen 2-3 Slots im Hero-Grid und
 * langweilen visuell. Wir behalten den höchstgescorten (= ersten, da die
 * Query nach event_score desc sortiert) und kicken die Wiederholungen.
 *
 * Dedupe ist konservativ: NUR wenn Titel UND Bild übereinstimmen. Wenn
 * derselbe Titel mit unterschiedlichen Fotos auftaucht, bleibt beides
 * drin (zwei verschiedene Ausgaben eines Festivals z.B.).
 */
function uniqueByTitleAndImage<T extends { title: string | null; image_url?: string | null }>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (!titleKey) {
      // Kein Titel → kein verlässlicher Dedupe-Key. Drin lassen.
      out.push(e);
      continue;
    }
    const imageKey = (e.image_url ?? '').trim();
    const key = `${titleKey}::${imageKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const isSharp = (e: Event) => (e.image_width ?? 0) >= MIN_TRUSTED_EVENT_IMAGE_WIDTH;

/**
 * Führt den Pool scharfer Bilder mit dem Score-Pool zusammen: vorne steht
 * das bestgescorte Event mit scharfem Bild (Hero-Slot), danach alle nach
 * Score, bei Gleichstand scharfe zuerst. Kleine Teaser bleiben also drin,
 * wenn sie relevanter sind, und zeigen über image_width den großen
 * Kategorie-Fallback statt eines hochskalierten 222px-Bildes.
 */
export function arrangeBySharpness(sharp: unknown[] | null, rest: unknown[] | null): Event[] {
  const sharpRows = (sharp ?? []) as Event[];
  const ids = new Set(sharpRows.map(e => e.id));
  const merged = [...sharpRows, ...((rest ?? []) as Event[]).filter(e => !ids.has(e.id))];
  const hero = merged.find(isSharp) ?? merged[0];
  if (!hero) return [];
  const others = merged
    .filter(e => e !== hero)
    .sort((a, b) => (b.event_score ?? 0) - (a.event_score ?? 0) || Number(isSharp(b)) - Number(isSharp(a)));
  return [hero, ...others];
}

/** Landing-Auswahl aus dem Festival-Pool:
 *
 *  1. Nur kommende Festivals (starts_at >= heute). Bereits laufende
 *     fliegen raus (User-Vorgabe 2026-09-24) und damit auch die
 *     Jahres-Serien-Artefakte der Series-Detection ("On the Couch",
 *     Jän–Dez), die früher per 45-Tage-Regel gefiltert wurden.
 *  2. Stundenrotation: deterministischer Shuffle mit Stunden-Seed. Die
 *     ISR-Shell (revalidate 3600) zeigt damit bei jedem Revalidate eine
 *     andere Viererauswahl, ohne die statische Cachebarkeit zu verlieren.
 *     Die frühere Tagesrotation wirkte bei ~10 Kandidaten wie Stillstand.
 *     Festivals mit gefetchtem Lineup zuerst (die Sektion heißt
 *     "Festivals mit Line-up"), Anzeige chronologisch sortiert.
 */
/** Mulberry32-Shuffle, Seed = Kalenderstunde → stabil pro ISR-Fenster. */
function hourlyShuffle<T>(items: T[], now: Date): T[] {
  const hourSeed = Math.floor(now.getTime() / 3_600_000);
  let a = hourSeed >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Größe des Pools, aus dem die Saison-Rotation stündlich zieht. */
export const SEASON_ROTATION_POOL = 12;

/**
 * Auswahl der Saison-Karte:
 *
 *  1. Gepinnte Events (Admin, bezahlt oder eigene Saison-Wahl) zuerst,
 *     in der Reihenfolge, in der sie kommen (neueste Pins vorne).
 *  2. Den Rest füllt die Rotation: die Top-Events der Saison nach Score,
 *     ohne Titel-Wiederholungen (Heuriger an zehn Tagen) und ohne Events,
 *     die schon in der Wochenend-Sektion darunter stehen. Aus den besten
 *     SEASON_ROTATION_POOL wird stündlich neu gemischt.
 */
export function pickSeasonEvents(
  featured: Event[],
  pool: Event[],
  excludeIds: Set<string>,
  count: number,
  now: Date = new Date(),
): Array<Event & { featured: boolean }> {
  const out: Array<Event & { featured: boolean }> = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const take = (e: Event, isFeatured: boolean) => {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (seenIds.has(e.id) || (titleKey && seenTitles.has(titleKey))) return;
    seenIds.add(e.id);
    if (titleKey) seenTitles.add(titleKey);
    out.push({ ...e, featured: isFeatured });
  };

  for (const e of featured) {
    if (out.length >= count) break;
    take(e, true);
  }

  const candidates: Event[] = [];
  const poolTitles = new Set(seenTitles);
  for (const e of pool) {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (excludeIds.has(e.id) || seenIds.has(e.id) || (titleKey && poolTitles.has(titleKey))) continue;
    if (titleKey) poolTitles.add(titleKey);
    candidates.push(e);
    if (candidates.length >= SEASON_ROTATION_POOL) break;
  }
  for (const e of hourlyShuffle(candidates, now)) {
    if (out.length >= count) break;
    take(e, false);
  }
  return out;
}

export function pickFestivals<T extends { id: string; starts_at: string | null; ends_at: string | null; lineup_status?: string }>(
  pool: T[],
  count: number,
  now: Date = new Date(),
): T[] {
  const todayStr = now.toISOString().split('T')[0];
  const upcoming = pool.filter(f => f.starts_at != null && f.starts_at >= todayStr);

  const shuffled = hourlyShuffle(upcoming, now);
  const withLineup = shuffled.filter(f => f.lineup_status === 'fetched');
  const rest = shuffled.filter(f => f.lineup_status !== 'fetched');
  return [...withLineup, ...rest]
    .slice(0, count)
    .sort((x, y) => (x.starts_at ?? '').localeCompare(y.starts_at ?? ''));
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
 * then enriches with per-event state via deriveEventState (anonym — §10.2).
 *
 * STATISCH-SICHER: nutzt bewusst einen cookie-freien Anon-Key-Client statt
 * createServerSupabaseClient (das cookies() liest und die Route aus dem
 * ISR-Cache kippen würde). Alle Queries lesen nur published/öffentliche
 * Daten — RLS mit Anon-Key deckt das ab. Personalisierung (Matches,
 * inplan-Badges) lebt seit dem Umbau client-seitig via /api/me/landing.
 *
 * Festival `lineupMatch` is set to false in Phase 2 — computing per-festival
 * lineup matches requires another join we're not optimizing for here.
 */
const emptyLanding = (): LandingData => ({
  season: { seasonId: currentSeason().id, moreQuery: currentSeason().moreQuery, picks: [] },
  todayWeekend: [],
  concerts: [],
  festivals: [],
  // Statische Fallback-Liste — der Artist-Teaser braucht keine DB.
  popularArtists: FALLBACK_ARTISTS,
});

/** Build-Resilienz-Wrapper (2026-08-26): haengt/failt Supabase, rendert
 *  die Landing mit leeren Sektionen statt den Build/Render zu killen —
 *  das naechste ISR-Revalidate (3600 s) fuellt sie, sobald die DB wieder
 *  antwortet. Ein Deploy darf nie von der Tagesform der Micro-Instanz
 *  abhaengen (Befund: alle Vercel-Builds ab 19:05 UTC am
 *  Landing-/Widget-Prerender gescheitert). */
export async function getLandingData(): Promise<LandingData> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      getLandingDataInner(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 15_000); }),
    ]);
    if (result) return result;
    console.error('[landing] getLandingData timeout (15s) — leere Sektionen');
    return emptyLanding();
  } catch (err) {
    console.error('[landing] getLandingData failed — leere Sektionen:', err);
    return emptyLanding();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getLandingDataInner(): Promise<LandingData> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const today = new Date().toISOString();
  const weekendEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // Base column list — kept tight to what the cards consume. image_width
  // MUSS mit: ohne sie greift die MIN_TRUSTED_EVENT_IMAGE_WIDTH-Regel in
  // EventImage nicht und 222px-Teaser werden auf 1180px hochgezogen.
  // EVENT_URL_COLUMNS MUSS mit: ohne postal_code zeigten alle Karten auf
  // 1010-wien bzw. 8010-graz und liefen über eine Weiterleitung.
  const eventCols = `${EVENT_URL_COLUMNS},title,description,end_date,district,category,image_url,image_width,ticket_url,price_text,price_min,price_max,price_tier,price_flags,publish_status,event_score,tags,created_at,updated_at,source_id,source_name,source_url`;

  // WeekendSection rendert 1 Hero + 2× 3 Cards = 7 Slots. Wir ziehen
  // ~4× soviel als Reserve, dann dedupliziert die uniqueByTitleAndImage-
  // Pass die Recurring-Events (Tandemspringen Fromberg, Heuriger an N
  // Tagen, etc.) raus bevor wir auf 7 schneiden — sonst beanspruchen
  // identische Fotos mehrere Slots im Hero-Grid.
  const TODAYWEEKEND_LIMIT = 7;
  const TODAYWEEKEND_POOL = 30;

  // Scharfe Bilder zuerst (Befund 2026-09-24): die Top-30 nach Score waren
  // ausnahmslos Eventim-/eventfinder-Teaser mit 222px, die Landing zeigte
  // sieben verpixelte Karten. Deshalb ein zweiter Pool nur mit vermessenen
  // Bildern >= MIN_TRUSTED_EVENT_IMAGE_WIDTH, der den Hero-Slot und
  // Gleichstände gewinnt (arrangeBySharpness).
  const weekendBase = () => supabase
    .from('events')
    .select(eventCols)
    .gte('start_date', today)
    .lte('start_date', weekendEnd)
    .eq('publish_status', 'published');
  const concertsBase = () => weekendBase().or('category.eq.music,category.eq.konzerte');

  // Saison-Karte (Hero): 14 Tage voraus, Tag-Overlap mit der Saison.
  // EXPLAIN 2026-09-24: Bitmap über idx_events_start_date, ~130 ms.
  const season = currentSeason();
  const seasonEnd = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  const [weekendSharpRes, weekendRes, concertsSharpRes, concertsRes, festivalsRes, featuredRes, seasonRes] = await Promise.all([
    // todayWeekend: top events in next 7 days
    weekendBase()
      .gte('image_width', MIN_TRUSTED_EVENT_IMAGE_WIDTH)
      .order('event_score', { ascending: false })
      .limit(TODAYWEEKEND_POOL),
    weekendBase()
      .order('event_score', { ascending: false })
      .limit(TODAYWEEKEND_POOL),
    // concerts: music in next 7 days
    concertsBase()
      .gte('image_width', MIN_TRUSTED_EVENT_IMAGE_WIDTH)
      .order('event_score', { ascending: false })
      .limit(3),
    concertsBase()
      .order('event_score', { ascending: false })
      .limit(3),
    // festivals: upcoming. JOIN parent event to grab its image_url AND
    // all url-building fields. Ohne parent_event hat das Festival keine
    // Detail-Page in /events/ → wir signalisieren via href=null an die
    // Card dass sie nicht klickbar sein darf (sonst landet der User auf
    // einem 404 wie /events/8010-graz/2026-02-09/murszene-graz).
    //
    // Bewusst POOL statt Top-4 (Befund 2026-08-26): sortiert nach
    // starts_at ASC gewannen immer dieselben vier Jahres-Serien
    // (Start Jänner, Ende Dezember — "On the Couch", "Murszene" …) die
    // Slots; echte kommende Festivals kamen nie dran. Die Auswahl
    // (Serien-Filter + Tagesrotation) passiert unten in pickFestivals().
    supabase
      .from('festivals')
      .select('*, parent_event:events!parent_event_id(id, slug, start_date, postal_code, address, bundesland, location_name, image_url)')
      .gte('starts_at', today.split('T')[0])
      .order('starts_at', { ascending: true })
      .limit(48),
    // Admin-Pins (landing_features), nur aktive Fenster.
    supabase
      .from('landing_features')
      .select(`created_at, event:events!inner(${eventCols})`)
      .lte('starts_at', today)
      .or(`ends_at.is.null,ends_at.gt.${today}`)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', seasonEnd)
      .eq('publish_status', 'published')
      .overlaps('tags', season.tags)
      .order('event_score', { ascending: false })
      .limit(40),
  ]);

  const todayWeekend = uniqueByTitleAndImage(
    enrichEvents(arrangeBySharpness(weekendSharpRes.data, weekendRes.data)),
  ).slice(0, TODAYWEEKEND_LIMIT);
  const concerts = enrichEvents(arrangeBySharpness(concertsSharpRes.data, concertsRes.data)).slice(0, 3);

  type ParentEventRow = {
    id: string;
    slug: string | null;
    start_date: string | null;
    postal_code: string | null;
    address: string | null;
    bundesland: string | null;
    location_name: string | null;
    image_url: string | null;
  };
  type FestivalRow = Festival & {
    parent_event: ParentEventRow | ParentEventRow[] | null;
  };
  const festivals: LandingFestival[] = pickFestivals(
    (festivalsRes.data ?? []) as unknown as FestivalRow[],
    4,
  ).map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;

    // Detail-URL: bevorzugt die canonical V2-URL des parent_event (führt
    // direkt zur reichhaltigen /events/[...slug]-Page); fällt zurück auf
    // /festivals/[slug] wenn das Festival keinen parent_event hat. So
    // landet niemand mehr auf einer non-clickable Card.
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
      lineupMatch: false, // Phase 2 best-effort — see fn-docstring above
      image_url:
        parentEvent?.image_url
        ?? FESTIVAL_OVERRIDES[f.slug]?.imageUrl
        ?? festivalCategoryFallback(f.id),
      href,
    };
  });

  type FeaturedRow = { event: Event | Event[] | null };
  const featuredEvents = ((featuredRes.data ?? []) as unknown as FeaturedRow[])
    .map(r => (Array.isArray(r.event) ? r.event[0] : r.event))
    .filter((e): e is Event => !!e && e.publish_status === 'published' && (e.end_date ?? e.start_date) >= today);
  const seasonPicks = pickSeasonEvents(
    featuredEvents,
    // Saison-Wort im Titel zuerst, sonst Score-Reihenfolge (sort ist stabil)
    ((seasonRes.data ?? []) as unknown as Event[])
      .sort((a, b) => Number(titleMatchesSeason(b.title, season)) - Number(titleMatchesSeason(a.title, season))),
    new Set(todayWeekend.map(e => e.id)),
    4,
  );

  return {
    season: { seasonId: season.id, moreQuery: season.moreQuery, picks: seasonPicks },
    todayWeekend,
    concerts,
    festivals,
    popularArtists: FALLBACK_ARTISTS,
  };
}
