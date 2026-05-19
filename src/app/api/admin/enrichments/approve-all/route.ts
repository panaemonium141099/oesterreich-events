import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

/**
 * POST /api/admin/enrichments/approve-all
 *
 * Bulk-approves every pending proposal. For each proposal: applies the non-null
 * proposed_* fields to the events row, marks the proposal approved. Loops
 * sequentially so a single bad row only blocks itself, not the rest of the batch.
 *
 * Returns counts: { approved, failed, errors[] }. Same approve logic as the
 * per-id route — kept in sync by hand (small enough that DRY would cost more
 * than it saves).
 */
export async function POST(_request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();

    const { data: proposals, error: fetchErr } = await supabase
      .from('event_enrichment_proposals')
      .select(
        'id, event_id, proposed_category, proposed_location_name, proposed_address, ' +
          'proposed_postal_code, proposed_image_url, proposed_description, ' +
          'proposed_price_text, proposed_price_min, proposed_price_max, proposed_tags',
      )
      .eq('status', 'pending');

    if (fetchErr) {
      console.error('approve-all fetch error:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!proposals || proposals.length === 0) {
      return NextResponse.json({ approved: 0, failed: 0, errors: [] });
    }

    let approved = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const p of proposals as unknown as Array<{
      id: string;
      event_id: string;
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
    }>) {
      const updates: Record<string, unknown> = {};
      if (p.proposed_category !== null) updates.category = p.proposed_category;
      if (p.proposed_location_name !== null) updates.location_name = p.proposed_location_name;
      if (p.proposed_address !== null) updates.address = p.proposed_address;
      if (p.proposed_postal_code !== null) updates.postal_code = p.proposed_postal_code;
      if (p.proposed_image_url !== null) updates.image_url = p.proposed_image_url;
      if (p.proposed_description !== null) updates.description = p.proposed_description;
      if (p.proposed_price_text !== null) updates.price_text = p.proposed_price_text;
      if (p.proposed_price_min !== null) updates.price_min = p.proposed_price_min;
      if (p.proposed_price_max !== null) updates.price_max = p.proposed_price_max;
      if (p.proposed_tags !== null) updates.tags = p.proposed_tags;

      // Address change invalidates old town-center coords — the geocoding
      // pipeline reruns on these on its next pass.
      if ('address' in updates) {
        updates.latitude = null;
        updates.longitude = null;
        updates.geocoding_confidence = null;
        updates.geocoding_source = null;
      }

      if (Object.keys(updates).length === 0) {
        // Nothing to apply — auto-decline with reason so it disappears from queue.
        await supabase
          .from('event_enrichment_proposals')
          .update({
            status: 'declined',
            reviewed_at: new Date().toISOString(),
            decline_reason: 'auto: proposal had no values to apply',
          })
          .eq('id', p.id);
        continue;
      }

      const { error: updErr } = await supabase
        .from('events')
        .update(updates)
        .eq('id', p.event_id);
      if (updErr) {
        failed++;
        errors.push({ id: p.id, message: `event update: ${updErr.message}` });
        continue;
      }

      const { error: markErr } = await supabase
        .from('event_enrichment_proposals')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', p.id);
      if (markErr) {
        failed++;
        errors.push({ id: p.id, message: `mark approved: ${markErr.message}` });
        continue;
      }

      approved++;
    }

    return NextResponse.json({ approved, failed, errors });
  } catch (err) {
    console.error('approve-all error:', err);
    return NextResponse.json({ error: 'Failed to bulk-approve' }, { status: 500 });
  }
}
