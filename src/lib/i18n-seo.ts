import type { AppLocale } from '@/i18n/routing';

const BASE_URL = 'https://lasstreffen.at';

/**
 * fn-17: hreflang-Alternates für eine lokalisierte Seite.
 *
 * DE ist unpräfixiert (Bestands-URLs/Rankings), EN unter /en. x-default
 * zeigt auf DE (Hauptmarkt). Canonical zeigt IMMER auf die eigene
 * Sprachversion — nie cross-locale, sonst deindexiert Google die
 * EN-Seiten wieder.
 *
 * Nur auf Seiten verwenden, deren EN-Version real existiert (Chrome +
 * Inhalt). Event-Detailseiten bekommen ihre Alternates erst mit der
 * Lazy-Translation (sonst Duplicate-Content-Signal auf 45k URLs).
 */
export function localeAlternates(path: string, locale: AppLocale) {
  const normalized = path === '/' ? '' : path;
  const de = `${BASE_URL}${normalized}` || BASE_URL;
  const en = `${BASE_URL}/en${normalized}`;
  return {
    canonical: locale === 'de' ? de : en,
    languages: {
      'de-AT': de,
      en,
      'x-default': de,
    },
  };
}
