import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { fetchArtistAppearances } from '@/lib/artists/appearances';

export const dynamic = 'force-dynamic';

/**
 * GET /api/artists/events
 * Liefert die sauberen Künstler-Auftritte des eingeloggten Nutzers (RPC
 * get_artist_appearances): 1 Eintrag pro (Künstler × Festival) bzw.
 * (Künstler × Konzert-Tag), dedupliziert, ohne Falsch-Treffer, nach Datum.
 */
export async function GET() {
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count: followedCount } = await auth
      .from('followed_artists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!followedCount || followedCount === 0) {
      return NextResponse.json({ appearances: [], has_followed_artists: false });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role missing' }, { status: 500 });
    }
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const appearances = await fetchArtistAppearances(svc, user.id);

    return NextResponse.json({ appearances, has_followed_artists: true });
  } catch (err) {
    console.error('GET /api/artists/events error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
