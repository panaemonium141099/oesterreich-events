/**
 * Übersicht von „Entdecken" für die native App (`GET /api/app/v1/discover`).
 *
 * Dieselben Regale wie /entdecken ohne Filter: Top-Picks, Heute Abend,
 * Dieses Wochenende, Nach Region (mit Zahl), die größten Kategorien, Gratis
 * und die Kategorie-Chips. Die Auswahl trifft `planShelves` aus dem
 * Karten-Snapshot, also dieselbe Rechnung über dieselben Events wie auf der
 * Website; hier werden nur die gewählten Events mit ihren Details gefüllt
 * und in Karten umgerechnet.
 *
 * Pur: keine Datenbank, keine Uhr (der Plan trägt die Tage). Die Form ist
 * ein Vertrag mit ausgelieferten App-Versionen (siehe landing.ts).
 */
import type { Event } from '@/types/events';
import type { ShelfPlan } from '@/components/Discover/v4/shelves-select';
import { bundeslandToId } from '@/lib/bundeslaender';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { shortViennaDay } from '@/lib/landing/day-labels';
import { DE_LOCALE } from '@/lib/site/intl';
import { SITE_REGIONS, siteRegionImage } from '@/lib/site/regions';
import { absoluteUrl, toAppEventCard, type AppEventCard, type AppLandingContext } from './landing';

export const APP_DISCOVER_VERSION = 1;

/** So viele Top-Picks zeigt die Übersicht (eine große Kachel, vier kleine). */
export const APP_DISCOVER_PICKS = 5;

export type AppDiscoverContext = Pick<AppLandingContext, 't' | 'locale' | 'origin'>;

export interface AppDiscover {
  version: typeof APP_DISCOVER_VERSION;
  /** Top-Picks: heute und morgen, höchster Score, nur mit Bild. */
  picks: AppEventCard[];
  tonight: {
    /** „1.234 Events": alle Events heute, nicht nur die gezeigten. */
    sub: string;
    count: number;
    /** Wiener Kalendertag (YYYY-MM-DD) für „Alle anzeigen". */
    day: string;
    events: AppEventCard[];
  };
  weekend: {
    /** „Sa 21. Nov. bis So 22. Nov." */
    sub: string;
    range: { from: string; to: string };
    events: AppEventCard[];
  };
  regions: Array<{ id: string; name: string; image: string | null; count: number }>;
  categories: Array<{ category: string; label: string; events: AppEventCard[] }>;
  free: AppEventCard[];
  /** Alle Kategorien der nächsten 14 Tage, absteigend nach Anzahl. */
  categoryCounts: Array<{ category: string; label: string; count: number }>;
}

export interface AppDiscoverInput {
  plan: ShelfPlan;
  /** Wiener Kalendertag, für den der Plan gerechnet wurde. */
  today: string;
  /** Details zu den Punkten des Plans, Schlüssel = Kurz-ID des Punkts. */
  details: Map<string, Partial<Event>>;
  /** Alle Punkte des Snapshots (nur für die Zahl je Region). */
  allEvents: Pick<Event, 'bundesland'>[];
}

/** Punkte in gewählter Reihenfolge mit Details füllen; ohne Details kein Eintrag. */
function hydrate(list: Event[], details: Map<string, Partial<Event>>): Event[] {
  return list.flatMap(point => {
    const d = details.get(point.id);
    // Die Details tragen die volle UUID; der Punkt nur die Kurz-ID.
    return d?.title ? [{ ...point, ...d } as Event] : [];
  });
}

export function toAppDiscover(input: AppDiscoverInput, ctx: AppDiscoverContext): AppDiscover {
  const { plan, details } = input;
  const fmt = ctx.locale === 'de' ? DE_LOCALE : 'en-GB';
  const cardCtx = { ...ctx, mapboxToken: null };
  const cards = (list: Event[]) => hydrate(list, details).map(e => toAppEventCard(e, cardCtx));
  const tCat = (key: string) => ctx.t(`Categories.${key}`);

  // Wie V4EntdeckenShelves: die ersten fünf mit Bild; „Heute Abend" zeigt
  // sie nicht noch einmal.
  const picks = hydrate(plan.picksPool, details).filter(e => e.image_url).slice(0, APP_DISCOVER_PICKS);
  const pickIds = new Set(picks.map(e => e.id));

  const regionCounts = new Map<string, number>();
  for (const e of input.allEvents) {
    const id = bundeslandToId(e.bundesland);
    if (id) regionCounts.set(id, (regionCounts.get(id) ?? 0) + 1);
  }

  const day = (d: string) => shortViennaDay(d, ctx.locale);

  return {
    version: APP_DISCOVER_VERSION,
    picks: picks.map(e => toAppEventCard(e, cardCtx)),
    tonight: {
      sub: ctx.t('Discover.nEvents', { count: plan.tonightCount.toLocaleString(fmt) }),
      count: plan.tonightCount,
      day: input.today,
      events: hydrate(plan.tonight, details)
        .filter(e => !pickIds.has(e.id))
        .map(e => toAppEventCard(e, cardCtx)),
    },
    weekend: {
      sub:
        plan.weekendFrom === plan.weekendTo
          ? day(plan.weekendFrom)
          : ctx.t('Discover.dayRange', { from: day(plan.weekendFrom), to: day(plan.weekendTo) }),
      range: { from: plan.weekendFrom, to: plan.weekendTo },
      events: cards(plan.weekend),
    },
    regions: SITE_REGIONS.filter(r => r.id !== 'all').map(r => {
      const image = siteRegionImage(r.id);
      return {
        id: r.id,
        name: bundeslandDisplayName(r.id, ctx.locale),
        image: image ? absoluteUrl(image, ctx.origin) : null,
        count: regionCounts.get(r.id) ?? 0,
      };
    }),
    categories: plan.categories.map(c => ({
      category: c.category,
      label: categoryLabel(tCat, c.category),
      events: cards(c.events),
    })),
    free: cards(plan.free),
    categoryCounts: plan.categoryCounts.map(c => ({
      category: c.category,
      label: categoryLabel(tCat, c.category),
      count: c.count,
    })),
  };
}

/** IDs aller Punkte, die die Übersicht zeigt (für das Nachladen der Details). */
export function discoverPointIds(plan: ShelfPlan): string[] {
  const ids = new Set<string>();
  for (const list of [plan.picksPool, plan.tonight, plan.weekend, plan.free, ...plan.categories.map(c => c.events)]) {
    for (const e of list) ids.add(e.id);
  }
  return [...ids];
}
