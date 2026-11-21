/**
 * Freizeitaktivitäten für die native App: Filter-Facetten und Detail als
 * anzeigefertige Werte. Regeln und Beschriftungen sind die der Website
 * (`ActivityHero`, `ActivityFacts`, `OpenNowBadge`, `NearbyEventsSection`,
 * Filter-Modul von /aktivitaeten); die Karte der Liste ist
 * `toAppActivityCard` aus `landing.ts`.
 *
 * Pur: keine Abfragen, die Uhr kommt als Argument.
 *
 * Pflichtangaben, die die App sichtbar zeigen muss: der Bildnachweis je
 * Bild (`credit`) und die Quelle des Eintrags (`source`).
 */
import { isOpenNow } from '@/components/Activities/open-now';
import {
  accessibilityFeatureLabel,
  parseCuratedAccessibility,
  parseDesklineAccessibility,
} from '@/lib/activities/accessibility';
import { renderableImageUrls } from '@/lib/activities/indexability';
import type { ActivityBezirkCount } from '@/lib/activities/list-loaders';
import { ACTIVITY_FILTER_TAGS } from '@/lib/activities/list-query';
import type { NearbyFutureEvent } from '@/lib/activities/nearby-loaders';
import { formatOpeningDate, formatOpeningWindow } from '@/lib/activities/opening-format';
import type { PublicActivity, PublicActivityImage } from '@/lib/activities/public-types';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { hasAffiliateOffer } from '@/lib/affiliate/viator-types';
import { districtDisplayName } from '@/lib/districtsAT';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { decodeEntities } from '@/lib/utils/decode-entities';
import type { Event } from '@/types/events';
import { absoluteUrl, toAppEventCard, type AppEventCard, type AppLandingContext } from './landing';

export const APP_ACTIVITIES_VERSION = 1;

/** So viele Bilder zeigt die App höchstens. */
const MAX_IMAGES = 8;
/** So viele Events in der Nähe zeigt die Detailseite (wie `NearbyEventsSection`). */
export const APP_ACTIVITY_NEARBY_EVENTS = 3;
export const APP_ACTIVITY_NEARBY_RADIUS_KM = 10;

/** Texte der App tragen keine Striche: „01.05.2026 – 31.10.2026" wird „01.05.2026 bis 31.10.2026". */
function spellRange(text: string): string {
  return text.replace(/\s*–\s*/g, ' bis ');
}

export interface AppActivityFacets {
  version: typeof APP_ACTIVITIES_VERSION;
  title: string;
  intro: string;
  tags: Array<{ id: string; label: string }>;
  settings: Array<{ id: 'indoor' | 'outdoor'; label: string }>;
  /** Bundesländer mit Bestand, je mit ihren Bezirken und der Zahl der Orte. */
  bundeslaender: Array<{
    id: string;
    name: string;
    count: number;
    bezirke: Array<{ id: string; name: string; count: number }>;
  }>;
}

export function toAppActivityFacets(counts: ActivityBezirkCount[], ctx: Pick<AppLandingContext, 't' | 'locale'>): AppActivityFacets {
  const byLand = new Map<string, Array<{ id: string; name: string; count: number }>>();
  for (const row of counts) {
    const list = byLand.get(row.bundesland) ?? [];
    list.push({ id: row.bezirk, name: districtDisplayName(row.bezirk), count: row.n });
    byLand.set(row.bundesland, list);
  }
  const t = (key: string) => ctx.t(`Activities.${key}`);
  return {
    version: APP_ACTIVITIES_VERSION,
    title: t('pageTitle'),
    intro: t('pageIntro').replace(/\s+—\s+/g, ', '),
    tags: ACTIVITY_FILTER_TAGS.map(tag => ({ id: tag, label: activityTagLabel(tag, ctx.locale) })),
    settings: [
      { id: 'indoor', label: t('settingIndoor') },
      { id: 'outdoor', label: t('settingOutdoor') },
    ],
    bundeslaender: [...byLand.entries()]
      .map(([id, bezirke]) => ({
        id,
        name: bundeslandDisplayName(id, ctx.locale),
        count: bezirke.reduce((sum, b) => sum + b.count, 0),
        bezirke: bezirke.sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')),
  };
}

export interface AppActivityDetail {
  version: typeof APP_ACTIVITIES_VERSION;
  id: string;
  slug: string;
  /** Adresse der Seite auf der Website, zum Teilen. */
  url: string;
  name: string;
  place: string;
  tags: string[];
  /** „Dauerhaft geschlossen", sonst null. */
  closedLabel: string | null;
  /** Jetzt geöffnet oder nicht; null ohne Öffnungszeiten oder wenn geschlossen. */
  openNow: { open: boolean; label: string } | null;
  /** Bilder mit Nachweis; der Nachweis steht sichtbar am Bild. */
  images: Array<{ url: string; credit: string | null }>;
  /** Text der Kachel, wenn es kein Bild gibt. */
  fallbackLabel: string;
  description: string | null;
  accessibility: {
    title: string;
    features: string[];
    note: string | null;
    /** „Angaben laut …" samt Prüfdatum. */
    sourceLine: string;
    sourceUrl: string | null;
  } | null;
  opening: { title: string; rows: Array<{ season: string; days: string; time: string }> } | null;
  facts: Array<{ label: string; value: string }>;
  onlineBookable: string | null;
  /** Pflichtangabe: Quelle des Eintrags. */
  source: { prefix: string; label: string; url: string; allLabel: string; allPath: string };
  location: { lat: number; lng: number; title: string; routeLabel: string; mapsUrl: string };
  /** Es gibt ein Buchungsangebot: die App holt es von `/api/activities/[id]/booking`. */
  hasBooking: boolean;
  nearbyEvents: { title: string; hint: string; events: AppEventCard[] } | null;
}

function imageCredit(image: PublicActivityImage): string | null {
  const parts = [...new Set([image.copyright, image.author].map(p => p?.trim()).filter((p): p is string => Boolean(p)))];
  return parts.length > 0 ? decodeEntities(parts.join(' · ')) : null;
}

/** Bilder mit Nachweis; malformte jsonb-Einträge fallen heraus. */
function detailImages(raw: unknown, origin: string): AppActivityDetail['images'] {
  if (!Array.isArray(raw)) return [];
  const renderable = new Set(renderableImageUrls(raw));
  const out: AppActivityDetail['images'] = [];
  for (const entry of raw as PublicActivityImage[]) {
    const url = Array.isArray(entry?.urls) ? entry.urls.find(u => renderable.has(u)) : undefined;
    if (!url) continue;
    out.push({ url: absoluteUrl(url, origin), credit: imageCredit(entry) });
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

export interface AppActivityDetailInput {
  activity: PublicActivity;
  gemeindeName: string | null;
  /** Kommende Events im Umkreis, nächste zuerst (`loadNearbyFutureEventsCached`). */
  nearbyEvents: NearbyFutureEvent[];
  now: Date;
}

export function toAppActivityDetail(
  { activity, gemeindeName, nearbyEvents, now }: AppActivityDetailInput,
  ctx: AppLandingContext,
): AppActivityDetail {
  const t = (key: string, values?: Record<string, string | number>) => ctx.t(`Activity.${key}`, values);
  const landName = activity.bundesland ? bundeslandDisplayName(activity.bundesland, ctx.locale) : null;
  const windows = activity.opening_times ?? [];

  const curated = parseCuratedAccessibility(activity.accessibility_curated);
  const deskline = parseDesklineAccessibility(activity.accessibility);
  const accessible = activity.accessible === true || curated != null || deskline != null;
  const features = [...new Set([...(curated?.features ?? []), ...(deskline?.features ?? [])])];

  const settingLabel =
    activity.setting === 'indoor'
      ? t('settingIndoor')
      : activity.setting === 'outdoor'
        ? t('settingOutdoor')
        : activity.setting === 'mixed'
          ? t('settingMixed')
          : null;
  const facts: AppActivityDetail['facts'] = [];
  if (activity.price_hint) facts.push({ label: t('price'), value: activity.price_hint });
  if (settingLabel) facts.push({ label: t('setting'), value: settingLabel });
  if (activity.gemeinde_slug && gemeindeName) facts.push({ label: t('region'), value: gemeindeName });

  const curatedSource = activity.source !== 'deskline' && activity.source_url && activity.source_label;
  const shown = nearbyEvents.slice(0, APP_ACTIVITY_NEARBY_EVENTS);
  const firstTag = activity.tags?.[0];

  return {
    version: APP_ACTIVITIES_VERSION,
    id: activity.id,
    slug: activity.slug,
    url: `${ctx.origin}/aktivitaet/${activity.slug}`,
    name: activity.name,
    place: [activity.town, landName].filter(Boolean).join(' · '),
    tags: (activity.tags ?? []).map(tag => activityTagLabel(tag, ctx.locale)),
    closedLabel: activity.is_closed ? t('permanentlyClosed') : null,
    openNow:
      windows.length > 0 && !activity.is_closed
        ? (open => ({ open, label: open ? t('openNow') : t('closedNow') }))(isOpenNow(windows, now))
        : null,
    images: detailImages(activity.images, ctx.origin),
    fallbackLabel: firstTag ? activityTagLabel(firstTag, ctx.locale) : ctx.t('Landing.Activities.cardFallback'),
    description: (activity.description ?? activity.description_short)?.trim() || null,
    accessibility: accessible
      ? {
          title: t('accessibilityTitle'),
          features: features.map(f => accessibilityFeatureLabel(f, ctx.locale)),
          note: curated?.note ?? (!curated && deskline && features.length === 0 ? t('accessibilityReported') : null),
          sourceLine: `${t('accessibilitySource')} ${
            curated
              ? curated.source_label
              : deskline?.basis === 'deskline-theme'
                ? t('accessibilitySourceRegion')
                : t('accessibilitySourceText')
          }${curated?.checked_at ? ` · ${t('accessibilityChecked', { date: formatOpeningDate(curated.checked_at.slice(0, 10)) })}` : ''}`,
          sourceUrl: curated?.source_url ?? null,
        }
      : null,
    opening:
      windows.length > 0
        ? {
            title: t('openingTimes'),
            rows: windows.map(w => {
              const f = formatOpeningWindow(w, t('allDays'), t('openEnd'));
              return { season: spellRange(f.season), days: f.days, time: spellRange(f.time) };
            }),
          }
        : null,
    facts,
    onlineBookable: activity.online_bookable ? t('onlineBookable') : null,
    source: {
      prefix: t('source'),
      label: curatedSource ? activity.source_label! : 'Feratel Deskline',
      url: curatedSource ? activity.source_url! : 'https://www.feratel.at/',
      allLabel: t('allSources'),
      allPath: '/quellen',
    },
    location: {
      lat: activity.lat,
      lng: activity.lng,
      title: t('map'),
      routeLabel: t('route'),
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`,
    },
    hasBooking: !activity.is_closed && hasAffiliateOffer(activity.affiliate_product),
    nearbyEvents:
      shown.length > 0
        ? {
            title: t('nearbyEventsTitle'),
            hint: t('nearbyEventsHint'),
            events: shown.map(event => toAppEventCard(event as unknown as Event, ctx)),
          }
        : null,
  };
}
