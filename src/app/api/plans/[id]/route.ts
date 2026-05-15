import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: plan } = await supabase.from('plans').select('*').eq('id', id).single();
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: items } = await supabase
    .from('plan_items')
    .select('event_id, position')
    .eq('plan_id', id)
    .order('position');
  return NextResponse.json({ plan, items: items ?? [] });
}

interface PatchBody {
  name?: string;
  plan_date?: string;
  note?: string | null;
  event_ids?: string[];
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: PatchBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.plan_date === 'string') updates.plan_date = body.plan_date;
  if (body.note !== undefined) updates.note = body.note;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('plans').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.event_ids)) {
    // Replace all items: delete + reinsert
    await supabase.from('plan_items').delete().eq('plan_id', id);
    if (body.event_ids.length > 0) {
      const items = body.event_ids.map((event_id, i) => ({ plan_id: id, event_id, position: i }));
      await supabase.from('plan_items').insert(items);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
