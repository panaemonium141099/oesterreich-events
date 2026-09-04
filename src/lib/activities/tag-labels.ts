/**
 * Anzeige-Labels fuer Aktivitaets-Tags (fn-18 Task 4).
 *
 * Die Tags kommen aus dem Event-TAGS-Vokabular (via taxonomy.ts-Mapping,
 * Epic E3) und sind slugs wie 'thermen-special' — fuer die Kategorie-
 * Chips der Gemeinde-Hub-Sektion brauchen sie deutsche Anzeige-Labels.
 * Kuratierte Map fuer alle in TOPIC_WHITELIST vergebenen Tags; Fallback
 * ist ein generischer Prettifier (Bindestriche -> Leerzeichen,
 * Grossschreibung), damit neue Tags nie crashen.
 */

export const ACTIVITY_TAG_LABELS: Readonly<Record<string, string>> = {
  ausstellung: 'Ausstellungen',
  bergtour: 'Bergtouren',
  bouldern: 'Bouldern',
  burgführung: 'Burgen & Schlösser',
  film: 'Film',
  kajak: 'Kajak',
  kanutour: 'Kanutouren',
  kino: 'Kino',
  klettern: 'Klettern',
  langlauf: 'Langlauf',
  mountainbike: 'Mountainbike',
  museumstour: 'Museen',
  naturführung: 'Naturführungen',
  radfahren: 'Radfahren',
  rafting: 'Rafting',
  reiten: 'Reiten',
  'sauna-special': 'Sauna',
  schwimmen: 'Schwimmen & Baden',
  'segel-tour': 'Segeln',
  ski: 'Ski',
  snowboard: 'Snowboard',
  tennis: 'Tennis',
  theater: 'Theater',
  'thermen-special': 'Therme',
  wandern: 'Wandern',
  wassersport: 'Wassersport',
  'wellness-day': 'Wellness',
};

/**
 * Englische Labels (fn-17). Nur die Tags, deren deutsches Label kein
 * Eigenname ist — 'Kajak', 'Tennis', 'Theater', 'Ski', 'Snowboard',
 * 'Rafting', 'Bouldern' -> 'Bouldering' usw. Was hier fehlt, faellt auf
 * das deutsche Label zurueck; das ist bei international gleich
 * geschriebenen Begriffen die richtige Ausgabe.
 */
const ACTIVITY_TAG_LABELS_EN: Readonly<Record<string, string>> = {
  ausstellung: 'Exhibitions',
  bergtour: 'Mountain tours',
  bouldern: 'Bouldering',
  'burgführung': 'Castles & palaces',
  film: 'Film',
  kajak: 'Kayaking',
  kanutour: 'Canoe tours',
  kino: 'Cinema',
  klettern: 'Climbing',
  langlauf: 'Cross-country skiing',
  mountainbike: 'Mountain biking',
  museumstour: 'Museums',
  'naturführung': 'Nature tours',
  radfahren: 'Cycling',
  rafting: 'Rafting',
  reiten: 'Horse riding',
  'sauna-special': 'Sauna',
  schwimmen: 'Swimming & bathing',
  'segel-tour': 'Sailing',
  ski: 'Skiing',
  snowboard: 'Snowboarding',
  tennis: 'Tennis',
  theater: 'Theatre',
  'thermen-special': 'Thermal baths',
  wandern: 'Hiking',
  wassersport: 'Water sports',
  'wellness-day': 'Wellness',
};

/** Anzeige-Label fuer einen Tag (kuratiert, sonst Prettifier). */
export function activityTagLabel(tag: string, locale = 'de'): string {
  const curated = locale === 'en'
    ? (ACTIVITY_TAG_LABELS_EN[tag] ?? ACTIVITY_TAG_LABELS[tag])
    : ACTIVITY_TAG_LABELS[tag];
  if (curated) return curated;
  return tag
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Kategorie-Chips fuer eine Aktivitaeten-Liste: eindeutige Tag-Labels,
 * sortiert nach Haeufigkeit (dann alphabetisch — deterministisch fuer
 * ISR-Renders), gekappt auf `max`.
 */
export function deriveActivityChips(
  activities: ReadonlyArray<{ tags: string[] | null }>,
  locale = 'de',
  max = 8,
): string[] {
  const counts = new Map<string, number>();
  for (const a of activities) {
    for (const tag of a.tags ?? []) {
      if (typeof tag !== 'string' || tag.trim() === '') continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .slice(0, max)
    .map(([tag]) => activityTagLabel(tag, locale));
}
