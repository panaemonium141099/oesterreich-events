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

import type { GygDestination } from './gyg-destinations';

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

/* ------------------------------------------------------------------ *
 * fn-22 — Zielseiten-Links (Touren-Boxen)
 *
 * Anders als der Suchlink oben braucht dieser Pfad KEIN geratenes
 * Template: die Zielseiten stehen in gyg-destinations.ts und sind dort
 * jede einzeln mit gezaehltem Angebot belegt. Fehlt die partner_id,
 * wird trotzdem nichts gebaut — ein Link ohne Attribution ist eine
 * verschenkte Provision, die niemandem auffaellt.
 * ------------------------------------------------------------------ */


/** de-Seite fuer deutschsprachige Nutzer, .com fuer /en. */
const GYG_HOSTS = {
  de: 'https://www.getyourguide.de',
  en: 'https://www.getyourguide.com',
} as const;

/**
 * Name des Kampagnen-Parameters. GYG nutzt in seinen eigenen Links
 * `cmp`; falls das Partner-Dashboard einen anderen Namen auswertet,
 * laesst er sich per Env umstellen, ohne Code anzufassen.
 */
const DEFAULT_CAMPAIGN_PARAM = 'cmp';

export interface GygDestinationLinkOptions {
  /** Platzierung fuer die Auswertung: "event-1a2b3c4d", "gemeinde-…". */
  placement: string;
  locale?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Ist die Auslieferung scharf geschaltet? Bewusst getrennt von
 * isGygEnabled(): Zielseiten-Links brauchen KEIN Deeplink-Template,
 * nur Flag + partner_id.
 */
export function isGygDestinationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NEXT_PUBLIC_GYG_ENABLED === 'true' &&
    typeof env.NEXT_PUBLIC_GYG_PARTNER_ID === 'string' &&
    env.NEXT_PUBLIC_GYG_PARTNER_ID.trim() !== ''
  );
}

/**
 * Affiliate-Link auf eine GYG-Zielseite — oder null, solange Flag oder
 * partner_id fehlen.
 */
export function buildGygDestinationLink(
  destination: Pick<GygDestination, 'path'>,
  { placement, locale = 'de', env = process.env }: GygDestinationLinkOptions,
): string | null {
  if (!isGygDestinationEnabled(env)) return null;

  const partnerId = (env.NEXT_PUBLIC_GYG_PARTNER_ID ?? '').trim();
  const path = destination.path.replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  const host = locale === 'en' ? GYG_HOSTS.en : GYG_HOSTS.de;
  const url = new URL(`${host}/${path}/`);
  url.searchParams.set('partner_id', partnerId);

  // Gleiche Konvention wie die sid bei Booking.com (fn-21): pro
  // Platzierung auswertbar, auf unbedenkliche Zeichen reduziert.
  const campaign = placement.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
  if (campaign) {
    url.searchParams.set(
      (env.NEXT_PUBLIC_GYG_CAMPAIGN_PARAM ?? DEFAULT_CAMPAIGN_PARAM).trim() ||
        DEFAULT_CAMPAIGN_PARAM,
      campaign,
    );
  }
  return url.toString();
}
