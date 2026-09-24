/**
 * POST /api/admin/landing-feature
 *
 * Admin-only: pinnt ein Event auf die Saison-Karte im Landing-Hero
 * (Tabelle landing_features) oder nimmt es wieder herunter. Gepinnte
 * Events stehen vor der automatischen Saison-Rotation, z. B. für eine
 * bezahlte Platzierung oder eine eigene Saison-Auswahl. Muster und
 * Rollencheck wie /api/admin/boost.
 *
 * Body: { eventId: string, featured: boolean, until?: string|null, note?: string|null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Startseite (ISR, revalidate 3600) sofort neu bauen, statt bis zu einer Stunde zu warten. */
function revalidateLanding() {
  revalidatePath('/[locale]', 'page');
}

export async function POST(request: NextRequest) {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'god')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : null;
  const featured = body.featured === true;
  const until =
    typeof body.until === 'string' && body.until.trim() ? body.until : null;
  const note =
    typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null;

  if (!eventId) {
    return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 });
  }

  // supabase-js wirft bei Schreibfehlern nicht: error IMMER prüfen.
  if (!featured) {
    const { error } = await service.from('landing_features').delete().eq('event_id', eventId);
    if (error) {
      console.error('[admin/landing-feature] delete failed:', error);
      return NextResponse.json({ error: 'Entfernen fehlgeschlagen' }, { status: 500 });
    }
    revalidateLanding();
    return NextResponse.json({ ok: true, featured: false });
  }

  const { data, error } = await service
    .from('landing_features')
    .upsert(
      {
        event_id: eventId,
        starts_at: new Date().toISOString(),
        ends_at: until,
        note,
        created_by: user.id,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' },
    )
    .select('event_id, ends_at')
    .single();

  if (error) {
    console.error('[admin/landing-feature] upsert failed:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 });
  }

  revalidateLanding();
  return NextResponse.json({ ok: true, featured: true, feature: data });
}
