/**
 * Einziger Weg, auf dem Gemeinde-Scraper an Ortsdaten kommen.
 *
 * Die Scraper-Listen (gem2goGemeinden.ts, gemeindeList.ts,
 * data/gemeinden-registry, data/gemeinden-event-pages.json) führen nur die
 * Identität einer Gemeinde (Kennziffer oder Name + Bundesland) und die
 * Kalender-URL. PLZ, Bezirk, Bundesland und Ortsmittelpunkt kommen hier aus
 * der Stammdatei `data/gemeinden-at.json`. Früher trug jede Liste eigene
 * Kopien davon; ein verrutschter Block und 40 geteilte Websites schrieben
 * Events monatelang in fremde Orte (Befund 2026-09-24).
 *
 * `idKey` ist KEINE Ortsangabe: der frühere Listenwert, der in die
 * source_id eingeht, damit bestehende Events ihre Identität behalten.
 *
 * SERVER-ONLY (Stammdatei per readFileSync).
 */
import { bundeslandLabel, findGemeinde } from '@/lib/gemeinden/data';

export interface GemeindeIdentity {
  name: string;
  bundesland?: string;
  gkz?: string;
  idKey?: string;
}

export interface GemeindeStammdaten {
  /** Amtlicher Name laut Stammdatei. */
  name: string;
  gkz: string;
  plz: string;
  bezirk: string;
  /** Anzeigename („Niederösterreich"), wie ihn die Scraper bisher setzten. */
  bundesland: string;
  lat: number;
  lng: number;
  /** ID-Schlüssel für die source_id (siehe Modulkommentar). */
  idKey: string;
}

/**
 * Ergänzt Listeneinträge um die Ortsdaten der Stammdatei. Einträge ohne
 * Zuordnung fallen weg (und fallen im CI-Test gemeinde-config.test.ts auf).
 */
export function withStammdaten<T extends GemeindeIdentity>(
  list: readonly T[],
  bundeslandFallback?: string,
): Array<Omit<T, keyof GemeindeStammdaten> & GemeindeStammdaten & { listName: string }> {
  const out: Array<Omit<T, keyof GemeindeStammdaten> & GemeindeStammdaten & { listName: string }> = [];
  for (const entry of list) {
    const g = findGemeinde({ gkz: entry.gkz, name: entry.name, bundesland: entry.bundesland ?? bundeslandFallback ?? '' });
    if (!g) {
      console.warn(`[stammdaten] Gemeinde nicht in data/gemeinden-at.json: ${entry.name} (${entry.bundesland ?? bundeslandFallback ?? '?'}) — Eintrag übersprungen`);
      continue;
    }
    out.push({
      ...entry,
      listName: entry.name,
      name: g.name,
      gkz: g.gkz,
      plz: g.plz,
      bezirk: g.bezirk,
      bundesland: bundeslandLabel(g.bundesland),
      lat: g.lat,
      lng: g.lng,
      idKey: entry.idKey ?? g.gkz,
    });
  }
  return out;
}
