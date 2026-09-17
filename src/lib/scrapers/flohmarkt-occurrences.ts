/**
 * flohmarkt.at-Termine aus Boudicca in einzelne Vorkommen auflösen.
 *
 * REIN — kein Netz, kein I/O. Wird von BoudiccaEventsScraper für den
 * Collector `flohmarkt` benutzt und ist deshalb ohne Scraper testbar.
 *
 * WARUM DAS EIGENS EXISTIERT
 * ──────────────────────────
 * flohmarkt.at führt einen wiederkehrenden Markt als EINEN Eintrag, dessen
 * Datum jede Woche weiterrückt. Die restlichen Termine stehen nur als Text
 * in der Beschreibung ("Dieser Markt findet noch an folgenden Tagen
 * statt: …"), die Uhrzeit nur als "8-14 Uhr" in der Adresszeile. Boudicca
 * reicht das 1:1 durch und vergibt für jeden Stand des Eintrags eine neue
 * UUID.
 *
 * Bei uns entstand daraus pro Woche eine neue Zeile, die die Terminliste
 * und die Uhrzeit dieser Woche für immer einfror. Vergangene Ausgaben
 * bleiben seit dem SEO-Fix vom 2026-09-01 erreichbar und werden von
 * Google indexiert — Besucher landeten auf dem Termin vom 26.08. mit
 * "8-14 Uhr" und einer Liste bis 14.10., obwohl der Veranstalter längst
 * 10-17 Uhr und andere Termine gemeldet hatte (Beschwerde Rotes Kreuz
 * Hollabrunn, 2026-09-17). Die Termine nach dem Stillstand von Boudicca
 * (keine neuen Einträge seit 2026-09-03) fehlten ganz.
 *
 * Deshalb:
 *   1. Jeder Termin der Liste wird ein eigenes Vorkommen mit eigener,
 *      STABILER Kennung (Listing-Schlüssel + Tag), damit der wöchentliche
 *      Lauf dieselben Zeilen trifft statt neue anzulegen.
 *   2. Beginn und Ende kommen pro Tag aus dem Uhrzeitbereich; das Ende
 *      war bisher gar nicht gespeichert.
 *   3. Die Kopfzeile mit dem Datum und der Listen-Block verschwinden aus
 *      der Beschreibung — auf einer Einzelseite sind sie entweder
 *      redundant oder (nach einer Woche) falsch.
 */

const MARKER = /Dieser Markt findet noch an folgenden Tagen statt:?/i;
const MARKER_END = /eventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!?/i;

const WEEKDAYS = '(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)';
const MONTHS = '(?:J(?:ä|ae)nner|Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)';

/** "Mittwoch 02. September 2026" — Tag ein- oder zweistellig, Monat als Wort. */
const DATE_RE = new RegExp(`${WEEKDAYS}\\s+(\\d{1,2})\\.\\s*(${MONTHS})\\s+(\\d{4})`, 'gi');

/** Kopfzeile: "Mittwoch 02. September 2026" oder "Freitag 18. September 2026 - Samstag 19.  September 2026". */
const HEADER_LINE_RE = new RegExp(
  `^\\s*${WEEKDAYS}\\s+\\d{1,2}\\.\\s*${MONTHS}\\s+\\d{4}(?:\\s*[-–]\\s*${WEEKDAYS}\\s+\\d{1,2}\\.\\s*${MONTHS}\\s+\\d{4})?\\s*$`,
  'i',
);

/**
 * "10-17 Uhr", "12-13:30 Uhr", "07-16 Uhr", "9.30-15.00 Uhr". Beide Seiten
 * höchstens zweistellig, damit Telefonnummern ("059144-57004") nicht als
 * Uhrzeit durchgehen; das "Uhr" dahinter ist Pflicht.
 */
const TIME_RANGE_RE = /(?<![\d.:])(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr\b/i;

const MONTH_INDEX: Record<string, number> = {
  'jänner': 1, 'jaenner': 1, 'januar': 1,
  'februar': 2,
  'märz': 3, 'maerz': 3,
  'april': 4,
  'mai': 5,
  'juni': 6,
  'juli': 7,
  'august': 8,
  'september': 9,
  'oktober': 10,
  'november': 11,
  'dezember': 12,
};

/** Mehr als ein Jahr wöchentlich — alles darüber ist ein Parser-Fehler. */
const MAX_OCCURRENCES = 60;

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface FlohmarktTimeRange {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface FlohmarktEntry {
  /** Boudicca `startDate`: Instant mit Zone, nackte Wandzeit oder reines Datum. */
  start: string;
  end: string | null;
  description: string | null;
}

export interface FlohmarktOccurrence {
  /** Wiener Kalendertag `yyyy-mm-dd`. */
  date: string;
  /**
   * Nackte Wiener Wandzeit `yyyy-mm-ddTHH:MM:00` — der Schreibpfad
   * (`normalizeEventTimestamps`) macht daraus den UTC-Instant, je Tag
   * DST-korrekt. Reines Datum, wenn die Quelle keine Uhrzeit kennt.
   */
  start: string;
  end: string | null;
}

/** Letztes Pfadsegment der flohmarkt.at-Detailseite — identifiziert den Markt. */
export function flohmarktListingKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const segment = path.slice(path.lastIndexOf('/') + 1).trim();
  if (!segment || /^https?:$/i.test(segment) || /^[\w.-]+\.[a-z]{2,}$/i.test(segment)) return null;
  return segment;
}

function toIsoDate(day: string, month: string, year: string): string | null {
  const m = MONTH_INDEX[month.toLowerCase()];
  const d = parseInt(day, 10);
  if (!m || d < 1 || d > 31) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Alle Termine hinter dem Listen-Marker als `yyyy-mm-dd`, in Textreihenfolge. */
export function parseFlohmarktDateList(description: string | null | undefined): string[] {
  if (!description) return [];
  const markerAt = description.search(MARKER);
  if (markerAt === -1) return [];
  const tail = description.slice(markerAt);
  const dates: string[] = [];
  for (const m of tail.matchAll(DATE_RE)) {
    const iso = toIsoDate(m[1], m[2], m[3]);
    if (iso) dates.push(iso);
  }
  return dates;
}

/** Erster Uhrzeitbereich der Beschreibung ("10-17 Uhr"). */
export function parseFlohmarktTimeRange(description: string | null | undefined): FlohmarktTimeRange | null {
  if (!description) return null;
  const m = TIME_RANGE_RE.exec(description);
  if (!m) return null;
  const start = { hour: parseInt(m[1], 10), minute: m[2] ? parseInt(m[2], 10) : 0 };
  const end = { hour: parseInt(m[3], 10), minute: m[4] ? parseInt(m[4], 10) : 0 };
  for (const t of [start, end]) {
    if (t.hour > 24 || t.minute > 59) return null;
  }
  return { start, end };
}

/**
 * Datums-Kopfzeile und Terminlisten-Block entfernen, Whitespace glätten.
 * Alles andere (Titelzeilen, Adresse mit Uhrzeit, Kontakt) bleibt.
 */
export function stripFlohmarktScheduleBlock(description: string): string {
  let text = description.replace(/\r\n?/g, '\n');

  const markerAt = text.search(MARKER);
  if (markerAt !== -1) {
    const endMatch = MARKER_END.exec(text.slice(markerAt));
    const cutEnd = endMatch ? markerAt + endMatch.index + endMatch[0].length : text.length;
    text = text.slice(0, markerAt) + text.slice(cutEnd);
  }

  const lines = text
    .split('\n')
    .map(line => line.replace(/[ \t ]+/g, ' ').trim())
    .filter(line => line.length > 0);

  if (lines.length > 0 && HEADER_LINE_RE.test(lines[0])) lines.shift();

  return lines.join('\n');
}

// ─── Wandzeit-Hilfen ──────────────────────────────────────────────────────

const VIENNA_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Vienna',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

interface WallClock {
  date: string;
  time: TimeOfDay | null;
}

/**
 * Boudicca-Zeitangabe → Wiener Kalendertag + Uhrzeit. Reine Datumswerte
 * bleiben ohne Uhrzeit (Platzhalter-Vertrag, siehe normalize-date.ts).
 */
function toViennaWallClock(raw: string): WallClock | null {
  const trimmed = raw.trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dateOnly) return { date: dateOnly[1], time: null };

  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/.exec(trimmed);
  if (naive) return { date: naive[1], time: { hour: +naive[2], minute: +naive[3] } };

  const instant = new Date(trimmed);
  if (isNaN(instant.getTime())) return null;
  const parts = VIENNA_FMT.formatToParts(instant);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? 0 : parseInt(get('hour'), 10);
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: { hour, minute: parseInt(get('minute'), 10) },
  };
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.UTC(...splitDate(toDate)) - Date.UTC(...splitDate(fromDate))) / 86_400_000);
}

function splitDate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m - 1, d];
}

function addDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(...splitDate(iso)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function wall(date: string, time: TimeOfDay): string {
  return `${date}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`;
}

function minutes(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

/**
 * Ein Vorkommen pro Kalendertag: der Boudicca-Tag plus alle Tage der
 * Terminliste ab diesem Tag. Beginn ist die Boudicca-Uhrzeit (sie folgt
 * dem Uhrzeitbereich der Quelle, aber sie ist die verbindliche Angabe);
 * das Ende kommt aus Boudicca, sonst aus dem Uhrzeitbereich.
 */
export function expandFlohmarktOccurrences(entry: FlohmarktEntry): FlohmarktOccurrence[] {
  const base = toViennaWallClock(entry.start);
  if (!base) return [];

  const range = parseFlohmarktTimeRange(entry.description);
  const startTime: TimeOfDay | null = base.time ?? range?.start ?? null;

  // Ende: Boudicca-Ende (mit Tagesabstand) vor Textbereich vor nichts.
  let endTime: TimeOfDay | null = null;
  let endDayOffset = 0;
  const boudiccaEnd = entry.end ? toViennaWallClock(entry.end) : null;
  if (boudiccaEnd?.time && startTime) {
    endDayOffset = daysBetween(base.date, boudiccaEnd.date);
    if (endDayOffset > 0 || (endDayOffset === 0 && minutes(boudiccaEnd.time) > minutes(startTime))) {
      endTime = boudiccaEnd.time;
    } else {
      endDayOffset = 0;
    }
  } else if (range && startTime && minutes(range.end) > minutes(startTime)) {
    endTime = range.end;
  }

  const dates = new Set<string>([base.date]);
  for (const d of parseFlohmarktDateList(entry.description)) {
    if (d >= base.date) dates.add(d);
    if (dates.size >= MAX_OCCURRENCES) break;
  }

  return [...dates].sort().map(date => {
    if (!startTime) return { date, start: date, end: null };
    return {
      date,
      start: wall(date, startTime),
      end: endTime ? wall(addDays(date, endDayOffset), endTime) : null,
    };
  });
}
