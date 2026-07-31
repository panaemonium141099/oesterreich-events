/**
 * GetYourGuide-Deeplinks — BEWUSST NUR VORBEREITET (fn-18 Task 5).
 *
 * STATUS: nicht abgenommen, hinter Feature-Flag, KEIN Acceptance-Kriterium.
 *
 * WARUM NUR GERUEST: Das exakte Deeplink-Format (Ziel-Typ, URL-Template,
 * Pflicht-Parameter neben partner_id) ist erst nach Freischaltung im
 * GYG-Partner-Portal verifizierbar. Ein geratenes Template wuerde
 * entweder 404s erzeugen oder — schlimmer — Klicks ohne Attribution
 * verschenken, ohne dass es auffaellt. Deshalb: Solange das Template
 * nicht verifiziert und per Env gesetzt ist, liefert dieses Modul `null`
 * und die BookingBox rendert keinen GYG-Fallback.
 *
 * TODO(gyg-onboarding) — Verifikationsschritte vor Aktivierung:
 *   1. partner.getyourguide.com -> Konto freischalten, partner_id notieren.
 *   2. Im Partner-Portal das dokumentierte Deeplink-Format fuer
 *      Aktivitaets-/Suchseiten abrufen (Parameter-Namen + Pflichtfelder).
 *   3. NEXT_PUBLIC_GYG_PARTNER_ID + GYG_DEEPLINK_TEMPLATE in BEIDE
 *      Secret-Stores setzen (Vercel-Env UND GitHub-Actions-Secrets).
 *   4. NEXT_PUBLIC_GYG_ENABLED=true setzen und einen Testklick gegen die
 *      Attribution im Partner-Dashboard verifizieren.
 *   5. Erst dann: BookingBox-Fallback aktivieren (Anzeige-Pflichten wie
 *      bei Viator — rel="sponsored nofollow" + sichtbare Kennzeichnung).
 *
 * Cookie-Laufzeit laut Recherche: 31 Tage (nicht codewirksam).
 */

export interface GygDeeplinkInput {
  /** Suchbegriff/Aktivitaetsname. */
  query: string;
  /** Ortsname fuer die Suchseite. */
  town?: string | null;
  partnerId?: string | null;
  /** Template mit {query}-Platzhalter, z. B. "https://www.getyourguide.com/s/?q={query}". */
  template?: string | null;
  enabled?: boolean;
}

/**
 * Flag-Check. Bewusst NEXT_PUBLIC_*, weil die Entscheidung im Browser
 * (BookingBox) faellt — die serverseitige ISR-Seite trifft sie nicht.
 */
export function isGygEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.NEXT_PUBLIC_GYG_ENABLED === 'true' &&
    typeof env.NEXT_PUBLIC_GYG_PARTNER_ID === 'string' &&
    env.NEXT_PUBLIC_GYG_PARTNER_ID.trim() !== '' &&
    typeof env.GYG_DEEPLINK_TEMPLATE === 'string' &&
    env.GYG_DEEPLINK_TEMPLATE.trim() !== ''
  );
}

/**
 * Baut einen GYG-Deeplink — oder `null`, solange Flag/Template/partner_id
 * nicht verifiziert gesetzt sind. Kein Raten, keine Default-URL.
 */
export function buildGygDeeplink(input: GygDeeplinkInput): string | null {
  const enabled = input.enabled ?? false;
  const partnerId = (input.partnerId ?? '').trim();
  const template = (input.template ?? '').trim();
  const query = [input.query, input.town].filter((v) => v && v.trim() !== '').join(' ').trim();

  if (!enabled || !partnerId || !template || !query) return null;
  if (!template.includes('{query}')) return null;

  let url: URL;
  try {
    url = new URL(template.replace('{query}', encodeURIComponent(query)));
  } catch {
    return null;
  }
  url.searchParams.set('partner_id', partnerId);
  return url.toString();
}
