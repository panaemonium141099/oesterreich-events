/**
 * „Was kann man in X machen?" für die native App: Einstieg und Ortsseite
 * als anzeigefertige Werte. Orte, Themen, Texte und Daten sind die der
 * Website (`src/lib/was-tun/`: `places.ts`, `themes.ts`, `content.ts`,
 * `loaders.ts`); hier wird nur umgeformt.
 *
 * Pur: keine Abfragen. Nachgeladen wird über `/api/app/v1/events` und
 * `/api/app/v1/activities` mit genau den Parametern, die die Seite der
 * Website für ihr Nachladen nutzt (`more`), sonst meinen erste Seite und
 * Nachladen verschiedene Mengen.
 *
 * OSM-Ziele (ODbL) bleiben eine eigene Liste mit eigener Quellenangabe und
 * werden nie mit den Aktivitäten gemischt.
 */
import type { NearbyOsmPoi } from '@/lib/osm/nearby-pois';
import { osmCategoryLabel } from '@/lib/osm/poi-whitelist';
import {
  buildAnswer,
  buildWasTunFaq,
  formatCount,
  scopeSentence,
  wasTunQuestion,
} from '@/lib/was-tun/content';
import type { WasTunData } from '@/lib/was-tun/loaders';
import { bundeslandLinks, regionLinks, relatedPlaces, type WasTunLink, type WasTunPlace } from '@/lib/was-tun/places';
import { WAS_TUN_THEMES, type WasTunTheme } from '@/lib/was-tun/themes';
import type { Event } from '@/types/events';
import {
  toAppActivityCard,
  toAppEventCard,
  type AppActivityCard,
  type AppEventCard,
  type AppLandingContext,
} from './landing';

export const APP_WAS_TUN_VERSION = 1;

/** So viele OSM-Ziele zeigt die Seite (wie `GemeindeOsmPoisSection`), erst ab drei. */
const OSM_SHOWN = 30;
const OSM_MIN = 3;

export interface AppWasTunLink {
  slug: string;
  name: string;
}

export interface AppWasTunIndex {
  version: typeof APP_WAS_TUN_VERSION;
  title: string;
  bundeslaender: AppWasTunLink[];
  regions: AppWasTunLink[];
}

export interface AppWasTun {
  version: typeof APP_WAS_TUN_VERSION;
  slug: string;
  /** Aktives Thema; null auf der Grundseite. */
  theme: string | null;
  /** Adresse der Seite auf der Website, zum Teilen. */
  url: string;
  question: string;
  answer: string;
  /** Ein Satz zum Umkreis bzw. zur Auswahl; null beim Bundesland ohne Thema. */
  scope: string | null;
  themes: Array<{ slug: string | null; label: string; active: boolean }>;
  events: {
    title: string;
    countLabel: string;
    total: number;
    items: AppEventCard[];
    /** Nachladen über /api/app/v1/events: Parameter und Cursor; null, wenn alles da ist. */
    more: { params: Record<string, string>; cursor: string } | null;
  } | null;
  activities: {
    title: string;
    countLabel: string;
    total: number;
    items: AppActivityCard[];
    /** Nachladen über /api/app/v1/activities. */
    more: { params: Record<string, string>; cursor: string } | null;
  } | null;
  osm: {
    title: string;
    items: Array<{ id: string; name: string; category: string; distance: string; website: string | null }>;
    /** Pflichtangabe (ODbL): Text und Links stehen sichtbar unter der Liste. */
    attribution: { text: string; links: Array<{ label: string; url: string }> };
  } | null;
  faq: Array<{ question: string; answer: string }>;
  related: { regions: AppWasTunLink[]; gemeinden: AppWasTunLink[] };
}

const slugOf = (link: WasTunLink): AppWasTunLink => ({ slug: link.href.split('/').filter(Boolean).pop() ?? '', name: link.name });

export function toAppWasTunIndex(): AppWasTunIndex {
  return {
    version: APP_WAS_TUN_VERSION,
    title: 'Was kann man in Österreich machen?',
    bundeslaender: bundeslandLinks().map(slugOf),
    regions: regionLinks().map(slugOf),
  };
}

export function toAppWasTun(
  place: WasTunPlace,
  theme: WasTunTheme | null,
  data: WasTunData,
  ctx: AppLandingContext,
): AppWasTun {
  const totals = { events: data.eventTotal, activities: data.activityTotal };
  const where = theme ? `${place.where} ${theme.phrase}` : place.where;
  const lastEvent = data.events[data.events.length - 1];
  const related = relatedPlaces(place);

  return {
    version: APP_WAS_TUN_VERSION,
    slug: place.slug,
    theme: theme?.slug ?? null,
    url: `${ctx.origin}/was-tun/${place.slug}${theme ? `/${theme.slug}` : ''}`,
    question: wasTunQuestion(place, theme),
    answer: buildAnswer(place, totals, data.activities, theme),
    scope: scopeSentence(place),
    themes: [
      { slug: null, label: 'Alles', active: theme === null },
      ...WAS_TUN_THEMES.map(t => ({ slug: t.slug, label: t.label, active: theme?.slug === t.slug })),
    ],
    events:
      data.events.length > 0 && data.eventApiParams
        ? {
            title: `Alle Veranstaltungen ${where}`,
            countLabel: formatCount(data.eventTotal),
            total: data.eventTotal,
            items: data.events.map(e => toAppEventCard(e as unknown as Event, ctx)),
            more:
              data.events.length < data.eventTotal && lastEvent
                ? { params: data.eventApiParams, cursor: lastEvent.id }
                : null,
          }
        : null,
    activities:
      data.activities.length > 0 && data.activityApiParams
        ? {
            title: `Ausflugsziele und Aktivitäten ${where}`,
            countLabel: formatCount(data.activityTotal),
            total: data.activityTotal,
            items: data.activities.map(a => toAppActivityCard({ ...a, bundesland: place.bundeslandId }, ctx)),
            more: data.activityCursor ? { params: data.activityApiParams, cursor: data.activityCursor } : null,
          }
        : null,
    osm:
      data.osmPois.length >= OSM_MIN
        ? {
            title: ctx.t('GemeindeHub.osmTitle'),
            items: data.osmPois.slice(0, OSM_SHOWN).map((poi: NearbyOsmPoi) => ({
              id: poi.id,
              name: poi.name,
              category: osmCategoryLabel(poi.category, ctx.locale),
              distance: `${poi._distance_km.toFixed(1).replace('.', ',')} km`,
              website: poi.website,
            })),
            attribution: {
              text: 'Kartendaten © OpenStreetMap contributors, lizenziert unter ODbL 1.0.',
              links: [
                { label: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
                { label: 'ODbL 1.0', url: 'https://opendatacommons.org/licenses/odbl/1-0/' },
              ],
            },
          }
        : null,
    faq: buildWasTunFaq(place, totals, data.events, data.activities, theme).map(entry => ({
      question: entry.question,
      answer: entry.answer,
    })),
    related: {
      regions: related.regions.map(slugOf),
      // Wie die Website: ein Bundesland mit Thema listet keine Gemeinden.
      gemeinden: theme && place.kind === 'bundesland' ? [] : related.gemeinden.map(slugOf),
    },
  };
}
