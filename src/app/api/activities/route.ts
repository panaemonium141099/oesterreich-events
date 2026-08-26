/**
 * /api/activities — cursor-paginierte Freizeitaktivitaeten (fn-18 Task 3).
 *
 * Wire-Contract (Task-Spec, eingefroren):
 *  - Default-Sortierung fix: `quality_score DESC, id ASC` (Ranking-Umbau
 *    2026-08-26 — vorberechneter Content-/Saison-Score mit taeglichem
 *    Rotations-Jitter statt Alphabet; Migration
 *    20260826180000_activities_quality_score.sql).
 *  - Cursor: base64url-JSON `{"q":<int>,"id":"<uuid>"}`
 *    (src/lib/activities/cursor.ts); Lookup-Regel
 *    `quality_score < $q OR (quality_score = $q AND id > $i)`.
 *  - Filter: `gemeinde=<kanonischer gemeinde_slug, z.B. 7100-neusiedl-am-see>`
 *    (Spalte gemeinde_slug), `bundesland=<kanonische lowercase-ID>`,
 *    `tag=<Taxonomie-Tag>` (tags-Array-Containment),
 *    `setting=indoor|outdoor|mixed` (exakter Spaltenwert, Task 8).
 *  - Liest via Service-Role die Basistabelle -> visible=true UND
 *    is_closed=false werden EXPLIZIT gefiltert (Anzeige-Bedingung ist
 *    ueberall `visible AND NOT is_closed`; die Public-View haette den
 *    Filter eingebaut, die Basistabelle nicht).
 *  - KEIN count (weder exact noch planned noetig — Supabase Micro!);
 *    hasMore kommt aus limit+1-Fetch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildActivityCursorFilter,
  decodeActivityCursor,
  encodeActivityCursor,
} from '@/lib/activities/cursor';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Public-sichere Spalten (== Spaltenliste der View poi_activities_public,
 *  ohne Detail-Ballast: description/guest_cards/affiliate_product bleiben
 *  der Detailseite vorbehalten). */
const LIST_COLUMNS =
  'id, slug, name, description_short, tags, setting, lat, lng, town, ' +
  'gemeinde_slug, bundesland, opening_times, online_bookable, images, ' +
  'price_hint, updated_at, quality_score';

/** Lazy Supabase client — validates env vars at call time. */
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Service nicht konfiguriert' }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;

  const rawLimit = Number.parseInt(params.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const rawCursor = params.get('cursor');
  const cursor = rawCursor != null ? decodeActivityCursor(rawCursor) : null;
  if (rawCursor != null && !cursor) {
    return NextResponse.json({ error: 'Ungültiger Cursor' }, { status: 400 });
  }

  let query = supabase
    .from('poi_activities')
    .select(LIST_COLUMNS)
    // Anzeige-Bedingung (Basistabelle via Service-Role -> beide explizit):
    .eq('visible', true)
    .eq('is_closed', false);

  const gemeinde = params.get('gemeinde');
  if (gemeinde) query = query.eq('gemeinde_slug', gemeinde);

  const bundesland = params.get('bundesland');
  if (bundesland) query = query.eq('bundesland', bundesland.toLowerCase());

  const tag = params.get('tag');
  if (tag) query = query.contains('tags', [tag]);

  // `setting` (Task 8): EXAKTER Spaltenwert — 'mixed' ist ein eigener
  // Wert und wird von 'indoor'/'outdoor' NICHT mitgefiltert.
  const setting = params.get('setting');
  if (setting === 'indoor' || setting === 'outdoor' || setting === 'mixed') {
    query = query.eq('setting', setting);
  }

  if (cursor) {
    query = query.or(buildActivityCursorFilter(cursor));
  }

  // Fixe deterministische Sortierung: quality_score DESC, id ASC.
  query = query.order('quality_score', { ascending: false }).order('id', { ascending: true });

  // limit+1, um hasMore ohne count zu bestimmen.
  const { data, error } = await query.limit(limit + 1);

  if (error) {
    console.error('[api/activities] query failed:', error.message);
    return NextResponse.json({ error: 'Fehler beim Laden der Aktivitäten' }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Array<{ id: string; quality_score: number }>;
  const hasMore = rows.length > limit;
  const activities = hasMore ? rows.slice(0, limit) : rows;
  const last = activities[activities.length - 1];
  const nextCursor =
    hasMore && last ? encodeActivityCursor({ q: last.quality_score, id: last.id }) : null;

  return NextResponse.json(
    { activities, nextCursor, hasMore },
    {
      headers: {
        // POI-Bestand aendert sich woechentlich — grosszuegig edge-cachen.
        'Cache-Control': 'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400',
      },
    },
  );
}
