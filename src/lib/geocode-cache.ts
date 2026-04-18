/**
 * Shared geocode cache backed by Supabase.
 *
 * Replaces the former SQLite `geocode_cache` table. Cache reads and writes
 * are async (network I/O) but amortised via an in-process memo Map so
 * repeated lookups within the same Node process are free.
 *
 * When Supabase credentials are missing (e.g. a unit test run with no env),
 * the cache silently no-ops — callers fall back to the live geocoder.
 *
 * Cache key conventions (stable across callers):
 *   - `"${normalized_query}||${hint}"`                — Nominatim path
 *   - `"gemini::${normalized_location}||${bundesland}"` — OpenAI path
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface GeoCacheEntry {
  latitude: number;
  longitude: number;
}

const memo = new Map<string, GeoCacheEntry | null>();
let adminClient: SupabaseClient | null = null;
let initFailed = false;

function getClient(): SupabaseClient | null {
  if (adminClient) return adminClient;
  if (initFailed) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    initFailed = true;
    return null;
  }
  adminClient = createClient(url, key, { auth: { persistSession: false } });
  return adminClient;
}

export async function getCachedGeo(cacheKey: string): Promise<GeoCacheEntry | null> {
  if (memo.has(cacheKey)) return memo.get(cacheKey) ?? null;
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('geocode_cache')
    .select('latitude, longitude')
    .eq('query', cacheKey)
    .maybeSingle();
  if (error) {
    console.warn(`[geocode-cache] read ${cacheKey}: ${error.message}`);
    memo.set(cacheKey, null);
    return null;
  }
  const entry = data ? { latitude: data.latitude as number, longitude: data.longitude as number } : null;
  memo.set(cacheKey, entry);
  return entry;
}

export async function setCachedGeo(cacheKey: string, lat: number, lng: number): Promise<void> {
  const entry: GeoCacheEntry = { latitude: lat, longitude: lng };
  memo.set(cacheKey, entry);
  const client = getClient();
  if (!client) return;
  const { error } = await client
    .from('geocode_cache')
    .upsert({ query: cacheKey, latitude: lat, longitude: lng }, { onConflict: 'query' });
  if (error) {
    console.warn(`[geocode-cache] write ${cacheKey}: ${error.message}`);
  }
}

/** Test-only helper. */
export function _resetGeoCacheMemo(): void {
  memo.clear();
}
