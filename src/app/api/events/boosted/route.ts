/**
 * GET /api/events/boosted
 *
 * Liefert nur die IDs der aktuell *effektiv* geboosteten Events
 * (is_boosted = true UND boost_until ist NULL oder noch in der Zukunft).
 *
 * Warum ein eigener Endpoint? Der große /api/events-Payload ist aus
 * Performance-Gründen 2 h edge-gecacht. Würde die Karte den Boost-Status
 * von dort lesen, bliebe ein beendeter Boost bis zu 2 h sichtbar. Dieser
 * Mini-Endpoint ist winzig und nur wenige Sekunden gecacht, sodass die
 * Karte den Boost-Status quasi in Echtzeit kennt — unabhängig vom großen
 * Cache.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('events')
    .select('id, boost_until')
    .eq('is_boosted', true)
    .limit(500);

  if (error) {
    console.error('[api/events/boosted] query failed:', error);
    return NextResponse.json({ ids: [] }, { status: 500 });
  }

  // Ablauf-Check in JS (bulletproof, winziger Payload): boost_until NULL =
  // unbegrenzt, sonst muss es noch in der Zukunft liegen. Fängt abgelaufene
  // Boosts ab, bevor der tägliche Cron sie auf is_boosted=false setzt.
  const now = Date.now();
  const ids = (data ?? [])
    .filter((r) => r.boost_until == null || new Date(r.boost_until).getTime() >= now)
    .map((r) => r.id);

  const res = NextResponse.json({ ids });
  // Kurzer Edge-Cache: reflektiert Boost-Änderungen in ~5 s, dedupliziert
  // aber Bursts auf der stark frequentierten Karte.
  res.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=20');
  return res;
}
