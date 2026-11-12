/**
 * fn-17: App-Locale → BCP-47-Tag für Datums-/Zahlenformatierung.
 * DE bleibt exakt beim historischen 'de-AT' (byte-identische Ausgaben);
 * EN nutzt 'en-GB' (24h-nahe Zeiten, "15 March 2026").
 */
import { DE_LOCALE } from '@/lib/site/intl';

export function dateLocaleFor(locale: string): string {
  return locale === 'en' ? 'en-GB' : DE_LOCALE;
}
