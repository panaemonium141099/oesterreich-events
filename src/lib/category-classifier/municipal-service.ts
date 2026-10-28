/**
 * Gemeinde-Dienste erkennen: Termine aus Gemeinde-Kalendern, die keine
 * Veranstaltungen sind.
 *
 * Entscheidung 2026-10-14: Müllabfuhr und Sammelstellen, Sprechtage und
 * Sprechstunden, Klimaticket-Verleih und Dorfservice werden auf der Seite
 * nirgends gezeigt. Die Zeilen bleiben in der Datenbank, damit die
 * Entscheidung umkehrbar ist. Durchgesetzt wird das im Freigabevertrag
 * (`src/lib/quality/admission.ts`, Grund `municipal_service`), nicht hier.
 *
 * Prod-Stand vor der Regel (sichtbare künftige Termine): Müll 505,
 * Sprechtage 370, Klimaticket 29, Dorfservice 13.
 *
 * Bewusst eng, weil die Regel die Zeile von JEDER Fläche nimmt:
 *   - kein nacktes „Müll" („Topolina rettet den Müll", „Klumpat der
 *     Mülltroll" sind Kinderstücke), kein nacktes „Recycling", „Tonne",
 *     „Abholung" („Friedenslicht Abholung") oder „ASZ" (Baustellen-Hinweis
 *     „Parken im Bereich ehem. ASZ untersagt").
 *   - Gemeinschafts-Aktionen bleiben: Flurreinigung, Plogging,
 *     „Müllsammelaktion" mit Kindern, Repair Café. Deshalb fehlt
 *     „Müllsammlung"; „Sperrmüllsammlung" trifft über „Sperrmüll".
 *   - Baumschnitt nur mit Sammel-/Abgabe-Wort oder als ganzer Titel:
 *     „Obstbaumschnittkurs" ist ein Kurs.
 *   - Echte Veranstaltungen rund um die Entsorgung (Besichtigung
 *     Recyclinghof, Tag der offenen Tür im ASZ, Tauschtag, Infoabend zum
 *     neuen Wertstoffzentrum) nimmt `EVENT_FORMAT` wieder heraus.
 *
 * Sprechtage haben keine solche Ausnahme: gem2go klebt seine Kategorie an
 * den Titel („HebammensprechstundeKurs, Seminar, Tagung, Vortrag, Lesung"),
 * ein Format-Wort ist dort kein Beleg für eine Veranstaltung.
 *
 * REIN, kein I/O.
 */

export type MunicipalServiceKind = 'waste' | 'consultation' | 'klimaticket' | 'dorfservice';

/** Abfuhr, Sammelstellen und Sammelaktionen der Abfallwirtschaft. */
const WASTE_RE = new RegExp(
  [
    '(?:sperr|rest|bio|haus|sonder|gr[üu]n|gift)m[üu]ll',
    'm[üu]ll[- ]?(?:abfuhr|abhol|entsorgung|termin|kalender|hof|s[äa]ck|tonne|insel)',
    'abfuhrtermin', 'abfallsammel', 'abfallwirtschaft', 'abfallkalender', 'bioabfall',
    'altpapier', 'altstoff', 'altglas', 'altkleider', 'altmetall', 'elektroalt', 'elektroschrott',
    'alt[- ]?speise[öo]l', 'speise[öo]l[- ]?(?:entsorgung|sammlung)',
    'problemstoff', 'schadstoffsammlung', 'sperrgut', 'autowrack',
    // Deutsche Entsprechungen (fn-29.2): Restabfall = Restmüll, Blaue Tonne =
    // Papiertonne, Schadstoffmobil und Problemabfall = Problemstoff.
    'restabfall', 'blaue\\s+tonne', 'schadstoffmobil', 'problemabfall',
    'wertstoff[- ]?(?:hof|sammel|zentrum|insel)', 'recycling[- ]?(?:hof|zentrum)', 'deponie',
    '(?:papier|bio|rest)[- ]?tonne', 'papier\\s*-?\\s*(?:rote\\s+)?tonne', 'rote\\s+tonne',
    'gelbe(?:r|n|\\(r\\))?\\s+(?:s[äa]ck|tonne)',
    '(?:leicht|metall|kunststoff)[- ]?verpackung', 'verpackungskunststoff',
    'papier[- ]?(?:abhol|abfuhr|sammlung|entsorgung)',
    'kompost[- ]?(?:abfuhr|sammlung|abhol|tonne)',
    'gr[üu]nschnitt', 'gr[üu]ngut', 'h[äa]cksel(?:dienst|aktion|platz)',
    '(?:christ|weihnachts)b[äa]um\\w*[\\s-]*(?:entsorgung|abhol|abfuhr|sammlung)',
    '(?:abholung|abfuhr|sammlung|entsorgung)\\s+(?:der\\s+)?(?:christ|weihnachts)b[äa]um',
    '(?:agrar|silo|landwirtschafts)[- ]?(?:folie|ballen|planen)',
  ].join('|'),
  'i',
);

/** Baum-/Strauchschnitt ist erst mit Sammel- oder Abgabe-Wort Entsorgung. */
const CUT_RE = /(?<![a-zäöüß])(?:baum|strauch|ast|hecken)\w{0,3}schnitt/i;
const DISPOSAL_RE = /samml|sammel|abfuhr|abhol|übernahme|abgabe|annahme|entsorg|platz|container/i;
/** „Baum- und Strauchschnitt", „Strauchschnitt": nur Schnittgut-Wörter. */
const CUT_ONLY_RE = /^(?:(?:baum|strauch|ast|hecken|gr[üu]n)[\s\-–&,]*(?:und\s+|u\.\s*)?)+schnitt$/i;

/** Altstoffsammelzentrum: als Titelanfang oder mit Sammel-Wort. */
const ASZ_START_RE = /^asz\b/i;
const ASZ_RE = /\basz\b/i;
const ASZ_COLLECT_RE = /samml|sammel|übernahme/i;

/** Ganzer Titel „Müll", „Müll 1". */
const BARE_WASTE_RE = /^m[üu]ll(?:\s*\d+)?$/i;

/** Echte Veranstaltung rund um die Entsorgung — nimmt die Müll-Regel zurück. */
const EVENT_FORMAT_RE = new RegExp(
  [
    'besichtigung', 'besuch (?:im|in der|beim|bei der)', 'tag der offenen t[üu]r', 'ferienspiel', 'ferienhit',
    '(?<![a-zäöüß])f[üu]hrung', 'informationsabend', 'informationsveranstaltung', 'infoabend', 'vortrag', 'ausstellung',
    'lesung', 'workshop', 'kurs\\b', 'tauschtag', 'upcycling', 'flohmarkt', 'theater', 'konzert', 'kabarett',
    'musical', 're-?use[- ]?shop', 'plogging', 'flurreinigung',
  ].join('|'),
  'i',
);

/** Sprechtage, Sprechstunden, Beratungstage (Sozial-, Bau-, Notar-, ÖGK-, SVS-…). */
const CONSULTATION_RE = /sprechtag|sprechstunde|beratungstag/i;

/** „Klimaticket", „VOR-KlimaTicket", „Klimaticket Ö" als ganzer Titel. */
const KLIMATICKET_ONLY_RE = /^(?:(?:vor|oö|nö|ö)[- ]?)?klima[- ]?ticket(?:\s+(?:ö|österreich|vor|oö|nö|classic|region))?$/i;
/** Verleih/Reservierung eines Gemeinde-Klimatickets („VOR-KlimaTicket - Reservierung"). */
const KLIMATICKET_LENDING_RE =
  /klima[- ]?ticket.{0,40}(?:reservier|verleih|ausleih|entlehn|ausgabe)|(?:reservier|verleih|ausleih|entlehn)\w*.{0,40}klima[- ]?ticket/i;

const DORFSERVICE_ONLY_RE = /^dorf-?service$/i;

/**
 * Titel ohne Beiwerk für Ganz-Titel-Vergleiche: Kleinschreibung, leere oder
 * reine Uhrzeit-Klammern der Gemeinde-Registry („Biomüll ( 06:00)",
 * „Dorfservice ()") weg, Leerraum zusammengefasst, Satzzeichen am Rand weg.
 */
function coreTitle(title: string): string {
  return title
    .normalize('NFC')
    .toLowerCase()
    .replace(/\(\s*[\d:.\s-]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–:.,!]+|[\s\-–:.,!]+$/g, '');
}

/** Welche Art Gemeinde-Dienst der Titel benennt, sonst null. */
export function municipalServiceKind(title: string | null | undefined): MunicipalServiceKind | null {
  if (!title) return null;
  const t = title.normalize('NFC').replace(/\s+/g, ' ');
  const core = coreTitle(t);
  if (!core) return null;

  if (CONSULTATION_RE.test(t)) return 'consultation';
  if (KLIMATICKET_ONLY_RE.test(core) || KLIMATICKET_LENDING_RE.test(t)) return 'klimaticket';
  if (DORFSERVICE_ONLY_RE.test(core)) return 'dorfservice';

  const waste =
    WASTE_RE.test(t) ||
    BARE_WASTE_RE.test(core) ||
    (CUT_RE.test(t) && (DISPOSAL_RE.test(t) || CUT_ONLY_RE.test(core))) ||
    ASZ_START_RE.test(core) ||
    (ASZ_RE.test(t) && ASZ_COLLECT_RE.test(t));
  if (waste && !EVENT_FORMAT_RE.test(t)) return 'waste';
  return null;
}

/** Ist der Titel ein Gemeinde-Dienst (kein Event, auf der Seite nicht gezeigt)? */
export function isMunicipalService(title: string | null | undefined): boolean {
  return municipalServiceKind(title) !== null;
}

/**
 * Nur für die Smart-Suche zusätzlich ausgefiltert: öffentliche Sitzungen und
 * Amtsstunden sind keine Freizeit-Treffer, bleiben aber auf der Seite.
 */
const SEARCH_ONLY_ADMIN_RE = /gemeinderatssitzung|amtsstunden|parteienverkehr|m[üu]llsammlung/i;

/**
 * fn-19: Müll- und Amtstermine sind für Freizeit-Suchen Gift — „Sperrmüll
 * Rechnitz" war Top-Treffer für „was geht am samstag im burgenland" und wäre
 * fast in einem Date-Vorschlag gelandet. Gemeinde-Dienste filtert schon der
 * Freigabevertrag von jeder Fläche; die Suche nimmt zusätzlich Sitzungen und
 * Amtsstunden heraus.
 */
export function isWasteOrAdminEvent(title: string | null | undefined): boolean {
  if (!title) return false;
  return isMunicipalService(title) || SEARCH_ONLY_ADMIN_RE.test(title);
}
