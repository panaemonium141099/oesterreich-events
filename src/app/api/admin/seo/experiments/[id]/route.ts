import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { invalidateExperimentsCache } from '@/lib/seo/experiments-server';

/**
 * Admin per-experiment ops.
 *
 *   GET    /api/admin/seo/experiments/[id]          single experiment + impression + traffic stats
 *   PATCH  /api/admin/seo/experiments/[id]          update status (pause/resume/conclude) + winner
 *   DELETE /api/admin/seo/experiments/[id]          remove experiment (rare — usually conclude it)
 *
 * The GET-with-stats is the most useful — returns impressions per variant
 * plus aggregated GSC clicks per period so the admin can eyeball a winner.
 */
export const dynamic = 'force-dynamic';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { id } = await params;

  const sb = serviceClient();
  const { data: exp, error } = await sb
    .from('seo_experiments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!exp) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Impressions per variant
  const { data: impressions } = await sb
    .from('seo_experiment_impressions')
    .select('variant')
    .eq('experiment_id', id);
  const impressionCounts = { A: 0, B: 0 };
  for (const row of impressions ?? []) {
    if (row.variant === 'A' || row.variant === 'B') {
      impressionCounts[row.variant as 'A' | 'B']++;
    }
  }

  return NextResponse.json({
    experiment: exp,
    stats: {
      impressions: impressionCounts,
      total: impressionCounts.A + impressionCounts.B,
    },
  });
}

interface PatchBody {
  status?: 'running' | 'paused' | 'concluded';
  winner?: 'A' | 'B' | null;
  notes?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Only allow whitelisted fields — never let admin UI overwrite the
  // variant payloads (those are frozen once an experiment runs).
  const update: Record<string, unknown> = {};
  if (body.status && ['running', 'paused', 'concluded'].includes(body.status)) {
    update.status = body.status;
    if (body.status === 'concluded') update.concluded_at = new Date().toISOString();
  }
  if (body.winner === 'A' || body.winner === 'B' || body.winner === null) {
    update.winner = body.winner;
  }
  if (typeof body.notes === 'string') update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
  }

  const sb = serviceClient();
  const { data, error } = await sb
    .from('seo_experiments')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateExperimentsCache();
  return NextResponse.json({ experiment: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { id } = await params;

  const sb = serviceClient();
  const { error } = await sb.from('seo_experiments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateExperimentsCache();
  return NextResponse.json({ success: true });
}
