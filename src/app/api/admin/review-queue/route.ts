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

export interface ReviewItem {
  id: string;
  type: 'dedup' | 'quality' | 'confidence';
  event_id: string;
  title: string;
  source_name: string | null;
  severity: string;
  details: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const typeFilter = searchParams.get('type'); // dedup | quality | confidence
    const severityFilter = searchParams.get('severity');
    const sourceFilter = searchParams.get('source_name');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    const items: ReviewItem[] = [];
    const counts = { dedup: 0, quality: 0, confidence: 0 };

    // ----------- Dedup uncertain pairs -----------
    if (!typeFilter || typeFilter === 'dedup') {
      const { count: dedupCount } = await supabase
        .from('event_dedup_log')
        .select('id', { count: 'exact', head: true })
        .eq('decision', 'uncertain');
      counts.dedup = dedupCount ?? 0;

      let dedupQuery = supabase
        .from('event_dedup_log')
        .select('id, event_a_id, event_b_id, overall_score, created_at')
        .eq('decision', 'uncertain')
        .order('created_at', { ascending: false });

      if (typeFilter === 'dedup') {
        dedupQuery = dedupQuery.range(offset, offset + limit - 1);
      } else {
        dedupQuery = dedupQuery.limit(limit);
      }

      const { data: dedupPairs } = await dedupQuery;

      if (dedupPairs && dedupPairs.length > 0) {
        // Fetch event titles for both sides
        const eventIds = new Set<string>();
        for (const p of dedupPairs) {
          eventIds.add(p.event_a_id);
          eventIds.add(p.event_b_id);
        }
        const { data: events } = await supabase
          .from('events')
          .select('id, title, source_name')
          .in('id', Array.from(eventIds));

        const eventMap = new Map<string, { title: string; source_name: string | null }>();
        if (events) {
          for (const e of events) {
            eventMap.set(e.id, { title: e.title, source_name: e.source_name });
          }
        }

        for (const p of dedupPairs) {
          const evA = eventMap.get(p.event_a_id);
          const evB = eventMap.get(p.event_b_id);
          const sourceName = evA?.source_name || evB?.source_name || null;

          if (sourceFilter && sourceName !== sourceFilter) continue;

          items.push({
            id: `dedup:${p.id}`,
            type: 'dedup',
            event_id: p.event_a_id,
            title: `${evA?.title || 'Unknown'} vs ${evB?.title || 'Unknown'}`,
            source_name: sourceName,
            severity: 'medium',
            details: `Similarity: ${Math.round((p.overall_score ?? 0) * 100)}%`,
            created_at: p.created_at,
          });
        }
      }
    }

    // ----------- Quality flags (unresolved) -----------
    if (!typeFilter || typeFilter === 'quality') {
      const { count: qualityCount } = await supabase
        .from('quality_flags')
        .select('id', { count: 'exact', head: true })
        .is('resolved_at', null);
      counts.quality = qualityCount ?? 0;

      let flagQuery = supabase
        .from('quality_flags')
        .select('id, event_id, flag_type, severity, details_json, created_at, events!inner(title, source_name)')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (severityFilter) {
        flagQuery = flagQuery.eq('severity', severityFilter);
      }

      if (typeFilter === 'quality') {
        flagQuery = flagQuery.range(offset, offset + limit - 1);
      } else {
        flagQuery = flagQuery.limit(limit);
      }

      const { data: flags } = await flagQuery;

      if (flags) {
        for (const f of flags) {
          const eventData = f.events as unknown as { title: string; source_name: string | null } | null;
          const sourceName = eventData?.source_name || null;

          if (sourceFilter && sourceName !== sourceFilter) continue;

          items.push({
            id: `quality:${f.id}`,
            type: 'quality',
            event_id: f.event_id,
            title: eventData?.title || 'Unknown event',
            source_name: sourceName,
            severity: f.severity || 'medium',
            details: f.flag_type?.replace(/_/g, ' ') || 'Quality flag',
            created_at: f.created_at,
          });
        }
      }
    }

    // ----------- Low-confidence events -----------
    if (!typeFilter || typeFilter === 'confidence') {
      const { count: confCount } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .in('publish_status', ['published_low_confidence', 'needs_review']);
      counts.confidence = confCount ?? 0;

      let confQuery = supabase
        .from('events')
        .select('id, title, source_name, publish_status, quality_score, created_at')
        .in('publish_status', ['published_low_confidence', 'needs_review'])
        .order('created_at', { ascending: false });

      if (sourceFilter) {
        confQuery = confQuery.eq('source_name', sourceFilter);
      }

      if (typeFilter === 'confidence') {
        confQuery = confQuery.range(offset, offset + limit - 1);
      } else {
        confQuery = confQuery.limit(limit);
      }

      const { data: lowConf } = await confQuery;

      if (lowConf) {
        for (const e of lowConf) {
          items.push({
            id: `confidence:${e.id}`,
            type: 'confidence',
            event_id: e.id,
            title: e.title || 'Unknown event',
            source_name: e.source_name || null,
            severity: e.publish_status === 'needs_review' ? 'high' : 'low',
            details: `Status: ${e.publish_status}, Score: ${e.quality_score ?? 'N/A'}`,
            created_at: e.created_at,
          });
        }
      }
    }

    // Sort all items by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply offset/limit for "all" type view
    const paged = typeFilter ? items : items.slice(offset, offset + limit);

    return NextResponse.json({
      items: paged,
      total: counts.dedup + counts.quality + counts.confidence,
      counts,
    });
  } catch (err) {
    console.error('Review queue error:', err);
    return NextResponse.json({ error: 'Failed to load review queue' }, { status: 500 });
  }
}
