/**
 * Zentraler Freigabevertrag ("Admission Gate") — die eine Stelle, die
 * entscheidet, ob ein Event-Kandidat überhaupt geschrieben und ob er
 * veröffentlicht werden darf.
 *
 * WARUM DAS EXISTIERT
 * ───────────────────
 * Bisher leitete sich `publish_status` allein aus `quality_score` ab
 * (src/lib/quality/score-event.ts). Der Score ist additiv: Bild (10),
 * Beschreibung (7), Links (10) und der Default-Dedup-Bonus (10) konnten
 * fehlende Kerninformationen KOMPENSIEREN. Gemessen am Prod-Bestand
 * (2026-09-06):
 *
 *   - 22 künftige Events standen auf `published`, obwohl sie weder
 *     location_name noch Koordinaten hatten (Score 63-70 aus Bild+Text).
 *   - Alle 19 künftigen meetup.com-Events waren US-Veranstaltungen
 *     ("Chandler Local Singles Speed Dating", "Chicago Data Night"),
 *     veröffentlicht mit bundesland='kaernten' und country='AT'.
 *   - `filterValidEvents` verglich nur `slice(0, 10)` — ein Event von
 *     18:00 bis 17:00 desselben Tages passierte den Filter.
 *
 * Der Score bleibt, was er ist: ein Ranking-/Vollständigkeitssignal.
 * Die FREIGABE kommt ab jetzt aus zwingenden fachlichen Regeln.
 *
 * PRINZIP
 * ───────
 * Unbekanntes bleibt unbekannt. Widersprüchliche Kandidaten werden nicht
 * freigegeben. Nichts wird still gelöscht, was nur ungeklärt ist —
 * `quarantine` schreibt die Zeile weiterhin, nimmt ihr aber die
 * Veröffentlichung, damit sie im Admin sichtbar geklärt werden kann.
 *
 * REIN — kein I/O. Die einzige Aussenabhängigkeit (Punkt-in-Polygon für
 * die Bundesland-Gegenprobe) wird als Funktion injiziert, damit das Modul
 * im Unit-Test ohne GeoJSON-Dateien läuft.
 */

/** `reject` = gar nicht schreiben. `quarantine` = schreiben, aber nie publik. */
export type AdmissionDecision = 'admit' | 'quarantine' | 'reject';

export type AdmissionReason =
  // ── reject ──────────────────────────────────────────────────────
  | 'missing_title'
  | 'missing_start_date'
  | 'invalid_start_date'
  | 'invalid_end_date'
  | 'start_in_past'
  | 'end_before_start'
  // ── quarantine ──────────────────────────────────────────────────
  | 'no_location_evidence'
  | 'placeholder_location'
  | 'region_contradicts_coords'
  | 'coords_outside_declared_country'
  | 'foreign_place_signal';

export interface AdmissionInput {
  title?: string | null;
  /** ISO-Instant wie er in `events.start_date` landet. */
  start_date?: string | null;
  end_date?: string | null;

  /** Aufgelöster Ort — das, was tatsächlich in die Zeile geschrieben wird. */
  location_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  bundesland?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Korrekturen, die der Schreibpfad anwenden MUSS, bevor er die Zeile
 * schreibt. Sie entstehen, wenn ein Widerspruch eindeutig aufgelöst
 * werden kann — dann wird das Event nicht zurückgehalten, sondern die
 * nachweislich falsche Angabe entfernt bzw. korrigiert.
 */
export type AdmissionCorrection =
  /** Koordinate ist der Ausreisser → verwerfen (kein falscher Kartenpin). */
  | 'drop_coordinates'
  /** Bundesland-Label ist der Ausreisser → auf `correctedBundesland` setzen. */
  | 'use_coordinate_region';

export interface AdmissionVerdict {
  decision: AdmissionDecision;
  /** Alle zutreffenden Gründe. Landet im Lauf-Report. */
  reasons: AdmissionReason[];
  /** Anzuwendende Korrekturen (siehe `AdmissionCorrection`). */
  corrections: AdmissionCorrection[];
  /** Bei `use_coordinate_region`: das per Polygon belegte Bundesland. */
  correctedBundesland?: string;
}

export interface AdmissionOptions {
  /**
   * Punkt-in-Polygon-Auflösung Koordinate → Bundesland-ID. In Produktion
   * `bundeslandFromPolygon` aus `@/lib/eventim/bundesland-from-geo`;
   * im Test ein Stub. Fehlt sie, entfällt die Gegenprobe still.
   */
  regionOf?: (lat: number, lng: number) => string | null;
  /**
   * PLZ → Bundesland-ID. Dritte, von Koordinate UND Label unabhängige
   * Stimme: sie entscheidet, welche der beiden widersprüchlichen Angaben
   * der Ausreisser ist. In Produktion `getBundeslandFromPLZ` aus
   * `@/lib/plzCoordinates`.
   */
  plzRegionOf?: (plz: string) => string | null;
  /** Referenzzeitpunkt (Tests). Default: jetzt. */
  now?: Date;
}

// Österreich-Bounding-Box — identisch zu score-event.ts.
const AT_LAT_MIN = 46.3;
const AT_LAT_MAX = 49.1;
const AT_LNG_MIN = 9.5;
const AT_LNG_MAX = 17.2;

/**
 * Ortsnamen, die keinen Ort benennen. Ein Scraper, der hier landet, hat
 * den Veranstaltungsort NICHT gefunden und ein Wort eingesetzt.
 *
 * "Österreich" steht hier, weil MeetupScraper fehlende Ortsnamen damit
 * auffüllte UND `location_master_coords` einen Master-Eintrag für den
 * normalisierten Namen "österreich" (→ 48.3069/14.2858, Linz) hatte:
 * jedes so befüllte Event bekam per DB-Trigger einen Linzer Pin.
 */
const PLACEHOLDER_LOCATIONS = new Set([
  'osterreich', 'oesterreich', 'austria',
  'deutschland', 'germany', 'schweiz', 'switzerland',
  'online', 'onlineevent', 'online event', 'virtuell', 'virtual', 'webinar',
  'tba', 'tbd', 'na', 'n a', 'unbekannt', 'unknown', 'diverse',
  'wird bekanntgegeben', 'siehe beschreibung', 'k a', 'keine angabe',
  '-', '--', '?',
]);

/** US-/CA-Bundesstaatskürzel — nur als Endsegment einer Adresse ausgewertet. */
const FOREIGN_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY', 'DC',
  'ON', 'QC', 'BC', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE',
]);

/** Diakritika weg, Kleinschreibung, Satzzeichen zu Leerzeichen. */
function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasText(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

const VIENNA_HMS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function viennaHms(d: Date): { y: number; mo: number; d: number; h: number; m: number; s: number } {
  const out: Record<string, string> = {};
  for (const p of VIENNA_HMS.formatToParts(d)) if (p.type !== 'literal') out[p.type] = p.value;
  // Intl liefert je nach ICU-Version "24" statt "00" für Mitternacht.
  const h = out.hour === '24' ? 0 : Number(out.hour);
  return { y: +out.year, mo: +out.month, d: +out.day, h, m: +out.minute, s: +out.second };
}

/**
 * Trägt der Zeitstempel eine ECHTE Uhrzeit — oder nur eine Platzhalter-
 * Mitternacht?
 *
 * Zwei Platzhalter-Formen kommen im Bestand vor (siehe
 * `src/lib/utils/event-time.ts`): naive `T00:00:00Z` und `T22:00:00Z`
 * (= Wien-Mitternacht im Sommer, aus `viennaToUtc()`). Diese Prüfung
 * arbeitet auf dem geparsten Instant, nicht auf dem String — genau das
 * war der Fehler im alten Datums-Score, wo `endsWith('T00:00:00')` bei
 * `…T00:00:00Z` nicht griff und derselbe Kalendertag je nach Schreibweise
 * 8 oder 13 Punkte bekam.
 */
export function hasTimeOfDay(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  // Naive UTC-Mitternacht.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return false;
  // Wien-Mitternacht (Sommer 22:00Z, Winter 23:00Z) — via Intl, damit der
  // Sommer-/Winterzeitwechsel nicht hart kodiert werden muss.
  const p = viennaHms(d);
  if (p.h === 0 && p.m === 0 && p.s === 0) return false;
  return true;
}

/** `YYYY-MM-DD` des Instants in Wien-Ortszeit. */
export function viennaCalendarDay(d: Date): string {
  const p = viennaHms(d);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/**
 * Zeitintervall prüfen.
 *
 * Regel (Audit §2F): vollständige Zeitpunkte vergleichen, wenn BEIDE eine
 * echte Uhrzeit tragen. Trägt einer von beiden nur ein Kalenderdatum
 * (Platzhalter-Mitternacht), wird auf Kalendertag-Ebene verglichen — sonst
 * würde jedes eintägige Event mit datums-only-Ende (sehr häufig:
 * `start=…T18:00`, `end=…T00:00`) fälschlich verworfen.
 */
export function isEndBeforeStart(startIso: string, endIso: string): boolean {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;

  if (hasTimeOfDay(startIso) && hasTimeOfDay(endIso)) {
    return e.getTime() < s.getTime();
  }
  return viennaCalendarDay(e) < viennaCalendarDay(s);
}

function isOutsideAtBox(lat: number, lng: number): boolean {
  return lat < AT_LAT_MIN || lat > AT_LAT_MAX || lng < AT_LNG_MIN || lng > AT_LNG_MAX;
}

/**
 * Unzweideutiges Auslands-Signal in einem Orts-/Adressfeld eines Events,
 * das als AT deklariert ist.
 *
 * Bewusst eng: nur ein Endsegment, das exakt ein US-/CA-Staatskürzel ist
 * (optional gefolgt von einer 5-stelligen ZIP). "Wien, AT" oder
 * "Graz, Steiermark" lösen nicht aus. Das ist ein Sicherheitsnetz, kein
 * Ersatz für korrekte Adapter — die Meetup-Zeilen mit reinen Firmennamen
 * ("Adyen Chicago Office") erwischt keine Heuristik, die fixt der Adapter.
 *
 * DE/NE sind bewusst NICHT in FOREIGN_STATE_CODES: "…, DE" ist im
 * DACH-Kontext ein Länderkürzel, kein Delaware.
 */
export function hasForeignPlaceSignal(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  const segments = value!.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return false;
  const last = segments[segments.length - 1];
  const m = last.match(/^([A-Z]{2})(\s+\d{5}(-\d{4})?)?$/);
  return !!m && FOREIGN_STATE_CODES.has(m[1]);
}

/**
 * Der Freigabevertrag. Reihenfolge: harte Verwerfungen zuerst, dann die
 * Gründe, die eine Zeile zwar zulassen, aber nicht veröffentlichen.
 */
export function evaluateAdmission(
  input: AdmissionInput,
  options: AdmissionOptions = {},
): AdmissionVerdict {
  const rejects: AdmissionReason[] = [];
  const quarantines: AdmissionReason[] = [];
  const corrections: AdmissionCorrection[] = [];
  let correctedBundesland: string | undefined;

  // ── 1. Identität & Zeit — ohne die gibt es kein Event ──────────────
  if (!hasText(input.title)) rejects.push('missing_title');

  if (!hasText(input.start_date)) {
    rejects.push('missing_start_date');
  } else {
    const start = new Date(input.start_date!);
    if (isNaN(start.getTime())) {
      rejects.push('invalid_start_date');
    } else {
      const now = options.now ?? new Date();
      if (viennaCalendarDay(start) < viennaCalendarDay(now)) {
        rejects.push('start_in_past');
      }

      if (hasText(input.end_date)) {
        const end = new Date(input.end_date!);
        if (isNaN(end.getTime())) {
          rejects.push('invalid_end_date');
        } else if (isEndBeforeStart(input.start_date!, input.end_date!)) {
          rejects.push('end_before_start');
        }
      }
    }
  }

  // ── 2. Ort — ein physisches Event ohne belastbaren Ort ist kein
  //        veröffentlichungsfähiger Eintrag ─────────────────────────
  const hasCoords = input.latitude != null && input.longitude != null;
  const hasPlaceText = hasText(input.location_name) || hasText(input.address);

  if (!hasCoords && !hasPlaceText) {
    quarantines.push('no_location_evidence');
  }

  // Platzhalter-Ortsname ohne jede weitere Ortsangabe: der Scraper hat den
  // Ort nicht gefunden. Koordinaten zählen hier NICHT als Rettung — sie
  // stammen in genau diesen Fällen aus dem Platzhalter selbst
  // (Master-Coord "österreich" → Linz).
  if (hasText(input.location_name)) {
    const norm = normalizePlace(input.location_name!);
    if (PLACEHOLDER_LOCATIONS.has(norm) && !hasText(input.address) && !hasText(input.postal_code)) {
      quarantines.push('placeholder_location');
    }
  }

  // ── 3. Widersprüche zwischen Ortsangaben ──────────────────────────
  if (hasCoords) {
    const lat = input.latitude!;
    const lng = input.longitude!;
    const declaredCountry = (input.country ?? 'AT').toUpperCase();

    if (declaredCountry === 'AT' && isOutsideAtBox(lat, lng)) {
      quarantines.push('coords_outside_declared_country');
    }

    // Bundesland-Gegenprobe per Punkt-in-Polygon. Nur wenn die Auflösung
    // ein Ergebnis liefert UND ein Bundesland deklariert ist — ein
    // grenznaher Punkt ohne Polygon-Treffer bleibt unbewertet statt geraten.
    const regionOf = options.regionOf;
    if (regionOf && hasText(input.bundesland) && !isOutsideAtBox(lat, lng)) {
      const declared = input.bundesland!.trim().toLowerCase();
      const actual = regionOf(lat, lng);

      if (actual && actual !== declared) {
        // Zwei Angaben widersprechen sich; eine davon ist falsch. Statt zu
        // raten (oder pauschal beide zu verwerfen) entscheidet die PLZ als
        // dritte, unabhängige Stimme.
        //
        // Gemessen an 161 Widersprüchen im Prod-Bestand (2026-09-06):
        // 124× stützt die PLZ das Bundesland — die Koordinate ist der
        // Ausreisser. Das sind durchweg generische Ortsnamen ("Haus",
        // "Platz", "Feuerwehrhaus", "Kirchenplatz", "Ronacher"), die auf
        // ein gleichnamiges Dorf in einem anderen Bundesland aufgelöst
        // wurden. 28× stützt die PLZ die Koordinate, das Label war falsch.
        // Nur 9 Fälle bleiben unauflösbar.
        const plzRegion =
          options.plzRegionOf && hasText(input.postal_code)
            ? options.plzRegionOf(input.postal_code!.trim())
            : null;

        if (plzRegion && plzRegion === declared) {
          // Koordinate ist der Ausreisser: kein falscher Pin, aber das
          // Event bleibt publik — es liegt nachweislich in `declared`.
          corrections.push('drop_coordinates');
        } else if (plzRegion && plzRegion === actual) {
          // Label ist der Ausreisser: Koordinate ist durch die PLZ gedeckt.
          corrections.push('use_coordinate_region');
          correctedBundesland = actual;
        } else {
          // Keine dritte Stimme oder eine dritte Antwort — nicht auflösbar.
          quarantines.push('region_contradicts_coords');
        }
      }
    }
  }

  if (
    (input.country ?? 'AT').toUpperCase() === 'AT' &&
    (hasForeignPlaceSignal(input.address) || hasForeignPlaceSignal(input.location_name))
  ) {
    quarantines.push('foreign_place_signal');
  }

  // Eine verworfene Zeile wird gar nicht geschrieben — Korrekturen daran
  // wären gegenstandslos.
  if (rejects.length > 0) return { decision: 'reject', reasons: rejects, corrections: [] };
  if (quarantines.length > 0) {
    return { decision: 'quarantine', reasons: quarantines, corrections, correctedBundesland };
  }
  return { decision: 'admit', reasons: [], corrections, correctedBundesland };
}
