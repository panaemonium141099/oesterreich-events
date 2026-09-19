/**
 * GET /api/me/ads — darf der eingeloggte Besucher Anzeigen sehen?
 *
 * Gegenstueck zu src/lib/ads/ads-allowed.ts: der Client ruft die Route nur
 * auf, wenn ein sb-*-auth-token-Cookie sichtbar ist (anonyme Besucher und
 * Googlebot treffen sie nie). Antwort:
 *
 *   401                       keine gueltige Session (Client: anonym, erlaubt)
 *   200 { signedIn, adsDisabled }
 *
 * adsDisabled kommt aus profiles.ads_disabled (Admin-Schalter unter
 * /admin/users). Fehlt das Profil, gilt der Account als werbefrei: im
 * Zweifel lieber keine Anzeige als ein weiterer ungueltiger Klick.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false, adsDisabled: false }, { status: 401, headers: NO_STORE });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('ads_disabled')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[api/me/ads] profile lookup failed:', error.message);
    return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { signedIn: true, adsDisabled: !profile || profile.ads_disabled === true },
    { headers: NO_STORE },
  );
}
