import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const COLUMNS = 'id, first_name, last_name, email, role, avatar_url, created_at, ads_disabled';

/**
 * GET /api/admin/users — Nutzerliste und Zähler für /admin (2026-11-21).
 *
 *   ?search=<text>   die 50 neuesten Profile, optional gefiltert nach
 *                    Vorname, Nachname oder E-Mail (Teilwort)
 *   ?stats=1         { total, today, week }; `today` (ISO) ist der Beginn
 *                    des heutigen Tages aus Sicht des Browsers
 *
 * Warum über den Server: seit der Migration 20261121120100 darf die Rolle
 * authenticated von profiles nur noch id, first_name, last_name, avatar_url
 * und role lesen. E-Mail, Anlagedatum und der Werbefrei-Schalter gehören
 * dem Admin, nicht jedem angemeldeten Nutzer, also prüft die Route die
 * Rolle und liest mit dem Service-Key. Vorher holte der Browser die Liste
 * direkt aus profiles; das ging nur, weil jede Spalte für jeden lesbar war.
 */
export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[admin/users GET] SUPABASE_SERVICE_ROLE_KEY is missing');
    return NextResponse.json(
      { error: 'Server not configured for admin operations' },
      { status: 500, headers: NO_STORE },
    );
  }
  const service = createClient(url, key, { auth: { persistSession: false } });
  const params = new URL(request.url).searchParams;

  if (params.get('stats')) {
    const now = Date.now();
    const todayParam = Date.parse(params.get('today') ?? '');
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    // Nur ein Tagesbeginn der letzten 48 Stunden zählt als „heute“.
    const today = Number.isFinite(todayParam) && todayParam <= now && now - todayParam < 48 * 3600_000
      ? new Date(todayParam)
      : dayStart;
    const week = new Date(now - 7 * 24 * 3600_000);

    const count = (since?: Date) => {
      const q = service.from('profiles').select('id', { count: 'exact', head: true });
      return since ? q.gte('created_at', since.toISOString()) : q;
    };
    const [all, sinceToday, sinceWeek] = await Promise.all([count(), count(today), count(week)]);
    const failed = all.error ?? sinceToday.error ?? sinceWeek.error;
    if (failed) {
      console.error('[admin/users GET] stats failed:', failed.message);
      return NextResponse.json({ error: 'Stats lookup failed' }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json(
      { total: all.count ?? 0, today: sinceToday.count ?? 0, week: sinceWeek.count ?? 0 },
      { headers: NO_STORE },
    );
  }

  let query = service
    .from('profiles')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(50);

  const term = searchTerm(params.get('search'));
  if (term) {
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[admin/users GET] list failed:', error.message);
    return NextResponse.json({ error: 'User lookup failed' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ users: data ?? [] }, { headers: NO_STORE });
}

/**
 * Der Suchtext landet in einem PostgREST-`or=(…)`. Komma, Klammern,
 * Anführungszeichen und Backslash trennen dort Bedingungen, `%` und `*`
 * sind Platzhalter: alles davon fällt weg, damit der Text ein Wert bleibt.
 */
function searchTerm(raw: string | null): string {
  return (raw ?? '').replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
