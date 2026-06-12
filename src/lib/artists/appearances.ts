import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ein Künstler-Auftritt: EIN Eintrag pro (gefolgter Künstler × Festival)
 * oder (Künstler × Konzert-Tag). Quelle: RPC get_artist_appearances —
 * Festival-Auftritte aus dem kuratierten Line-up (festival_artists, Wahrheit,
 * keine Falsch-Treffer), Konzerte aus präzisen Titel-Matches (dedupliziert).
 */
export interface ArtistAppearance {
  artist_name: string;
  artist_image: string | null;
  kind: 'festival' | 'concert';
  /** Festivalname (festival) bzw. Event-Titel (concert). */
  context: string;
  event_id: string | null;
  event_slug: string | null;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  bundesland: string | null;
}

/**
 * Holt die sauberen Künstler-Auftritte eines Nutzers via RPC. `svc` muss ein
 * Service-Role-Client sein (die RPC ist nur an service_role granted).
 */
export async function fetchArtistAppearances(
  svc: SupabaseClient,
  userId: string,
): Promise<ArtistAppearance[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.rpc as any)('get_artist_appearances', {
    p_user_id: userId,
  });
  if (error) {
    console.error('[appearances] rpc get_artist_appearances failed:', error);
    return [];
  }
  return (data ?? []) as ArtistAppearance[];
}
