/**
 * Stripe-Integration für den Event-Boost-Checkout (MASTERPLAN §7.2).
 *
 * Ablauf (bewusst OHNE Webhook für v1 — kein Signing-Secret-Setup nötig):
 *   1. POST /api/checkout/boost erzeugt eine Stripe-Checkout-Session
 *      (einmalig 29 €, metadata.event_id bindet die Zahlung ans Event).
 *   2. Stripe leitet nach Zahlung auf /fuer-firmen/boost/erfolg?session_id=…
 *   3. Die Erfolgsseite verifiziert die Session SERVERSEITIG direkt gegen
 *      die Stripe-API (payment_status === 'paid') und setzt erst dann
 *      is_boosted/boost_tier/boost_until — der Client kann nichts faken,
 *      die Wahrheit kommt immer von Stripe.
 *   Wiederholtes Aufrufen der Erfolgsseite ist idempotent (gleiches Event,
 *   gleiche Werte). Ein Webhook (checkout.session.completed) kann später
 *   ergänzt werden, falls „Browser vor Redirect geschlossen" relevant wird
 *   — die Session bleibt bei Stripe abrufbar, der Kauf geht nicht verloren.
 *
 * Env: STRIPE_SECRET_KEY (Vercel: Live-Key seit 2026-07-10; lokal Test-Key).
 * Steuern: 29 € ist ENDPREIS (inkl. USt) — User-Entscheidung 2026-07-10,
 * Copy auf /fuer-firmen und im Formular entsprechend.
 */

import Stripe from 'stripe';

export const BOOST_PRICE_CENTS = 2900; // 29 € — muss zur /fuer-firmen-Copy passen
export const BOOST_MAX_DAYS = 28;      // „Laufzeit 2–4 Wochen rund um dein Event"

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY fehlt (Vercel-Env bzw. .env.local)');
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Boost-Ende: bis einen Tag nach Event-Beginn (danach bringt Hervorhebung
 * nichts mehr), gedeckelt auf 28 Tage ab jetzt (Events in ferner Zukunft
 * kaufen sonst monatelange Laufzeit für 29 €).
 */
export function computeBoostUntil(eventStartIso: string, now: Date = new Date()): string {
  const dayAfterEvent = new Date(new Date(eventStartIso).getTime() + 24 * 3600 * 1000);
  const cap = new Date(now.getTime() + BOOST_MAX_DAYS * 24 * 3600 * 1000);
  return (dayAfterEvent < cap ? dayAfterEvent : cap).toISOString();
}

/** UUID- oder Slug-Extraktion aus einer lasstreffen.at-Event-URL. */
export function parseEventRef(input: string): { id?: string; slug?: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return { id: uuidMatch[0].toLowerCase() };

  // Kanonische URL: /events/{plz-ort}/{yyyy-mm-dd}/{slug} → letztes Segment
  try {
    const path = trimmed.includes('://') ? new URL(trimmed).pathname : trimmed;
    const segs = path.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    if (last && /^[a-z0-9-]{3,}$/.test(last)) return { slug: last };
  } catch {
    /* keine URL — unten als roher Slug versuchen */
  }
  if (/^[a-z0-9-]{3,}$/.test(trimmed)) return { slug: trimmed };
  return null;
}
