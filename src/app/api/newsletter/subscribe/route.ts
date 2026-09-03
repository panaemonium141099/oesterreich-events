/**
 * POST /api/newsletter/subscribe — Anmeldung OHNE Account (MASTERPLAN §8.2).
 * Body: { email: string, region: string }  (region = Bundesland-ID oder 'oesterreich')
 *
 * Double-Opt-in: legt die Row unbestätigt an (bzw. aktualisiert die Region)
 * und schickt die Bestätigungs-Mail. Versand passiert erst nach Bestätigung.
 * Antwortet bewusst IMMER gleich (kein E-Mail-Enumeration-Leak).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '@/lib/email';
import {
import { publicOrigin } from '@/lib/site-url';
  isPlausibleEmail,
  isValidRegion,
  newsletterToken,
  confirmMailHtml,
  regionLabel,
} from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { email?: string; region?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const region = (body.region ?? '').trim();
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' }, { status: 400 });
  }
  if (!isValidRegion(region)) {
    return NextResponse.json({ error: 'Bitte wähle eine Region.' }, { status: 400 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Newsletter derzeit nicht verfügbar.' }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Upsert: neue Adresse → unbestätigte Row; bestehende → Region
  // aktualisieren + Abmeldung zurücksetzen (erneute Anmeldung = neuer
  // Double-Opt-in-Zyklus, confirmed_at bleibt wie es ist).
  const { error } = await admin.from('newsletter_subscribers').upsert(
    { email, bundesland: region, unsubscribed_at: null },
    { onConflict: 'email' },
  );
  if (error) {
    console.error('[newsletter/subscribe] upsert failed:', error);
    return NextResponse.json({ error: 'Anmeldung fehlgeschlagen — bitte später erneut versuchen.' }, { status: 503 });
  }

  const token = await newsletterToken('confirm', email);
  const confirmUrl = `${publicOrigin(req)}/api/newsletter/confirm?email=${encodeURIComponent(email)}&token=${token}`;
  const sent = await sendGenericEmail(
    email,
    `Bitte bestätigen: dein Event-Newsletter für ${regionLabel(region)}`,
    confirmMailHtml(region, confirmUrl),
  );
  if (!sent.success) {
    console.error('[newsletter/subscribe] confirm mail failed:', sent.error);
    return NextResponse.json({ error: 'Bestätigungs-Mail konnte nicht gesendet werden — bitte später erneut versuchen.' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Fast geschafft — bitte bestätige die Anmeldung über den Link in deinem Postfach.',
  });
}
