import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

const ALLOWED_PUBLISH_STATUSES = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const { publish_status } = body;

    if (!publish_status || !ALLOWED_PUBLISH_STATUSES.includes(publish_status)) {
      return NextResponse.json(
        { error: `Ungültiger publish_status. Erlaubt: ${ALLOWED_PUBLISH_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('events')
      .update({ publish_status })
      .eq('id', id);

    if (error) {
      console.error('Update publish status error:', error);
      return NextResponse.json({ error: 'Fehler beim Aktualisieren des Publish-Status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, publish_status });
  } catch (err) {
    console.error('Publish status error:', err);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Publish-Status' }, { status: 500 });
  }
}
