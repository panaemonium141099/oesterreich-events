/**
 * Startseite für die native App (`GET /api/app/v1/landing`).
 *
 * Die App zeigt dieselbe Tagesausgabe wie die Website. Damit beide dasselbe
 * sagen, rechnet dieser Baustein die Daten von `getLandingData()` mit den
 * Helfern der Website in anzeigefertige Werte um (Datum und Uhrzeit in
 * Wiener Zeit, Preis-Badge, Bildwahl, Ortszeile): die App rendert nur. Feste
 * Beschriftungen („Heute Abend", „Karte öffnen") trägt die App selbst; von
 * hier kommt, was von den Daten abhängt.
 *
 * Pur: keine Datenbank, keine Uhr außer `now`. Die Form ist ein Vertrag mit
 * ausgelieferten App-Versionen: Felder ergänzen ist frei, umbenennen oder
 * entfernen braucht eine neue Version (`/api/app/v2/…`).
 */
import type { Event } from '@/types/events';
import type { LandingData } from '@/lib/v4/get-landing-data';
import { resolvePrimaryEventImage, isUsableImageCandidate } from '@/lib/event-images/resolveEventImage';
import { gradientFor } from '@/components/Discover/v4/category-gradient';
import { pickActivityImage } from '@/lib/activities/card-image';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { districtDisplayName } from '@/lib/districtsAT';
import { dayRangeLabel, shortDateWithYear, shortViennaDay, weekdayLabel } from '@/lib/landing/day-labels';
import { DORFFESTE_DAYS, DORFFESTE_HREF } from '@/lib/landing/dorffeste';
import { DE_LOCALE } from '@/lib/site/intl';
import { SITE_REGIONS, siteRegionImage } from '@/lib/site/regions';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatEventDate, parseEventDate, toViennaDate } from '@/lib/utils/event-time';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { mapStaticUrl } from '@/lib/v4/map-static-url';
import { priceBadge } from '@/lib/v4/price-badge';

export const APP_LANDING_VERSION = 1;

/** Übersetzer über alle Namespaces: `t('Landing.Tip.free')`. */
export type AppTranslate = (key: string, values?: Record<string, string | number>) => string;

export interface AppLandingContext {
  t: AppTranslate;
  locale: 'de' | 'en';
  /** Ursprung der Website ohne Schrägstrich am Ende; macht lokale Bildpfade absolut. */
  origin: string;
  mapboxToken?: string | null;
}

/** Event als Karte: alles, was Regal, Liste und Bühne zeigen. */
export interface AppEventCard {
  id: string;
  title: string;
  /** Pfad der Detailseite auf der Website (zum Teilen). */
  path: string;
  /** Bild der Quelle, null wenn keines brauchbar ist (dann `gradient` + `categoryLabel`). */
  image: string | null;
  /** Immer ein Bild: das der Quelle, sonst das Kategorie-Foto der Website. */
  imageResolved: string;
  /** Farbverlauf der Kategorie für Karten ohne Bild. */
  gradient: [string, string];
  category: string | null;
  categoryLabel: string;
  /** Beginn als ISO-Zeitpunkt (UTC). */
  startsAt: string;
  /** Wiener Kalendertag des Beginns (YYYY-MM-DD). */
  day: string;
  /** „Fr 30. Okt." für das Karten-Badge. */
  dayShort: string;
  /** „20:00" in Wiener Zeit; null, wenn die Quelle keine Uhrzeit kennt. */
  time: string | null;
  locationName: string | null;
  /** „Gasometer · Wien" (Ort, dann Bezirk oder Bundesland). */
  place: string;
  /** Kurzer Preis für das Badge; null, wenn er nicht knapp darstellbar ist. */
  price: { label: string; free: boolean } | null;
}

export interface AppLanding {
  version: typeof APP_LANDING_VERSION;
  /** Wiener Kalendertag der Ausgabe (YYYY-MM-DD). */
  today: string;
  /** „Freitag, 20. November" */
  todayLabel: string;
  /** Kommende Events im Land, auf volle Tausender abgerundet; null unter 1.000. */
  eventCount: number | null;
  tip: {
    kind: 'sponsored' | 'editorial' | 'auto';
    /** Nur bei `sponsored`: Pflichtangabe neben dem Label „Anzeige". */
    sponsorName: string | null;
    /** „Fr., 20. Nov. · Gasometer" */
    line: string;
    /** „Tickets ab 29 €", „Eintritt frei", „Zum Event" */
    cta: string;
    event: AppEventCard;
  } | null;
  season: {
    id: string;
    kicker: string;
    title: string;
    more: string;
    /** Pfad der Liste auf der Website (`/entdecken?saison=…`). */
    morePath: string;
    picks: Array<AppEventCard & { featured: boolean; meta: string }>;
  };
  map: {
    /** Kartenbild mit den Pins von heute (2x); null ohne Token. */
    image: string | null;
    pins: Array<{ lat: number; lng: number }>;
  };
  artistsLive: Array<{
    artistId: string;
    name: string;
    image: string | null;
    event: AppEventCard;
  }>;
  program: {
    /** „Freitag, ab 17 Uhr" */
    sub: string;
    events: AppEventCard[];
  };
  weekend: {
    /** „Fr 20. Nov. bis So 22. Nov." */
    sub: string;
    range: { from: string; to: string };
    events: AppEventCard[];
  };
  dorffeste: {
    sub: string;
    path: string;
    events: AppEventCard[];
  };
  regions: Array<{ id: string; name: string; image: string | null }>;
  festivals: Array<{
    id: string;
    slug: string;
    name: string;
    image: string;
    /** „Fr 5. Jun. bis So 7. Jun. · Nickelsdorf" */
    meta: string;
    acts: string[];
  }>;
  posts: Array<{
    slug: string;
    title: string;
    image: string;
    /** „Guide · 30. Okt. 2026" */
    meta: string;
  }>;
  activities: AppActivityCard[];
}

/** Ausflugsziel als Karte (Startseite, Smart-Suche). */
export interface AppActivityCard {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  /** Bildnachweis; steht sichtbar am Bild, solange es zu sehen ist. */
  credit: string | null;
  /** Kategorie-Badge aus dem ersten Tag; null ohne Tag. */
  tagLabel: string | null;
  /** Text der Kachel ohne Bild. */
  fallbackLabel: string;
  place: string;
}

type ActivityCardSource = {
  id: string;
  slug: string;
  name: string;
  tags?: string[] | null;
  town?: string | null;
  bundesland?: string | null;
  images?: unknown;
};

export function toAppActivityCard(a: ActivityCardSource, ctx: Pick<AppLandingContext, 't' | 'locale' | 'origin'>): AppActivityCard {
  const picked = pickActivityImage(a.images);
  const tag = a.tags?.[0];
  const label = tag ? activityTagLabel(tag, ctx.locale) : null;
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    image: picked ? absoluteUrl(picked.url, ctx.origin) : null,
    // Quellen liefern den Nachweis teils HTML-kodiert ("Gsund &amp; fesch").
    credit: picked?.credit ? decodeEntities(picked.credit) : null,
    tagLabel: label,
    fallbackLabel: label ?? ctx.t('Landing.Activities.cardFallback'),
    place: [a.town, a.bundesland ? bundeslandDisplayName(a.bundesland, ctx.locale) : null]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Logische Größe des Kartenbilds der App (wird als @2x geholt). */
export const APP_MAP_IMAGE_SIZE = { width: 400, height: 220 } as const;

const FREE = '\u0000free';
const FROM = '\u0000from:';

/** Lokale Pfade der Website („/images/…") absolut machen, fremde URLs bleiben. */
export function absoluteUrl(url: string, origin: string): string {
  return url.startsWith('/') ? `${origin}${url}` : url;
}

export function toAppEventCard(ev: Event, ctx: AppLandingContext): AppEventCard {
  const intl = ctx.locale === 'de' ? DE_LOCALE : 'en-GB';
  const start = parseEventDate(ev.start_date);
  const day = start ? toViennaDate(start) : '';
  const badge = priceBadge(ev, { free: FREE, from: p => ctx.t('MapPage.priceFrom', { price: p }) }, intl);
  const region = ev.district
    ? districtDisplayName(ev.district)
    : ev.bundesland
      ? bundeslandDisplayName(ev.bundesland, ctx.locale)
      : '';
  const ownImage = usableOwnImage(ev);

  return {
    id: ev.id,
    title: decodeEntities(ev.title ?? ''),
    path: buildEventUrlV2(ev),
    image: ownImage ? absoluteUrl(ownImage, ctx.origin) : null,
    imageResolved: absoluteUrl(
      resolvePrimaryEventImage({
        imageUrl: ev.image_url,
        category: ev.category,
        title: ev.title,
        bundesland: ev.bundesland,
        imageWidth: ev.image_width,
        sourceId: ev.source_id,
      }),
      ctx.origin,
    ),
    gradient: gradientFor(ev.category),
    category: ev.category ?? null,
    categoryLabel: categoryLabel(key => ctx.t(`Categories.${key}`), ev.category || 'Sonstiges'),
    startsAt: start ? start.toISOString() : ev.start_date,
    day,
    dayShort: day ? shortViennaDay(day, ctx.locale) : '',
    time: formatEventDate(ev, intl).time,
    locationName: ev.location_name ?? null,
    place: [ev.location_name, region].filter(Boolean).join(' · '),
    price: badge == null ? null : { label: badge === FREE ? ctx.t('Discover.chipFree') : badge, free: badge === FREE },
  };
}

/**
 * Bild der Quelle für Regal-Karten: wie auf der Website jedes vorhandene
 * Bild, außer es ist als dauerhaft tot vermessen (`image_width === 0`).
 */
function usableOwnImage(ev: Event): string | null {
  if (ev.image_width === 0) return null;
  return isUsableImageCandidate(ev.image_url) ? ev.image_url!.trim() : null;
}

/** Knopftext des Tipps, gleiche Regel wie `tipCtaLabel` der Website. */
function tipCta(ev: Event, ctx: AppLandingContext): string {
  const intl = ctx.locale === 'de' ? DE_LOCALE : 'en-GB';
  const badge = priceBadge(ev, { free: FREE, from: p => FROM + p }, intl);
  if (!badge) return ctx.t('Landing.Tip.toEvent');
  if (badge === FREE) return ctx.t('Landing.Tip.free');
  if (badge.startsWith(FROM)) return ctx.t('Landing.Tip.ticketsFrom', { price: badge.slice(FROM.length) });
  return ctx.t('Landing.Tip.tickets', { price: badge });
}

/** „über 88.000": auf volle Tausender abgerundet, unter 1.000 keine Zahl. */
function roundedCount(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const rounded = Math.floor(n / 1000) * 1000;
  return rounded > 0 ? rounded : null;
}

export function toAppLanding(data: LandingData, ctx: AppLandingContext): AppLanding {
  const intl = ctx.locale === 'de' ? DE_LOCALE : 'en-GB';
  const card = (ev: Event) => toAppEventCard(ev, ctx);
  const range = (from: string, to: string) => ctx.t('Landing.Shelves.range', { from, to });
  const short = { weekday: 'short', day: 'numeric', month: 'short' } as const;

  const tip = data.tip && (() => {
    const { event, kind, sponsorName } = data.tip!;
    const when = formatEventDate(event, intl, short).label;
    const place = (kind === 'sponsored' ? sponsorName : null) ?? event.location_name ?? null;
    return {
      kind,
      sponsorName: kind === 'sponsored' ? sponsorName : null,
      line: place ? `${when} · ${place}` : when,
      cta: tipCta(event, ctx),
      event: card(event),
    };
  })();

  const seasonKey = `Landing.Season.${data.season.seasonId}`;
  const weekendSub = data.weekendRange.from === data.weekendRange.to
    ? shortViennaDay(data.weekendRange.from, ctx.locale)
    : range(shortViennaDay(data.weekendRange.from, ctx.locale), shortViennaDay(data.weekendRange.to, ctx.locale));

  return {
    version: APP_LANDING_VERSION,
    today: data.today,
    todayLabel: new Date(`${data.today}T12:00:00Z`).toLocaleDateString(intl, {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    }),
    eventCount: roundedCount(data.countryTotal),
    tip: tip || null,
    season: {
      id: data.season.seasonId,
      kicker: ctx.t(`${seasonKey}.kicker`),
      title: ctx.t(`${seasonKey}.title`),
      more: ctx.t(`${seasonKey}.more`),
      morePath: `/entdecken?saison=${data.season.seasonId}`,
      picks: data.season.picks.map(ev => {
        const { date, time } = formatEventDate(ev, intl, short);
        return {
          ...card(ev),
          featured: ev.featured,
          meta: [time ? `${date} · ${time}` : date, ev.location_name].filter(Boolean).join(' · '),
        };
      }),
    },
    map: {
      image: ctx.mapboxToken
        ? mapStaticUrl(data.mapPins, { ...APP_MAP_IMAGE_SIZE, token: ctx.mapboxToken, retina: true })
        : null,
      pins: data.mapPins.map(p => ({ lat: p.lat, lng: p.lng })),
    },
    artistsLive: data.artistsLive.map(a => ({
      artistId: a.artistId,
      name: a.name,
      image: a.image,
      event: card(a.event),
    })),
    program: {
      sub: ctx.t('Landing.Program.sub', { day: weekdayLabel(data.today, ctx.locale) }),
      events: data.program.map(card),
    },
    weekend: { sub: weekendSub, range: data.weekendRange, events: data.weekend.map(card) },
    dorffeste: {
      sub: ctx.t('Landing.Shelves.dorffesteSub', { days: DORFFESTE_DAYS }),
      path: DORFFESTE_HREF,
      events: data.dorffeste.map(card),
    },
    regions: SITE_REGIONS.filter(r => r.id !== 'all').map(r => {
      const image = siteRegionImage(r.id);
      return {
        id: r.id,
        name: bundeslandDisplayName(r.id, ctx.locale),
        image: image ? absoluteUrl(image, ctx.origin) : null,
      };
    }),
    festivals: data.festivals.map(f => ({
      id: f.id,
      slug: f.slug,
      name: f.canonical_name,
      image: absoluteUrl(f.image_url ?? '/images/categories/musik-1.jpg', ctx.origin),
      meta: [dayRangeLabel(f.starts_at, f.ends_at, ctx.locale, range), f.city].filter(Boolean).join(' · '),
      acts: f.acts,
    })),
    posts: data.posts.map(p => ({
      slug: p.slug,
      title: p.title,
      image: absoluteUrl(p.image, ctx.origin),
      meta: [p.category, shortDateWithYear(p.publishDate, ctx.locale)].filter(Boolean).join(' · '),
    })),
    activities: data.activities.map(a => toAppActivityCard(a, ctx)),
  };
}
