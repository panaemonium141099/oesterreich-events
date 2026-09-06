/**
 * PATCH /api/admin/event-submissions/[id]
 *
 * Freigabe oder Ablehnung eines Event-Inserats.
 *
 * Body:
 *   { action: 'approve', edits?: {...}, note?: string }
 *   { action: 'reject',  note?: string }
 *
 * `edits` erlaubt es, Tippfehler und schiefe Ortsangaben VOR der
 * Veröffentlichung zu korrigieren — sonst wäre die Freigabe ein
 * Stempel und jede Korrektur ein zweiter Handgriff in /admin/events.
 * Die Korrekturen werden auch in die Einreichung zurückgeschrieben,
 * damit Liste und veröffentlichtes Event nicht auseinanderlaufen.
 *
 * Bei `approve` entsteht eine echte `events`-Zeile (siehe
 * src/lib/inserate/approve.ts). Erst wenn dieser Insert nachweislich
 * erfolgreich war, wird die Einreichung auf `approved` gesetzt —
 * supabase-js wirft bei Schreibfehlern nicht, ein ungeprüftes Ergebnis
 * hinterliesse ein "freigegebenes" Inserat ohne Veranstaltung.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminWithCaller } from '@/lib/supabase/require-admin';
import { buildEventRow, type ApprovableSubmission } from '@/lib/inserate/approve';
import { clean, cleanUrl } from '@/lib/inserate/submission';
import { geocodeLocation } from '@/lib/geocoding';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { sendGenericEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/utils/escape-html';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lasstreffen.at';

/** Felder, die der Admin vor der Freigabe korrigieren darf. Bewusst ohne
 *  Datum: eine Terminänderung ist keine Korrektur, sondern ein anderes
 *  Event — das gehört zurück an den Inserenten. */
const EDITABLE_TEXT: Array<[key: string, column: string, max: number]> = [
  ['title', 'title', 200],
  ['description', 'description', 5000],
  ['category', 'category', 60],
  ['locationName', 'location_name', 200],
  ['address', 'address', 300],
  ['postalCode', 'postal_code', 10],
  ['bundesland', 'bundesland', 40],
  ['priceText', 'price_text', 200],
  ['organizer', 'organizer', 200],
];

const EDITABLE_URL: Array<[key: string, column: string]> = [
  ['ticketUrl', 'ticket_url'],
  ['imageUrl', 'image_url'],
  ['eventUrl', 'event_url'],
];

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Zieht die erlaubten Korrekturen aus dem Body. Unbekannte Schlüssel
 *  werden ignoriert — der Body darf nicht bestimmen, welche Spalten
 *  geschrieben werden. */
function extractEdits(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const edits: Record<string, string | null> = {};

  for (const [key, column, max] of EDITABLE_TEXT) {
    if (key in input) edits[column] = clean(input[key], max);
  }
  for (const [key, column] of EDITABLE_URL) {
    if (key in input) edits[column] = cleanUrl(input[key]);
  }
  return edits;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminWithCaller();
  if ('error' in auth) return auth.error;
  const { caller } = auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: "action muss 'approve' oder 'reject' sein" },
      { status: 400 }
    );
  }

  const note = clean(body.note, 2000);
  const supabase = getServiceClient();

  const { data: submission, error: loadError } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (loadError) {
    console.error('[admin/event-submissions] load failed:', loadError);
    return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: 'Inserat nicht gefunden' }, { status: 404 });
  }
  if (submission.status !== 'pending') {
    return NextResponse.json(
      { error: `Inserat ist bereits ${submission.status === 'approved' ? 'freigegeben' : 'abgelehnt'}.` },
      { status: 409 }
    );
  }

  const reviewedAt = new Date().toISOString();

  // ── Ablehnen ──────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error } = await supabase
      .from('event_submissions')
      .update({
        status: 'rejected',
        review_note: note,
        reviewed_by: caller.id,
        reviewed_at: reviewedAt,
      })
      .eq('id', id);

    if (error) {
      console.error('[admin/event-submissions] reject failed:', error);
      return NextResponse.json({ error: 'Ablehnung fehlgeschlagen' }, { status: 500 });
    }

    await notifySubmitter(submission.email, {
      subject: `Dein Event-Inserat "${submission.title}"`,
      html: `
        <p>Hallo ${escapeHtml(submission.contact_name)},</p>
        <p>dein Inserat <strong>${escapeHtml(submission.title)}</strong> konnten wir leider
        nicht veröffentlichen.</p>
        ${note ? `<p><strong>Grund:</strong> ${escapeHtml(note)}</p>` : ''}
        <p>Wenn du meinst, dass das ein Irrtum ist, antworte einfach auf diese E-Mail.</p>
        <p>Viele Grüße<br>LassTreffen.at</p>
      `,
    });

    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // ── Freigeben ─────────────────────────────────────────────────────
  const edits = extractEdits(body.edits);
  const merged = { ...submission, ...edits } as ApprovableSubmission & {
    email: string;
    contact_name: string;
  };

  if (!merged.title || merged.title.trim().length < 3) {
    return NextResponse.json(
      { error: 'Der Titel darf nicht leer sein.' },
      { status: 400 }
    );
  }

  // Koordinaten auflösen. Ohne sie fehlt der Kartenpin und die
  // Umkreissuche findet das Event nicht. Bestes verfügbares Signal
  // zuerst: vollständige Adresse, dann Ort + PLZ, dann nur der Ortsname.
  // Schlägt alles fehl, wird das Event trotzdem freigegeben — ein Event
  // ohne Pin ist besser als eine geratene Koordinate.
  const geoQuery =
    [merged.address, merged.postal_code, merged.location_name]
      .filter(Boolean)
      .join(', ') || merged.location_name;

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (geoQuery) {
    try {
      const geo = await geocodeLocation(geoQuery);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    } catch (err) {
      console.error('[admin/event-submissions] geocoding failed:', err);
    }
  }

  const eventRow = buildEventRow(merged, { latitude, longitude });

  const { data: createdEvent, error: insertError } = await supabase
    .from('events')
    .insert(eventRow)
    .select('id, slug, start_date, postal_code, address, bundesland, location_name')
    .single();

  if (insertError || !createdEvent) {
    console.error('[admin/event-submissions] event insert failed:', insertError);
    return NextResponse.json(
      { error: `Event konnte nicht angelegt werden: ${insertError?.message ?? 'unbekannter Fehler'}` },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from('event_submissions')
    .update({
      ...edits,
      status: 'approved',
      event_id: createdEvent.id,
      review_note: note,
      reviewed_by: caller.id,
      reviewed_at: reviewedAt,
    })
    .eq('id', id);

  if (updateError) {
    // Das Event steht bereits online. Die Einreichung bleibt auf
    // 'pending' — sichtbar als offener Posten, statt still zu scheitern.
    console.error('[admin/event-submissions] status update failed:', updateError);
    return NextResponse.json(
      {
        error:
          'Das Event wurde angelegt, der Status des Inserats konnte aber nicht gesetzt werden. Bitte erneut versuchen.',
        eventId: createdEvent.id,
      },
      { status: 500 }
    );
  }

  const eventUrl = `${SITE_URL}${buildEventUrlV2(createdEvent)}`;

  await notifySubmitter(submission.email, {
    subject: `Dein Event "${submission.title}" ist online`,
    html: `
      <p>Hallo ${escapeHtml(submission.contact_name)},</p>
      <p>dein Event <strong>${escapeHtml(submission.title)}</strong> ist ab sofort
      auf LassTreffen.at zu finden:</p>
      <p><a href="${escapeHtml(eventUrl)}">${escapeHtml(eventUrl)}</a></p>
      ${note ? `<p><strong>Anmerkung:</strong> ${escapeHtml(note)}</p>` : ''}
      <p>Viele Grüße<br>LassTreffen.at</p>
    `,
  });

  return NextResponse.json({
    ok: true,
    status: 'approved',
    eventId: createdEvent.id,
    eventUrl,
  });
}

/** Benachrichtigung an den Inserenten. Ein Fehler hier darf die bereits
 *  vollzogene Freigabe/Ablehnung nicht umstossen. */
async function notifySubmitter(
  to: string,
  message: { subject: string; html: string },
): Promise<void> {
  try {
    await sendGenericEmail(to, message.subject, message.html);
  } catch (err) {
    console.error('[admin/event-submissions] notification email failed:', err);
  }
}
