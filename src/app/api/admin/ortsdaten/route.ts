/**
 * Prüfansicht Ortsdaten (fn-25 O1, Review §10): ungeklärte Fälle nach
 * Quell-Spielstätte und Problem gruppiert, mit Quellenbeleg, Kandidaten
 * und Konfliktgrund.
 *
 * GET /api/admin/ortsdaten?status=conflict|unresolved|region_only&limit=50
 *   → Gruppen (Quelle + Rohname) mit Anzahl, nächstem Termin, Beispiel-
 *     Events (Titel, Adresse, PLZ, Gründe, verworfene Position, Quell-URL).
 *
 * GET /api/admin/ortsdaten?metrics=1 → Statusverteilung der künftigen Events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

interface EventRowLite {
  id: string;
  title: string;
  slug: string | null;
  source_name: string;
  source_url: string | null;
  start_date: string;
  location_name: string | null;
  location_name_raw: string | null;
  address_raw: string | null;
  address: string | null;
  postal_code: string | null;
  city_raw: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: string | null;
  location_precision: string | null;
  location_resolution: { reasons?: string[]; rejected?: string[]; evidence?: string[]; revoked?: Record<string, unknown> | null; phase?: string } | null;
  raw_event_id: string | null;
  publish_status: string | null;
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nowIso = new Date().toISOString();

  if (searchParams.get('metrics') === '1') {
    const statuses = ['venue_confirmed', 'address_confirmed', 'municipality_only', 'region_only', 'unresolved', 'conflict', 'online'];
    const out: Record<string, number> = {};
    for (const s of statuses) {
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true })
        .gte('start_date', nowIso).in('publish_status', ['published', 'published_low_confidence', 'needs_review']).eq('location_status', s);
      out[s] = count ?? 0;
    }
    const { count: none } = await supabase.from('events').select('id', { count: 'exact', head: true })
      .gte('start_date', nowIso).in('publish_status', ['published', 'published_low_confidence', 'needs_review']).is('location_status', null);
    out.undecided = none ?? 0;
    return NextResponse.json({ metrics: out });
  }

  const status = searchParams.get('status') || 'conflict';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, slug, source_name, source_url, start_date, location_name, location_name_raw, address_raw, address, postal_code, city_raw, bundesland, latitude, longitude, location_status, location_precision, location_resolution, raw_event_id, publish_status')
    .gte('start_date', nowIso)
    .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
    .eq('location_status', status)
    .order('start_date', { ascending: true })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Gruppe = Quelle + Rohname + Ortskontext (PLZ, sonst Ortsname): derselbe
  // Name in einer anderen Gemeinde ist eine andere Spielstätte, und die
  // Zuordnung im Admin gilt genau für diesen Schlüssel (venue-key.ts).
  const groups = new Map<string, { key: string; source_name: string; name: string; postal_code: string | null; city: string | null; count: number; next_start: string; has_raw: number; reasons: Map<string, number>; samples: EventRowLite[] }>();
  for (const r of (data ?? []) as unknown as EventRowLite[]) {
    const name = r.location_name_raw ?? r.location_name ?? '∅';
    const plz = r.postal_code ?? null;
    const city = r.city_raw ?? null;
    const key = `${r.source_name}::${name}::${plz ?? city ?? ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, source_name: r.source_name, name, postal_code: plz, city, count: 0, next_start: r.start_date, has_raw: 0, reasons: new Map(), samples: [] };
      groups.set(key, g);
    }
    g.count++;
    if (r.raw_event_id) g.has_raw++;
    for (const reason of r.location_resolution?.reasons ?? []) {
      const k = reason.replace(/:\d+km$/, '');
      g.reasons.set(k, (g.reasons.get(k) ?? 0) + 1);
    }
    if (g.samples.length < 3) g.samples.push(r);
  }
  const list = [...groups.values()]
    .sort((a, b) => b.count - a.count || a.next_start.localeCompare(b.next_start))
    .slice(0, limit)
    .map(g => ({ ...g, reasons: [...g.reasons.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`) }));
  return NextResponse.json({ status, total_events: data?.length ?? 0, groups: list });
}
