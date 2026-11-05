/**
 * Halbe Zeichen aus Texten entfernen, bevor sie in die Datenbank gehen.
 *
 * Ein Emoji besteht in JavaScript aus zwei Code-Einheiten. Kürzt ein Scraper
 * eine Beschreibung auf feste Länge (`slice(0, 500)`, `substring(0, 997)`,
 * über hundert Stellen im Projekt), kann der Schnitt genau dazwischen fallen.
 * Übrig bleibt ein einzelnes Surrogat, und Postgres lehnt den ganzen
 * Schreib-Batch ab: „invalid input syntax for type json". So verlor der
 * Eventfrog-Import bis 2026-11-05 jeden Tag 100 Events an eine einzige
 * Beschreibung, die hinter „Bahnhof" ein halbes Emoji trug.
 *
 * Deshalb hier, im einen Schreibweg, statt an jeder Kürzung: das halbe
 * Zeichen fällt weg, alles andere bleibt, wie es ist.
 */

const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const LONE_ALL = new RegExp(LONE.source, 'g');

export function stripLoneSurrogates(text: string): string {
  return LONE.test(text) ? text.replace(LONE_ALL, '') : text;
}

/**
 * Wie `stripLoneSurrogates`, für jeden Text in einem Wert (Felder, Listen,
 * verschachtelte Objekte). Ohne Fund kommt derselbe Wert zurück, nichts wird
 * kopiert.
 */
export function wellFormed<T>(value: T): T {
  if (typeof value === 'string') return stripLoneSurrogates(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const w = wellFormed(v);
      if (w !== v) changed = true;
      return w;
    });
    return (changed ? out : value) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let out: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(value)) {
      const w = wellFormed(v);
      if (w !== v) (out ??= { ...(value as Record<string, unknown>) })[k] = w;
    }
    return (out ?? value) as T;
  }
  return value;
}
