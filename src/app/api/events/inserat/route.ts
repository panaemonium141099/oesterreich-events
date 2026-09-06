/**
 * POST /api/events/inserat
 *
 * Öffentliches Inserat-Formular ("Event inserieren", verlinkt im Footer).
 * Der Inserent ist NICHT eingeloggt — der Insert läuft daher über die
 * Service-Role (umgeht RLS, siehe 20260906170000_event_submissions.sql).
 *
 * Die Einreichung ist NICHT veröffentlicht. Sie landet in
 * `event_submissions` mit `status='pending'` und wird unter
 * /admin/inserate manuell freigegeben. Erst die Freigabe schreibt eine
 * `events`-Zeile.
 *
 * Missbrauchsschutz, absteigend nach Wirkung:
 *   1. Manuelle Freigabe — nichts wird ohne Sichtung öffentlich.
 *   2. Rate-Limit pro IP (in-memory, siehe src/lib/rate-limit.ts).
 *   3. Honeypot-Feld `fax`: für Menschen unsichtbar, Bots füllen es aus.
 *      Wir antworten dann mit 200/ok, damit der Bot keinen Fehler zum
 *      Nachjustieren bekommt — die Zeile wird schlicht nicht geschrieben.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/email';
import { validateSubmission } from '@/lib/inserate/submission';
import { escapeHtml } from '@/lib/utils/escape-html';

export const dynamic = 'force-dynamic';

const NOTIFY_TO = process.env.BUSINESS_LEADS_EMAIL || 'dev@glatzdev.com';

/** 5 Inserate pro Stunde und IP. Genug für einen Veranstalter, der eine
 *  Reihe von Terminen einträgt; zu wenig für eine Spam-Welle. */
const LIMIT_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  // Honeypot — stillschweigend verwerfen.
  if (typeof body.fax === 'string' && body.fax.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`inserat:${ip}`, LIMIT_PER_HOUR, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Zu viele Einreichungen. Bitte in einer Stunde erneut versuchen.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const validated = validateSubmission(body);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, field: validated.field },
      { status: 400 }
    );
  }

  const submission = validated.value;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('event_submissions')
    .insert({ ...submission, user_agent: userAgent })
    .select('id')
    .single();

  // supabase-js wirft bei Schreibfehlern NICHT — ohne diese Prüfung würde
  // das Formular "Danke!" melden und nichts wäre gespeichert.
  if (error || !data) {
    console.error('[events/inserat] insert failed:', error);
    return NextResponse.json(
      { error: 'Das Inserat konnte nicht gespeichert werden. Bitte später erneut versuchen.' },
      { status: 500 }
    );
  }

  // Benachrichtigung an den Betreiber — ein Fehler hier darf die
  // Einreichung nicht verwerfen, sie liegt bereits sicher in der DB.
  try {
    const startLocal = new Date(submission.start_date).toLocaleString('de-AT', {
      timeZone: 'Europe/Vienna',
      dateStyle: 'full',
      timeStyle: submission.is_all_day ? undefined : 'short',
    });
    const rows: Array<[string, string | null]> = [
      ['Titel', submission.title],
      ['Beginn', startLocal],
      ['Ort', submission.location_name],
      ['Adresse', submission.address],
      ['Kategorie', submission.category],
      ['Einreicher', submission.company ?? submission.contact_name],
      ['Kontakt', `${submission.contact_name} · ${submission.email}`],
      ['Telefon', submission.phone],
      ['Nachricht', submission.message],
    ];
    const html = `
      <h2>Neues Event-Inserat</h2>
      <table cellpadding="4">
        ${rows
          .filter(([, v]) => v)
          .map(
            ([k, v]) =>
              `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(String(v))}</td></tr>`
          )
          .join('')}
      </table>
      <p><a href="https://lasstreffen.at/admin/inserate">Im Admin prüfen und freigeben →</a></p>
      <hr>
      <p style="color:#888;font-size:12px">Inserat-ID: ${data.id}</p>
    `;
    await sendGenericEmail(
      NOTIFY_TO,
      `Neues Event-Inserat: ${submission.title}`,
      html
    );
  } catch (err) {
    console.error('[events/inserat] notification email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
