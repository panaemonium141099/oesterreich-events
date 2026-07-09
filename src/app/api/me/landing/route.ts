/**
 * GET /api/me/landing — Personalisierung für die statische Landing (§10.2).
 *
 * Die Landing (`/`) rendert seit dem Umbau für ALLE Besucher identisch aus
 * dem ISR-Cache (kein cookies()/auth im RSC-Pfad mehr). Eingeloggte Clients
 * holen sich hier nach dem First Paint ihre Personalisierung:
 *
 *   - matches: die nächsten Auftritte gefolgter Künstler (max 8, gleiche
 *     RPC wie früher im Server-Render)
 *   - savedEventIds / artistMatchEventIds / lineupMatchEventIds: für
 *     künftige Client-Badge-Hydration der Event-Karten
 *
 * Anonyme Aufrufer bekommen sofort { signedIn: false, ... } — der Client
 * ruft die Route aber ohnehin nur auf, wenn ein sb-*-auth-token-Cookie
 * sichtbar ist (siehe PersonalizedMatches), Googlebot & Co. treffen sie nie.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLandingContext } from '@/lib/v4/get-landing-context';
import { fetchArtistAppearances, type ArtistAppearance } from '@/lib/artists/appearances';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getLandingContext();

  if (!ctx.signedIn || !ctx.userId) {
    return NextResponse.json(
      { signedIn: false, matches: [], savedEventIds: [], artistMatchEventIds: [], lineupMatchEventIds: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // Künstler-Auftritte via RPC get_artist_appearances (nur an service_role
  // granted) — identische Quelle wie der frühere Server-Render.
  let matches: ArtistAppearance[] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      );
      matches = (await fetchArtistAppearances(admin, ctx.userId)).slice(0, 8);
    } catch (e) {
      console.error('[api/me/landing] appearances failed:', e);
    }
  }

  return NextResponse.json(
    {
      signedIn: true,
      matches,
      savedEventIds: [...ctx.savedEventIds],
      artistMatchEventIds: [...ctx.artistMatchEventIds],
      lineupMatchEventIds: [...ctx.lineupMatchEventIds],
    },
    // privat cachen: 60s reicht — die Daten ändern sich nur durch eigene
    // Aktionen (folgen/merken), und die Seite lädt bei Navigation ohnehin neu.
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
