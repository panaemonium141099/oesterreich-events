/**
 * fn-25 Sammelmarker (Position ungefähr): Klick-Regel und Listen-Reihenfolge.
 *
 * Events ohne belegte Position liegen exakt auf dem Gemeinde-/PLZ-Mittelpunkt
 * und bekommen bewusst keinen Event-Pin. Ihr Sammelmarker kann sich deshalb
 * nie auflösen (Prod 2026-09-30: 35.910 Punkte auf 2.638 Koordinaten). Statt
 * eines Pins öffnet der Klick die Liste der Events an diesem Ort.
 */
import type { Event } from '@/types/events';

/**
 * Was passiert beim Klick auf einen Sammelmarker-Cluster?
 *
 * `expansionZoom` ist die Zoomstufe, ab der sich der Cluster teilt. Liegt sie
 * innerhalb des Kartenzooms, wird wie bei normalen Clustern hineingezoomt.
 * Liegt sie darüber, sitzen alle Punkte (praktisch) auf derselben Koordinate
 * und Zoomen brächte nichts: dann die Liste.
 */
export function approxClusterAction(expansionZoom: number, mapMaxZoom: number): 'zoom' | 'list' {
  return expansionZoom <= mapMaxZoom ? 'zoom' : 'list';
}

/**
 * Events eines Sammelmarkers in Listen-Reihenfolge: nächster Termin zuerst,
 * bei gleichem Tag nach ID. Deterministisch, damit gleiche Filter dieselben
 * Detail-Chunks anfragen (Edge-Cache-HITs auf /api/events/details).
 */
export function sortApproxEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const da = a.start_date ?? '';
    const db = b.start_date ?? '';
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Die Punkte kennen nur den Tag, die Uhrzeit kommt erst mit den Details.
 * Deshalb jede vollständig geladene Seite nach der echten Startzeit ordnen.
 * Das passiert beim Wechsel Platzhalter → Inhalt, sichtbar springt nichts;
 * Seiten, die noch laden, bleiben in Punkt-Reihenfolge.
 */
export function orderLoadedPages(events: Event[], pageSize: number): Event[] {
  const time = (e: Event) => Date.parse(e.start_date ?? '') || 0;
  const out: Event[] = [];
  for (let i = 0; i < events.length; i += pageSize) {
    const page = events.slice(i, i + pageSize);
    if (page.every((e) => e.title != null)) page.sort((a, b) => time(a) - time(b));
    out.push(...page);
  }
  return out;
}
