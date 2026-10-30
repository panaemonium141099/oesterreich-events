/**
 * Fortsetzung langer Quell-Listen über mehrere Läufe.
 *
 * Die Gemeinde-Aggregatoren schaffen ihre Listen nicht in einem Lauf: sie
 * brechen am Soft-Budget ab (BaseScraper.softDeadline). Der abbrechende
 * Lauf merkt sich den Schlüssel des zuletzt bearbeiteten Eintrags
 * (`source_runs.rotation_cursor`, geschrieben von runScraper), der nächste
 * Lauf beginnt direkt danach. Nach ceil(n / Reichweite) Läufen ist jeder
 * Eintrag einmal dran.
 *
 * Vorher wanderte der Startpunkt per Tagesrotation um EINEN Eintrag pro Tag
 * (rotateDaily): gemeinde-registry schaffte jede Nacht rund 800 von 1.881
 * Gemeinden und fast immer dieselben. Salzburg und Steiermark kamen seit
 * Mai nicht mehr dran, Tirol und Vorarlberg seit dem 24.09., als eine
 * kürzere Liste den Startpunkt verschob (Prod 2026-10-14).
 *
 * Die Liste wird nach Schlüssel sortiert und setzt beim ersten Schlüssel
 * nach dem Cursor fort. So bleibt die Stelle richtig, wenn Einträge
 * dazukommen oder wegfallen, auch wenn der Cursor-Eintrag selbst fehlt.
 * Schlüssel sind deshalb die Identität des Eintrags (Kennziffer, Name),
 * nie sein Index, und müssen in der Liste eindeutig sein.
 */

/**
 * Schlüssel einer Gemeinde aus einer Scraper-Liste: Kennziffer und
 * Listenname. Die Kennziffer allein ist nicht eindeutig, fusionierte
 * Gemeinden führen eigene Einträge unter derselben Kennziffer (Matrei am
 * Brenner, Mühlbachl, Pfons).
 */
export function gemeindeCursorKey(g: { gkz: string; listName: string }): string {
  return `${g.gkz} ${g.listName}`;
}

/** Reihenfolge nach Code-Einheiten, unabhängig von der Locale des Runners. */
function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface CursorRotation<T> {
  /** Liste ab dem Eintrag nach dem Cursor, danach der Rest von vorne. */
  items: T[];
  /** Position des ersten Eintrags in der sortierten Liste (0 = Anfang). */
  startIndex: number;
}

export function rotateAfterCursor<T>(
  list: readonly T[],
  keyOf: (item: T) => string,
  cursor: string | null,
): CursorRotation<T> {
  const sorted = list
    .map((item, index) => ({ item, key: keyOf(item), index }))
    .sort((a, b) => compareKeys(a.key, b.key) || a.index - b.index);
  let startIndex = cursor == null ? 0 : sorted.findIndex(s => compareKeys(s.key, cursor) > 0);
  // Cursor hinter dem letzten Schlüssel: die Runde ist durch, von vorne.
  if (startIndex < 0) startIndex = 0;
  const items = [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)].map(s => s.item);
  return { items, startIndex };
}
