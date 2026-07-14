/**
 * Wochen-Newsletter pro Region (MASTERPLAN §8.2, User-Go 2026-07-14).
 *
 * Flow: POST /api/newsletter/subscribe (E-Mail + Region, ohne Account)
 *   → Double-Opt-in-Mail mit HMAC-Token-Link
 *   → GET /api/newsletter/confirm setzt confirmed_at
 *   → wöchentlicher Cron versendet den Regionen-Digest (Brevo),
 *     jede Mail trägt einen Unsubscribe-Link (DSGVO).
 *
 * Tokens: HMAC über `${purpose}:${email}` mit UNSUBSCRIBE_SECRET —
 * gleiche Maschinerie wie die Artist-Alert-Abmeldelinks (lib/email.ts),
 * kein Token-Storage in der DB nötig.
 */

import { generateUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email';
import { BUNDESLAND_NAMES, type BundeslandId } from '@/lib/districtsAT';

export const NEWSLETTER_REGIONS: Record<string, string> = {
  oesterreich: 'ganz Österreich',
  ...BUNDESLAND_NAMES,
};

export function isValidRegion(r: string): boolean {
  return r in NEWSLETTER_REGIONS;
}

export function regionLabel(r: string): string {
  return NEWSLETTER_REGIONS[r] ?? r;
}

/** Konservative E-Mail-Plausibilität — die echte Verifikation IST das Double-Opt-in. */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? '';
}

export async function newsletterToken(purpose: 'confirm' | 'unsub', email: string): Promise<string> {
  return generateUnsubscribeToken(`newsletter-${purpose}:${email.toLowerCase()}`, secret());
}

export async function verifyNewsletterToken(
  purpose: 'confirm' | 'unsub',
  email: string,
  token: string,
): Promise<boolean> {
  if (!token || !secret()) return false;
  return verifyUnsubscribeToken(`newsletter-${purpose}:${email.toLowerCase()}`, token, secret());
}

/** Bundesland-Query-Wert für den Digest: 'oesterreich' = kein Filter. */
export function regionToBundeslandFilter(region: string): string | null {
  return region === 'oesterreich' ? null : region;
}

export function confirmMailHtml(region: string, confirmUrl: string): string {
  const label = regionLabel(region);
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <h2 style="margin:0 0 12px;">Fast geschafft!</h2>
    <p style="line-height:1.6;color:#444;">
      Du möchtest jede Woche die besten Events für <strong>${label}</strong> bekommen.
      Bestätige kurz deine Anmeldung — erst danach schicken wir dir etwas
      (Double-Opt-in, damit niemand fremde Adressen anmeldet):
    </p>
    <p style="margin:24px 0;">
      <a href="${confirmUrl}" style="background:#111;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
        Anmeldung bestätigen
      </a>
    </p>
    <p style="font-size:12px;color:#888;line-height:1.5;">
      Falls du dich nicht angemeldet hast, ignoriere diese Mail einfach —
      ohne Bestätigung passiert nichts und die Adresse wird nicht verwendet.<br/>
      lasstreffen.at · <a href="https://lasstreffen.at/impressum" style="color:#888;">Impressum</a> ·
      <a href="https://lasstreffen.at/datenschutz" style="color:#888;">Datenschutz</a>
    </p>
  </div>`;
}
