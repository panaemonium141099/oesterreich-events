/**
 * Die Seiten, die aus dieser Codebasis gebaut werden: je Land eine Domain.
 *
 * Alles, was sich zwischen lasstreffen.at und lasstreffen.de unterscheidet,
 * steht hier und nur hier. Kein anderes Modul nennt ein Land oder eine Domain
 * als Literal (Wächter: site-country-guard.test.ts; fn-31).
 */

export type SiteCountry = 'AT' | 'DE';

/** Säulen neben dem Kern (Events, Karte, Suche, Hubs, Rechtsseiten). */
export type SiteFeature =
  | 'blog' | 'festivals' | 'activities' | 'artists' | 'students' | 'themes' | 'venues'
  | 'heatmap' | 'business' | 'account' | 'social' | 'newsletter' | 'admin' | 'llms';

const ALL_ON: Record<SiteFeature, boolean> = {
  blog: true, festivals: true, activities: true, artists: true, students: true, themes: true,
  venues: true, heatmap: true, business: true, account: true, social: true, newsletter: true,
  admin: true, llms: true,
};

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
  /** Ein Satz unter dem Namen (Vorschaubild der Startseite). */
  tagline: string;
  /** Kontaktadressen in Footer und Hinweisen. */
  contact: { office: string; support: string };
  /**
   * Abfragen der Startseite, die diese Seite nicht stellt (Namen aus
   * get-landing-data.ts). Die Sektion bleibt dann leer.
   */
  landingSkip: readonly string[];
  /**
   * Ort des Wetters in Datumszeile und Saison-Karte: die Hauptstadt als Ort,
   * der für die Seite steht (Besucher mit gespeichertem Standort sehen ihren).
   */
  weatherPlace: { name: string; lat: number; lng: number };
  /**
   * Fenster des Dorffeste-Regals in Tagen. Die Abfrage sucht in Titeln über
   * alle kommenden Events des Landes im Fenster; sie muss unter der
   * Zeitgrenze von 3 s für anon bleiben.
   */
  landingDorffesteDays: number;
  /**
   * Städte der Chip-Reihe auf /entdecken. `null`: die Reihe der Seite kommt
   * aus dem Hub-Verzeichnis (lasstreffen.at: Wien und die fünf Stadt-Hubs).
   */
  cityChips: readonly { name: string; href: string }[] | null;
  /** Welche Säulen die Seite ausspielt (Pfade in features.ts). */
  features: Record<SiteFeature, boolean>;
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
    contact: { office: 'office@lasstreffen.at', support: 'support@lasstreffen.at' },
    tagline: 'Events in Wien, Graz, Salzburg und ganz Österreich — 85\u2009000 Events & Ausflugsziele auf einer Karte.',
    landingSkip: [],
    cityChips: null,
    weatherPlace: { name: 'Wien', lat: 48.21, lng: 16.37 },
    landingDorffesteDays: 30,
    features: ALL_ON,
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
    // Bis ein Postfach unter .de besteht, gelten die Adressen des Betreibers.
    contact: { office: 'office@lasstreffen.at', support: 'support@lasstreffen.at' },
    tagline: 'Konzerte, Dorffeste und Märkte in ganz Deutschland auf einer Karte.',
    // Startseite wie lasstreffen.at. Nicht gestellt werden nur die Abfragen
    // abgeschalteter Säulen: bezahlter Tipp (Veranstalter-Pakete), Künstler-
    // Kachel, Festivals, Aktivitäten. Die Künstler-Abfrage lief für
    // Deutschland zudem in die Zeitgrenze (3 s, 14.11.2026).
    landingSkip: ['featured', 'artists', 'artistPrimaries', 'festivals', 'festivalActs', 'activities'],
    weatherPlace: { name: 'Berlin', lat: 52.52, lng: 13.405 },
    // Die acht einwohnerstärksten Gemeinden laut Stammdatei (Destatis,
    // Gebietsstand 30.09.2026), Slug aus Amts-PLZ und Name. Wächter in
    // site-gemeinden.test.ts.
    cityChips: [
      { name: 'Berlin', href: '/gemeinde/10178-berlin' },
      { name: 'Hamburg', href: '/gemeinde/20038-hamburg' },
      { name: 'München', href: '/gemeinde/80313-muenchen' },
      { name: 'Köln', href: '/gemeinde/50667-koeln' },
      { name: 'Frankfurt am Main', href: '/gemeinde/60311-frankfurt-am-main' },
      { name: 'Düsseldorf', href: '/gemeinde/40213-duesseldorf' },
      { name: 'Leipzig', href: '/gemeinde/04109-leipzig' },
      { name: 'Stuttgart', href: '/gemeinde/70173-stuttgart' },
    ],
    // 30 Tage wie in Österreich liefen in die Zeitgrenze (3,07 s über
    // 177.613 kommende Events, 14.11.2026).
    landingDorffesteDays: 10,
    // Start mit dem Kern. Die übrigen Säulen führen nur österreichische
    // Inhalte (Blog, Festivals, Aktivitäten, Studenten, Themen, Venues) oder
    // warten auf eine Entscheidung (Login, Veranstalter-Pakete, Künstler).
    features: {
      blog: false, festivals: false, activities: false, artists: false, students: false,
      themes: false, venues: false, heatmap: false, business: false, account: false,
      social: false, newsletter: false, admin: false, llms: false,
    },
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
