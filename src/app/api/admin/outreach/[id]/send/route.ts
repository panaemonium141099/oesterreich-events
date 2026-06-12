import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/outreach/admin-guard';
import { sendGenericEmail } from '@/lib/email';

function toHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminDb();
  if ('error' in guard) return guard.error;
  const { db, userId } = guard;
  const { id } = await params;

  const { data: p } = await db
    .from('outreach_prospects').select('id, domain, email, status').eq('id', id).single();
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!p.email) return NextResponse.json({ error: 'Kein Kontakt (E-Mail) vorhanden' }, { status: 400 });

  // Suppression guard — never send to a suppressed domain.
  const { data: sup } = await db
    .from('outreach_suppression').select('domain').eq('domain', p.domain).maybeSingle();
  if (sup) return NextResponse.json({ error: 'Domain ist gesperrt (Suppression)' }, { status: 400 });

  const { data: draft } = await db
    .from('outreach_drafts').select('id, subject, body')
    .eq('prospect_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!draft) return NextResponse.json({ error: 'Kein Entwurf vorhanden' }, { status: 400 });

  const result = await sendGenericEmail(p.email, draft.subject, toHtml(draft.body));

  await db.from('outreach_sends').insert({
    prospect_id: id, draft_id: draft.id, to_email: p.email, subject: draft.subject,
    sent_by: userId, resend_id: result.id ?? null, status: result.success ? 'sent' : 'failed',
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Versand fehlgeschlagen' }, { status: 502 });
  }
  await db.from('outreach_prospects')
    .update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ ok: true });
}
