/**
 * Locale für Datums- und Zahlenformate der deutschen Fassung (fn-31).
 *
 * lasstreffen.at formatiert österreichisch (`de-AT`: „Jänner“, „€ 12,00“),
 * lasstreffen.de deutsch (`de-DE`: „Januar“, „12,00 €“). Kein anderes Modul
 * nennt die Locale als Literal (Wächter: domain-literal-guard.test.ts).
 */
import { getSite } from './index';

export const DE_LOCALE: string = getSite().hreflang;
