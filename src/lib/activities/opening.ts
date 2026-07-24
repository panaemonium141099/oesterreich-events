/**
 * Normalisierung der Deskline-Oeffnungszeiten (fn-18, Epic E8).
 *
 * Deskline liefert `openingTimes` als flaches Array
 *   { dateFrom: 'YYYY-MM-DDT00:00:00', dateTo: '...', timeFrom: 'HH:MM',
 *     timeTo: 'HH:MM', weekdays: <int-Bitmaske> }
 * (live verprobt 2026-07-24 gegen /{region}/de/infrastructures).
 *
 * Persistierter Vertrag (`poi_activities.opening_times`, EINZIGER Lesepfad
 * fuer "Jetzt geoeffnet"-Badge + Noindex-Gate):
 *   Array von { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD',
 *               timeFrom: 'HH:MM', timeTo: 'HH:MM',
 *               weekdays: <Bitmaske Mo=1..So=64> | null }
 *   - weekdays null = alle Tage (Deskline 0 und 127 werden dahin normalisiert;
 *     die Deskline-Bitmaske ist ebenfalls Mo=1..So=64, live gegen
 *     Restaurant-Ruhetage verifiziert)
 *   - timeFrom == timeTo == '00:00' = durchgehend geoeffnet
 *   - vergangene Saisonfenster bleiben erhalten (Filterung ist Sache des
 *     Lesers); das Deskline-Original wandert zusaetzlich unveraendert in
 *     opening_times_raw (Debug/Reprocessing).
 *
 * Ausgabe deterministisch: valide Fenster dedupliziert und sortiert nach
 * (from, to, timeFrom, timeTo, weekdays); nicht parsebare Eintraege werden
 * uebersprungen. Null, wenn kein einziges valides Fenster uebrig bleibt.
 */

/** Wochentags-Bits des Vertrags (identisch zur Deskline-Bitmaske). */
export const WEEKDAY_BITS = {
  mo: 1, di: 2, mi: 4, do: 8, fr: 16, sa: 32, so: 64,
} as const;

/** Bitmaske "alle 7 Tage" — wird zu null (= alle Tage) normalisiert. */
const ALL_WEEKDAYS = 127;

export interface NormalizedOpeningWindow {
  /** Saisonbeginn 'YYYY-MM-DD'. */
  from: string;
  /** Saisonende 'YYYY-MM-DD'. */
  to: string;
  /** 'HH:MM'; '00:00'/'00:00' = durchgehend geoeffnet. */
  timeFrom: string;
  /** 'HH:MM'. */
  timeTo: string;
  /** Bitmaske Mo=1..So=64; null = alle Tage. */
  weekdays: number | null;
}

/**
 * 'YYYY-MM-DD' aus Deskline-Datumsstrings ('2026-05-05T00:00:00').
 * Semantisch validiert: nicht existierende Kalenderdaten ('2026-13-40',
 * '2026-02-30') werden verworfen — dieses Modul speist den EINZIGEN
 * persistierten opening_times-Lesepfad, kaputte Upstream-Daten duerfen
 * nicht als valide Fenster durchrutschen.
 */
function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * 'HH:MM' aus 'HH:MM' oder 'HH:MM:SS'. Nur reale Uhrzeiten 00:00-23:59 —
 * '24:xx' liefert Deskline nicht (Mitternacht/durchgehend ist im Vertrag
 * '00:00') und wird verworfen. Fehlende/leere Zeiten sind INVALIDE (Fenster
 * wird uebersprungen): '00:00'/'00:00' bedeutet im Vertrag "durchgehend
 * geoeffnet" und darf nur entstehen, wenn die Quelle das explizit sendet —
 * unvollstaendige Upstream-Daten duerfen nie als 24/7 publiziert werden.
 */
function parseTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] === undefined ? 0 : Number(m[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/** Bitmaske 1..126 bleibt; 0 / 127 / fehlend / invalide -> null (alle Tage). */
function parseWeekdays(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  if (raw <= 0 || raw >= ALL_WEEKDAYS) return null;
  return raw;
}

function windowSortKey(w: NormalizedOpeningWindow): string {
  return `${w.from}|${w.to}|${w.timeFrom}|${w.timeTo}|${w.weekdays ?? -1}`;
}

/**
 * Normalisiert das rohe Deskline-`openingTimes`-Array in den E8-Vertrag.
 * Null bei fehlendem/leerem/komplett unparsebarem Input.
 */
export function normalizeOpeningTimes(raw: unknown): NormalizedOpeningWindow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const byKey = new Map<string, NormalizedOpeningWindow>();
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    const from = parseDate(e.dateFrom);
    const to = parseDate(e.dateTo);
    if (!from || !to || to < from) continue;

    const timeFrom = parseTime(e.timeFrom);
    const timeTo = parseTime(e.timeTo);
    if (timeFrom == null || timeTo == null) continue;

    const window: NormalizedOpeningWindow = {
      from,
      to,
      timeFrom,
      timeTo,
      weekdays: parseWeekdays(e.weekdays),
    };
    byKey.set(windowSortKey(window), window);
  }

  if (byKey.size === 0) return null;
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, w]) => w);
}
