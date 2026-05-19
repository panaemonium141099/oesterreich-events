import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

/**
 * GET /api/admin/enrichments
 *
 * Lists enrichment proposals. By default returns pending only; pass
 * ?status=approved or ?status=declined for history. Joins each proposal with
 * the underlying event so the UI can render a vorher/nachher diff in one round-trip.
 */

export interface EnrichmentProposal {
  id: string;
  event_id: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  reviewed_at: string | null;
  decline_reason: string | null;
  proposed_category: string | null;
  proposed_location_name: string | null;
  proposed_address: string | null;
  proposed_postal_code: string | null;
  proposed_image_url: string | null;
  proposed_description: string | null;
  proposed_price_text: string | null;
  proposed_price_min: number | null;
  proposed_price_max: number | null;
  proposed_tags: string[] | null;
  image_source: string | null;
  agent_model: string | null;
  agent_reasoning: string | null;
  event: {
    id: string;
    title: string;
    slug: string | null;
    source_url: string | null;
    source_name: string | null;
    location_name: string | null;
    address: string | null;
    postal_code: string | null;
    bundesland: string | null;
    start_date: string;
    category: string | null;
    image_url: string | null;
    description: string | null;
    price_text: string | null;
    price_min: number | null;
    price_max: number | null;
    tags: string[] | null;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const status = (searchParams.get('status') ?? 'pending') as
      | 'pending'
      | 'approved'
      | 'declined';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

    const { data: proposalsRaw, error: pErr } = await supabase
      .from('event_enrichment_proposals')
      .select(
        'id, event_id, status, created_at, reviewed_at, decline_reason, ' +
          'proposed_category, proposed_location_name, proposed_address, proposed_postal_code, ' +
          'proposed_image_url, proposed_description, proposed_price_text, ' +
          'proposed_price_min, proposed_price_max, proposed_tags, ' +
          'image_source, agent_model, agent_reasoning',
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (pErr) {
      console.error('enrichments list error:', pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Supabase JS infers a union with GenericStringError when the column list is
    // passed as a comma-string; cast to the shape we actually selected.
    const proposals = (proposalsRaw ?? []) as unknown as Array<
      Omit<EnrichmentProposal, 'event'>
    >;

    if (proposals.length === 0) {
      return NextResponse.json({ items: [], counts: await fetchCounts(supabase) });
    }

    const eventIds = proposals.map((p) => p.event_id);
    const { data: eventsRaw } = await supabase
      .from('events')
      .select(
        'id, title, slug, source_url, source_name, location_name, address, postal_code, ' +
          'bundesland, start_date, category, image_url, description, price_text, ' +
          'price_min, price_max, tags',
      )
      .in('id', eventIds);

    const events = (eventsRaw ?? []) as unknown as Array<NonNullable<EnrichmentProposal['event']>>;
    const eventMap = new Map<string, NonNullable<EnrichmentProposal['event']>>();
    for (const e of events) eventMap.set(e.id, e);

    const items: EnrichmentProposal[] = proposals.map((p) => ({
      ...p,
      event: eventMap.get(p.event_id) ?? null,
    }));

    return NextResponse.json({ items, counts: await fetchCounts(supabase) });
  } catch (err) {
    console.error('enrichments list error:', err);
    return NextResponse.json({ error: 'Failed to load enrichments' }, { status: 500 });
  }
}

async function fetchCounts(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<{ pending: number; approved: number; declined: number }> {
  const [{ count: pending }, { count: approved }, { count: declined }] = await Promise.all([
    supabase
      .from('event_enrichment_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('event_enrichment_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('event_enrichment_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'declined'),
  ]);
  return {
    pending: pending ?? 0,
    approved: approved ?? 0,
    declined: declined ?? 0,
  };
}
