import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/outreach/admin-guard';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminDb();
  if ('error' in guard) return guard.error;
  const { db } = guard;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === 'edit') {
    const { data: draft } = await db
      .from('outreach_drafts').select('id')
      .eq('prospect_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!draft) return NextResponse.json({ error: 'kein Entwurf' }, { status: 400 });
    await db.from('outreach_drafts')
      .update({ subject: String(body.subject ?? ''), body: String(body.body ?? ''), edited_by_user: true })
      .eq('id', draft.id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'skip') {
    await db.from('outreach_prospects')
      .update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'suppress') {
    const { data: p } = await db.from('outreach_prospects').select('domain, email').eq('id', id).single();
    if (p) {
      await db.from('outreach_suppression')
        .upsert({ domain: p.domain, email: p.email, reason: 'manual' }, { onConflict: 'domain' });
      await db.from('outreach_prospects')
        .update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', id);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
