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
 *    `bezirk=<a,b,c>` (Filter-Modul 2026-09-15: kommagetrennte kanonische
 *    lowercase-Bezirksnamen, Vokabular DISTRICTS_BY_BUNDESLAND; mit
 *    `bundesland` nur dessen Bezirke, sonst jeder kanonische; unbekannte
 *    Werte werden verworfen, max. 30), `tag=<Taxonomie-Tag>`
 *    (tags-Array-Containment), `setting=indoor|outdoor|mixed` (exakter
 *    Spaltenwert, Task 8), `q=<Freitext>` (ilike auf name ODER town,
 *    Muster via activitySearchPattern; town hat keinen Index — 11k Rows,
 *    Seq-Scan im ms-Bereich).
 *  - `count=1`: zusaetzlich exakte Trefferzahl `total` (Content-Range).
 *    poi_activities ist mit ~11k Rows klein — die Micro-Warnung vor
 *    count(*) gilt fuer `events` (280k), nicht hier. Ohne den Param bleibt
 *    die Antwort wie bisher ohne Count.
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
import {
  ACTIVITY_MAX_BEZIRKE,
  activitySearchPattern,
  canonicalBezirkeFor,
  splitBezirkParam,
} from '@/lib/activities/list-query';
import { isCanonicalDistrict } from '@/lib/district-normalizer';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Public-sichere Spalten (== Spaltenliste der View poi_activities_public,
 *  ohne Detail-Ballast: description/guest_cards/affiliate_product bleiben
 *  der Detailseite vorbehalten). */
const LIST_COLUMNS =
  'id, slug, name, description_short, tags, setting, lat, lng, town, ' +
  'gemeinde_slug, bundesland, opening_times, online_bookable, images, ' +
  'price_hint, updated_at, quality_score';

/**
 * `bezirk`-Param -> validierte, deduplizierte, sortierte Liste. Mit
 * Bundesland zaehlt nur dessen kanonische Bezirksliste, ohne Bundesland
 * jeder kanonische Bezirksname (Vokabular DISTRICTS_BY_BUNDESLAND).
 */
function parseBezirkParam(raw: string | null, bundesland: string | null): string[] {
  const wanted = splitBezirkParam(raw).map((b) => b.toLowerCase());
  if (wanted.length === 0) return [];
  const allowed = bundesland ? new Set(canonicalBezirkeFor(bundesland)) : null;
  const valid = wanted.filter((b) => (allowed ? allowed.has(b) : isCanonicalDistrict(b)));
  return [...new Set(valid)].sort().slice(0, ACTIVITY_MAX_BEZIRKE);
}

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

  const withCount = params.get('count') === '1';

  let query = supabase
    .from('poi_activities')
    .select(LIST_COLUMNS, withCount ? { count: 'exact' } : undefined)
    // Anzeige-Bedingung (Basistabelle via Service-Role -> beide explizit):
    .eq('visible', true)
    .eq('is_closed', false);

  const gemeinde = params.get('gemeinde');
  if (gemeinde) query = query.eq('gemeinde_slug', gemeinde);

  const bundesland = params.get('bundesland')?.toLowerCase() ?? null;
  if (bundesland) query = query.eq('bundesland', bundesland);

  const bezirke = parseBezirkParam(params.get('bezirk'), bundesland);
  if (bezirke.length > 0) query = query.in('bezirk', bezirke);

  const tag = params.get('tag');
  if (tag) query = query.contains('tags', [tag]);

  // Freitext: EIN or-Filter ueber name/town (PostgREST-Wildcard `*`).
  const pattern = activitySearchPattern(params.get('q'));
  if (pattern) query = query.or(`name.ilike.${pattern},town.ilike.${pattern}`);

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
  const { data, error, count } = await query.limit(limit + 1);

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
    withCount
      ? { activities, nextCursor, hasMore, total: typeof count === 'number' ? count : null }
      : { activities, nextCursor, hasMore },
    {
      headers: {
        // POI-Bestand aendert sich woechentlich — grosszuegig edge-cachen.
        'Cache-Control': 'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400',
      },
    },
  );
}
