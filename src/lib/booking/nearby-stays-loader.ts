/**
 * fn-21: gecachter Loader für "Unterkünfte in der Nähe" (Event-Detail).
 *
 * Ruft die RPC nearby_stays() (bbox-vorgefiltert + hart limitiert, siehe
 * supabase/migrations/20260831190000_stay_pois.sql) über den cookie-freien
 * Anon-Client auf — ISR-/Static-sicher wie nearby-loaders.ts (fn-18).
 * Koordinaten werden auf 3 Nachkommastellen (~110 m) gerundet, damit der
 * unstable_cache-Key nicht pro Event-Mikroposition fragmentiert.
 */

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export interface NearbyStay {
  osm_id: number;
  name: string;
  kind: string;
  city: string | null;
  distance_km: number;
}

const STAY_LIMIT = 4;

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export const loadNearbyStaysCached = unstable_cache(
  async (lat: number, lng: number): Promise<NearbyStay[]> => {
    const { data, error } = await anonClient().rpc('nearby_stays', {
      p_lat: lat,
      p_lng: lng,
      p_limit: STAY_LIMIT,
    });
    if (error || !Array.isArray(data)) return [];
    return data as NearbyStay[];
  },
  ['nearby-stays-v1'],
  { revalidate: 86400 },
);

/** Cache-Key-freundliche Rundung — im Aufrufer anwenden. */
export function roundCoord(v: number): number {
  return Math.round(v * 1000) / 1000;
}
