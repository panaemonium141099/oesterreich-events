/**
 * Bezirk-Ableitung fuer Freizeitaktivitaeten (Spalte poi_activities.bezirk).
 *
 * Jeder POI haengt ueber gemeinde_slug an genau einer Zeile der Gemeinde-
 * Registry (gemeinde-match.ts), und die Registry kennt pro Gemeinde den
 * Bezirk. Damit der Bezirks-Filter der Uebersichtsseite dasselbe Vokabular
 * spricht wie `events.district` und die Event-Filter (DISTRICTS_BY_BUNDESLAND),
 * laeuft der Registry-Wert durch denselben `normalizeDistrict` wie die
 * Scraper — Ergebnis ist der kanonische lowercase-Bezirksname oder null.
 *
 * Gemessen 2026-09-15 gegen die 2 028 Registry-Zeilen: 89 Bezirke landen
 * direkt kanonisch, vier Registry-Schreibweisen nicht — die drei mit
 * eindeutigem Ziel stehen in REGISTRY_ALIASES, Wien (eine Registry-Zeile
 * fuer die ganze Stadt, ein einziger Deskline-POI) bleibt bewusst null.
 * Statutarstaedte fuehrt die OOe-Registry als Bezirk 'Statutarstadt' —
 * dort entscheidet der Gemeindename (Linz/Steyr/Wels), nicht der Bezirk.
 */

import type { AustrianGemeinde } from '@/lib/gemeinden/data';
import { isCanonicalDistrict, normalizeDistrict } from '@/lib/district-normalizer';

/** Registry-Schreibweisen ohne Treffer in der ALIAS_MAP des Normalizers.
 *  Bewusst lokal statt in district-normalizer.ts: dessen Alias-Map ist mit
 *  einer SQL-Migration fuer events.district gekoppelt. */
const REGISTRY_ALIASES: Readonly<Record<string, string>> = {
  'rust': 'eisenstadt',
  'waidhofen/ybbs': 'waidhofen an der ybbs',
  'innsbruck stadt': 'innsbruck (stadt)',
};

/**
 * Kanonischer Bezirk (lowercase, Vokabular DISTRICTS_BY_BUNDESLAND) fuer
 * eine Registry-Zeile; null wenn kein kanonischer Wert ableitbar ist.
 * `bundeslandId` ist die kanonische lowercase-ID aus gemeinde-match.
 */
export function activityBezirk(
  gemeinde: Pick<AustrianGemeinde, 'name' | 'plz' | 'bezirk'>,
  bundeslandId: string | null | undefined,
): string | null {
  if (!bundeslandId) return null;
  const rawBezirk = gemeinde.bezirk.trim().toLowerCase();
  if (!rawBezirk) return null;

  // OOe fuehrt Linz/Steyr/Wels als 'Statutarstadt' — der Gemeindename
  // traegt die Information ('steyr' -> 'steyr (stadt)' via Normalizer).
  const source = rawBezirk === 'statutarstadt' ? gemeinde.name : (REGISTRY_ALIASES[rawBezirk] ?? rawBezirk);

  const normalized = normalizeDistrict(source, bundeslandId, gemeinde.plz);
  if (!normalized || !isCanonicalDistrict(normalized)) return null;
  return normalized;
}
