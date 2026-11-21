/**
 * GET /api/app/v1/me/plans/[id] — ein Plan des angemeldeten Nutzers für die
 * native App: Kopf, Countdown-Ziel, Module (Ticket, Anreise, Unterkunft,
 * Reminder), Events als Karten und der Stand für den Assistenten.
 *
 * Derselbe Loader wie die Plan-Seite der Website (`getPlan`, RLS im Namen
 * des Nutzers); Umrechnung in `src/lib/app-api/plans.ts`.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import type { AppTranslate } from '@/lib/app-api/landing';
import { toAppPlanDetail } from '@/lib/app-api/plans';
import { loadMessages } from '@/i18n/messages';
import { getPlan } from '@/lib/plans/loaders';
import { getSite, SITE_ORIGIN } from '@/lib/site';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Ungültige Plan-ID.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bitte melde dich an.' }, { status: 401 });
  }

  const plan = await getPlan(id);
  if (!plan) {
    return NextResponse.json({ error: 'Diesen Plan gibt es nicht (mehr).' }, { status: 404 });
  }

  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  const detail = toAppPlanDetail(plan, { t, locale: 'de', origin: SITE_ORIGIN, mapboxToken: null }, new Date());

  return NextResponse.json(detail, { headers: { 'Cache-Control': 'private, no-store' } });
}
