/**
 * fn-17: App-Locale → BCP-47-Tag für Datums-/Zahlenformatierung.
 * DE bleibt exakt beim historischen 'de-AT' (byte-identische Ausgaben);
 * EN nutzt 'en-GB' (24h-nahe Zeiten, "15 March 2026").
 */
export function dateLocaleFor(locale: string): string {
  return locale === 'en' ? 'en-GB' : 'de-AT';
}
