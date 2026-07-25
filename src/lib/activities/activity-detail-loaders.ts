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

/** Lazy — kein Modul-Load-Throw, damit tsc/Tests ohne Env funktionieren. */
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const getResolverRowBySlug = unstable_cache(
  async (slug: string): Promise<ActivityResolverRow | null> => {
    const supabase = getServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('poi_activities')
      .select(RESOLVER_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as ActivityResolverRow;
  },
  ['activity-resolver-slug'],
  { revalidate: 3600, tags: ['activity'] },
);

const getResolverRowByShortId = unstable_cache(
  async (shortid: string): Promise<ActivityResolverRow | null> => {
    const supabase = getServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('poi_activities')
      .select(RESOLVER_COLUMNS)
      .eq('shortid', shortid)
      .maybeSingle();
    if (error || !data) return null;
    return data as ActivityResolverRow;
  },
  ['activity-resolver-shortid'],
  { revalidate: 3600, tags: ['activity'] },
);

const getResolverRowById = unstable_cache(
  async (id: string): Promise<ActivityResolverRow | null> => {
    const supabase = getServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('poi_activities')
      .select(RESOLVER_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as ActivityResolverRow;
  },
  ['activity-resolver-id'],
  { revalidate: 3600, tags: ['activity'] },
);

/** Store-Adapter fuer resolveActivitySlug() (resolver.ts, pur/getestet). */
export const activityResolverStore: ActivityResolverStore = {
  getBySlug: getResolverRowBySlug,
  getByShortId: getResolverRowByShortId,
  getById: getResolverRowById,
};

/** Volle Row fuers Rendern — nur nach 'render'-Resolution aufrufen. */
export const getActivityById = unstable_cache(
  async (id: string): Promise<PublicActivity | null> => {
    const supabase = getServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('poi_activities')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as PublicActivity;
  },
  ['activity-detail'],
  { revalidate: 3600, tags: ['activity'] },
);
