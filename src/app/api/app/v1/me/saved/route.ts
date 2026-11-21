/**
 * GET /api/app/v1/me/saved — gemerkte Events des angemeldeten Nutzers als
 * Karten für die native App (neueste Merkung zuerst, höchstens 200).
 *
 * Dieselbe Abfrage wie `/api/saved-events` (RLS im Namen des Nutzers, nur
 * Events des Landes der Seite); hier kommen die Zeilen als Karten zurück
 * (`toAppEventCard`), dazu `past` für bereits vergangene Termine. Die App
 * weist sich mit `Authorization: Bearer <Zugangstoken>` aus.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppEventCard, type AppTranslate } from '@/lib/app-api/landing';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';
import { SITE_COUNTRY } from '@/lib/site-country';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Event } from '@/types/events';

export const dynamic = 'force-dynamic';

const EVENT_COLUMNS =
  'id, slug, title, start_date, end_date, location_name, address, postal_code, district, bundesland, country, category, image_url, image_width, source_id, price_text, price_min, price_max, price_tier, is_all_day, duration_type';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bitte melde dich an.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_events')
    .select(`created_at, event:events!inner(${EVENT_COLUMNS})`)
    .eq('user_id', user.id)
    .eq('event.country', SITE_COUNTRY)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[app-api] me/saved:', error.message);
    return NextResponse.json({ error: 'Die gemerkten Events sind gerade nicht verfügbar.' }, { status: 503 });
  }

  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  const ctx = { t, locale: 'de' as const, origin: SITE_ORIGIN, mapboxToken: null };
  const now = Date.now();

  const rows = (data ?? []) as unknown as Array<{ created_at: string; event: Event | Event[] | null }>;
  const events = rows.flatMap(row => {
    const event = Array.isArray(row.event) ? row.event[0] : row.event;
    if (!event) return [];
    const end = new Date(event.end_date || event.start_date).getTime();
    return [{ ...toAppEventCard(event, ctx), savedAt: row.created_at, past: end < now - DAY_MS }];
  });

  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'private, no-store' } });
}
