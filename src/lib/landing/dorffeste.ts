/**
 * Dorffeste der Startseite: Kirtage, Zeltfeste, Feuerwehr- und Pfarrfeste,
 * Frühschoppen. Pur, ohne I/O; die Abfrage liegt in get-landing-data.ts,
 * die Auswahl in landing-picks.ts, der Listen-Link in /entdecken
 * (`?thema=dorffeste`).
 *
 * Zwei Hürden, weil die Tags allein streuen (Prod 2026-10-30, Tag
 * `dorffest`, 30 Tage: 144 Zeilen, darunter „Sparefroh Weltspartag" und
 * „Veranstaltungskalender 2027"): die Tags aus der Taxonomie grenzen den
 * Pool ein, der Titel muss nach Fest klingen (`isDorffestTitle`).
 */

/** Taxonomie-Tags (enrichment-taxonomy.ts, Achse Märkte & Feste). */
export const DORFFEST_TAGS = [
  'dorffest', 'kirtag', 'pfarrfest', 'feuerwehrfest', 'heurigenfest',
  'stadtfest', 'schützenfest', 'maibaumfest', 'sonnwendfeier',
  'frühschoppen', 'dämmerschoppen', 'weinfest',
] as const;

/** Fenster der Auswahl in Wiener Tagen ab heute. */
export const DORFFESTE_DAYS = 30;

/** Wortteile, die im Titel eindeutig nach Fest klingen. */
const WORD_HINTS = /kirtag|kirchtag|kiritag|bierzelt|zeltfest|frühschoppen|fruehschoppen|dämmerschoppen|daemmerschoppen|maibaum|sonnwend|martiniloben|dorffest/;

/**
 * „…fest" als Wortende oder Festzelt: Dorffest, Weinfest, Seefest, Festl.
 * Nicht Festival, Festspiele, Festakt (Buchstabe nach „fest").
 */
const FEST_ENDING = /fest(e|es|l|ln|erl|zelt)?(?![a-zäöüß])/;

export function isDorffestTitle(title: string | null | undefined): boolean {
  const t = (title ?? '').toLowerCase();
  if (!t) return false;
  return WORD_HINTS.test(t) || FEST_ENDING.test(t);
}

/**
 * PostgREST-`or`-Filter für den Pool, weit gefasst (Festival rutscht mit
 * durch); `isDorffestTitle` entscheidet in der Auswahl.
 */
export const DORFFEST_TITLE_FILTER = [
  'fest', 'kirtag', 'kirchtag', 'kiritag', 'bierzelt', 'schoppen',
  'maibaum', 'sonnwend', 'martiniloben',
].map(w => `title.ilike.%${w}%`).join(',');

/** Thema-Kennung des Listen-Links (/entdecken?thema=…). */
export const DORFFESTE_THEMA = 'dorffeste';

export const DORFFESTE_HREF = `/entdecken?thema=${DORFFESTE_THEMA}`;
