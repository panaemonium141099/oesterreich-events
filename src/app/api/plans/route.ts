import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type PlanItemStatus = 'open' | 'done' | 'skip' | 'later';
type ArrivalMode = 'auto' | 'oeffis' | 'fuss' | 'fahrrad';

const PLAN_ITEM_STATUSES: PlanItemStatus[] = ['open', 'done', 'skip', 'later'];
const ARRIVAL_MODES: ArrivalMode[] = ['auto', 'oeffis', 'fuss', 'fahrrad'];

interface CreatePlanBody {
  name?: string;
  plan_date?: string;
  note?: string | null;
  event_ids?: string[];
  tickets_status?: PlanItemStatus;
  arrival_status?: PlanItemStatus;
  arrival_mode?: ArrivalMode | null;
  arrival_from?: string | null;
  accommodation_status?: PlanItemStatus;
  accommodation_city?: string | null;
  reminder_7d?: boolean;
  reminder_1d?: boolean;
  reminder_3h?: boolean;
}

function pickStatus(v: unknown, fallback: PlanItemStatus = 'open'): PlanItemStatus {
  return typeof v === 'string' && PLAN_ITEM_STATUSES.includes(v as PlanItemStatus)
    ? (v as PlanItemStatus) : fallback;
}

function pickArrivalMode(v: unknown): ArrivalMode | null {
  if (v === null) return null;
  return typeof v === 'string' && ARRIVAL_MODES.includes(v as ArrivalMode)
    ? (v as ArrivalMode) : null;
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
    .insert({
      user_id: user.id,
      name,
      plan_date: planDate,
      note: body.note ?? null,
      tickets_status: pickStatus(body.tickets_status),
      arrival_status: pickStatus(body.arrival_status),
      arrival_mode: pickArrivalMode(body.arrival_mode),
      arrival_from: body.arrival_from ?? null,
      accommodation_status: pickStatus(body.accommodation_status),
      accommodation_city: body.accommodation_city ?? null,
      reminder_7d: body.reminder_7d ?? true,
      reminder_1d: body.reminder_1d ?? true,
      reminder_3h: body.reminder_3h ?? true,
    })
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
