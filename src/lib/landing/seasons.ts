/**
 * Saison-Kalender für die Hero-Karte der Landing.
 *
 * Jede Saison ist ein Kalenderfenster (Monat/Tag, jahresübergreifend
 * erlaubt) mit den Event-Tags aus der Taxonomie (enrichment-taxonomy.ts),
 * die in dieser Zeit Saison haben. Die Reihenfolge ist die Priorität:
 * überlappen zwei Fenster (Silvester liegt im Winter), gewinnt die
 * engere, weiter oben stehende Saison.
 *
 * Die Tags sind gegen Prod gezählt (2026-09-24, kommende 120 Tage):
 * adventmarkt 837, weinfest 498, heurigenfest 254, krampuslauf 218 …
 * Das Datumsfenster der Abfrage ist trotzdem Pflicht, weil der Classifier
 * Tags auch außerhalb der Saison vergibt (adventmarkt schon im September).
 */

export interface Season {
  id: string;
  /** [Monat, Tag] inklusive, 1-basiert. */
  from: [number, number];
  to: [number, number];
  tags: string[];
  /**
   * Wortteile, die im Titel eindeutig nach Saison klingen. Die Tags sind
   * Classifier-Ausgabe und streuen (ein Handwerksmarkt mit „erntedank"),
   * deshalb gehen Events mit Saison-Wort im Titel in der Rotation vor.
   */
  titleHints: string[];
}

export const SEASONS: Season[] = [
  {
    id: 'silvester',
    from: [12, 27], to: [1, 1],
    tags: ['silvester-party', 'ball'],
    titleHints: ['silvester', 'neujahr', 'jahreswechsel', 'ball'],
  },
  {
    id: 'advent',
    from: [11, 14], to: [12, 26],
    tags: ['christkindlmarkt', 'adventmarkt', 'krampuslauf', 'perchtenlauf', 'perchten'],
    titleHints: ['advent', 'christkind', 'krampus', 'percht', 'punsch', 'weihnacht', 'nikolo'],
  },
  {
    id: 'halloween',
    from: [10, 24], to: [10, 31],
    tags: ['halloween-party', 'weinfest', 'heurigenfest', 'erntedank', 'kirtag'],
    titleHints: ['halloween', 'grusel', 'kürbis', 'horror', 'sturm', 'heurig'],
  },
  {
    id: 'fasching',
    from: [1, 7], to: [2, 28],
    tags: ['ball', 'fasching', 'fasching-party'],
    titleHints: ['ball', 'fasching', 'gschnas', 'maskenball', 'krapfen'],
  },
  {
    id: 'winter',
    from: [1, 2], to: [3, 15],
    tags: ['ski', 'langlauf', 'snowboard', 'perchten', 'ball'],
    titleHints: ['ski', 'rodel', 'eislauf', 'percht', 'ball', 'winter'],
  },
  {
    id: 'ostern',
    from: [3, 16], to: [4, 25],
    tags: ['ostermarkt', 'bauernmarkt', 'flohmarkt'],
    titleHints: ['oster', 'palm', 'frühling'],
  },
  {
    id: 'fruehling',
    from: [4, 26], to: [6, 14],
    tags: ['maibaumfest', 'flohmarkt', 'bauernmarkt', 'weinfest', 'geführte-wanderung', 'street-food'],
    titleHints: ['maibaum', 'frühling', 'flohmarkt', 'spargel', 'wein'],
  },
  {
    id: 'sommer',
    from: [6, 15], to: [8, 31],
    tags: ['sonnwendfeier', 'dorffest', 'kirtag', 'feuerwehrfest', 'weinfest', 'street-food', 'outdoor-festival'],
    titleHints: ['sonnwend', 'kirtag', 'open air', 'sommer', 'seefest', 'feuerwehrfest', 'badefest'],
  },
  {
    id: 'herbst',
    from: [9, 1], to: [11, 13],
    tags: ['weinfest', 'heurigenfest', 'heuriger', 'buschenschank', 'erntedank', 'almabtrieb', 'kirtag', 'weinverkostung', 'pilzwanderung'],
    titleHints: ['sturm', 'heurig', 'ernte', 'kürbis', 'kastanie', 'maroni', 'wein', 'kirtag', 'herbst', 'almabtrieb', 'kellergasse'],
  },
];

/** Saison per id (für /entdecken?saison=…), sonst undefined. */
export function seasonById(id: string | null | undefined): Season | undefined {
  return SEASONS.find(s => s.id === id);
}

function viennaYmd(now: Date): [number, number, number] {
  const [y, m, d] = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Vienna' }).split('-').map(Number);
  return [y, m, d];
}

/**
 * Letzter Tag des Saison-Fensters, das heute läuft oder als nächstes kommt
 * (YYYY-MM-DD, Wiener Kalender). Grenze für „Mehr davon“ auf /entdecken:
 * der Classifier vergibt Saison-Tags auch außerhalb der Saison.
 */
export function seasonEndDate(season: Season, now: Date = new Date()): string {
  const [y, m, d] = viennaYmd(now);
  const today = m * 100 + d;
  const to = season.to[0] * 100 + season.to[1];
  const from = season.from[0] * 100 + season.from[1];
  const wraps = from > to;
  // Ende liegt im nächsten Jahr, wenn das Fenster über Neujahr läuft und wir
  // vor Neujahr sind, oder wenn das Ende dieses Jahres schon vorbei ist.
  const nextYear = wraps ? today >= from : today > to;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${nextYear ? y + 1 : y}-${pad(season.to[0])}-${pad(season.to[1])}`;
}

function inWindow(month: number, day: number, s: Season): boolean {
  const v = month * 100 + day;
  const from = s.from[0] * 100 + s.from[1];
  const to = s.to[0] * 100 + s.to[1];
  return from <= to ? v >= from && v <= to : v >= from || v <= to;
}

/** Aktuelle Saison nach Wiener Kalendertag. Jeder Tag des Jahres ist abgedeckt. */
export function currentSeason(now: Date = new Date()): Season {
  const [month, day] = now
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Vienna' })
    .split('-')
    .slice(1)
    .map(Number);
  return SEASONS.find(s => inWindow(month, day, s)) ?? SEASONS[SEASONS.length - 1];
}

/** Klingt der Titel nach der Saison? (Wortteil, ohne Groß-/Kleinschreibung) */
export function titleMatchesSeason(title: string | null | undefined, season: Season): boolean {
  const t = (title ?? '').toLowerCase();
  return season.titleHints.some(h => t.includes(h));
}
