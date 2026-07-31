/**
 * /api/activities/[id]/booking — Affiliate-Angebot einer Aktivitaet
 * (fn-18 Task 5).
 *
 * WARUM ES DIESE ROUTE UEBERHAUPT GIBT (Viator-ToS, Auflage 1):
 * "Sie duerfen keine Viator-spezifischen Inhalte indexieren." Produkt-
 * titel, Teaser, Bild und Preis duerfen deshalb NICHT im serverseitig
 * gerenderten HTML der ISR-Aktivitaetsseite stehen — Google wuerde sie
 * sonst indexieren. Die BookingBox ist darum eine Client-Komponente, die
 * ihre Daten erst im Browser hier abholt. Diese Route traegt
 * `X-Robots-Tag: noindex, nofollow`; zusaetzlich ist `/api/` in
 * src/app/robots.ts fuer ALLE User-Agents (inkl. der namentlich
 * gelisteten AI-Crawler) disallowed.
 *
 * Vertrag:
 *   GET /api/activities/<uuid>/booking
 *   200 {"product": {...} | null}   — IMMER 200, auch ohne Angebot.
 *   400 bei ungueltiger UUID.
 * Fehlt VIATOR_API_KEY (Vercel-Env!), wird nichts ausgeliefert — die Box
 * bleibt leer statt zu raten.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseAffiliateProduct } from '@/lib/affiliate/viator-types';
import { isViatorConfigured } from '@/lib/affiliate/viator-client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nicht indexierbar + kurz cachebar (Preise sind kurzlebig). */
const HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  // s-maxage kurz halten: Preise werden taeglich refresht und duerfen
  // nicht tagelang am Edge festkleben.
  'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
} as const;

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function empty(): NextResponse {
  return NextResponse.json({ product: null }, { headers: HEADERS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID_RE.test(id ?? '')) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400, headers: HEADERS });
  }

  if (!isViatorConfigured()) {
    // Kein Key -> keine Viator-Auslieferung. Der Key liegt in GitHub-
    // Actions-Secrets UND Vercel-Env (getrennte Stores, CLAUDE.md
    // "Deployment") — fehlt er in Vercel, bleibt die Box dauerhaft leer.
    console.warn('[api/activities/booking] VIATOR_API_KEY fehlt — Angebot wird nicht ausgeliefert');
    return empty();
  }

  const supabase = getSupabaseClient();
  if (!supabase) return empty();

  const { data, error } = await supabase
    .from('poi_activities')
    .select('affiliate_product, visible, is_closed')
    // Anzeige-Bedingung ist ueberall `visible AND NOT is_closed` —
    // geschlossene POIs bekommen NIE eine Buchungs-Box.
    .eq('id', id)
    .eq('visible', true)
    .eq('is_closed', false)
    .maybeSingle();

  if (error) {
    console.error('[api/activities/booking] query failed:', error.message);
    return empty();
  }

  const product = parseAffiliateProduct((data as { affiliate_product?: unknown } | null)?.affiliate_product);
  return NextResponse.json({ product }, { headers: HEADERS });
}
