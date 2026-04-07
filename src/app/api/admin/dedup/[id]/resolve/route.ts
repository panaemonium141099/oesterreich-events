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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const { decision } = body as { decision: 'manual_merge' | 'manual_split' };

    if (!decision || !['manual_merge', 'manual_split'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "manual_merge" or "manual_split".' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Fetch the dedup log entry
    const { data: logEntry, error: logError } = await supabase
      .from('event_dedup_log')
      .select('*')
      .eq('id', id)
      .single();

    if (logError || !logEntry) {
      return NextResponse.json({ error: 'Dedup log entry not found' }, { status: 404 });
    }

    const eventAId = logEntry.event_a_id;
    const eventBId = logEntry.event_b_id;

    if (decision === 'manual_merge') {
      // Determine which event is primary (higher quality_score wins)
      const { data: events } = await supabase
        .from('events')
        .select('id,quality_score,created_at')
        .in('id', [eventAId, eventBId]);

      if (!events || events.length < 2) {
        return NextResponse.json({ error: 'Could not find both events' }, { status: 404 });
      }

      const [evA, evB] = events[0].id === eventAId ? [events[0], events[1]] : [events[1], events[0]];
      const primaryId = (evA.quality_score ?? 0) >= (evB.quality_score ?? 0) ? evA.id : evB.id;
      const duplicateId = primaryId === evA.id ? evB.id : evA.id;

      // Mark duplicate
      const { error: dupError } = await supabase
        .from('events')
        .update({
          publish_status: 'duplicate',
          duplicate_of: primaryId,
          dedup_score: logEntry.overall_score,
        })
        .eq('id', duplicateId);

      if (dupError) {
        console.error('Manual merge update error:', dupError);
        return NextResponse.json({ error: 'Failed to merge events' }, { status: 500 });
      }

      // Update log entry decision
      const { error: logUpdateError } = await supabase
        .from('event_dedup_log')
        .update({ decision: 'manual_merge' })
        .eq('id', id);

      if (logUpdateError) {
        console.error('Dedup log update error:', logUpdateError);
      }

      return NextResponse.json({ success: true, primaryId, duplicateId });
    }

    if (decision === 'manual_split') {
      // Clear any duplicate linkage between the two events
      const { error: clearAError } = await supabase
        .from('events')
        .update({
          duplicate_of: null,
          dedup_score: null,
        })
        .eq('id', eventAId)
        .eq('duplicate_of', eventBId);

      if (clearAError) {
        console.error('Clear A error:', clearAError);
      }

      const { error: clearBError } = await supabase
        .from('events')
        .update({
          duplicate_of: null,
          dedup_score: null,
        })
        .eq('id', eventBId)
        .eq('duplicate_of', eventAId);

      if (clearBError) {
        console.error('Clear B error:', clearBError);
      }

      // Restore publish_status based on quality_score for any event that was marked duplicate
      for (const eid of [eventAId, eventBId]) {
        const { data: ev } = await supabase
          .from('events')
          .select('id,quality_score,publish_status')
          .eq('id', eid)
          .single();

        if (ev && ev.publish_status === 'duplicate') {
          const qs = ev.quality_score ?? 0;
          const newStatus = qs >= 40 ? 'published' : qs >= 20 ? 'published_low_confidence' : 'needs_review';
          await supabase
            .from('events')
            .update({ publish_status: newStatus, duplicate_of: null, dedup_score: null })
            .eq('id', eid);
        }
      }

      // Update log entry decision
      const { error: logUpdateError } = await supabase
        .from('event_dedup_log')
        .update({ decision: 'manual_split' })
        .eq('id', id);

      if (logUpdateError) {
        console.error('Dedup log update error:', logUpdateError);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  } catch (err) {
    console.error('Dedup resolve error:', err);
    return NextResponse.json({ error: 'Failed to resolve dedup entry' }, { status: 500 });
  }
}
