import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

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
