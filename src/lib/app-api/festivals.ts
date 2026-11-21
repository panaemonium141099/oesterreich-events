/**
 * Festivals für die native App: Liste und Detail als anzeigefertige Werte.
 * Lader und Ableitungen sind die der Website (`src/lib/festivals/public.ts`:
 * Bildwahl, Zeitraum, Genre, Line-up nach Rolle, Route); hier wird nur
 * umgeformt und beschriftet. Pur: keine Abfragen.
 */
import {
  BILLING_LABEL,
  deriveFestivalView,
  festivalCardDateRange,
  ticketProviderOf,
  type FestivalDetailData,
  type UpcomingFestival,
} from '@/lib/festivals/display';
import { buildOebbScottyUrl } from '@/lib/plans/deep-links';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { viennaToday } from '@/lib/utils/event-time';
import { absoluteUrl, type AppTranslate } from './landing';
import { toAppPlanDraft, type AppPlanDraft, type AppPlanState } from './plans';

export const APP_FESTIVALS_VERSION = 1;

/** So viele Namen von der Festival-Website zeigt die Detailseite höchstens. */
const EXCERPT_MAX = 80;

export interface AppFestivalsContext {
  t: AppTranslate;
  locale: 'de';
  origin: string;
}

export interface AppFestivalCard {
  id: string;
  slug: string;
  name: string;
  image: string;
  /** „vorauss. 12.–14. Juni · Wiesen". */
  meta: string;
  price: string | null;
}

export interface AppFestivalList {
  version: typeof APP_FESTIVALS_VERSION;
  eyebrow: string;
  title: string;
  /** „23 kommende Festivals in Österreich." oder der Hinweis, dass es keine gibt. */
  sub: string;
  festivals: AppFestivalCard[];
}

export interface AppFestivalDetail {
  version: typeof APP_FESTIVALS_VERSION;
  id: string;
  slug: string;
  name: string;
  image: string;
  /** Adresse der Festivalseite auf der Website, zum Teilen. */
  url: string;
  dateLabel: string;
  place: string;
  description: string | null;
  /** Zeilen der Info-Karte: Termin, Ort, Genre, Acts, Preis (nur was bekannt ist). */
  info: Array<{ label: string; value: string }>;
  lineup: {
    /** Line-up der Datenbank nach Rolle, Headliner zuerst. */
    groups: Array<{ key: string; label: string; artists: Array<{ name: string; day: string | null }> }>;
    /** Namen von der Festival-Website, wenn die Datenbank kein Line-up hat. */
    excerpt: string[];
    /** Hinweis unter dem Auszug bzw. statt eines Line-ups; null bei vollem Line-up. */
    note: string | null;
  };
  ticket: { url: string; label: string; provider: string } | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  /** Haupt-Event des Festivals in der Event-Datenbank; die App öffnet es als Event. */
  eventId: string | null;
}

/** Zeitraum ohne Strich: „10.–13. Juni" wird „10. bis 13. Juni" (Texte der App tragen keine Striche). */
function spellRange(range: string): string {
  return range.replace(/\s*–\s*/g, ' bis ');
}

export function toAppFestivalCard(festival: UpcomingFestival, ctx: AppFestivalsContext): AppFestivalCard {
  const range = spellRange(festivalCardDateRange(festival.starts_at, festival.ends_at));
  return {
    id: festival.id,
    slug: festival.slug,
    name: decodeEntities(festival.canonical_name),
    image: absoluteUrl(festival.image_url, ctx.origin),
    meta: `${festival.date_status === 'expected' ? 'vorauss. ' : ''}${range}${festival.city ? ` · ${festival.city}` : ''}`,
    price: festival.price_text ?? null,
  };
}

export function toAppFestivalList(festivals: UpcomingFestival[], ctx: AppFestivalsContext): AppFestivalList {
  const t = (key: string, values?: Record<string, string | number>) => ctx.t(`FestivalsPage.${key}`, values);
  return {
    version: APP_FESTIVALS_VERSION,
    eyebrow: t('eyebrow'),
    title: t('title'),
    sub: festivals.length === 0 ? t('empty') : t('count', { count: festivals.length }),
    festivals: festivals.map(f => toAppFestivalCard(f, ctx)),
  };
}

export function toAppFestivalDetail(data: FestivalDetailData, ctx: AppFestivalsContext): AppFestivalDetail {
  const { festival, parentEvent, artists } = data;
  const view = deriveFestivalView(data);
  const dateLabel = spellRange(view.dateRange);

  const info: AppFestivalDetail['info'] = [{ label: 'Termin', value: dateLabel }];
  if (view.place) info.push({ label: 'Ort', value: view.place });
  if (view.genreLabel) info.push({ label: 'Genre', value: view.genreLabel });
  if (artists.length > 0 || view.enrichmentArtists.length > 0) {
    info.push({ label: 'Acts', value: artists.length > 0 ? String(artists.length) : `~${view.enrichmentArtists.length}` });
  }
  if (view.priceText) info.push({ label: 'Preis', value: view.priceText });

  const groups = view.billingKeys.map(key => ({
    key,
    label: BILLING_LABEL[key] ?? key,
    artists: (view.grouped.get(key) ?? []).map(a => ({ name: a.artist_name_raw, day: a.day_label ?? null })),
  }));
  const excerpt = view.enrichmentArtists.slice(0, EXCERPT_MAX);

  return {
    version: APP_FESTIVALS_VERSION,
    id: festival.id,
    slug: festival.slug,
    name: decodeEntities(festival.canonical_name),
    image: absoluteUrl(view.heroImage, ctx.origin),
    url: `${ctx.origin}/festivals/${encodeURIComponent(festival.slug)}`,
    dateLabel,
    place: view.place,
    description: view.description?.trim() || null,
    info,
    lineup: {
      groups,
      excerpt,
      note:
        groups.length > 0
          ? null
          : excerpt.length > 0
            ? 'Auszug von der Festival-Seite. Die vollständige Liste steht auf der offiziellen Website.'
            : 'Das Line-up wurde noch nicht eingelesen. Schau auf der offiziellen Festival-Seite nach.',
    },
    ticket: festival.ticket_url
      ? {
          url: festival.ticket_url,
          label: `Tickets${view.priceText ? ` · ${view.priceText.replace(/^(Festivalpass|Tickets?|Eintritt)\s*/i, '')}` : ''}`,
          provider: ticketProviderOf(festival.ticket_url),
        }
      : null,
    websiteUrl: festival.website_url,
    mapsUrl: view.mapsUrl,
    eventId: parentEvent?.id ?? null,
  };
}

/**
 * Vorbelegung des Plan-Assistenten für ein Festival ohne Haupt-Event, wie
 * `initialPrefill` der Website: Name, Tag und Stadt stehen, der Plan trägt
 * kein Event.
 */
export function toAppFestivalPlanDraft(data: FestivalDetailData, ctx: AppFestivalsContext, now: Date): AppPlanDraft {
  const { festival } = data;
  const state: AppPlanState = {
    name: festival.city ? `${festival.canonical_name} in ${festival.city}` : festival.canonical_name,
    plan_date: festival.starts_at?.slice(0, 10) || viennaToday(now),
    note: null,
    event_ids: [],
    tickets_status: 'open',
    arrival_status: 'open',
    arrival_mode: null,
    arrival_from: null,
    accommodation_status: 'open',
    accommodation_city: festival.city ?? null,
    reminder_7d: true,
    reminder_1d: true,
    reminder_3h: true,
  };
  const draft = toAppPlanDraft(null, state, { ...ctx, mapboxToken: null });
  const destination = [festival.city, festival.state].filter(Boolean).join(', ');
  return {
    ...draft,
    ticket: festival.ticket_url
      ? { url: festival.ticket_url, provider: ticketProviderOf(festival.ticket_url), priceLabel: festival.price_text ?? null }
      : null,
    destination: destination || decodeEntities(festival.canonical_name),
    oebbUrl: destination
      ? buildOebbScottyUrl(
          { location_name: festival.city, address: null, bundesland: festival.state, start_date: '' },
          null,
          state.plan_date,
        )
      : null,
  };
}
