/**
 * Festivals: Anzeige-Ableitungen ohne Datenbankzugriff (Bildwahl, Zeitraum,
 * Genre, Line-up nach Rolle, Route). Von den Festival-Seiten, der Karte
 * (auch in Client-Bündeln, deshalb keine Server-Importe) und der App-API
 * (`src/lib/app-api/festivals.ts`) genutzt. Die Lader stehen in `public.ts`.
 *
 * Bis 2026-11 standen diese Funktionen privat in den Seiten-Dateien; sie
 * sind unverändert hierher gezogen.
 */
import type { FestivalEnrichment } from '@/lib/festivals/enrich';
import { DE_LOCALE } from '@/lib/site/intl';
import { EVENT_TZ, toViennaDate, viennaFields } from '@/lib/utils/event-time';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { Festival, FestivalArtist } from '@/types/festivals';

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
