/**
 * iCal-Kern der DE-Adapter (fn-29.5/6): Zeilen entfalten, TEXT entmaskieren,
 * DTSTART/DTEND lesen. Die Feldwahl (welches X-Feld trägt den Ort) bleibt
 * beim Adapter. REIN, kein I/O.
 */
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { looksLikeImageFile } from './bild';

export interface Prop { params: Record<string, string>; value: string }
export type VEvent = Map<string, Prop>;

/** iCal-Zeilen entfalten (RFC 5545 3.1). */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/**
 * TEXT-Werte in einem Durchgang entmaskieren: `\n` ist ein Umbruch, jedes
 * andere `\x` steht für x. Neben den RFC-Fällen (`\,` `\;` `\\`) maskieren
 * ionas-Kalender auch Anführungszeichen (`\"Talk am Turm\"`, Nidda 2026-10).
 */
export function unescapeText(v: string): string {
  return v.replace(/\\(.)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c)).trim();
}

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

/** Alle VEVENTs; je Eigenschaft gewinnt das erste Vorkommen (DTSTAMP steht im ionas-Export doppelt). */
export function readVEvents(text: string): VEvent[] {
  const out: VEvent[] = [];
  let cur: VEvent | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = new Map(); continue; }
    if (line === 'END:VEVENT') {
      if (cur) out.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    if (p && !cur.has(p[0])) cur.set(p[0], p[1]);
  }
  return out;
}

export function icalText(m: VEvent, k: string): string | undefined {
  const v = m.get(k)?.value;
  const t = v ? unescapeText(v) : '';
  return t || undefined;
}

/**
 * Bild des Termins aus `ATTACH`: mit `FMTTYPE=image/…` (ionas) oder als
 * Bilddatei ohne Typangabe (Events Manager). Prüfung auf Logo, Wappen und
 * Platzhalter in `bild.ts`.
 */
export function icalImage(m: VEvent): string | undefined {
  const p = m.get('ATTACH');
  const v = p?.value.trim();
  if (!p || !v || p.params.VALUE === 'BINARY') return undefined;
  const typed = (p.params.FMTTYPE ?? '').toLowerCase();
  if (typed && !typed.startsWith('image/')) return undefined;
  return typed || looksLikeImageFile(v) ? v : undefined;
}

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Datum/Uhrzeit eines DTSTART/DTEND: Instant (ISO, UTC) oder reines Datum
 * bei `VALUE=DATE`. `date` ist der Kalendertag in deutscher Ortszeit, auch
 * bei UTC-Zeiten (NOLIS: 23:30Z am 31.12. ist der 1.1.).
 */
export function parseIcalDate(p: Prop): { iso: string; date: string; allDay: boolean } | null {
  const v = p.value.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d || p.params.VALUE === 'DATE') {
    if (!d) return null;
    const date = `${d[1]}-${d[2]}-${d[3]}`;
    return { iso: date, date, allDay: true };
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!t) return null;
  const wall = `${t[1]}-${t[2]}-${t[3]}T${t[4]}:${t[5]}:${t[6] ?? '00'}`;
  if (t[7] || p.params.TZID === 'UTC') {
    const instant = new Date(`${wall}Z`);
    return { iso: instant.toISOString(), date: BERLIN_DAY.format(instant), allDay: false };
  }
  const tz = p.params.TZID ?? 'Europe/Berlin';
  // Europe/Berlin und Europe/Vienna haben dieselben Offsets und
  // Umstellungstage (EU-Sommerzeit); toUtcInstant rechnet Wiener Wandzeit.
  if (tz !== 'Europe/Berlin' && tz !== 'Europe/Vienna') return null;
  return { iso: toUtcInstant(wall) as string, date: wall.slice(0, 10), allDay: false };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ende aus DTSTART/DTEND: `VALUE=DATE` ist exklusiv (7. bis 10.8. heißt bis
 * einschließlich 9.8.); ein gleiches oder früheres Ende (15:00 bis 15:00,
 * 10:00 bis 00:00) heißt Ende unbekannt.
 */
export function icalEnd(s: { iso: string; date: string; allDay: boolean }, e: { iso: string; date: string; allDay: boolean } | null): string | undefined {
  if (!e) return undefined;
  if (s.allDay && e.allDay) {
    const last = addDays(e.date, -1);
    return last > s.date ? last : undefined;
  }
  if (!s.allDay && !e.allDay && e.iso > s.iso) return e.iso;
  return undefined;
}
