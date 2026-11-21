/**
 * Öffentliche Festival-Daten: Liste und Detail, wie /festivals und
 * /festivals/[slug] sie zeigen. Lader und Ableitungen stehen hier an einer
 * Stelle, damit die Seiten und die App-API (`src/lib/app-api/festivals.ts`)
 * dasselbe lesen und dasselbe anzeigen.
 *
 * Bis 2026-11 standen diese Funktionen privat in den beiden Seiten-Dateien;
 * sie sind unverändert hierher gezogen.
 */
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getFestivalEnrichment, type FestivalEnrichment } from '@/lib/festivals/enrich';
import { SITE_COUNTRY } from '@/lib/site-country';
import { DE_LOCALE } from '@/lib/site/intl';
import { EVENT_TZ, toViennaDate, viennaFields } from '@/lib/utils/event-time';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { Festival, FestivalArtist } from '@/types/festivals';
import overridesJson from '../../../data/festival-overrides.json';

const OVERRIDES = overridesJson as Record<string, { imageUrl?: string | null }>;

/* Deterministischer Kategorie-Fallback für Festivals ohne Bild: eines von
   30 musik-N.jpg aus /public/images/categories/, stabil je Festival-ID. */
const FESTIVAL_FALLBACK_COUNT = 30;
export function festivalCategoryFallback(festivalId: string): string {
  let h = 0;
  for (let i = 0; i < festivalId.length; i++) {
    h = (h * 31 + festivalId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(h) % FESTIVAL_FALLBACK_COUNT) + 1;
  return `/images/categories/musik-${idx}.jpg`;
}

/** Zeitraum auf der Karte: „12.–14. Juni", „30. Juni – 2. Juli", ein Tag allein. */
export function festivalCardDateRange(startIso: string | null, endIso?: string | null): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString(DE_LOCALE, { day: 'numeric', month: 'short', timeZone: EVENT_TZ });
  const s = viennaFields(start);
  const e = end ? viennaFields(end) : null;
  if (!end || !e || (e.year === s.year && e.month === s.month && e.day === s.day)) return startStr;
  const sameMonth = s.month === e.month;
  const startDay = s.day;
  const endDay = e.day;
  if (sameMonth) {
    const month = start.toLocaleDateString(DE_LOCALE, { month: 'short', timeZone: EVENT_TZ });
    return `${startDay}.–${endDay}. ${month}`;
  }
  const endStr = end.toLocaleDateString(DE_LOCALE, { day: 'numeric', month: 'short', timeZone: EVENT_TZ });
  return `${startStr} – ${endStr}`;
}

/** Zeitraum auf der Detailseite: „12. Juni – 14. Juni 2027", ohne Beginn „Termin offen". */
export function formatFestivalDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return 'Termin offen';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString(DE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  if (!end || toViennaDate(end) === toViennaDate(start)) return startStr;
  const sameYear = toViennaDate(start).slice(0, 4) === toViennaDate(end).slice(0, 4);
  const startShort = start.toLocaleDateString(DE_LOCALE, sameYear
    ? { day: 'numeric', month: 'long', timeZone: EVENT_TZ }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  const endStr = end.toLocaleDateString(DE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  return `${startShort} – ${endStr}`;
}

const GENRE_LABELS: Record<string, string> = {
  K: 'Klassik',
  J: 'Jazz',
  P: 'Pop/Rock',
  E: 'Elektronik',
  H: 'Hip-Hop',
  G: 'Global',
  N: 'Neue Musik',
  I: 'Interdisziplinär',
};
export function expandGenres(raw: string | null): string {
  if (!raw) return '';
  return raw
    .split(/[,/]/)
    .map(g => g.trim())
    .filter(Boolean)
    .map(g => GENRE_LABELS[g.toUpperCase()] ?? g)
    .join(' · ');
}

export type ParentEventRow = {
  id: string;
  slug: string | null;
  start_date: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  location_name: string | null;
  image_url: string | null;
};

/** Adresse der Event-Seite des Haupt-Events; null ohne Slug oder Termin. */
export function parentEventHref(parentEvent: ParentEventRow | null): string | null {
  return parentEvent && parentEvent.slug && parentEvent.start_date
    ? buildEventUrlV2({
        id: parentEvent.id,
        slug: parentEvent.slug,
        start_date: parentEvent.start_date,
        postal_code: parentEvent.postal_code,
        address: parentEvent.address,
        bundesland: parentEvent.bundesland,
        location_name: parentEvent.location_name,
      })
    : null;
}

/** Festival der Liste: Bild steht fest (Haupt-Event, Festival, Override, Kategorie), `href` ist das Ziel der Karte. */
export type UpcomingFestival = Festival & { image_url: string; href: string };

type FestivalListRow = Festival & { parent_event: ParentEventRow | ParentEventRow[] | null };

/**
 * Kommende Festivals (Ende nicht vor heute), nach Beginn. Das Haupt-Event
 * liefert Bild und Ziel der Karte; ein ausländisches Haupt-Event kommt als
 * null (Nicht-inner-Einbettung), das Festival bleibt in der Liste.
 */
export async function loadUpcomingFestivals(): Promise<UpcomingFestival[]> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('festivals')
    .select('*, parent_event:events!parent_event_id(id, slug, start_date, postal_code, address, bundesland, location_name, image_url)')
    .gte('ends_at', today)
    // Nicht-inner-Einbettung: ein ausländisches Haupt-Event kommt als null.
    .eq('parent_event.country', SITE_COUNTRY)
    .order('starts_at', { ascending: true });

  return ((data ?? []) as unknown as FestivalListRow[]).map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;
    const href = parentEventHref(parentEvent ?? null) ?? `/festivals/${f.slug}`;
    const override = OVERRIDES[f.slug];
    return {
      ...(rest as Festival),
      image_url:
        parentEvent?.image_url
        ?? f.image_url
        ?? (override?.imageUrl ?? null)
        ?? festivalCategoryFallback(f.id),
      href,
    };
  });
}

const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue',
};
function asciiFoldSlug(slug: string): string {
  return slug.replace(/[äöüßÄÖÜ]/g, c => UMLAUT_MAP[c] ?? c);
}

/**
 * Slug lookup that tolerates Unicode-normalization drift. We try NFC
 * first (matches what the seed registry stores), then NFD, then a
 * pure-ASCII fold (`mörbisch` → `moerbisch`) for legacy rows. The first
 * non-null result wins.
 *
 * Returns the matched festival row or null. NEVER throws — Supabase
 * errors are logged and treated as null so the page can render the 404
 * shell cleanly instead of crashing into the global error boundary.
 */
export async function fetchFestivalRow(slug: string): Promise<Festival | null> {
  const supabase = await createServerSupabaseClient();
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* invalid escape sequence in slug — keep original */
  }
  const variants = Array.from(new Set([
    decoded,
    slug,
    decoded.normalize('NFC'),
    decoded.normalize('NFD'),
    asciiFoldSlug(decoded.normalize('NFC')),
  ]));

  for (const candidate of variants) {
    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('slug', candidate)
        .maybeSingle();
      if (!error && data) return data as unknown as Festival;
    } catch (err) {
      console.error('[festival-detail] lookup threw for', candidate, err);
    }
  }
  // ilike fallback for stored rows with weird whitespace or dash variants
  try {
    const { data } = await supabase
      .from('festivals')
      .select('*')
      .ilike('slug', decoded)
      .limit(1);
    if (data && data.length > 0) return data[0] as unknown as Festival;
  } catch (err) {
    console.error('[festival-detail] ilike fallback threw:', decoded, err);
  }
  return null;
}

export async function fetchParentEvent(parentEventId: string | null): Promise<ParentEventRow | null> {
  if (!parentEventId) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('events')
      .select('id, slug, start_date, postal_code, address, bundesland, location_name, image_url')
      .eq('id', parentEventId)
      .eq('country', SITE_COUNTRY)
      .maybeSingle();
    return (data ?? null) as ParentEventRow | null;
  } catch (err) {
    console.error('[festival-detail] parent event lookup threw:', parentEventId, err);
    return null;
  }
}

export async function fetchFestivalArtists(festivalId: string): Promise<FestivalArtist[]> {
  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('festival_artists') as any)
      .select('*')
      .eq('festival_id', festivalId);
    return (data ?? []) as FestivalArtist[];
  } catch (err) {
    console.error('[festival-detail] artists lookup threw:', festivalId, err);
    return [];
  }
}

/** Ticket-Anbieter aus dem Link für das Klick-Tracking (data-track-provider). */
export function ticketProviderOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/oeticket|eventim/.test(host)) return 'eventim';
    if (/ticketmaster/.test(host)) return 'ticketmaster';
    if (/ntry\.at/.test(host)) return 'ntry';
    return host;
  } catch {
    return 'unknown';
  }
}

export const BILLING_ORDER: Record<string, number> = {
  headliner: 0,
  sub_headliner: 1,
  support: 2,
  opener: 3,
  unknown: 4,
};

export const BILLING_LABEL: Record<string, string> = {
  headliner: 'Headliner',
  sub_headliner: 'Sub-Headliner',
  support: 'Support',
  opener: 'Opener',
  unknown: 'Line-up',
};

export interface FestivalDetailData {
  festival: Festival;
  parentEvent: ParentEventRow | null;
  artists: FestivalArtist[];
  enrichment: FestivalEnrichment;
}

/**
 * Alles zu einem Festival: Zeile, Haupt-Event, Line-up und die Anreicherung
 * von der Festival-Website. Kein Lader wirft; null heißt „gibt es nicht".
 *
 * Kuratierte Spalten (data/festivals-upcoming.json, 2026-10) gehen vor:
 * trägt die Zeile Beschreibung, Bild und Preis, entfällt der Website-
 * Abruf komplett (bis zu ~7 s Latenz bei trägen Festival-Seiten).
 */
export async function loadFestivalDetail(slug: string): Promise<FestivalDetailData | null> {
  const festival = await fetchFestivalRow(slug);
  if (!festival) return null;
  const curatedComplete = !!festival.description && !!festival.image_url && !!festival.price_text;
  const [parentEvent, artists, enrichment] = await Promise.all([
    fetchParentEvent(festival.parent_event_id),
    fetchFestivalArtists(festival.id),
    curatedComplete
      ? getFestivalEnrichment(null, festival.slug)
      : getFestivalEnrichment(festival.website_url, festival.slug),
  ]);
  return { festival, parentEvent, artists, enrichment };
}

export interface FestivalView {
  heroImage: string;
  dateRange: string;
  place: string;
  genreLabel: string;
  description: string | null;
  priceText: string | null;
  /** Namen von der Festival-Website, nur wenn die Datenbank kein Line-up hat. */
  enrichmentArtists: string[];
  parentEventHref: string | null;
  mapsUrl: string | null;
  /** Line-up der Datenbank nach Rolle. */
  grouped: Map<string, FestivalArtist[]>;
  /** Rollen in Anzeige-Reihenfolge (Headliner zuerst). */
  billingKeys: string[];
}

/** Was die Detailseite aus den geladenen Daten anzeigt. */
export function deriveFestivalView({ festival, parentEvent, artists, enrichment }: FestivalDetailData): FestivalView {
  const heroImage =
    parentEvent?.image_url
    ?? festival.image_url
    ?? enrichment.imageUrl
    ?? festivalCategoryFallback(festival.id);
  const dateRange = (festival.date_status === 'expected' ? 'voraussichtlich ' : '')
    + formatFestivalDateRange(festival.starts_at, festival.ends_at);
  const place = [festival.city, festival.state].filter(Boolean).join(' · ');
  const genreLabel = expandGenres(festival.genres);

  const description = festival.description ?? enrichment.description;
  const priceText = festival.price_text ?? enrichment.priceText;
  const enrichmentArtists = artists.length === 0 ? enrichment.artists : [];

  // Google Maps directions URL. Prefer parent event's address; fall back
  // to festival city + state so the Route button still has a target on
  // festivals without a linked event.
  const mapsDest = parentEvent?.address
    ? [parentEvent.address, parentEvent.location_name, parentEvent.bundesland].filter(Boolean).join(', ')
    : [festival.city, festival.state].filter(Boolean).join(', ');
  const mapsUrl = mapsDest
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDest)}`
    : null;

  // Group DB artists by billing for visual hierarchy.
  const grouped = new Map<string, FestivalArtist[]>();
  for (const a of artists) {
    const key = (a.billing as string) ?? 'unknown';
    const arr = grouped.get(key) ?? [];
    arr.push(a);
    grouped.set(key, arr);
  }
  const billingKeys = Array.from(grouped.keys()).sort(
    (a, b) => (BILLING_ORDER[a] ?? 99) - (BILLING_ORDER[b] ?? 99),
  );

  return {
    heroImage,
    dateRange,
    place,
    genreLabel,
    description,
    priceText,
    enrichmentArtists,
    parentEventHref: parentEventHref(parentEvent),
    mapsUrl,
    grouped,
    billingKeys,
  };
}
