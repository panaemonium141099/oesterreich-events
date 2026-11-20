/**
 * Event-Detail für die native App (`GET /api/app/v1/events/[id]`).
 *
 * Dieselben Angaben wie die Detailseite der Website, mit ihren Helfern
 * gerechnet: Kopfbild mit Bildnachweis, Beschreibung, Ort, die Zustands-Box
 * (Tickets, Eintritt frei, Abendkasse, kein Online-Verkauf) samt
 * Preiszeilen, Quelle und „Auch gelistet bei", ähnliche Events. Die App
 * rendert nur; persönliche Zustände (gemerkt, gefolgter Künstler) legt sie
 * später selbst darüber, wie die Website nach dem Laden.
 *
 * Pur: keine Datenbank, keine Uhr außer `now`. Die Form ist ein Vertrag mit
 * ausgelieferten App-Versionen (siehe landing.ts).
 */
import type { Event } from '@/types/events';
import { priceBlockItems, type PriceItem } from '@/components/Events/v4/V4PriceBlock';
import { effectiveBundesland, hubLinksFor, type RelatedRow } from '@/components/Events/v4/V4RelatedEvents';
import { BUNDESLAND_NAMES, type BundeslandId } from '@/lib/districtsAT';
import { buildAlsoListedSources, sourceLabelOf, type DuplicateSourceRow, type ListedSource } from '@/lib/events/also-listed-sources';
import { resolvePrimaryEventImage } from '@/lib/event-images/resolveEventImage';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { DE_LOCALE } from '@/lib/site/intl';
import { resolveSourceAttribution } from '@/lib/source-attribution-overrides';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatEventDate } from '@/lib/utils/event-time';
import { isLocationApproximate, isLocationTrusted } from '@/lib/utils/location-trust';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import { deriveTicketMeta } from '@/lib/v4/ticket-meta';
import { absoluteUrl, toAppEventCard, type AppEventCard, type AppLandingContext } from './landing';

export const APP_EVENT_DETAIL_VERSION = 1;

export type AppEventDetailContext = Pick<AppLandingContext, 't' | 'locale' | 'origin'>;

/** Zustand der Box ohne persönliche Daten (die legt die App darüber). */
export type AppEventBoxKind = 'ticket' | 'free' | 'doorsale' | 'unknown';

export interface AppEventDetail {
  version: typeof APP_EVENT_DETAIL_VERSION;
  id: string;
  title: string;
  /** Pfad und volle Adresse der Detailseite auf der Website (Teilen). */
  path: string;
  url: string;
  startsAt: string;
  endsAt: string | null;
  /** Ende (sonst Beginn) liegt mehr als 24 Stunden zurück. */
  isPast: boolean;
  hero: {
    /** Großes Bild: das der Quelle, sonst das Kategorie-Foto der Website. */
    image: string;
    /** Weitere Bilder der Quelle für die Galerie (ohne das erste doppelt). */
    gallery: string[];
    /** Bildnachweis; nur am Bild der Quelle, nie am Kategorie-Foto. */
    credit: { text: string; sourceUrl: string | null } | null;
    /** „Freitag, 20. November · 20:00" */
    dateLabel: string;
    /** „Gasometer · Wien" */
    placeLabel: string;
  };
  description: string | null;
  venue: {
    name: string | null;
    address: string | null;
    /** Nur, wenn der Veranstalter nicht ohnehin als Quelle genannt ist. */
    organizer: string | null;
  } | null;
  /** Kategorie zuerst, dann die Tags, ohne Dubletten. */
  chips: string[];
  /** Pflichtangabe: Quelle des Eintrags. */
  source: ListedSource | null;
  /** Quellen der Dubletten, deren Inhalte in diesen Eintrag eingeflossen sind. */
  alsoListed: ListedSource[];
  box: {
    kind: AppEventBoxKind;
    badge: string;
    /** Fette Zeile unter dem Badge; bei Tickets die Anbieterzeile. */
    headline: string;
    sub: string | null;
    /** Großer Ab-Preis („€ 12"); nur mit Zahl in der Quelle. */
    priceFrom: string | null;
    /** Aufgeschlüsselte Preiszeilen (Label leer = ganze Zeile ist der Wert). */
    priceItems: PriceItem[];
    /** Abendkasse: roher Preistext. */
    priceAtDoor: string | null;
    ticket: { url: string; provider: string } | null;
  };
  location: {
    /** Route nur bei belegten Koordinaten. */
    mapsUrl: string | null;
    /** Koordinaten vorhanden, aber nur ungefähr: Hinweis statt Route. */
    approximate: boolean;
    latitude: number | null;
    longitude: number | null;
  };
  related: {
    heading: string;
    events: AppEventCard[];
  };
  /** „Mehr entdecken": Gemeinde- und Bundesland-Seite. */
  hubs: Array<{ path: string; label: string }>;
  /** Nächste Ausgabe eines vergangenen Events. */
  successor: { id: string; title: string; dateLabel: string } | null;
}

export interface AppEventDetailInput {
  event: Event;
  duplicateSources: DuplicateSourceRow[];
  related: RelatedRow[];
  successor: Event | null;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function box(event: Event, ctx: AppEventDetailContext): AppEventDetail['box'] {
  const t = (key: string, values?: Record<string, string | number>) => ctx.t(`EventDetail.${key}`, values);
  const anon = {
    savedEventIds: new Set<string>(),
    followedArtistIds: new Set<string>(),
    artistMatchEventIds: new Set<string>(),
    lineupMatchEventIds: new Set<string>(),
  };
  const state = deriveEventState(event, anon);
  const { provider, priceFrom, priceAtDoor } = deriveTicketMeta(event);
  const labels = { admission: t('admission'), from: t('from') };
  const prices = { priceText: event.price_text, priceMin: event.price_min, priceMax: event.price_max };

  // Wie V4SideBox: Kaufen nur mit Anbieter und Link, sonst „unbekannt".
  if (state === 'ticket' && provider && event.ticket_url) {
    return {
      kind: 'ticket',
      badge: t('badgeTicket'),
      headline: t('providerLine', { name: provider }),
      sub: null,
      priceFrom: priceFrom ? priceFrom.replace(/^ab\s*/i, '') : null,
      priceItems: priceFrom ? [] : priceBlockItems(prices, labels),
      priceAtDoor: null,
      ticket: { url: event.ticket_url, provider },
    };
  }
  if (state === 'free') {
    return {
      kind: 'free',
      badge: t('badgeFree'),
      headline: t('freeHeadline'),
      sub: t('freeSub'),
      priceFrom: null,
      priceItems: priceBlockItems({ ...prices, priceTier: 'gratis' }, labels),
      priceAtDoor: null,
      ticket: null,
    };
  }
  if (state === 'doorsale') {
    return {
      kind: 'doorsale',
      badge: t('badgeDoorsale'),
      headline: t('doorsaleHeadline'),
      sub: t('doorsaleSub'),
      priceFrom: null,
      priceItems: [],
      priceAtDoor: priceAtDoor ?? null,
      ticket: null,
    };
  }
  return {
    kind: 'unknown',
    badge: t('badgeUnknown'),
    headline: t('unknownHeadline'),
    sub: t('unknownSub'),
    priceFrom: null,
    priceItems: priceBlockItems({ ...prices, priceTier: event.price_tier }, labels),
    priceAtDoor: null,
    ticket: null,
  };
}

export function toAppEventDetail(input: AppEventDetailInput, ctx: AppEventDetailContext): AppEventDetail {
  const { event, now } = input;
  const intl = ctx.locale === 'de' ? DE_LOCALE : 'en-GB';
  const long = { weekday: 'long', day: 'numeric', month: 'long' } as const;
  const card = toAppEventCard(event, { ...ctx, mapboxToken: null });

  // Quelle und Dubletten-Quellen wie V4EventDetail (Attributionspflicht).
  const attribution = resolveSourceAttribution(event);
  const sourceLabel = sourceLabelOf(attribution);

  // Bild wie V4EventDetail: Mini-Bilder weichen dem Kategorie-Foto, der
  // Bildnachweis steht nur am Bild der Quelle.
  const heroImage = resolvePrimaryEventImage({
    imageUrl: event.image_url,
    imageWidth: event.image_width,
    sourceId: event.source_id,
    category: event.category,
    title: event.title,
    bundesland: event.bundesland,
  });
  const images = (event.images ?? []).filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  const showsSourceImage = images.length > 1 || heroImage === event.image_url?.trim();
  const gallery = images.length > 1 ? images.filter(url => url !== heroImage) : [];

  const venueName = event.location_name?.trim() || null;
  const address = event.address?.trim() && event.address.trim() !== venueName ? event.address.trim() : null;
  const organizer =
    event.organizer?.trim() && event.organizer.trim() !== attribution.name?.trim() ? event.organizer.trim() : null;

  const trusted = isLocationTrusted(event);
  const end = event.end_date || event.start_date;
  const bl = effectiveBundesland(event);

  return {
    version: APP_EVENT_DETAIL_VERSION,
    id: event.id,
    title: card.title,
    path: card.path,
    url: `${ctx.origin}${card.path}`,
    startsAt: card.startsAt,
    endsAt: event.end_date ?? null,
    isPast: end ? new Date(end).getTime() < now.getTime() - DAY_MS : false,
    hero: {
      image: absoluteUrl(heroImage, ctx.origin),
      gallery,
      credit:
        showsSourceImage && event.image_credit
          ? { text: event.image_credit, sourceUrl: event.source_url ?? attribution.url ?? null }
          : null,
      dateLabel: formatEventDate({ start_date: event.start_date }, intl, long).label,
      placeLabel: [event.location_name, event.bundesland ? bundeslandDisplayName(event.bundesland, ctx.locale) : null]
        .filter(Boolean)
        .join(' · '),
    },
    description: event.description?.trim() ? decodeEntities(event.description.trim()) : null,
    venue: venueName || address ? { name: venueName, address, organizer } : null,
    chips: [...new Set([event.category, ...(event.tags ?? [])].filter((c): c is string => Boolean(c)))],
    source: sourceLabel ? { label: sourceLabel, url: attribution.url ?? null } : null,
    alsoListed: buildAlsoListedSources(attribution, input.duplicateSources),
    box: box(event, ctx),
    location: {
      mapsUrl: trusted
        ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
        : null,
      approximate: isLocationApproximate(event),
      latitude: trusted ? (event.latitude ?? null) : null,
      longitude: trusted ? (event.longitude ?? null) : null,
    },
    related: {
      heading:
        bl && bl in BUNDESLAND_NAMES
          ? ctx.t('EventDetail.relatedHeadingIn', { region: BUNDESLAND_NAMES[bl as BundeslandId] })
          : ctx.t('EventDetail.relatedHeading'),
      events: input.related.map(row => toAppEventCard(row as unknown as Event, { ...ctx, mapboxToken: null })),
    },
    hubs: hubLinksFor(event).map(h => ({ path: h.href, label: h.label })),
    successor: input.successor
      ? {
          id: input.successor.id,
          title: decodeEntities(input.successor.title ?? ''),
          dateLabel: formatEventDate(input.successor, intl, long).label,
        }
      : null,
  };
}
