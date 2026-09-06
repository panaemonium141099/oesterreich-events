/**
 * Zeit-Primitiven für Events — eine Quelle für Anzeige UND JSON-LD.
 *
 * Hintergrund (gemessen 2026-09-05 gegen Prod + DB):
 *
 *  - `start_date` liegt in Supabase als UTC-Instant. Die Anzeige-Formatter
 *    riefen `toLocaleTimeString()` ohne `timeZone` auf, liefen also in der
 *    Zeitzone der Runtime: serverseitig UTC. Ein Event um 19:00 Wien wurde
 *    im SSR-HTML als "17:00" gerendert — für Googlebot und für jeden User,
 *    bevor React hydratisiert. Deshalb hängt hier überall `timeZone` dran.
 *
 *  - 32,5 % der zukünftigen Events haben **keine bekannte Uhrzeit**. Sie
 *    liegen als Platzhalter in der DB und wurden trotzdem mit einer erfundenen
 *    Uhrzeit angezeigt (meist "02:00"). `hasKnownStartTime()` erkennt die zwei
 *    Platzhalter-Formen, damit Anzeige und Schema die Uhrzeit weglassen
 *    statt zu raten.
 *
 * Alles hier ist rein und ohne I/O — läuft im Client-Bundle wie im RSC.
 */

/** IANA-Zone aller Events auf der Plattform. */
export const EVENT_TZ = 'Europe/Vienna';

const VIENNA_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface ViennaParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

/** Zerlegt einen Instant in seine Wien-lokalen Kalenderfelder. */
function viennaParts(d: Date): ViennaParts {
  const out: Record<string, string> = {};
  for (const p of VIENNA_PARTS.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  // Intl liefert je nach ICU-Version "24" statt "00" für Mitternacht.
  if (out.hour === '24') out.hour = '00';
  return out as unknown as ViennaParts;
}

/**
 * UTC-Offset von Europe/Vienna am gegebenen Instant, in Minuten.
 * Muss pro Datum berechnet werden — Sommerzeit ist +02:00, Winter +01:00.
 */
export function viennaOffsetMinutes(d: Date): number {
  const p = viennaParts(d);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  // Millisekunden abschneiden: formatToParts kennt keine, sonst driftet der Offset.
  const utcSeconds = Math.floor(d.getTime() / 1000) * 1000;
  return Math.round((asUtc - utcSeconds) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** `2026-10-01T19:00:00+02:00` — Wien-Ortszeit mit explizitem Offset. */
export function toViennaIso(d: Date): string {
  const p = viennaParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${formatOffset(viennaOffsetMinutes(d))}`;
}

/** `2026-10-01` — Wien-lokaler Kalendertag. */
export function toViennaDate(d: Date): string {
  const p = viennaParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Ende eines date-only-Events auf den gemeinten Kalendertag zurückrechnen.
 *
 * Nur ein Fall braucht die Korrektur: synthetische "Ende des UTC-Tages"-Marker
 * (`23:59:59Z`), die es in Wien-Ortszeit auf den Folgetag kippen — aus einem
 * Ein-Tages-Event würde sonst ein Zwei-Tages-Event.
 *
 * NICHT korrigiert werden dürfen:
 *   - `T00:00:00Z` (nacktes Datum wie "2026-09-17") — gemeint ist genau
 *     dieser Tag, Wien-Datum stimmt bereits.
 *   - `T22:00:00Z` aus viennaToUtc() — das IST Wien-Mitternacht des
 *     gemeinten End-Tages, das Wien-Datum ist also ebenfalls korrekt.
 * Deshalb greift die Verschiebung ausschliesslich ab UTC-Stunde 23.
 */
export function viennaEndDate(d: Date): string {
  const isUtcEndOfDay = d.getUTCHours() >= 23;
  return toViennaDate(isUtcEndOfDay ? new Date(d.getTime() - 4 * 3600_000) : d);
}

export function parseEventDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Felder, die für die Uhrzeit-Heuristik relevant sind. */
export interface EventTiming {
  start_date: string;
  is_all_day?: boolean | null;
  duration_type?: string | null;
}

/**
 * Ist die Startuhrzeit echt — oder nur ein Platzhalter?
 *
 * `src/lib/pipeline/normalize-date.ts` kennt intern eine `startPrecision`
 * ('exact' | 'day_only'), verwirft sie aber beim Write in Supabase (es gibt
 * keine Spalte dafür). Wir rekonstruieren die Information deshalb aus den
 * beiden eindeutigen Platzhalter-Formen, statt eine Spalte + Backfill über
 * 280k Zeilen zu bauen:
 *
 *   A) `T00:00:00Z`  — naive Mitternacht, Wien-lokal 02:00 (32,5 % der Rows)
 *   B) `T22:00:00Z`  — aus viennaToUtc(); Wien-lokal 00:00 am **Folgetag**
 *
 * Falsch-negativ-Risiko: ein Event, das echt um 00:00 oder 02:00 Wien startet,
 * verliert die Uhrzeit. Der **Tag** bleibt in beiden Fällen korrekt, und der
 * Anteil echter 2-Uhr-Events ist verschwindend gegenüber den Platzhaltern.
 */
export function hasKnownStartTime(event: EventTiming): boolean {
  if (event.is_all_day) return false;
  if (event.duration_type === 'ganztag' || event.duration_type === 'dauerausstellung') return false;

  const d = parseEventDate(event.start_date);
  if (!d) return false;

  // Form A: naive Mitternacht in UTC.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return false;

  // Form B: Wien-lokal exakt Mitternacht.
  const p = viennaParts(d);
  if (p.hour === '00' && p.minute === '00' && p.second === '00') return false;

  return true;
}

export interface FormattedEventDate {
  /** z. B. "Donnerstag, 1. Oktober" */
  date: string;
  /** "19:00" — oder null, wenn die Uhrzeit nur ein Platzhalter ist. */
  time: string | null;
  /** Anzeigefertig: "Donnerstag, 1. Oktober · 19:00" bzw. ohne Uhrzeit. */
  label: string;
}

/**
 * Formatiert Datum + Uhrzeit eines Events in Wien-Ortszeit.
 *
 * `dateOptions` erlaubt den Aufrufern ihre gewohnte Länge (long/short).
 * Die Uhrzeit entfällt, wenn sie laut `hasKnownStartTime()` erfunden wäre —
 * lieber "Donnerstag, 1. Oktober" als ein falsches "02:00".
 */
export function formatEventDate(
  event: EventTiming,
  intlLocale: string,
  dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): FormattedEventDate {
  const d = parseEventDate(event.start_date);
  if (!d) return { date: '', time: null, label: '' };

  const date = d.toLocaleDateString(intlLocale, { ...dateOptions, timeZone: EVENT_TZ });
  const time = hasKnownStartTime(event)
    ? d.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', timeZone: EVENT_TZ })
    : null;

  return { date, time, label: time ? `${date} · ${time}` : date };
}
