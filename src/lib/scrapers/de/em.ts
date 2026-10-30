/**
 * Events Manager (WordPress, „wp-events-plugin"), fn-29.7.
 *
 * Gelesen wird `/events.ics`. Der Export nimmt keine Parameter an (`limit`,
 * `scope`, `page`, `pno` ohne Wirkung, Langenselbold 2026-10-29) und liefert
 * die nächsten Termine ab heute bis zur Grenze der Website (meist 50), nach
 * Beginn sortiert. Zeiten mit `TZID=Europe/Berlin`, Detailseite in `URL`,
 * Ort als `LOCATION` „Name, Straße, Ort, PLZ, Deutschland" (PLZ oft fehlend),
 * Koordinate in `X-APPLE-STRUCTURED-LOCATION` (`geo:Breite,Länge`, oft 0,0).
 * REIN, kein I/O.
 */
import { icalEnd, icalImage, icalText, parseIcalDate, readVEvents, type VEvent } from './ical';
import { asDayIfMidnight, nolisEnd, STREET } from './nolis';

export interface EmEvent {
  /** UID ohne Host („1386@langenselbold.de" → 1386). */
  uid: string;
  url?: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  category?: string;
  /** Bild aus `ATTACH` (Logo/Platzhalter prüft `bild.ts`). */
  image?: string;
  lat?: number;
  lng?: number;
}

const COUNTRY = /^(deutschland|germany|de)$/i;

/**
 * `LOCATION` zerlegen. Events Manager setzt die Teile nach dem Format der
 * Website zusammen: „Name, Straße, Ort, PLZ, Deutschland", „Name, Straße, Ort,
 * Deutschland" oder „Name, Straße, PLZ Ort". Ohne PLZ ist der letzte Teil vor
 * dem Land der Ort, wenn er keine Straße ist.
 */
export function parseEmLocation(raw: string | undefined): Pick<EmEvent, 'locationName' | 'street' | 'postalCode' | 'locality'> {
  if (!raw) return {};
  // Ein Link ist kein Ort (Bensheim „https://nachtderausbildung-bensheim.de/").
  const parts = raw.split(/\s*[\n,]\s*/).map(p => p.trim()).filter(p => p && !/^(https?:\/\/|www\.)/i.test(p));
  while (parts.length && COUNTRY.test(parts[parts.length - 1])) parts.pop();
  // „Kirchplatz, Kirchplatz, Laubach": doppelte Teile einmal.
  for (let i = parts.length - 1; i > 0; i--) if (parts[i] === parts[i - 1]) parts.splice(i, 1);
  if (!parts.length) return {};
  let postalCode: string | undefined, locality: string | undefined;
  const joined = parts.findIndex(p => /^\d{5}\s+\S/.test(p));
  const alone = parts.findIndex(p => /^\d{5}$/.test(p));
  if (joined >= 0) {
    const m = /^(\d{5})\s+(.+)$/.exec(parts[joined])!;
    postalCode = m[1];
    locality = m[2].trim();
    parts.splice(joined);
  } else if (alone >= 0) {
    postalCode = parts[alone];
    const before = parts[alone - 1];
    if (before && !STREET.test(before)) { locality = before; parts.splice(alone - 1); } else parts.splice(alone);
  } else if (parts.length >= 2 && !STREET.test(parts[parts.length - 1])) {
    locality = parts.pop();
  }
  let si = -1;
  for (let i = parts.length - 1; i >= 0; i--) if (STREET.test(parts[i])) { si = i; break; }
  const street = si >= 0 ? parts.splice(si, 1)[0] : undefined;
  return { locationName: parts.length ? parts.join(', ') : undefined, street, postalCode, locality };
}

function geo(m: VEvent): { lat: number; lng: number } | null {
  const v = m.get('X-APPLE-STRUCTURED-LOCATION')?.value ?? '';
  const g = /geo:(-?[\d.]+),(-?[\d.]+)/i.exec(v);
  if (!g) return null;
  const lat = Number(g[1]), lng = Number(g[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;
}

export function parseEmIcs(text: string): EmEvent[] {
  return readVEvents(text).map(toEvent).filter((e): e is EmEvent => e !== null);
}

/**
 * Zeit eines DTSTART/DTEND. `Z` ohne `TZID` ist bei Events Manager die
 * Ortszeit der Website, nicht UTC (Laubach „Repair Café" 14:30Z, Seite
 * 14:30; Schlossvippach, Gommersheim ebenso, 2026-10-29): die Website steht
 * auf Zeitzone UTC. 00:00 heißt ohne Uhrzeit, ein Ende um Mitternacht ist
 * der letzte Tag einschließlich (Leiblfing „Sa. 19. Dezember bis So. 20.
 * Dezember | 00:00 Uhr"), wie bei NOLIS. Echte ganztägige Termine kommen
 * als `VALUE=DATE` mit ausschließlichem Ende (Bergenhusen „Halloween Ralley"
 * 31.10. bis 01.11., Seite „31/10/2026 Ganztägig").
 */
function emDate(m: VEvent, k: string) {
  const p = m.get(k);
  if (!p) return null;
  const wall = /Z$/.test(p.value.trim()) && !p.params.TZID
    ? { params: { ...p.params, TZID: 'Europe/Berlin' }, value: p.value.trim().slice(0, -1) }
    : p;
  return asDayIfMidnight(parseIcalDate(wall));
}

function emEnd(m: VEvent, s: NonNullable<ReturnType<typeof emDate>>): string | undefined {
  const e = emDate(m, 'DTEND');
  return m.get('DTEND')?.params.VALUE === 'DATE' ? icalEnd(s, e) : nolisEnd(s, e);
}

function toEvent(m: VEvent): EmEvent | null {
  const title = icalText(m, 'SUMMARY');
  const uidRaw = icalText(m, 'UID');
  const s = emDate(m, 'DTSTART');
  if (!title || !uidRaw || !s) return null;
  const g = geo(m);
  return {
    uid: uidRaw.replace(/@.*$/, ''),
    url: icalText(m, 'URL'),
    localDate: s.date,
    start: s.iso,
    end: emEnd(m, s),
    allDay: s.allDay,
    title: title.replace(/\s+/g, ' '),
    description: icalText(m, 'DESCRIPTION'),
    ...parseEmLocation(icalText(m, 'LOCATION')),
    category: icalText(m, 'CATEGORIES')?.split(',')[0]?.trim() || undefined,
    image: icalImage(m),
    ...(g ?? {}),
  };
}

/**
 * Antwort an der Grenze der Website (50 Termine, nach Beginn sortiert): ohne
 * den letzten, angeschnittenen Tag; spätere Termine kommen in den folgenden
 * Nächten. Andere Größen bleiben unverändert.
 */
export const EM_LIMIT = 50;
export function emCompleteDays(events: EmEvent[]): EmEvent[] {
  if (events.length !== EM_LIMIT) return events;
  const last = events.reduce((a, e) => (e.localDate > a ? e.localDate : a), events[0].localDate);
  return events.filter(e => e.localDate < last);
}
