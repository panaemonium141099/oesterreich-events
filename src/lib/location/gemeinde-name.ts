/**
 * Namensvergleich für Gemeinden (ohne Datenabhängigkeit, auch im Client
 * und in Build-Skripten nutzbar).
 */

/** Schreibweise für den Namensvergleich: klein, Umlaute vereinheitlicht,
 *  „St."/„Sankt" gleichgesetzt, Satzzeichen weg. */
export function normalizeGemeindeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\bst\.\s*/g, 'sankt ')
    .replace(/\bst\s+/g, 'sankt ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
