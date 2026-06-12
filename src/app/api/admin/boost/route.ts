/**
 * POST /api/admin/boost
 *
 * Admin-only: setzt/entfernt das Boost-Flag auf einem beliebigen Event
 * (auch gescrapte — z.B. für ein zahlendes Venue). Läuft mit Service-Role
 * (umgeht RLS) NACH einem expliziten Rollencheck (admin/god) über die
 * Session-Cookie. So lässt sich auch ein Event boosten, das der Admin
 * nicht selbst angelegt hat (events-UPDATE-RLS erlaubt sonst nur is_god()).
 *
 * Body: { eventId: string, boosted: boolean, until?: string|null, tier?: 'boost'|'abo'|'scraper'|null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_TIERS = ['boost', 'abo', 'scraper'] as const;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // 1) Caller authentifizieren
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // 2) Rollencheck — nur admin/god
  const service = getServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'god')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  // 3) Body validieren
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : null;
  const boosted = body.boosted === true;
  const until =
    typeof body.until === 'string' && body.until.trim() ? body.until : null;
  const tierRaw = typeof body.tier === 'string' ? body.tier : null;
  const tier =
    tierRaw && (VALID_TIERS as readonly string[]).includes(tierRaw) ? tierRaw : null;

  if (!eventId) {
    return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 });
  }

  // 4) Update — beim Entboosten boost_until/boost_tier mit aufräumen.
  const patch = boosted
    ? { is_boosted: true, boost_until: until, boost_tier: tier ?? 'boost' }
    : { is_boosted: false, boost_until: null, boost_tier: null };

  const { data, error } = await service
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select('id, is_boosted, boost_until, boost_tier')
    .single();

  if (error) {
    console.error('[admin/boost] update failed:', error);
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: data });
}
