/**
 * POST /api/event-reminder/subscribe — Event merken OHNE Account
 * (User-Auftrag 2026-07-15). Body: { email: string, eventId: string }
 *
 * Double-Opt-in wie beim Newsletter: Row unbestätigt anlegen,
 * Bestätigungs-Mail mit HMAC-Link schicken. Erinnert wird erst nach
 * Bestätigung (send-reminders-Cron: 2 Tage vorher + am Event-Tag).
 * Antwortet bewusst immer gleich (kein E-Mail-Enumeration-Leak).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '@/lib/email';
import { isPlausibleEmail, reminderToken, reminderConfirmMailHtml } from '@/lib/event-reminder';
import { publicOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: { email?: string; eventId?: string; windows?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const eventId = (body.eventId ?? '').trim();

  // Gewaehlte Erinnerungs-Zeitpunkte. Ohne Angabe bleibt es beim bisherigen
  // Verhalten (zwei Tage vorher + am Tag des Events), damit aeltere Clients
  // unveraendert funktionieren. Unbekannte Werte werden verworfen statt den
  // Request abzulehnen — sonst kippt ein neuer Wert im Frontend die ganze
  // Anmeldung. Bleibt nichts uebrig, greift wieder der Default.
  const ALLOWED_WINDOWS = ['7d', '2d', 'day'] as const;
  const requested = Array.isArray(body.windows) ? body.windows : [];
  const windows = [...new Set(
    requested.filter((w): w is string => typeof w === 'string')
      .filter((w) => (ALLOWED_WINDOWS as readonly string[]).includes(w)),
  )];
  const effectiveWindows = windows.length > 0 ? windows : ['2d', 'day'];
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' }, { status: 400 });
  }
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: 'Ungültiges Event.' }, { status: 400 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Erinnerungen derzeit nicht verfügbar.' }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Event muss existieren und in der Zukunft liegen — sonst wäre die
  // Erinnerung sinnlos (und die Tabelle ein offener Spam-Endpunkt).
  const { data: event } = await admin
    .from('events')
    .select('id,title,start_date,publish_status')
    .eq('id', eventId)
    .maybeSingle();
  if (!event || event.publish_status !== 'published' || new Date(event.start_date) < new Date()) {
    return NextResponse.json({ error: 'Für dieses Event sind keine Erinnerungen möglich.' }, { status: 404 });
  }

  // Upsert: erneutes Eintragen reaktiviert ein abgemeldetes Abo (neuer
  // Opt-in-Zyklus); confirmed_at bleibt unangetastet.
  const { error } = await admin.from('event_email_reminders').upsert(
    { email, event_id: eventId, unsubscribed_at: null, windows: effectiveWindows },
    { onConflict: 'email,event_id' },
  );
  if (error) {
    console.error('[event-reminder/subscribe] upsert failed:', error);
    return NextResponse.json({ error: 'Eintragen fehlgeschlagen — bitte später erneut versuchen.' }, { status: 503 });
  }

  const dateLabel = new Intl.DateTimeFormat('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Vienna',
  }).format(new Date(event.start_date));
  // Ohne Signier-Secret koennen wir keinen gueltigen Bestaetigungslink
  // bauen. Frueher flog der WebCrypto-Fehler ungefangen bis in die
  // Route-Antwort (HTTP 500, im Frontend nur "Eintragen fehlgeschlagen").
  let token: string;
  try {
    token = await reminderToken('confirm', email, eventId);
  } catch (err) {
    console.error('[event-reminder/subscribe] token signing failed:', err);
    return NextResponse.json(
      { error: 'Erinnerungen sind gerade nicht verfügbar — bitte später erneut versuchen.' },
      { status: 503 },
    );
  }
  const confirmUrl = `${publicOrigin(req)}/api/event-reminder/confirm?email=${encodeURIComponent(email)}&event=${eventId}&token=${token}`;
  const sent = await sendGenericEmail(
    email,
    `Bitte bestätigen: Erinnerung an „${event.title}"`,
    reminderConfirmMailHtml(event.title ?? 'dein Event', dateLabel, confirmUrl),
  );
  if (!sent.success) {
    console.error('[event-reminder/subscribe] confirm mail failed:', sent.error);
    return NextResponse.json({ error: 'Bestätigungs-Mail konnte nicht gesendet werden — bitte später erneut versuchen.' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Fast geschafft — bitte bestätige die Erinnerung über den Link in deinem Postfach.',
  });
}
