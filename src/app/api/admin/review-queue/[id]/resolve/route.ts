import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Verify the caller is an authenticated admin/god user. */
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

type Action = 'approve' | 'suppress' | 'merge' | 'split' | 'skip';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id: rawId } = await params;
    const body = await request.json();
    const action = body.action as Action;

    if (!action || !['approve', 'suppress', 'merge', 'split', 'skip'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: approve, suppress, merge, split, skip' },
        { status: 400 }
      );
    }

    // Parse the composite ID: "type:actualId"
    const colonIdx = rawId.indexOf(':');
    if (colonIdx === -1) {
      return NextResponse.json({ error: 'Invalid review item ID format' }, { status: 400 });
    }

    const itemType = rawId.slice(0, colonIdx);
    const actualId = rawId.slice(colonIdx + 1);
    const supabase = await createServerSupabaseClient();

    // ----------- Dedup items -----------
    if (itemType === 'dedup') {
      if (action === 'merge') {
        // Fetch the dedup log entry
        const { data: logEntry } = await supabase
          .from('event_dedup_log')
          .select('*')
          .eq('id', actualId)
          .single();

        if (!logEntry) {
          return NextResponse.json({ error: 'Dedup entry not found' }, { status: 404 });
        }

        // Determine primary (higher quality_score)
        const { data: events } = await supabase
          .from('events')
          .select('id, quality_score')
          .in('id', [logEntry.event_a_id, logEntry.event_b_id]);

        if (!events || events.length < 2) {
          return NextResponse.json({ error: 'Could not find both events' }, { status: 404 });
        }

        const [evA, evB] = events[0].id === logEntry.event_a_id
          ? [events[0], events[1]]
          : [events[1], events[0]];
        const primaryId = (evA.quality_score ?? 0) >= (evB.quality_score ?? 0) ? evA.id : evB.id;
        const duplicateId = primaryId === evA.id ? evB.id : evA.id;

        await supabase
          .from('events')
          .update({ publish_status: 'duplicate', duplicate_of: primaryId, dedup_score: logEntry.overall_score })
          .eq('id', duplicateId);

        await supabase
          .from('event_dedup_log')
          .update({ decision: 'manual_merge' })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action: 'merge', primaryId, duplicateId });
      }

      if (action === 'split' || action === 'skip') {
        const newDecision = action === 'split' ? 'manual_split' : 'skipped';
        await supabase
          .from('event_dedup_log')
          .update({ decision: newDecision })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action });
      }

      return NextResponse.json({ error: `Action "${action}" not applicable to dedup items` }, { status: 400 });
    }

    // ----------- Quality flag items -----------
    if (itemType === 'quality') {
      if (action === 'approve' || action === 'skip') {
        // Resolve the flag
        await supabase
          .from('quality_flags')
          .update({ resolved_at: new Date().toISOString() })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action });
      }

      if (action === 'suppress') {
        // Get the event_id, then suppress the event and resolve the flag
        const { data: flag } = await supabase
          .from('quality_flags')
          .select('event_id')
          .eq('id', actualId)
          .single();

        if (flag) {
          await supabase
            .from('events')
            .update({ publish_status: 'suppressed' })
            .eq('id', flag.event_id);
        }

        await supabase
          .from('quality_flags')
          .update({ resolved_at: new Date().toISOString() })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action });
      }

      return NextResponse.json({ error: `Action "${action}" not applicable to quality items` }, { status: 400 });
    }

    // ----------- Confidence items -----------
    if (itemType === 'confidence') {
      if (action === 'approve') {
        await supabase
          .from('events')
          .update({ publish_status: 'published' })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action });
      }

      if (action === 'suppress') {
        await supabase
          .from('events')
          .update({ publish_status: 'suppressed' })
          .eq('id', actualId);

        return NextResponse.json({ success: true, action });
      }

      if (action === 'skip') {
        return NextResponse.json({ success: true, action: 'skip' });
      }

      return NextResponse.json({ error: `Action "${action}" not applicable to confidence items` }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unknown item type' }, { status: 400 });
  } catch (err) {
    console.error('Review resolve error:', err);
    return NextResponse.json({ error: 'Failed to resolve review item' }, { status: 500 });
  }
}
