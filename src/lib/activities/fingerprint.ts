/**
 * content_fingerprint fuer Aktivitaeten (fn-18, Epic E11).
 *
 * Dedup-Fallback unabhaengig von der Mirror-GUID-Frage: Hash aus
 * normalisiertem Namen + EXAKT spezifizierter Koordinaten-Quantisierung
 * `round(lat*1000)/1000` und `round(lng*1000)/1000` (3 Dezimalstellen,
 * Grid ~111 m x ~75 m in AT). Grid-Kanten-Effekte sind bekannt und
 * akzeptiert — der Fingerprint ist Fallback-HEURISTIK, keine
 * Genauigkeitsgarantie. Tests arbeiten fixture-basiert gegen genau
 * diesen Algorithmus.
 *
 * Server-only (node:crypto) — nicht in Client-Bundles importieren.
 */

import { createHash } from 'crypto';

/**
 * Haeufige UTF-8-als-Latin1-Mojibake-Sequenzen (Deskline liefert vereinzelt
 * doppelt-encodete Namen). Laengere Sequenzen zuerst ersetzen.
 */
const MOJIBAKE_MAP: ReadonlyArray<readonly [string, string]> = [
  ['â€œ', '"'], ['â€ž', '"'], ['â€“', '–'], ['â€”', '—'],
  ['â€™', '’'], ['â€˜', '‘'],
  ['Ã¤', 'ä'], ['Ã¶', 'ö'], ['Ã¼', 'ü'], ['ÃŸ', 'ß'],
  ['Ã„', 'Ä'], ['Ã–', 'Ö'], ['Ãœ', 'Ü'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã¡', 'á'],
  // 0xE0 ('à') mojibaked ist 'Ã' + U+00A0 (NBSP!), nicht 'Ã' + Space —
  // Der Key enthaelt ein echtes U+00A0 (Tests sichern die Codepoints ab);
  // legitimes 'Ã' + normales Leerzeichen bleibt unangetastet.
  ['Ã ', 'à'],
  ['Ã´', 'ô'], ['Ã®', 'î'], ['Ã§', 'ç'],
  // 0xA0 (NBSP) mojibaked ist 'Â' + U+00A0 -> normales Leerzeichen.
  ['Â°', '°'], ['Â ', ' '],
];

/** Repariert die gaengigen deutschen Mojibake-Sequenzen (deterministisch). */
export function fixMojibake(input: string): string {
  let s = input;
  for (const [broken, fixed] of MOJIBAKE_MAP) {
    if (s.includes(broken)) s = s.split(broken).join(fixed);
  }
  return s;
}

/**
 * Namens-Normalisierung fuer den Fingerprint: Mojibake-bereinigt, NFC,
 * lowercase, Whitespace (inkl. NBSP) kollabiert + getrimmt.
 */
export function normalizeActivityName(name: string): string {
  return fixMojibake(name)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Exakt spezifizierte Quantisierung: round(x*1000)/1000. */
export function quantizeCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * content_fingerprint = sha1(`${normName}|${lat3}|${lng3}`) als Hex.
 * lat3/lng3 sind die quantisierten Koordinaten, fix auf 3 Nachkommastellen
 * formatiert (deterministische String-Repraesentation).
 */
export function contentFingerprint(name: string, lat: number, lng: number): string {
  const lat3 = quantizeCoord(lat).toFixed(3);
  const lng3 = quantizeCoord(lng).toFixed(3);
  return createHash('sha1')
    .update(`${normalizeActivityName(name)}|${lat3}|${lng3}`, 'utf8')
    .digest('hex');
}
