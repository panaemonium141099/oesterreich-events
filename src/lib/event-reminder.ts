/**
 * Anonyme Event-Reminder (User-Auftrag 2026-07-15): Events ohne Login
 * merken — E-Mail eintragen statt Konto. Gleiche Maschinerie wie der
 * Newsletter (lib/newsletter.ts): Double-Opt-in, HMAC-Token-Links ohne
 * Token-Storage, Versand via sendGenericEmail (Brevo, Resend-Fallback).
 *
 * Flow: POST /api/event-reminder/subscribe → Bestätigungs-Mail →
 * GET /api/event-reminder/confirm setzt confirmed_at → der tägliche
 * send-reminders-Cron (08:00) mailt 2 Tage vor dem Event und am
 * Event-Tag; jede Mail trägt einen Unsubscribe-Link (DSGVO).
 */
import { generateUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email';

export { isPlausibleEmail } from '@/lib/newsletter';

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? '';
}

/** Token bindet E-Mail UND Event — ein Link kann nie ein anderes Abo treffen. */
export async function reminderToken(
  purpose: 'confirm' | 'unsub',
  email: string,
  eventId: string,
): Promise<string> {
  return generateUnsubscribeToken(`event-reminder-${purpose}:${email.toLowerCase()}:${eventId}`, secret());
}

export async function verifyReminderToken(
  purpose: 'confirm' | 'unsub',
  email: string,
  eventId: string,
  token: string,
): Promise<boolean> {
  if (!token || !secret()) return false;
  return verifyUnsubscribeToken(`event-reminder-${purpose}:${email.toLowerCase()}:${eventId}`, token, secret());
}

const FOOTER = `
    <p style="font-size:12px;color:#888;line-height:1.5;">
      lasstreffen.at · <a href="https://lasstreffen.at/impressum" style="color:#888;">Impressum</a> ·
      <a href="https://lasstreffen.at/datenschutz" style="color:#888;">Datenschutz</a>
    </p>`;

export function reminderConfirmMailHtml(eventTitle: string, eventDate: string, confirmUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <h2 style="margin:0 0 12px;">Fast geschafft!</h2>
    <p style="line-height:1.6;color:#444;">
      Du möchtest an <strong>${eventTitle}</strong> (${eventDate}) erinnert werden.
      Bestätige kurz deine E-Mail-Adresse — erst danach schicken wir dir etwas
      (Double-Opt-in, damit niemand fremde Adressen einträgt):
    </p>
    <p style="margin:24px 0;">
      <a href="${confirmUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
        Erinnerung bestätigen
      </a>
    </p>
    <p style="font-size:13px;color:#666;line-height:1.5;">
      Danach erinnern wir dich zwei Tage vor dem Event und am Event-Tag selbst — sonst nichts.
    </p>
    <p style="font-size:12px;color:#888;line-height:1.5;">
      Falls du das nicht warst, ignoriere diese Mail einfach — ohne
      Bestätigung passiert nichts und die Adresse wird nicht verwendet.
    </p>${FOOTER}
  </div>`;
}

export function reminderMailHtml(opts: {
  eventTitle: string;
  eventDate: string;
  locationName: string | null;
  eventUrl: string;
  isEventDay: boolean;
  unsubscribeUrl: string;
}): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <h2 style="margin:0 0 12px;">${opts.isEventDay ? 'Heute ist es so weit!' : 'In zwei Tagen ist es so weit!'}</h2>
    <p style="line-height:1.6;color:#444;">
      <strong>${opts.eventTitle}</strong><br/>
      ${opts.eventDate}${opts.locationName ? ` · ${opts.locationName}` : ''}
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.eventUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
        Alle Details ansehen
      </a>
    </p>
    <p style="font-size:12px;color:#888;line-height:1.5;">
      Du bekommst diese Mail, weil du dich auf lasstreffen.at für eine
      Erinnerung an dieses Event eingetragen hast.
      <a href="${opts.unsubscribeUrl}" style="color:#888;">Erinnerung abbestellen</a>
    </p>${FOOTER}
  </div>`;
}
