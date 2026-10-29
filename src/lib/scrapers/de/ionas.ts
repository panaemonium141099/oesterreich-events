/**
 * ionas-Kalender (TVM-Modul, Chamaeleon AG; auch ekom21 cms21), fn-29.5.
 *
 * Gelesen wird der iCal-Export `…/event.ics?weekends=false&tagMode=ALL&start=…&end=…`
 * neben dem `events.json` der Registry. Er trägt, was das JSON nicht hat:
 * Straße, PLZ und Ort des Veranstaltungsorts (`X-STREET-ADDRESS`,
 * `X-POSTAL-CODE`, `X-LOCALITY`), den Veranstalter (`X-ORGANIZER-NAME`) und
 * eine stabile UID. Ohne `start`/`end` liefert der Feed ein Fenster, das
 * ganz in der Vergangenheit liegen kann (Poggensee 2026-10-28).
 *
 * Wiederholungen kommen als einzelne VEVENTs (keine RRULE in 709 geprüften
 * Terminen aus 10 Feeds). REIN, kein I/O.
 */
import { icalEnd, icalText, parseIcalDate, readVEvents, type VEvent } from './ical';

export interface IonasEvent {
  /** UID ohne Datumsanhang (eine UID kann mehrere Termine tragen). */
  uid: string;
  /** Kalendertag des Beginns in Ortszeit (Teil der source_id). */
  localDate: string;
  /** Instant (ISO, UTC) oder reines Datum bei ganztägigen Terminen. */
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  url?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  organizer?: string;
  category?: string;
  lat?: number;
  lng?: number;
}

export function parseIonasIcs(text: string): IonasEvent[] {
  return readVEvents(text).map(toEvent).filter((e): e is IonasEvent => e !== null);
}

const text = icalText;

function toEvent(m: VEvent): IonasEvent | null {
  const title = text(m, 'SUMMARY');
  const uidRaw = text(m, 'UID');
  const s = m.get('DTSTART') ? parseIcalDate(m.get('DTSTART')!) : null;
  if (!title || !uidRaw || !s) return null;
  const end = icalEnd(s, m.get('DTEND') ? parseIcalDate(m.get('DTEND')!) : null);
  const geo = text(m, 'GEO')?.split(';').map(Number);
  const hasGeo = !!geo && geo.length === 2 && geo.every(Number.isFinite) && !(geo[0] === 0 && geo[1] === 0);
  return {
    uid: uidRaw.replace(/:\d{4}-\d{2}-\d{2}$/, ''),
    localDate: s.date,
    start: s.iso,
    end,
    allDay: s.allDay,
    title: title.replace(/\s+/g, ' '),
    description: text(m, 'DESCRIPTION'),
    url: text(m, 'URL'),
    locationName: text(m, 'X-LOCATION-NAME') ?? text(m, 'LOCATION'),
    street: text(m, 'X-STREET-ADDRESS'),
    postalCode: text(m, 'X-POSTAL-CODE'),
    locality: text(m, 'X-LOCALITY'),
    organizer: text(m, 'X-ORGANIZER-NAME'),
    category: text(m, 'CATEGORIES') ?? text(m, 'X-IONAS-CATEGORY'),
    ...(hasGeo ? { lat: geo![0], lng: geo![1] } : {}),
  };
}

/** iCal-URL des Kalenders zum `events.json` der Registry, mit Zeitfenster. */
export function ionasIcsUrl(eventsJsonUrl: string, from: string, to: string): string {
  const u = new URL(eventsJsonUrl);
  u.pathname = u.pathname.replace(/events\.json$/, 'event.ics');
  u.search = '';
  u.searchParams.set('weekends', 'false');
  u.searchParams.set('tagMode', 'ALL');
  u.searchParams.set('start', from);
  u.searchParams.set('end', to);
  return u.href;
}
