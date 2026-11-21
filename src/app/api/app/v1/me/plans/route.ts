/**
 * GET /api/app/v1/me/plans — Pläne des angemeldeten Nutzers für die native
 * App: Kennzahlen, anstehende und vergangene Pläne als Karten.
 *
 * Gelesen wird im Namen des Nutzers (RLS), wie `/api/plans`; die Umrechnung
 * steht in `src/lib/app-api/plans.ts`. Die App weist sich mit
 * `Authorization: Bearer <Zugangstoken>` aus. Angelegt, geändert und
 * gelöscht wird weiter über `/api/plans`.
 */
import { NextResponse } from 'next/server';
import { toAppPlanList, type AppPlanMeta } from '@/lib/app-api/plans';
import { SITE_COUNTRY } from '@/lib/site-country';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Plan } from '@/types/plans';

export const dynamic = 'force-dynamic';

/** PostgREST trägt `.in()` in der Adresse: Listen in Stücken. */
const IN_CHUNK = 100;

type PlanEventRow = { title: string | null; start_date: string | null };

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bitte melde dich an.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('plan_date', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[app-api] me/plans:', error.message);
    return NextResponse.json({ error: 'Deine Pläne sind gerade nicht verfügbar.' }, { status: 503 });
  }
  const plans = (data ?? []) as Plan[];

  // Je Plan: Zahl der Events und Titel des ersten (nur Events des Landes der Seite).
  const meta: AppPlanMeta = {};
  for (let i = 0; i < plans.length; i += IN_CHUNK) {
    const ids = plans.slice(i, i + IN_CHUNK).map(p => p.id);
    const { data: items, error: itemsError } = await supabase
      .from('plan_items')
      .select('plan_id, position, event:events!inner(title, country, start_date)')
      .in('plan_id', ids)
      .eq('event.country', SITE_COUNTRY)
      .order('position', { ascending: true });
    if (itemsError) {
      console.error('[app-api] me/plans items:', itemsError.message);
      return NextResponse.json({ error: 'Deine Pläne sind gerade nicht verfügbar.' }, { status: 503 });
    }
    const rows = (items ?? []) as unknown as Array<{
      plan_id: string;
      event: PlanEventRow | PlanEventRow[] | null;
    }>;
    for (const row of rows) {
      const event = Array.isArray(row.event) ? row.event[0] : row.event;
      if (!event) continue;
      const entry = (meta[row.plan_id] ??= { count: 0, firstTitle: null, firstStart: null });
      if (entry.count === 0) {
        entry.firstTitle = event.title;
        entry.firstStart = event.start_date;
      }
      entry.count += 1;
    }
  }

  return NextResponse.json(toAppPlanList(plans, meta, new Date()), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
