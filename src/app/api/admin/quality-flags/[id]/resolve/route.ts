import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Verify the caller is an authenticated admin/god user. Returns null on success, or an error Response. */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('quality_flags')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Resolve quality flag error:', error);
      return NextResponse.json({ error: 'Fehler beim Auflösen des Quality-Flags' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Resolve quality flag error:', err);
    return NextResponse.json({ error: 'Fehler beim Auflösen des Quality-Flags' }, { status: 500 });
  }
}
