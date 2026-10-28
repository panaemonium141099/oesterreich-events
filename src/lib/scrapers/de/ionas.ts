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
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

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

/** iCal-Zeilen entfalten (RFC 5545 3.1). */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/**
 * TEXT-Werte in einem Durchgang entmaskieren: `\n` ist ein Umbruch, jedes
 * andere `\x` steht für x. Neben den RFC-Fällen (`\,` `\;` `\\`) maskieren
 * ionas-Kalender auch Anführungszeichen (`\"Talk am Turm\"`, Nidda 2026-10).
 */
function unescapeText(v: string): string {
  return v.replace(/\\(.)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c)).trim();
}

interface Prop { params: Record<string, string>; value: string }

function parseLine(line: string): [string, Prop] | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [name, ...rawParams] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const [k, v] = p.split('=');
    if (k && v !== undefined) params[k.toUpperCase()] = v;
  }
  return [name.toUpperCase(), { params, value: line.slice(i + 1) }];
}

/** Datum/Uhrzeit eines DTSTART/DTEND: Instant, reines Datum oder null. */
function parseDate(p: Prop): { iso: string; date: string; allDay: boolean } | null {
  const v = p.value.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d || p.params.VALUE === 'DATE') {
    if (!d) return null;
    const date = `${d[1]}-${d[2]}-${d[3]}`;
    return { iso: date, date, allDay: true };
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!t) return null;
  const date = `${t[1]}-${t[2]}-${t[3]}`;
  const wall = `${date}T${t[4]}:${t[5]}:${t[6] ?? '00'}`;
  if (t[7]) return { iso: new Date(`${wall}Z`).toISOString(), date, allDay: false };
  const tz = p.params.TZID ?? 'Europe/Berlin';
  // Europe/Berlin und Europe/Vienna haben dieselben Offsets und
  // Umstellungstage (EU-Sommerzeit); toUtcInstant rechnet Wiener Wandzeit.
  if (tz !== 'Europe/Berlin' && tz !== 'Europe/Vienna') return null;
  return { iso: toUtcInstant(wall) as string, date, allDay: false };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseIonasIcs(text: string): IonasEvent[] {
  const out: IonasEvent[] = [];
  let cur: Map<string, Prop> | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = new Map(); continue; }
    if (line === 'END:VEVENT') {
      if (cur) {
        const e = toEvent(cur);
        if (e) out.push(e);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    // Erstes Vorkommen gewinnt (DTSTAMP steht doppelt im ionas-Export).
    if (p && !cur.has(p[0])) cur.set(p[0], p[1]);
  }
  return out;
}

function text(m: Map<string, Prop>, k: string): string | undefined {
  const v = m.get(k)?.value;
  const t = v ? unescapeText(v) : '';
  return t || undefined;
}

function toEvent(m: Map<string, Prop>): IonasEvent | null {
  const title = text(m, 'SUMMARY');
  const uidRaw = text(m, 'UID');
  const s = m.get('DTSTART') ? parseDate(m.get('DTSTART')!) : null;
  if (!title || !uidRaw || !s) return null;
  const e = m.get('DTEND') ? parseDate(m.get('DTEND')!) : null;
  let end: string | undefined;
  if (s.allDay && e?.allDay) {
    // DTEND;VALUE=DATE ist exklusiv: 7.–10.8. heißt bis einschließlich 9.8.
    const last = addDays(e.date, -1);
    if (last > s.date) end = last;
  } else if (!s.allDay && e && !e.allDay && e.iso > s.iso) {
    // Gleiches oder früheres Ende (15:00–15:00, 10:00–00:00) heißt: Ende unbekannt.
    end = e.iso;
  }
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
