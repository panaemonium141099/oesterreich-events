import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type PlanItemStatus = 'open' | 'done' | 'skip' | 'later';
type ArrivalMode = 'auto' | 'oeffis' | 'fuss' | 'fahrrad';

const PLAN_ITEM_STATUSES: PlanItemStatus[] = ['open', 'done', 'skip', 'later'];
const ARRIVAL_MODES: ArrivalMode[] = ['auto', 'oeffis', 'fuss', 'fahrrad'];

function isStatus(v: unknown): v is PlanItemStatus {
  return typeof v === 'string' && PLAN_ITEM_STATUSES.includes(v as PlanItemStatus);
}
function isArrivalMode(v: unknown): v is ArrivalMode {
  return typeof v === 'string' && ARRIVAL_MODES.includes(v as ArrivalMode);
}

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: PatchBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};

  // Basis-Felder
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.plan_date === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.plan_date)) {
      return NextResponse.json({ error: 'plan_date YYYY-MM-DD required' }, { status: 400 });
    }
    updates.plan_date = body.plan_date;
  }
  if (body.note !== undefined) updates.note = body.note;

  // Tickets
  if (body.tickets_status !== undefined) {
    if (!isStatus(body.tickets_status)) {
      return NextResponse.json({ error: 'invalid tickets_status' }, { status: 400 });
    }
    updates.tickets_status = body.tickets_status;
  }

  // Anreise
  if (body.arrival_status !== undefined) {
    if (!isStatus(body.arrival_status)) {
      return NextResponse.json({ error: 'invalid arrival_status' }, { status: 400 });
    }
    updates.arrival_status = body.arrival_status;
  }
  if (body.arrival_mode !== undefined) {
    if (body.arrival_mode === null) {
      updates.arrival_mode = null;
    } else if (!isArrivalMode(body.arrival_mode)) {
      return NextResponse.json({ error: 'invalid arrival_mode' }, { status: 400 });
    } else {
      updates.arrival_mode = body.arrival_mode;
    }
  }
  if (body.arrival_from !== undefined) {
    updates.arrival_from = body.arrival_from === null ? null : String(body.arrival_from).trim() || null;
  }

  // Unterkunft
  if (body.accommodation_status !== undefined) {
    if (!isStatus(body.accommodation_status)) {
      return NextResponse.json({ error: 'invalid accommodation_status' }, { status: 400 });
    }
    updates.accommodation_status = body.accommodation_status;
  }
  if (body.accommodation_city !== undefined) {
    updates.accommodation_city = body.accommodation_city === null ? null : String(body.accommodation_city).trim() || null;
  }

  // Reminder
  if (typeof body.reminder_7d === 'boolean') updates.reminder_7d = body.reminder_7d;
  if (typeof body.reminder_1d === 'boolean') updates.reminder_1d = body.reminder_1d;
  if (typeof body.reminder_3h === 'boolean') updates.reminder_3h = body.reminder_3h;

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
