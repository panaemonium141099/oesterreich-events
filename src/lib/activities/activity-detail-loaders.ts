/**
 * Server-Loader fuer die Aktivitaets-Detailseite (fn-18 Task 3).
 *
 * Liest via SERVICE-ROLE die Basistabelle poi_activities: der Resolver
 * braucht auch unsichtbare Rows (301/404-Entscheidungen), die public-
 * RLS/View exponiert aber nur visible AND NOT is_closed. Alle Reads
 * laufen ueber unstable_cache — der Supabase-JS-Client sendet intern
 * `Cache-Control: no-cache` und wuerde die ISR-Seite sonst aus dem
 * Next-Cache kippen (gleiches Muster wie event-detail-loaders.ts).
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ActivityResolverRow, ActivityResolverStore } from './resolver';
import type { PublicActivity } from './public-types';

const RESOLVER_COLUMNS = 'id, slug, visible, is_closed, duplicate_of';

/** Detail-Select: Public-View-Spalten + is_closed (Hinweis-Rendering). */
const DETAIL_COLUMNS =
  'id, slug, shortid, name, description, description_short, tags, setting, ' +
  'lat, lng, town, gemeinde_slug, bundesland, opening_times, online_bookable, ' +
  'images, guest_cards, price_hint, affiliate_product, source, is_closed, ' +
  'created_at, updated_at';

/**
 * Lazy — kein Modul-Load-Throw, damit tsc/Tests ohne Env funktionieren.
 * WIRFT bei fehlender Env: eine Fehlkonfiguration darf nicht als 404
 * durchgehen (die ISR-Seite wuerde das Ergebnis bis zu 1h cachen).
 */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[activity-detail-loaders] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * "Row fehlt" (null) vs. "Backend kaputt" (throw) strikt trennen
 * (Review-Finding R2): maybeSingle() liefert bei 0 Rows data=null OHNE
 * error — ein error ist also immer ein echter Query-/Netz-Fehler und
 * eskaliert als 500 statt als cachebares 404/noindex.
 */
async function fetchResolverRow(
  column: 'slug' | 'shortid' | 'id',
  value: string,
): Promise<ActivityResolverRow | null> {
  const { data, error } = await getServiceClient()
    .from('poi_activities')
    .select(RESOLVER_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (error) {
    throw new Error(`[activity-detail-loaders] ${column}-Lookup fehlgeschlagen: ${error.message}`);
  }
  return (data as ActivityResolverRow | null) ?? null;
}

const getResolverRowBySlug = unstable_cache(
  (slug: string) => fetchResolverRow('slug', slug),
  ['activity-resolver-slug'],
  { revalidate: 3600, tags: ['activity'] },
);

const getResolverRowByShortId = unstable_cache(
  (shortid: string) => fetchResolverRow('shortid', shortid),
  ['activity-resolver-shortid'],
  { revalidate: 3600, tags: ['activity'] },
);

const getResolverRowById = unstable_cache(
  (id: string) => fetchResolverRow('id', id),
  ['activity-resolver-id'],
  { revalidate: 3600, tags: ['activity'] },
);

/** Store-Adapter fuer resolveActivitySlug() (resolver.ts, pur/getestet). */
export const activityResolverStore: ActivityResolverStore = {
  getBySlug: getResolverRowBySlug,
  getByShortId: getResolverRowByShortId,
  getById: getResolverRowById,
};

/** Volle Row fuers Rendern — nur nach 'render'-Resolution aufrufen.
 *  Gleiche Fehler-Semantik wie fetchResolverRow: error -> throw (500),
 *  nur eine wirklich fehlende Row wird zu null/404. */
export const getActivityById = unstable_cache(
  async (id: string): Promise<PublicActivity | null> => {
    const { data, error } = await getServiceClient()
      .from('poi_activities')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`[activity-detail-loaders] Detail-Lookup fehlgeschlagen: ${error.message}`);
    }
    return (data as unknown as PublicActivity | null) ?? null;
  },
  ['activity-detail'],
  { revalidate: 3600, tags: ['activity'] },
);
