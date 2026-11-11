/**
 * Reine Auswahl der Regale auf /entdecken (Variante „Regale", 2026-10-22).
 *
 * Arbeitet auf dem Points-Snapshot (title=null, aber Tag, Kategorie,
 * Score und Gratis-Flag sind da): Welche Events kommen in welches Regal,
 * entscheidet sich hier ohne Netzwerk; die Anzeige-Felder holt die
 * Komponente danach per useDetailHydration nur für die gezeigten Karten.
 */
import type { Event } from '@/types/events';
import { addViennaDays, toViennaDate, viennaToday } from '@/lib/utils/event-time';
import { applyDatePreset } from '@/components/MapV3/datePresets';

export const PICKS_POOL = 16;
export const SHELF_SIZE = 14;
export const CATEGORY_SHELVES = 3;
/** Horizont der Kategorie- und Gratis-Regale in Tagen. */
export const HORIZON_DAYS = 14;

export interface CategoryShelf {
  category: string;
  events: Event[];
}

export interface ShelfPlan {
  /** Kandidaten für die Top-Picks (heute + morgen, höchster Score). Die
   *  Komponente nimmt daraus die ersten fünf mit Bild. */
  picksPool: Event[];
  tonight: Event[];
  /** Alle Events heute (vor dem Kappen), für den Zähler im Regalkopf. */
  tonightCount: number;
  weekend: Event[];
  weekendFrom: string;
  weekendTo: string;
  free: Event[];
  categories: CategoryShelf[];
  /** Alle Kategorien der nächsten 14 Tage, absteigend nach Anzahl. */
  categoryCounts: { category: string; count: number }[];
}

function eventDay(e: Event): string {
  return toViennaDate(new Date(e.start_date));
}

function byScore(a: Event, b: Event): number {
  const d = (b.event_score ?? 0) - (a.event_score ?? 0);
  if (d !== 0) return d;
  return a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0;
}

function isFree(e: Event): boolean {
  const t = (e.price_text ?? '').trim().toLowerCase();
  return t === 'gratis' || t === 'eintritt frei' || t === 'kostenlos' || t === 'frei' || t === 'free'
    || e.price_tier === 'gratis'
    || (e.price_min === 0 && (e.price_max == null || e.price_max === 0));
}

export function planShelves(events: Event[], today: string = viennaToday()): ShelfPlan {
  const tomorrow = addViennaDays(today, 1);
  const horizon = addViennaDays(today, HORIZON_DAYS);
  const weekend = applyDatePreset('wochenende', today) ?? { dateFrom: today, dateTo: today };
  const weekendFrom = weekend.dateFrom ?? today;
  const weekendTo = weekend.dateTo ?? weekendFrom;

  const picksPool: Event[] = [];
  const tonight: Event[] = [];
  const weekendEvents: Event[] = [];
  const free: Event[] = [];
  const perCategory = new Map<string, Event[]>();

  for (const e of events) {
    if (!e.start_date) continue;
    const day = eventDay(e);
    if (day < today) continue;
    if (day === today) tonight.push(e);
    if (day === today || day === tomorrow) picksPool.push(e);
    if (day >= weekendFrom && day <= weekendTo) weekendEvents.push(e);
    if (day > horizon) continue;
    if (isFree(e)) free.push(e);
    const cat = e.category;
    if (cat && cat !== 'Sonstiges') {
      const list = perCategory.get(cat);
      if (list) list.push(e);
      else perCategory.set(cat, [e]);
    }
  }

  const categoryCounts = [...perCategory.entries()]
    .map(([category, list]) => ({ category, count: list.length }))
    .sort((a, b) => b.count - a.count);

  const categories: CategoryShelf[] = categoryCounts
    .slice(0, CATEGORY_SHELVES)
    .map(({ category }) => ({
      category,
      events: (perCategory.get(category) ?? []).sort(byScore).slice(0, SHELF_SIZE),
    }));

  return {
    picksPool: picksPool.sort(byScore).slice(0, PICKS_POOL),
    tonightCount: tonight.length,
    tonight: tonight.sort(byScore).slice(0, SHELF_SIZE),
    weekend: weekendEvents.sort(byScore).slice(0, SHELF_SIZE),
    weekendFrom,
    weekendTo,
    free: free.sort(byScore).slice(0, SHELF_SIZE),
    categories,
    categoryCounts,
  };
}

/**
 * Sind Filter aktiv, die die Liste einschränken? Nur dann weichen die
 * Regale der reinen Liste (wie eine Suche bei Netflix die Reihen ersetzt).
 * Anzeige-Felder (topicLabel), Sortierung und Paginierung zählen nicht.
 */
const NON_NARROWING = new Set(['topicLabel', 'sort', 'limit', 'offset', 'cursor']);

export function hasNarrowing(filters: Record<string, unknown>, bundeslandIds: string[]): boolean {
  if (bundeslandIds.some((b) => b !== 'all')) return true;
  return Object.entries(filters).some(([k, v]) => {
    if (NON_NARROWING.has(k)) return false;
    if (v === undefined || v === null || v === '' || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}
