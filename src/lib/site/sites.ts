/**
 * Die Seiten, die aus dieser Codebasis gebaut werden: je Land eine Domain.
 *
 * Alles, was sich zwischen lasstreffen.at und lasstreffen.de unterscheidet,
 * steht hier und nur hier. Kein anderes Modul nennt ein Land oder eine Domain
 * als Literal (Wächter: site-country-guard.test.ts; fn-31).
 */

export type SiteCountry = 'AT' | 'DE';

export interface SiteConfig {
  /** Land der Events, die diese Seite ausspielt (`events.country`). */
  country: SiteCountry;
  /** Domain ohne Schema und ohne www. */
  domain: string;
  /** Kanonische Basis-URL ohne Schrägstrich am Ende (Canonical, Sitemap, JSON-LD). */
  url: string;
  /** Name der Seite in Texten und Metadaten. */
  brand: string;
  /** Name des Landes, deutsch und englisch (Rückfall-Ort, JSON-LD areaServed). */
  countryName: { de: string; en: string };
  /** hreflang der deutschen Fassung. */
  hreflang: 'de-AT' | 'de-DE';
  /** OpenGraph-Locale der deutschen Fassung. */
  ogLocale: 'de_AT' | 'de_DE';
  /** Sprachen dieser Seite, die erste ist der Standard ohne Präfix. */
  locales: readonly ('de' | 'en')[];
  /** Zeitzone für Anzeige und JSON-LD. Beide Zonen haben dieselben Regeln. */
  timeZone: 'Europe/Vienna' | 'Europe/Berlin';
}

export const SITES: Record<SiteCountry, SiteConfig> = {
  AT: {
    country: 'AT',
    domain: 'lasstreffen.at',
    url: 'https://lasstreffen.at',
    brand: 'LassTreffen.at',
    countryName: { de: 'Österreich', en: 'Austria' },
    hreflang: 'de-AT',
    ogLocale: 'de_AT',
    locales: ['de', 'en'],
    timeZone: 'Europe/Vienna',
  },
  DE: {
    country: 'DE',
    domain: 'lasstreffen.de',
    url: 'https://lasstreffen.de',
    brand: 'LassTreffen.de',
    countryName: { de: 'Deutschland', en: 'Germany' },
    hreflang: 'de-DE',
    ogLocale: 'de_DE',
    locales: ['de'],
    timeZone: 'Europe/Berlin',
  },
};

/** Liest einen Rohwert (Umgebungsvariable) als Land. Leer heißt Österreich. */
export function parseSiteCountry(raw: string | null | undefined): SiteCountry {
  const value = (raw ?? '').trim().toUpperCase();
  if (value === '') return 'AT';
  if (value === 'AT' || value === 'DE') return value;
  throw new Error(
    `SITE_COUNTRY="${raw}" ist kein bekanntes Land. Erlaubt: ${Object.keys(SITES).join(', ')}.`,
  );
}

/**
 * Öffentliche Origin für Links, die den Server verlassen: die ausdrücklich
 * gesetzte Adresse (`NEXT_PUBLIC_SITE_URL`, lokal etwa http://localhost:3000),
 * sonst die URL der Seite. Zeigt die gesetzte Adresse auf die Domain einer
 * ANDEREN Seite, ist der Build falsch zusammengesetzt (DE-Image mit der
 * AT-Adresse): dann lieber abbrechen als Mails und Links auf die falsche
 * Domain schicken.
 */
export function resolveOrigin(site: SiteConfig, configured: string | null | undefined): string {
  const origin = (configured ?? '').trim().replace(/\/+$/, '');
  if (!origin) return site.url;
  // Host ohne Schema, www und Port. Eine Adresse ohne Schema galt bisher
  // unverändert; das bleibt so, geprüft wird nur die fremde Domain.
  const host = origin.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[/:?#]/)[0].toLowerCase();
  for (const other of Object.values(SITES)) {
    if (other.country !== site.country && host === other.domain) {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL zeigt auf ${other.domain}, gebaut wird aber ${site.domain} (SITE_COUNTRY=${site.country}).`,
      );
    }
  }
  return origin;
}
