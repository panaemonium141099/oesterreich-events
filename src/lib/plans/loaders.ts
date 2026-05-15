import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Plan, PlanWithEvents } from '@/types/plans';
import type { Event } from '@/types/events';

export async function listPlans(opts: {
  scope?: 'upcoming' | 'past';
  limit?: number;
} = {}): Promise<Plan[]> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from('plans').select('*').order('plan_date', { ascending: false });
  if (opts.scope === 'upcoming') q = q.gte('plan_date', today);
  if (opts.scope === 'past') q = q.lt('plan_date', today);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('[listPlans]', error);
    return [];
  }
  return (data ?? []) as Plan[];
}

export async function getPlan(id: string): Promise<PlanWithEvents | null> {
  const supabase = await createServerSupabaseClient();
  const { data: plan } = await supabase.from('plans').select('*').eq('id', id).single();
  if (!plan) return null;
  const { data: items } = await supabase
    .from('plan_items')
    .select('event_id, position')
    .eq('plan_id', id)
    .order('position', { ascending: true });
  const eventIds = (items ?? []).map(it => it.event_id);
  if (eventIds.length === 0) {
    return { ...plan, events: [], event_count: 0 } as PlanWithEvents;
  }
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds);
  const eventMap = new Map<string, Event>((events ?? []).map((e) => [e.id as string, e as Event]));
  const ordered = (items ?? [])
    .map(it => eventMap.get(it.event_id))
    .filter((e): e is Event => Boolean(e));
  return { ...plan, events: ordered, event_count: ordered.length } as PlanWithEvents;
}
