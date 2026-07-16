/**
 * GET /api/events/details?ids=<12-hex>,<12-hex>,… — Karten-Details fürs
 * sichtbare Listen-Fenster (fn-16 Option A, User-Go 2026-07-16).
 *
 * Die Liste sortiert/filtert/zählt über den Points-Snapshot und holt hier
 * NUR die Anzeige-Felder (Titel, Bild, Ort, Slug) der gerade gerenderten
 * Karten nach: RPC get_event_details_by_short_ids = PK-Range-Lookup pro
 * ID (~0,5 ms/ID, EXPLAIN-belegt) statt 10-13-s-Cursor-Batches.
 *
 * Cachebar: die Liste fragt deterministische Chunks der Snapshot-Reihen-
 * folge an → gleiche Filter = identische ids-Strings = Edge-Cache-HITs
 * über alle Besucher hinweg (15 min, wie der Snapshot selbst).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ID_RE = /^[0-9a-f]{12}$/;

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('ids') ?? '').trim().toLowerCase();
  const ids = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (ids.length === 0 || ids.length > 48 || ids.some((s) => !ID_RE.test(s))) {
    return NextResponse.json({ error: 'ids: 1-48 Kurz-IDs (12 Hex) erwartet' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_event_details_by_short_ids', {
    short_ids: ids,
  });
  if (error) {
    console.error('[events/details] RPC failed:', error);
    return NextResponse.json({ error: 'Details derzeit nicht verfügbar' }, { status: 500 });
  }

  return NextResponse.json(
    { events: data ?? [] },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
      },
    },
  );
}
