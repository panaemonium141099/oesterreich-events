import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * fn-16 Slice 1: kompletter Points-Snapshot aller publizierbaren Future-AT-
 * Events in EINEM Response — ersetzt fuer /map die ~30 sequenziellen
 * limit=3000-Batches (je 10-13 s DB-Zeit, ~45 MB gesamt).
 *
 * Datenquelle: RPC get_event_map_points() liest die schmale MV
 * event_map_points (15-min-pg_cron-Refresh) und liefert columnar-kodiertes
 * jsonb (~5-6 MB raw, ~1,5-2 MB brotli am CDN). Payload-Format siehe
 * Migration 20260705_event_map_points.sql bzw. Spec fn-16.
 *
 * Anon-Key bewusst (statt service_role): nur oeffentliche Daten, und das
 * 8s-Statement-Timeout der anon-Role ist fuer den MV-Scan irrelevant.
 */
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable', code: 'ENV_MISSING' },
      { status: 503 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_event_map_points');

    if (error) {
      console.error('get_event_map_points RPC error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Karten-Daten' },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? { v: 1, n: 0 }, {
      headers: {
        // 15 min frisch am CDN (= MV-Refresh-Takt), 24 h stale-while-revalidate
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('API Error (events/map-points):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Karten-Daten' },
      { status: 500 }
    );
  }
}
