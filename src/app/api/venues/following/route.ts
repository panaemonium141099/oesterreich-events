import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/venues/following
 * Listing endpoint for followed venues (server-side consumers: profile, digests).
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

    const { data: follows, error } = await supabase
      .from('followed_venues')
      .select(
        `
        venue_id,
        created_at,
        venues (
          name,
          city,
          bundesland
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List followed venues error:', error);
      return NextResponse.json(
        { error: 'Failed to list followed venues' },
        { status: 500 },
      );
    }

    const venues = (follows ?? []).map((f) => {
      const venue = f.venues as unknown as {
        name: string;
        city: string | null;
        bundesland: string | null;
      } | null;
      return {
        venue_id: f.venue_id,
        name: venue?.name ?? null,
        city: venue?.city ?? null,
        bundesland: venue?.bundesland ?? null,
        created_at: f.created_at,
      };
    });

    return NextResponse.json({ venues });
  } catch (err) {
    console.error('GET /api/venues/following error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
