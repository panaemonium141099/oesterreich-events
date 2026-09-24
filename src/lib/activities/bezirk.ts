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
 * Wien (eine Gemeinde für die ganze Stadt) bleibt bewusst null.
 */

import type { AustrianGemeinde } from '@/lib/gemeinden/data';
import { districtFromGemeinde } from '@/lib/plz-district';

/**
 * Kanonischer Bezirk (lowercase, Vokabular DISTRICTS_BY_BUNDESLAND) für
 * eine Gemeinde der Stammdatei; null wenn kein kanonischer Wert ableitbar
 * ist. Dieselbe Funktion wie für events.district (districtFromGemeinde), damit
 * Aktivitäten- und Event-Filter nie auseinanderlaufen.
 */
export function activityBezirk(
  gemeinde: Pick<AustrianGemeinde, 'name' | 'plz' | 'bezirk'>,
  bundeslandId: string | null | undefined,
): string | null {
  if (!bundeslandId || !gemeinde.bezirk.trim()) return null;
  return districtFromGemeinde(gemeinde.bezirk, bundeslandId, gemeinde.plz);
}
