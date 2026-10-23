/**
 * smart-fallback — reine Helfer der Smart-Suche (2026-10-23, Stufe 0):
 *
 *   pickFallbackTerms  Welche Wörter der Anfrage in die ilike-Suche gehen,
 *                      wenn kein LLM-Intent vorliegt.
 *   collapseSeries     Serien (gleicher Titel, gleicher Ort) auf EINE Karte.
 *
 * Beide ohne I/O, damit sie testbar sind. Hintergrund in
 * docs/design/smart-suche-analyse-2026-10-23.md §2.
 */

/**
 * Wörter, die nie ein Pflicht-Suchbegriff sein dürfen. "Konzert von
 * Pizzera & Jaus" lief bis 2026-10-23 als `Konzert` AND `von` und fand
 * Senta Berger, weil "von" (drei Zeichen) nicht in der Liste stand und
 * die ersten zwei Wörter genommen wurden.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  // Artikel, Pronomen, Präpositionen, Konjunktionen
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'mit', 'ohne', 'für', 'auf', 'von', 'vom', 'zum', 'zur', 'bei', 'beim', 'nach', 'aus', 'bis', 'über',
  'ich', 'wir', 'uns', 'mir', 'mich', 'dir', 'ihr', 'sie', 'man', 'the', 'and', 'for',
  // Fragewörter, Hilfsverben, Füllwörter
  'was', 'wer', 'wie', 'wo', 'wann', 'ist', 'sind', 'bin', 'hab', 'habe', 'gibt', 'geht', 'gehen', 'kann',
  'will', 'wollen', 'möchte', 'mag', 'tun', 'machen', 'unternehmen', 'etwas', 'irgendwas', 'mal', 'auch',
  'noch', 'nur', 'ganz', 'sehr', 'gut', 'gute', 'cool', 'coole', 'cooles', 'schön', 'schöne', 'schon',
  'dann', 'jetzt', 'hier', 'dort', 'nicht', 'kein', 'keine', 'mehr', 'lust', 'gern', 'gerne', 'bisschen',
  // Zeit- und Gruppenwörter, die schon als Filter oder Facette wirken
  'abend', 'abends', 'heute', 'morgen', 'nachmittag', 'vormittag', 'nacht', 'wochenende',
  'student', 'studentin', 'studenten', 'freunde', 'freunden', 'familie', 'kinder', 'kindern',
  // Gattungswörter, die kein Titel trägt
  'veranstaltung', 'veranstaltungen', 'event', 'events', 'termin', 'termine', 'tipps', 'ideen',
]);

/**
 * Eventtyp-Wörter sind nur dann Suchbegriff, wenn sonst nichts bleibt:
 * ein Konzert heißt im Titel selten "Konzert", ein Künstlername ist der
 * bessere Pflicht-Treffer.
 */
const GENERIC_TYPE_WORDS: ReadonlySet<string> = new Set([
  'konzert', 'konzerte', 'party', 'partys', 'parties', 'show', 'shows', 'festival', 'festivals',
  'fest', 'feste', 'feier', 'aufführung', 'vorstellung', 'treffen', 'ausflug', 'programm',
]);

const MAX_TERMS = 2;

/**
 * Tokens der Anfrage ohne Stoppwörter, Bindestriche getrennt
 * ("Techno-Party" → "Techno", "Party"); zuerst die spezifischen, dann die
 * Gattungswörter; innerhalb einer Gruppe längere zuerst (seltener), bei
 * Gleichstand die Reihenfolge der Anfrage. Höchstens zwei Wörter, weil
 * jedes ein Pflicht-Match ist.
 */
export function pickFallbackTerms(intentText: string): string[] {
  const tokens = intentText
    .split(/[\s/]+/)
    .flatMap(w => w.split('-'))
    .map(w => w.replace(/[^\p{L}\p{N}'&.]/gu, ''))
    .filter(w => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()));

  const seen = new Set<string>();
  const unique = tokens.filter(w => {
    const k = w.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const rank = (list: string[]) =>
    list
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w.length - a.w.length || a.i - b.i)
      .map(x => x.w);

  const specific = rank(unique.filter(w => !GENERIC_TYPE_WORDS.has(w.toLowerCase())));
  if (specific.length > 0) return specific.slice(0, MAX_TERMS);
  return rank(unique.filter(w => GENERIC_TYPE_WORDS.has(w.toLowerCase()))).slice(0, MAX_TERMS);
}

/** Minimal-Shape, die collapseSeries braucht (Zeilen aus EVENT_COLS). */
export interface SeriesRow {
  id: string;
  title?: string | null;
  location_name?: string | null;
  start_date?: string | null;
}

function seriesKey(row: SeriesRow): string | null {
  const title = (row.title ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const venue = (row.location_name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${title}|${venue}`;
}

/**
 * Gleicher Titel am gleichen Ort an verschiedenen Terminen → eine Zeile
 * (der früheste Termin, Rangfolge des ersten Vorkommens) mit
 * `series_count` (alle Termine) und `series_dates` (die übrigen, sortiert,
 * höchstens fünf). Zeilen ohne Titel bleiben einzeln.
 */
export function collapseSeries<T extends SeriesRow>(
  rows: T[],
): Array<T & { series_count?: number; series_dates?: string[] }> {
  const groups = new Map<string, T[]>();
  const order: Array<string | T> = [];
  for (const row of rows) {
    const key = seriesKey(row);
    if (!key) { order.push(row); continue; }
    const g = groups.get(key);
    if (g) g.push(row);
    else { groups.set(key, [row]); order.push(key); }
  }
  return order.map(entry => {
    if (typeof entry !== 'string') return entry;
    const g = groups.get(entry)!;
    if (g.length === 1) return g[0];
    const sorted = [...g].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
    const [first, ...rest] = sorted;
    return {
      ...first,
      series_count: g.length,
      series_dates: rest.map(r => r.start_date ?? '').filter(Boolean).slice(0, 5),
    };
  });
}
