/**
 * Dorffeste der Startseite: Kirtage, Zeltfeste, Feuerwehr- und Pfarrfeste,
 * Maibaumaufstellen, Sonnwendfeuer, Frühschoppen, Erntedank, Martiniloben,
 * Mostkost, Kellergassenfeste. Pur, ohne I/O; die Abfrage liegt in
 * get-landing-data.ts, die Auswahl in landing-picks.ts, der Listen-Link in
 * /entdecken (`?thema=dorffeste`).
 *
 * Zwei Befunde aus Prod (2026-10-30, 30 Tage voraus) bestimmen die Regeln:
 *
 *  - Die Fest-Tags des Classifiers streuen (Tag `dorffest`: 144 Zeilen,
 *    darunter „Sparefroh Weltspartag" und „Veranstaltungskalender 2027")
 *    UND fehlen fast überall, wo sie hingehören (3 von 116 Fest-Titeln wie
 *    „Feuerwehrfest", „Erntedank" tragen einen). Deshalb holt die Abfrage
 *    den Pool über Tags ODER Titel (`DORFFEST_POOL_FILTER`) und der Titel
 *    entscheidet (`isDorffestEvent`).
 *  - Das Wortende „…fest" allein ist zu schwach: Manifest, Hochfest,
 *    Lesefest, „Björn von Morgenstern - Kreisverkehrfest" (Kabarett),
 *    „Monika Martin - Frühschoppen" (Konzert). Darum zwei Stufen: ein
 *    starkes Wort (Kirtag, Maibaum, Martiniloben, …) reicht; ein schwaches
 *    (…fest, Frühschoppen, Dämmerschoppen) zählt nur, wenn die Zeile als
 *    Fest eingeordnet ist (Kategorie „Märkte & Feste" oder Fest-Tag) und
 *    nicht aus dem Ticket-Feed (Eventim) kommt.
 */

/** Taxonomie-Tags (enrichment-taxonomy.ts, Achse Märkte & Feste). */
export const DORFFEST_TAGS = [
  'dorffest', 'kirtag', 'pfarrfest', 'feuerwehrfest', 'heurigenfest',
  'stadtfest', 'schützenfest', 'maibaumfest', 'sonnwendfeier',
  'frühschoppen', 'dämmerschoppen', 'weinfest', 'erntedank', 'almabtrieb',
] as const;
const TAG_SET = new Set<string>(DORFFEST_TAGS);

/** Primärkategorie der Taxonomie, in der Feste landen. */
export const FEST_CATEGORY = 'Märkte & Feste';

/** Fenster der Auswahl in Wiener Tagen ab heute. */
export const DORFFESTE_DAYS = 30;

const pattern = (words: string[]) => new RegExp(words.map(w => w.replace(/[-\s]/g, '[-\\s]?')).join('|'));

/**
 * Wörter, die allein ein Dorffest belegen. Recherche 2026-10-30
 * (salzburgerland.com, noe.gv.at, Prod-Titel): Kirtag/Kirchtag/Kiritag,
 * Maibaum (Aufstellen, Umschneiden, Kraxeln), Sonnwend- und Johannisfeuer,
 * Bierzelt/Zeltfest, Feuerwehrfest (auch „FF-Fest"), Erntedank, Weinlese,
 * Mostkost, Martiniloben, Almabtrieb, Fetzenmarkt, Oktoberfest sowie die
 * Fest-Komposita der Taxonomie (Dorffest, Pfarrfest, Weinfest, …).
 */
const STRONG = pattern([
  'kirtag', 'kirchtag', 'kiritag', 'kirchweih',
  'maibaum', 'sonnwend', 'johannisfeuer', 'osterfeuer',
  'bierzelt', 'zeltfest', 'festzelt', 'oktoberfest',
  'feuerwehrfest', 'ff-fest', 'ff fest', 'feuerwehrheurig',
  'erntedank', 'weinlese', 'mostkost', 'weinkost',
  'martiniloben', 'almabtrieb', 'fetzenmarkt',
  'dorffest', 'pfarrfest', 'weinfest', 'heurigenfest', 'stadtfest',
  'seefest', 'schützenfest', 'sturmfest', 'musikfest', 'kellergassenfest',
]);

/**
 * Schwache Hinweise: „…fest" als Wortende (Herbstfest, Festl), nicht
 * Festival/Festspiele/Festakt (Buchstabe nach „fest"); Frühschoppen und
 * Dämmerschoppen (auch Konzertformate).
 */
const WEAK = /fest(e|es|l|ln|erl)?(?![a-zäöüß])|frühschoppen|fruehschoppen|dämmerschoppen|daemmerschoppen/;

/** Nie ein Dorffest, auch mit Fest-Wort. */
const NEVER = pattern([
  'manifest', 'hochfest', 'reformationsfest', 'festmesse', 'festgottesdienst',
  'festkonzert', 'ausstellung', 'vortrag', 'lesung', 'kellergassenführung',
]);

export function isDorffestTitle(title: string | null | undefined): boolean {
  const t = (title ?? '').toLowerCase();
  return !!t && !NEVER.test(t) && (STRONG.test(t) || WEAK.test(t));
}

export interface DorffestCandidate {
  title: string | null;
  tags?: string[] | null;
  category?: string | null;
  source_name?: string | null;
}

/** Ticket-Feed-Zeilen (Eventim) tragen Konzerte, keine Dorffeste. */
const isTicketFeed = (e: DorffestCandidate) => /eventim/i.test(e.source_name ?? '');

/** Starkes Wort reicht; schwaches nur als eingeordnetes Fest außerhalb des Ticket-Feeds. */
export function isDorffestEvent(e: DorffestCandidate): boolean {
  const t = (e.title ?? '').toLowerCase();
  if (!t || NEVER.test(t)) return false;
  if (STRONG.test(t)) return true;
  if (!WEAK.test(t) || isTicketFeed(e)) return false;
  return e.category === FEST_CATEGORY || (e.tags ?? []).some(tag => TAG_SET.has(tag));
}

/** Titel-Wörter der Abfrage, weit gefasst (Festival rutscht mit durch). */
const TITLE_WORDS = [
  'fest', 'kirtag', 'kirchtag', 'kiritag', 'kirchweih', 'maibaum', 'sonnwend',
  'johannisfeuer', 'osterfeuer', 'schoppen', 'bierzelt', 'ff-fest',
  'erntedank', 'weinlese', 'mostkost', 'weinkost', 'martiniloben', 'almabtrieb',
  'fetzenmarkt',
];

/**
 * PostgREST-`or`-Filter des Pools: Fest-Tag ODER Fest-Wort im Titel.
 * Festivals und Festspiele hält die Abfrage mit `DORFFEST_POOL_EXCLUDE`
 * draußen, sonst füllten Eventim-Festivals den Pool.
 */
export const DORFFEST_POOL_FILTER = [
  `tags.ov.{${DORFFEST_TAGS.join(',')}}`,
  ...TITLE_WORDS.map(w => `title.ilike.%${w}%`),
].join(',');

export const DORFFEST_POOL_EXCLUDE = ['%festival%', '%festspiel%'] as const;

/** Thema-Kennung des Listen-Links (/entdecken?thema=…). */
export const DORFFESTE_THEMA = 'dorffeste';

export const DORFFESTE_HREF = `/entdecken?thema=${DORFFESTE_THEMA}`;
