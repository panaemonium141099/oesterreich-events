/**
 * POST /api/admin/landing-feature
 *
 * Admin-only: bucht ein Event auf die Startseite (Tabelle landing_features)
 * oder nimmt es wieder herunter. Zwei Arten (fn-30, Tagesausgabe):
 *
 *   * `sponsored`: Tipp des Tages, genau eine Buchung je Wiener Kalendertag.
 *     Pflicht: `sponsorName` (die Karte trägt „Anzeige“ plus Sponsor, § 26
 *     MedienG, § 6 ECG) und `day` (YYYY-MM-DD). Fenster = 00:00 bis 24:00
 *     dieses Tages in Europe/Vienna. Liegt für den Tag schon eine
 *     sponsored-Buchung eines anderen Events vor → 409 mit dem belegten Event.
 *   * `editorial` (Default): Pin für die Saison-Karte wie bisher, Fenster ab
 *     jetzt bis `until` (oder bis das Event vorbei ist).
 *
 * Das Event muss veröffentlicht, aus dem Land der Seite und am Buchungstag
 * noch nicht vorbei sein, sonst 422. Nach jeder Änderung wird die Startseite
 * neu gebaut (revalidateLanding). Rollencheck wie /api/admin/boost.
 *
 * Body: {
 *   eventId: string, featured: boolean,
 *   kind?: 'sponsored' | 'editorial', sponsorName?: string, day?: 'YYYY-MM-DD',
 *   until?: string | null, note?: string | null
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SITE_COUNTRY } from '@/lib/site-country';
import { eventEndDay } from '@/lib/v4/landing-picks';
import { revalidateLanding } from '@/lib/landing/revalidate-landing';
import { viennaDayRange, viennaToday } from '@/lib/utils/event-time';

export const dynamic = 'force-dynamic';

export type LandingFeatureKind = 'sponsored' | 'editorial';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPONSOR_NAME_MAX = 120;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Kalendertag `YYYY-MM-DD`, der auch wirklich existiert (kein 2026-02-30). */
function isValidDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
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
  const kindRaw = body.kind === undefined ? 'editorial' : body.kind;
  const sponsorName =
    typeof body.sponsorName === 'string' && body.sponsorName.trim()
      ? body.sponsorName.trim().slice(0, SPONSOR_NAME_MAX)
      : null;
  const day = typeof body.day === 'string' ? body.day.trim() : null;

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

  if (kindRaw !== 'sponsored' && kindRaw !== 'editorial') {
    return NextResponse.json({ error: 'kind muss sponsored oder editorial sein' }, { status: 400 });
  }
  const kind: LandingFeatureKind = kindRaw;

  if (kind === 'sponsored') {
    if (!sponsorName) {
      return NextResponse.json({ error: 'sponsorName fehlt (Pflicht bei Anzeige)' }, { status: 400 });
    }
    if (!day || !isValidDay(day)) {
      return NextResponse.json({ error: 'day fehlt oder ist kein Datum (YYYY-MM-DD)' }, { status: 400 });
    }
  }

  // Buchungstag: Anzeige am gewählten Tag, Redaktion ab heute (Wien).
  const bookingDay = kind === 'sponsored' ? (day as string) : viennaToday();

  const { data: event, error: eventError } = await service
    .from('events')
    .select('id, title, publish_status, country, start_date, end_date')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) {
    console.error('[admin/landing-feature] event lookup failed:', eventError);
    return NextResponse.json({ error: 'Event konnte nicht geladen werden' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
  }
  if (event.publish_status !== 'published') {
    return NextResponse.json({ error: 'Event ist nicht veröffentlicht' }, { status: 422 });
  }
  if ((event.country ?? null) !== SITE_COUNTRY) {
    return NextResponse.json({ error: `Event liegt nicht in ${SITE_COUNTRY}` }, { status: 422 });
  }
  const endDay = eventEndDay(event);
  if (!endDay || endDay < bookingDay) {
    return NextResponse.json(
      { error: `Event ist am ${bookingDay} schon vorbei` },
      { status: 422 },
    );
  }

  let startsAt: string;
  let endsAt: string | null;
  if (kind === 'sponsored') {
    const range = viennaDayRange(bookingDay);
    startsAt = range.start.toISOString();
    endsAt = range.next.toISOString();

    // Ein Tipp je Tag: eine andere sponsored-Buchung, deren Fenster diesen Tag
    // berührt, sperrt ihn. Dasselbe Event darf umgebucht werden (unique event_id,
    // der Upsert ersetzt die Zeile).
    const { data: taken, error: takenError } = await service
      .from('landing_features')
      .select('event_id, sponsor_name, starts_at, ends_at, event:events(title)')
      .eq('kind', 'sponsored')
      .neq('event_id', eventId)
      .lt('starts_at', endsAt)
      .or(`ends_at.is.null,ends_at.gt.${startsAt}`)
      .limit(1);
    if (takenError) {
      console.error('[admin/landing-feature] conflict check failed:', takenError);
      return NextResponse.json({ error: 'Belegung konnte nicht geprüft werden' }, { status: 500 });
    }
    const conflict = taken?.[0] as
      | { event_id: string; sponsor_name: string | null; event: { title: string } | { title: string }[] | null }
      | undefined;
    if (conflict) {
      const ev = Array.isArray(conflict.event) ? conflict.event[0] : conflict.event;
      const title = ev?.title ?? conflict.event_id;
      return NextResponse.json(
        {
          error: `Der ${bookingDay} ist schon belegt: „${title}“${conflict.sponsor_name ? ` (${conflict.sponsor_name})` : ''}`,
          conflict: { eventId: conflict.event_id, title, sponsorName: conflict.sponsor_name },
        },
        { status: 409 },
      );
    }
  } else {
    startsAt = new Date().toISOString();
    endsAt = until;
  }

  const { data, error } = await service
    .from('landing_features')
    .upsert(
      {
        event_id: eventId,
        kind,
        sponsor_name: kind === 'sponsored' ? sponsorName : null,
        starts_at: startsAt,
        ends_at: endsAt,
        note,
        created_by: user.id,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' },
    )
    .select('event_id, kind, sponsor_name, starts_at, ends_at')
    .single();

  if (error) {
    console.error('[admin/landing-feature] upsert failed:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 });
  }

  revalidateLanding();
  return NextResponse.json({ ok: true, featured: true, feature: data });
}
