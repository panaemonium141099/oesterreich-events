import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface CreatePlanBody {
  name?: string;
  plan_date?: string;     // ISO date YYYY-MM-DD
  note?: string | null;
  event_ids?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: CreatePlanBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const name = (body.name || '').trim();
  const planDate = (body.plan_date || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!planDate || !/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
    return NextResponse.json({ error: 'plan_date YYYY-MM-DD required' }, { status: 400 });
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .insert({ user_id: user.id, name, plan_date: planDate, note: body.note ?? null })
    .select()
    .single();
  if (planErr || !plan) {
    return NextResponse.json({ error: planErr?.message ?? 'create failed' }, { status: 500 });
  }

  const eventIds = (body.event_ids ?? []).filter(Boolean);
  if (eventIds.length > 0) {
    const items = eventIds.map((event_id, i) => ({ plan_id: plan.id, event_id, position: i }));
    const { error: itemsErr } = await supabase.from('plan_items').insert(items);
    if (itemsErr && process.env.NODE_ENV === 'development') {
      console.error('[POST /api/plans] plan_items insert:', itemsErr);
    }
  }

  return NextResponse.json({ plan }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const scope = req.nextUrl.searchParams.get('scope');
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from('plans').select('*').order('plan_date', { ascending: false });
  if (scope === 'upcoming') q = q.gte('plan_date', today);
  if (scope === 'past') q = q.lt('plan_date', today);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}
