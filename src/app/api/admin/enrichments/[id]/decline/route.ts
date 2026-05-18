import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

/**
 * POST /api/admin/enrichments/[id]/decline
 *
 * Marks the proposal as declined. Optional body: { reason?: string }.
 * The event is NOT modified.
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

    let reason: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.reason === 'string') reason = body.reason.slice(0, 500);
    } catch {
      // empty body is fine
    }

    const { data: proposal, error: pErr } = await supabase
      .from('event_enrichment_proposals')
      .select('status')
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

    const { error: updErr } = await supabase
      .from('event_enrichment_proposals')
      .update({
        status: 'declined',
        reviewed_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('id', id);

    if (updErr) {
      console.error('enrichment decline error:', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('enrichment decline error:', err);
    return NextResponse.json({ error: 'Failed to decline proposal' }, { status: 500 });
  }
}
