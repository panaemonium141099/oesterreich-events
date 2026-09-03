/**
 * Oeffentliche Origin der Seite — fuer Links, die den Server verlassen.
 *
 * `req.nextUrl.origin` ist dafuer unbrauchbar, sobald die App hinter einem
 * Reverse-Proxy im Container laeuft: Next.js bindet dort auf HOSTNAME/PORT
 * (docker-compose setzt 0.0.0.0 und 3000), und genau das landete dann in den
 * Bestaetigungsmails — "https://0.0.0.0:3000/api/event-reminder/confirm?…",
 * also ein Link, den kein Empfaenger oeffnen kann (03.09.2026, nach dem
 * Hetzner-Umzug). Auf Vercel fiel es nicht auf, weil dort die oeffentliche
 * Adresse in nextUrl steht.
 *
 * Reihenfolge:
 *   1. NEXT_PUBLIC_SITE_URL — die explizite, kanonische Adresse. Auf Prod
 *      gesetzt und die einzige Quelle, die auch in Hintergrundjobs stimmt.
 *   2. x-forwarded-proto/-host — was der Proxy durchreicht.
 *   3. req.nextUrl.origin — letzter Ausweg, korrekt im lokalen `next dev`.
 */

const CONFIGURED = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');

/** Basis fuer Hintergrundjobs ohne Request (Crons, Skripte). */
export const SITE_ORIGIN = CONFIGURED || 'https://lasstreffen.at';

export function publicOrigin(req: { nextUrl: URL; headers: Headers }): string {
  if (CONFIGURED) return CONFIGURED;

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|\[::\]|localhost)(:|$)/.test(host)) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }

  return req.nextUrl.origin;
}
