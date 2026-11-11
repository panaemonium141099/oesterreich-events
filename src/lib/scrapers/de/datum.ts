/**
 * Datumsangaben in deutschen Kalenderlisten (fn-29.16): „27.10.2026",
 * „Sa, 7.11.26", „5. November 2026", Spannen „12.–14.12.2026",
 * „12.12. – 14.12.2026", „12. bis 14. Dezember 2026",
 * „25.09.2026 – 31.01.2027". Ein Datum ohne Jahr allein ist keins (welches
 * Jahr, sagt die Seite nicht); nur als Anfang einer Spanne nimmt es Monat
 * und Jahr vom Ende. REIN, kein I/O.
 */

const MONTHS: Record<string, number> = {
  januar: 1, jänner: 1, jaenner: 1, jan: 1,
  februar: 2, feb: 2,
  märz: 3, maerz: 3, mär: 3, mrz: 3,
  april: 4, apr: 4,
  mai: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12,
};

const MONTH = 'Januar|Jänner|Jaenner|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Mrz|Apr|Jun|Jul|Aug|Sept|Sep|Okt|Nov|Dez';

/**
 * Ein Datum (voll oder ohne Jahr) an einer Stelle des Texts. Reihenfolge der
 * Alternativen: volle Formen vor Teilformen, damit „12.12.2026" nicht als
 * „12.12." gelesen wird.
 */
const ATOM = new RegExp(
  [
    String.raw`(?<fd>\d{1,2})\.\s?(?<fm>\d{1,2})\.\s?(?<fy>\d{4}|\d{2})(?![\d])`,
    String.raw`(?<wd>\d{1,2})\.?\s*(?<wm>${MONTH})\.?\s*(?<wy>\d{4})(?!\d)`,
    String.raw`(?<pwd>\d{1,2})\.?\s*(?<pwm>${MONTH})(?![\p{L}])\.?`,
    // „16.10 - 05.11.2026" (Kempen): Anfang ohne Schlusspunkt nur direkt vor
    // einer Spanne, sonst ist „19.30" eine Uhrzeit.
    String.raw`(?<rd>\d{1,2})\.(?<rm>\d{1,2})(?=\s*(?:-|–|—|bis)\s*(?:\p{L}{2,10}\.?,?\s*)?\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4})`,
    String.raw`(?<pd>\d{1,2})\.(?:\s?(?<pm>\d{1,2})\.)?(?![\d])`,
  ].map(s => `(?<![\\d.])(?:${s})`).join('|'),
  'giu',
);

const WEEKDAY = String.raw`(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?,?`;
/** Zwischen zwei Daten einer Spanne: Strich oder „bis", ggf. mit Wochentag. */
const RANGE_GAP = new RegExp(String.raw`^\s*,?\s*(?:-|–|—|bis(?:\s+(?:zum|einschl\.?|einschließlich))?)\s*(?:${WEEKDAY})?\s*(?:den\s+)?$`, 'iu');

interface Atom {
  index: number;
  end: number;
  day: number;
  month?: number;
  year?: number;
}

export interface DateExpr {
  /** YYYY-MM-DD */
  start: string;
  /** Letzter Tag einer Spanne (YYYY-MM-DD). */
  end?: string;
  index: number;
  length: number;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2020 || y > 2039) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function year(raw: string): number {
  return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
}

function atoms(text: string): Atom[] {
  const out: Atom[] = [];
  for (const m of text.matchAll(ATOM)) {
    const g = m.groups!;
    const a: Atom = { index: m.index!, end: m.index! + m[0].length, day: 0 };
    if (g.fd) Object.assign(a, { day: +g.fd, month: +g.fm, year: year(g.fy) });
    else if (g.wd) Object.assign(a, { day: +g.wd, month: MONTHS[g.wm.toLowerCase()], year: +g.wy });
    else if (g.pwd) Object.assign(a, { day: +g.pwd, month: MONTHS[g.pwm.toLowerCase()] });
    else if (g.rd) Object.assign(a, { day: +g.rd, month: +g.rm });
    else Object.assign(a, { day: +g.pd, month: g.pm ? +g.pm : undefined });
    out.push(a);
  }
  return out;
}

/**
 * Alle Daten und Spannen des Texts in Fundreihenfolge. Eine Spanne über
 * mehr als 400 Tage ist keine (eher zwei Angaben), dann zählt nur ihr Ende
 * als eigenes Datum nicht mit dem Anfang zusammen.
 */
export function findDateExprs(text: string): DateExpr[] {
  const list = atoms(text);
  const out: DateExpr[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (b && b.year && b.month && RANGE_GAP.test(text.slice(a.end, b.index))) {
      const month = a.month ?? b.month;
      let y = a.year ?? b.year;
      if (!a.year && month > b.month) y -= 1;
      const endIso = validDate(b.year, b.month, b.day) ? iso(b.year, b.month, b.day) : null;
      const startIso = validDate(y, month, a.day) ? iso(y, month, a.day) : null;
      if (startIso && endIso && startIso <= endIso && Date.parse(endIso) - Date.parse(startIso) <= 400 * 86_400_000) {
        out.push({ start: startIso, ...(endIso > startIso ? { end: endIso } : {}), index: a.index, length: b.end - a.index });
        i++;
        continue;
      }
    }
    if (a.year && a.month && validDate(a.year, a.month, a.day)) {
      out.push({ start: iso(a.year, a.month, a.day), index: a.index, length: a.end - a.index });
    }
  }
  return out;
}

/** Schlüssel einer Angabe: gleiche Angabe zweimal in einer Kachel ist ein Termin. */
export const dateKey = (d: DateExpr) => `${d.start}/${d.end ?? ''}`;

/** Text ohne alle Datumsangaben (auch ohne Jahr), für die Uhrzeitsuche. */
export function withoutDates(text: string): string {
  return text.replace(ATOM, m => ' '.repeat(m.length));
}

/**
 * Tag und Monat ohne Jahr, die zu keiner Spanne gehören („JUNI 5. Juni •
 * 15:00 Uhr" im Kopf einer Eitorfer Kachel, deren Text weiter unten ein
 * anderes Datum mit Jahr nennt, Prüfstand 2026-10-29). Nur mit Monat: ein
 * nackter Tag („1. Vorsitzender") ist kein Datum.
 */
export function yearlessDates(text: string): { day: number; month: number }[] {
  const exprs = findDateExprs(text);
  return atoms(text)
    .filter(a => !a.year && a.month && !exprs.some(e => a.index >= e.index && a.index < e.index + e.length))
    .map(a => ({ day: a.day, month: a.month! }));
}
