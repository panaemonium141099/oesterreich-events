import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spotify/status
 * Returns whether the authenticated user has Spotify connected.
 * Checks spotify_tokens via service_role -- never exposes tokens to client.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service_role to query spotify_tokens (no authenticated RLS)
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ connected: false });
    }

    const serviceClient = createClient(serviceUrl, serviceKey);

    const { data, error } = await serviceClient
      .from('spotify_tokens')
      .select('id, spotify_user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Spotify status check error:', error);
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: !!data,
      spotify_user_id: data?.spotify_user_id || null,
    });
  } catch (err) {
    console.error('GET /api/spotify/status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
