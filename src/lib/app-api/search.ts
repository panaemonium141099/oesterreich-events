/**
 * Smart-Suche für die native App (`POST /api/app/v1/search`).
 *
 * Dieselbe Antwort wie die Smart-Suche von /entdecken: `runSmartSearch`
 * liefert Treffer und gedeutete Anfrage, und die Helfer der Website machen
 * daraus, was die Seite zeigt (Chips „Verstanden", den Satz über den
 * Regalen, die Regale nach Tag und Tageszeit, die Nachfragen). Hier wird
 * nur in Karten umgerechnet: die App rendert.
 *
 * Pur: keine Datenbank; die Uhr kommt als `now` (die Regale hängen an
 * „heute"). Die Form ist ein Vertrag mit ausgelieferten App-Versionen
 * (siehe landing.ts).
 */
import type { Event } from '@/types/events';
import { buildUnderstoodChips, type UnderstoodChip } from '@/components/Discover/v4/smart-chips';
import { planSmartShelves } from '@/components/Discover/v4/smart-shelves';
import { buildConciergeLine, buildRefineChips, type RefineChip } from '@/components/Discover/v4/smart-summary';
import type { SmartSearchPayload } from '@/lib/search/smart-search';
import {
  toAppActivityCard,
  toAppEventCard,
  type AppActivityCard,
  type AppEventCard,
  type AppLandingContext,
} from './landing';

export const APP_SEARCH_VERSION = 1;

/** So viele Treffer holt die App je Anfrage, wie die Website (`RESULT_LIMIT`). */
export const APP_SEARCH_LIMIT = 40;

export type AppSearchContext = Pick<AppLandingContext, 't' | 'locale' | 'origin'>;

export interface AppSearch {
  version: typeof APP_SEARCH_VERSION;
  query: string;
  /** „Verstanden": was aus der Anfrage gelesen wurde (Ort, Zeit, Budget …). */
  chips: UnderstoodChip[];
  /** Der Satz über den Regalen: was gefunden wurde, und was nicht. */
  summary: string;
  /** Weder Events noch Ausflugsziele. */
  empty: boolean;
  shelves: Array<{
    key: string;
    title: string;
    sub: string | null;
    /** Karte plus Zahl weiterer Termine derselben Reihe („+3 Termine"). */
    events: Array<AppEventCard & { moreDates: number }>;
  }>;
  /** Ausflugsziele ohne festen Termin. */
  activities: AppActivityCard[];
  /** Nachfragen: `append` wird an die Anfrage gehängt und neu gesucht. */
  refine: RefineChip[];
}

export function toAppSearch(payload: SmartSearchPayload, ctx: AppSearchContext, now: Date): AppSearch {
  const cardCtx = { ...ctx, mapboxToken: null };
  const chips = buildUnderstoodChips(payload.parsed);
  const activities = payload.activityMatches ?? [];
  const matches = payload.matches as unknown as Array<Event & { series_count?: number }>;

  return {
    version: APP_SEARCH_VERSION,
    query: payload.query,
    chips,
    summary: buildConciergeLine({
      count: payload.count,
      activities: activities.length,
      chips,
      signals: payload.parsed?.signals ?? [],
      unmatchedTerms: payload.parsed?.unmatched_terms ?? [],
    }),
    empty: payload.count === 0 && activities.length === 0,
    shelves: planSmartShelves(matches, now).map(shelf => ({
      key: shelf.key,
      title: shelf.title,
      sub: shelf.sub ?? null,
      events: shelf.events.map(event => ({
        ...toAppEventCard(event, cardCtx),
        moreDates: (event.series_count ?? 1) > 1 ? event.series_count! - 1 : 0,
      })),
    })),
    activities: activities.map(activity => toAppActivityCard(activity, ctx)),
    refine: buildRefineChips(payload.parsed),
  };
}
