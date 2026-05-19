import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

/**
 * POST /api/admin/enrichments/[id]/approve
 *
 * Applies the proposal's non-null fields to the events row, then marks the
 * proposal approved. Fields where the agent did not produce a value (NULL in
 * the proposal) are NOT touched on the event — so a half-filled proposal
 * partially enriches the event without nulling out existing data.
 *
 * Optional body: { override?: Partial<Proposal> } — the UI can let the admin
 * tweak the proposed values before approving. Anything in `override` wins.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    let override: Record<string, unknown> = {};
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && body.override) override = body.override;
    } catch {
      // empty body is fine
    }

    const { data: proposal, error: pErr } = await supabase
      .from('event_enrichment_proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json(
        { error: `Proposal already ${proposal.status}` },
        { status: 400 },
      );
    }

    // Build the event update payload — only non-null proposed fields.
    const updates: Record<string, unknown> = {};
    const setIf = (eventCol: string, proposedCol: string) => {
      const val =
        proposedCol in override ? override[proposedCol] : proposal[proposedCol];
      if (val !== null && val !== undefined) updates[eventCol] = val;
    };
    setIf('category', 'proposed_category');
    setIf('location_name', 'proposed_location_name');
    setIf('address', 'proposed_address');
    setIf('postal_code', 'proposed_postal_code');
    setIf('image_url', 'proposed_image_url');
    setIf('description', 'proposed_description');
    setIf('price_text', 'proposed_price_text');
    setIf('price_min', 'proposed_price_min');
    setIf('price_max', 'proposed_price_max');
    setIf('tags', 'proposed_tags');

    // When the address changes, the previous lat/lng/geocoding_confidence are
    // stale — they probably point at a town-center fallback. Clear them so the
    // existing geocoding pipeline (openai-geocode / location-normalizer) picks
    // this event up on its next run and computes accurate coords from the new
    // address text. We never let the LLM guess coords directly.
    if ('address' in updates) {
      updates.latitude = null;
      updates.longitude = null;
      updates.geocoding_confidence = null;
      updates.geocoding_source = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Proposal has no proposed values to apply' },
        { status: 400 },
      );
    }

    const { error: updErr } = await supabase
      .from('events')
      .update(updates)
      .eq('id', proposal.event_id);

    if (updErr) {
      console.error('enrichment approve — event update failed:', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { error: markErr } = await supabase
      .from('event_enrichment_proposals')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (markErr) {
      console.error('enrichment approve — proposal mark failed:', markErr);
      return NextResponse.json({ error: markErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, applied: Object.keys(updates) });
  } catch (err) {
    console.error('enrichment approve error:', err);
    return NextResponse.json({ error: 'Failed to approve proposal' }, { status: 500 });
  }
}
