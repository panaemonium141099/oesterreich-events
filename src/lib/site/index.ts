/**
 * Die Seite, die dieser Build ausspielt.
 *
 * Quelle ist genau eine Variable, `SITE_COUNTRY`, gelesen zur Build-Zeit
 * (`next.config.ts` gibt sie über `env` auch dem Client-Bundle mit). Je Land
 * entsteht ein eigenes Image; eine Weiche über den Host zur Laufzeit gibt es
 * bewusst nicht, sie würde jede ISR-Seite dynamisch machen (fn-31).
 *
 * WICHTIG: `process.env.SITE_COUNTRY` muss hier wörtlich stehen. Next.js
 * ersetzt nur diesen Ausdruck; ein Zugriff über einen berechneten Namen käme
 * im Browser leer an.
 */
import { SITES, parseSiteCountry, resolveOrigin, type SiteConfig } from './sites';

export type { SiteConfig, SiteCountry } from './sites';
export { SITES } from './sites';

const SITE: SiteConfig = SITES[parseSiteCountry(process.env.SITE_COUNTRY)];

/** Die Konfiguration dieser Seite. Synchron, ohne `headers()` oder `cookies()`. */
export function getSite(): SiteConfig {
  return SITE;
}

/**
 * Öffentliche Origin für Links, die den Server verlassen (Mails, Crons).
 * Siehe `resolveOrigin`.
 */
export const SITE_ORIGIN_CONFIGURED = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
export const SITE_ORIGIN = resolveOrigin(SITE, SITE_ORIGIN_CONFIGURED);
