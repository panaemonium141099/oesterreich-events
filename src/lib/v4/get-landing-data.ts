import type { Event } from '@/types/events';
import type { Festival } from '@/types/festivals';
import { deriveEventState, type V4EventState, type DeriveCtx } from './derive-event-state';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { createClient } from '@supabase/supabase-js';
import overridesJson from '../../../data/festival-overrides.json';

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

export interface LandingData {
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

/** Landing-Auswahl aus dem Festival-Pool (Befund 2026-08-26):
 *
 *  1. Jahres-Serien raus: Zeilen mit > 45 Tagen Laufzeit, die bereits
 *     laufen, sind Serien-Artefakte der Series-Detection ("On the Couch",
 *     Jän–Dez), keine Festivals. Kommende Festivals zählen unabhängig
 *     von der Dauer.
 *  2. Tagesrotation: deterministischer Shuffle mit Datums-Seed — die
 *     ISR-Shell (revalidate 3600) zeigt damit jeden Tag eine andere
 *     Viererauswahl, ohne die statische Cachebarkeit zu verlieren.
 *     Festivals mit gefetchtem Lineup zuerst (die Sektion heißt
 *     "Festivals mit Line-up"), Anzeige chronologisch sortiert.
 */
function pickFestivals<T extends { id: string; starts_at: string | null; ends_at: string | null; lineup_status?: string }>(
  pool: T[],
  count: number,
): T[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const sane = pool.filter(f => {
    if (!f.starts_at) return false;
    if (f.starts_at >= todayStr) return true; // kommend → immer ok
    const days = (Date.parse(f.ends_at ?? f.starts_at) - Date.parse(f.starts_at)) / 86_400_000;
    return days <= 45; // läuft gerade → nur echte Festival-Dauern
  });

  // Mulberry32-Shuffle, Seed = Kalendertag → stabil pro Tag, rotiert täglich
  const daySeed = Number(todayStr.replace(/-/g, ''));
  let a = daySeed >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...sane];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
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
const EMPTY_LANDING: LandingData = {
  todayWeekend: [],
  concerts: [],
  festivals: [],
  // Statische Fallback-Liste — der Artist-Teaser braucht keine DB.
  popularArtists: FALLBACK_ARTISTS,
};

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
    return EMPTY_LANDING;
  } catch (err) {
    console.error('[landing] getLandingData failed — leere Sektionen:', err);
    return EMPTY_LANDING;
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

  // Base column list — kept tight to what the cards consume.
  const eventCols = 'id,slug,title,description,start_date,end_date,location_name,bundesland,district,category,image_url,ticket_url,price_text,price_min,price_max,price_tier,price_flags,publish_status,event_score,tags,created_at,updated_at,source_id,source_name,source_url';

  // WeekendSection rendert 1 Hero + 2× 3 Cards = 7 Slots. Wir ziehen
  // ~4× soviel als Reserve, dann dedupliziert die uniqueByTitleAndImage-
  // Pass die Recurring-Events (Tandemspringen Fromberg, Heuriger an N
  // Tagen, etc.) raus bevor wir auf 7 schneiden — sonst beanspruchen
  // identische Fotos mehrere Slots im Hero-Grid.
  const TODAYWEEKEND_LIMIT = 7;
  const TODAYWEEKEND_POOL = 30;

  const [weekendRes, concertsRes, festivalsRes] = await Promise.all([
    // todayWeekend: top events in next 7 days
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', weekendEnd)
      .eq('publish_status', 'published')
      .order('event_score', { ascending: false })
      .limit(TODAYWEEKEND_POOL),
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
      .gte('ends_at', today.split('T')[0])
      .order('starts_at', { ascending: true })
      .limit(48),
  ]);

  const todayWeekend = uniqueByTitleAndImage(
    enrichEvents((weekendRes.data ?? []) as unknown as Event[]),
  ).slice(0, TODAYWEEKEND_LIMIT);
  const concerts = enrichEvents((concertsRes.data ?? []) as unknown as Event[]);

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

  return {
    todayWeekend,
    concerts,
    festivals,
    popularArtists: FALLBACK_ARTISTS,
  };
}
