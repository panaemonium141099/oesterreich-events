import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cities/following
 * Listing endpoint for followed cities (server-side consumers: profile, digests).
 * Follow-Buttons use Supabase Client + RLS directly instead.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: cities, error } = await supabase
      .from('followed_cities')
      .select('city, bundesland, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List followed cities error:', error);
      return NextResponse.json(
        { error: 'Failed to list followed cities' },
        { status: 500 },
      );
    }

    return NextResponse.json({ cities: cities ?? [] });
  } catch (err) {
    console.error('GET /api/cities/following error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
