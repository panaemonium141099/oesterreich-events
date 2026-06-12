import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/outreach/admin-guard';

interface DraftRow { id: string; subject: string; body: string; created_at: string }

export async function GET(request: NextRequest) {
  const guard = await requireAdminDb();
  if ('error' in guard) return guard.error;
  const { db } = guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const kind = searchParams.get('kind');

  let q = db
    .from('outreach_prospects')
    .select('*, outreach_drafts(id, subject, body, created_at)')
    .order('updated_at', { ascending: false })
    .limit(300);
  if (status) q = q.eq('status', status);
  if (kind) q = q.eq('kind', kind);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten: keep the newest draft per prospect.
  const prospects = (data ?? []).map((p) => {
    const drafts = ((p.outreach_drafts ?? []) as DraftRow[])
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const { outreach_drafts, ...rest } = p as Record<string, unknown>;
    void outreach_drafts;
    return { ...rest, draft: drafts[0] ?? null };
  });

  return NextResponse.json({ prospects });
}
