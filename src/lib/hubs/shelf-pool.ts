/**
 * Kandidaten für die Regale der SEO-Hubs (HubShelves, 2026-10-26).
 *
 * Die Liste einer Hub-Seite sind die Top 20 nach Score über die ganze
 * Zukunft; daraus ließe sich kein „Heute Abend" bauen. Deshalb zwei
 * schmale Abfragen nach Score: die Tage bis zum Ende des kommenden
 * Wochenendes (Heute, Wochenende, Top-Picks) und die nächsten 14 Tage
 * (Kategorien, Gratis). Bei Zeitfilter-Seiten (/wien/heute) genügt eine
 * Abfrage im Fenster der Seite.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { addViennaDays, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import { applyDatePreset } from '@/components/MapV3/datePresets';
import { HORIZON_DAYS } from '@/components/Discover/v4/shelves-select';
import { SITE_COUNTRY } from '@/lib/site-country';
import { getCategorySlug } from '@/lib/landing-slugs';
import type { HubShelfLinks, HubShelvesProps } from '@/components/Hub/HubShelves';

/** Felder für Poster-Karten und kanonische Event-URLs. */
export const SHELF_FIELDS =
  'id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, district, latitude, longitude, category, image_url, price_text, price_min, price_max, event_score';

const NEAR_LIMIT = 60;
const HORIZON_LIMIT = 120;

export interface ShelfPoolScope {
  bundesland?: string | null;
  category?: string | null;
  /** Zeitfenster der Seite (Wiener Tage, `to` exklusiv); ohne: Regal-Fenster. */
  window?: { from: string; to: string } | null;
  /** Freigabe-Status wie die Liste der Seite. */
  statuses: string[];
  minQuality?: number;
}

export async function loadShelfPool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  scope: ShelfPoolScope,
  today: string = viennaToday(),
): Promise<Event[]> {
  const run = async (from: string, to: string, limit: number): Promise<Event[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from('events') as any)
      .select(SHELF_FIELDS)
      .eq('country', SITE_COUNTRY)
      .in('publish_status', scope.statuses)
      .gte('start_date', viennaDayStart(from).toISOString())
      .lt('start_date', viennaDayStart(to).toISOString());
    if (scope.bundesland) q = q.eq('bundesland', scope.bundesland);
    if (scope.category) q = q.eq('category', scope.category);
    if (scope.minQuality != null) q = q.gte('quality_score', scope.minQuality);
    const { data, error } = await q
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as Event[];
  };

  if (scope.window) return run(scope.window.from, scope.window.to, HORIZON_LIMIT);

  const weekend = applyDatePreset('wochenende', today);
  const nearTo = addViennaDays(weekend?.dateTo ?? today, 1);
  const [near, horizon] = await Promise.all([
    run(today, nearTo, NEAR_LIMIT),
    run(today, addViennaDays(today, HORIZON_DAYS + 1), HORIZON_LIMIT),
  ]);
  const seen = new Set<string>();
  return [...near, ...horizon].filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

export interface LandingShelves {
  events: Event[];
  links: HubShelfLinks;
  hide: HubShelvesProps['hide'];
}

/**
 * Welche Regale eine gefilterte Landing-Seite zeigt und wohin „Alle
 * anzeigen" führt. Die Chips stehen schon im Seitenkopf, die Regale
 * zeigen sie nicht noch einmal. Kategorie und Zeitfilter zusammen
 * (/wien/musik/heute) sind schon die engste Seite: nur die Liste.
 */
export function landingShelfConfig(
  basePath: string,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
): Omit<LandingShelves, 'events'> | null {
  if (category && timeFilter) return null;
  if (category) {
    const slug = getCategorySlug(category);
    if (!slug) return null;
    return {
      links: { tonight: `${basePath}/${slug}/heute`, weekend: `${basePath}/${slug}/wochenende` },
      hide: { categories: true, chips: true },
    };
  }
  const categoryLink = (c: string) => {
    const slug = getCategorySlug(c);
    if (!slug) return undefined;
    return timeFilter ? `${basePath}/${slug}/${timeFilter}` : `${basePath}/${slug}`;
  };
  if (timeFilter) {
    return { links: { category: categoryLink }, hide: { tonight: true, weekend: true, chips: true } };
  }
  return {
    links: { tonight: `${basePath}/heute`, weekend: `${basePath}/wochenende`, category: categoryLink },
    hide: { chips: true },
  };
}
