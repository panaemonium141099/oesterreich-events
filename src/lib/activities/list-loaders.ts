/**
 * Server-Loader der ersten Seite von /aktivitaeten (fn-18 Task 8).
 *
 * Liefert exakt das, was /api/activities ohne Filter als Seite 1 liefern
 * wuerde — gleiche Spaltenteilmenge, gleiche Anzeige-Bedingung
 * (`visible AND NOT is_closed`), gleiche fixe Sortierung
 * `quality_score DESC, id ASC` (Ranking-Umbau 2026-08-26) und derselbe
 * Cursor (encodeActivityCursor). Nur so setzt das
 * client-seitige "Mehr laden" die serverseitig gerenderte Liste
 * ueberlappungs- und lueckenfrei fort.
 *
 * Bewusst KEIN zusaetzlicher duplicate_of-Filter: die API hat ihn auch
 * nicht (Duplikate sind per E11 visible=false), und jede Abweichung
 * zwischen Server-Render und Fortsetzungs-Fetch wuerde Karten doppeln
 * oder verschlucken.
 *
 * Liest via Service-Role die Basistabelle (wie activity-detail-loaders /
 * nearby-loaders; fn-18.1 hat den anon-SELECT revoked), gecacht per
 * unstable_cache mit derselben 1h-Frist wie die ISR-Seite.
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { encodeActivityCursor } from './cursor';
import type { ActivitySetting } from './list-query';

/** Karten-Teilmenge (Snippet-Cards — Attribution lebt auf der Detailseite). */
export interface ActivityListItem {
  id: string;
  slug: string;
  name: string;
  tags: string[] | null;
  town: string | null;
  bundesland: string;
  setting: ActivitySetting | null;
  price_hint: string | null;
  /** Roh-jsonb — nur ueber ActivityCardImage/renderableImageUrls lesen. */
  images: unknown;
  /** Ranking-Spalte — nur fuer die Cursor-Fortsetzung, nicht rendern. */
  quality_score: number;
}

export interface ActivityListPage {
  items: ActivityListItem[];
  /** Cursor fuer den naechsten /api/activities-Fetch (null == Ende). */
  nextCursor: string | null;
}

const LIST_COLUMNS =
  'id, slug, name, tags, town, bundesland, setting, price_hint, images, quality_score';

/** Lazy — kein Modul-Load-Throw, damit tsc/Tests ohne Env laufen. */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[list-loaders] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Erste Seite des sichtbaren Bestands. Fehler werfen bewusst (statt zu
 * einer leeren Liste zu degradieren): die Uebersichtsseite IST die Liste
 * — eine leere Variante duerfte nie fuer eine Stunde in den ISR-Cache
 * und damit in den Google-Index. Der fehlgeschlagene Render laesst die
 * zuletzt gecachte Seite stehen.
 */
export const loadActivityListPageCached = unstable_cache(
  async (limit: number): Promise<ActivityListPage> => {
    const { data, error } = await getServiceClient()
      .from('poi_activities')
      .select(LIST_COLUMNS)
      .eq('visible', true)
      .eq('is_closed', false)
      .order('quality_score', { ascending: false })
      .order('id', { ascending: true })
      // limit+1 wie die API: hasMore ohne count (Supabase Micro).
      .limit(limit + 1);

    if (error) {
      // BUILD-Phase: leere erste Seite statt Deploy-Abbruch — der Client
      // (ActivitiesBrowser) laedt ohnehin ueber /api/activities nach, und
      // das erste Revalidate fuellt den ISR-Cache, sobald die DB antwortet.
      // Der Befund vom 2026-08-26 (I/O-Sturm): dieser throw hat als
      // letzter verbliebener Build-Time-DB-Konsument JEDEN Vercel-Deploy
      // gekillt. Zur LAUFZEIT bleibt er absichtlich: wirft das
      // Revalidate, behaelt Next die letzte gute Seite (nie eine leere
      // Liste fuer 1 h in Cache + Google-Index).
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.error(`[list-loaders] Build-Fallback (leere Seite 1): ${error.message}`);
        return { items: [], nextCursor: null };
      }
      throw new Error(`[list-loaders] Aktivitaeten-Liste fehlgeschlagen: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as ActivityListItem[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeActivityCursor({ q: last.quality_score, id: last.id }) : null,
    };
  },
  ['activity-list-page'],
  { revalidate: 3600, tags: ['activity'] },
);
