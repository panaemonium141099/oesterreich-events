/**
 * NOLIS-Kalender (NOLIS-Manager V3.5, NOLIS GmbH Nienburg), fn-29.6.
 *
 * Gelesen wird der iCal-Export „vCalendar exportieren"
 * `/veranstaltungen/veranstaltungen.ical?…&selected_kommune=<ID>&…` mit dem
 * vollständigen Parametersatz der Registry (gekürzt kommt 1 Termin) und
 * eigener Zahl der Tage ab heute (`auswahl_woche_tage`; Barsbüttel
 * 2026-10-28: 28 Tage 47 Termine, 365 Tage 91). Höchstens 1.000 Termine je
 * Abruf.
 *
 * Felder: Zeiten in UTC (`Z`), jeder Termin ein VEVENT mit eigener
 * `X-ID` = `<KommuneID>_<TerminID>`, Ort als `LOCATION` („Name, Straße,\n
 * PLZ Ort"), dazu `X-ORT` und `X-KOMMUNE`. `GEO` steht als Länge;Breite
 * (Barsbüttel „GEO:10.2087;53.5617"), oft `0;0`. REIN, kein I/O.
 */
import { icalEnd, icalText, parseIcalDate, readVEvents, type VEvent } from './ical';

export interface NolisEvent {
  /** Termin-ID aus `X-ID` (je Termin eindeutig, auch über Kommunen geteilt). */
  uid: string;
  kommuneId: string;
  kommune?: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  /** `URL`: meist eine Website des Veranstalters, bei Marburg der Terminlink. */
  url?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  /** `X-ORT`: Ort des Termins in der Kommune (auch Ortsteil). */
  ort?: string;
  organizer?: string;
  category?: string;
  cancelled: boolean;
  lat?: number;
  lng?: number;
}

const STREET = /(stra(ß|ss)e|str\.|weg|platz|allee|gasse|ring|damm|chaussee|ufer|markt|hof|berg|feld)\b.*\d|\d+\s*[a-z]?$/i;

/**
 * `LOCATION` zerlegen: „Kindergarten Falkennest, Falkenstraße 9L,\n22885
 * Barsbüttel" → Name, Straße, PLZ, Ort. Ohne PLZ bleibt der ganze Text der
 * Ortsname.
 */
export function parseNolisLocation(raw: string | undefined): Pick<NolisEvent, 'locationName' | 'street' | 'postalCode' | 'locality'> {
  if (!raw) return {};
  const parts = raw.split(/\s*[\n,]\s*/).map(p => p.trim()).filter(Boolean);
  const plzIdx = parts.findIndex(p => /^\d{5}\s+\S/.test(p));
  if (plzIdx < 0) return { locationName: parts.join(', ') };
  const m = /^(\d{5})\s+(.+)$/.exec(parts[plzIdx])!;
  const before = parts.slice(0, plzIdx);
  // Die Straße steht meist vor der PLZ, manchmal vor dem Namen
  // („Waldenburger Weg 2, DRK Ortsverein Barsbüttel, 22885 Barsbüttel").
  let si = -1;
  for (let i = before.length - 1; i >= 0; i--) if (STREET.test(before[i])) { si = i; break; }
  const street = si >= 0 ? before.splice(si, 1)[0] : undefined;
  return {
    locationName: before.length ? before.join(', ') : undefined,
    street,
    postalCode: m[1],
    // „22885 22885 Barsbüttel" (Stellau): doppelte PLZ weg.
    locality: m[2].replace(/^\d{5}\s+/, '').trim(),
  };
}

/**
 * GEO als Koordinate: NOLIS schreibt Länge;Breite. Die Reihenfolge ist für
 * Deutschland eindeutig (Breite 47 bis 55, Länge 5 bis 15 überlappen nicht);
 * passt keine, gilt der Punkt nicht. `0;0` ist kein Punkt.
 */
export function nolisGeo(v: string | undefined): { lat: number; lng: number } | null {
  const n = v?.split(';').map(Number);
  if (!n || n.length !== 2 || !n.every(Number.isFinite)) return null;
  const [a, b] = n;
  const lat = (x: number) => x >= 47.2 && x <= 55.1;
  const lng = (x: number) => x >= 5.8 && x <= 15.1;
  if (lng(a) && lat(b)) return { lat: b, lng: a };
  if (lat(a) && lng(b)) return { lat: a, lng: b };
  return null;
}

export function parseNolisIcs(text: string): NolisEvent[] {
  return readVEvents(text).map(toEvent).filter((e): e is NolisEvent => e !== null);
}

const BERLIN_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

type IcalDate = NonNullable<ReturnType<typeof parseIcalDate>>;

/**
 * Lokale Mitternacht in UTC (23:00Z im Winter, 22:00Z im Sommer) heißt bei
 * NOLIS „ohne Uhrzeit": die Detailseite zeigt nur den Tag („Mi., 28.10.2026",
 * Amt Märkische Schweiz). Ein solches DTEND ist der letzte Tag
 * EINSCHLIESSLICH (Rheder Weihnachtsmarkt DTEND 05.12. 23:00Z, Seite „Do.,
 * 03.12. bis So., 06.12."), anders als `VALUE=DATE`.
 */
function asDayIfMidnight(d: IcalDate | null): IcalDate | null {
  if (!d || d.allDay || BERLIN_TIME.format(new Date(d.iso)) !== '00:00:00') return d;
  return { iso: d.date, date: d.date, allDay: true };
}

function nolisEnd(s: IcalDate, e: IcalDate | null): string | undefined {
  if (!e) return undefined;
  if (s.allDay) return e.date > s.date ? e.date : undefined;
  // Uhrzeit bis Mitternacht: Ende unbekannt statt eines erfundenen 00:00.
  if (e.allDay) return undefined;
  // „bis 23:59:59" steht für das Tagesende, nicht für eine Uhrzeit
  // (Marburg: 566 von 577 Terminen).
  if (BERLIN_TIME.format(new Date(e.iso)).startsWith('23:59')) return undefined;
  return icalEnd(s, e);
}

function toEvent(m: VEvent): NolisEvent | null {
  const title = icalText(m, 'SUMMARY');
  const xid = /^(\d+)_(\d+)$/.exec(icalText(m, 'X-ID') ?? '');
  const s = asDayIfMidnight(m.get('DTSTART') ? parseIcalDate(m.get('DTSTART')!) : null);
  if (!title || !xid || !s) return null;
  const e = asDayIfMidnight(m.get('DTEND') ? parseIcalDate(m.get('DTEND')!) : null);
  const geo = nolisGeo(icalText(m, 'GEO'));
  return {
    uid: xid[2],
    kommuneId: xid[1],
    kommune: icalText(m, 'X-KOMMUNE'),
    localDate: s.date,
    start: s.iso,
    end: nolisEnd(s, e),
    allDay: s.allDay,
    title: title.replace(/\s+/g, ' '),
    description: icalText(m, 'DESCRIPTION') ?? icalText(m, 'X-KURZBESCHREIBUNG'),
    url: icalText(m, 'URL'),
    ...parseNolisLocation(icalText(m, 'LOCATION')),
    ort: icalText(m, 'X-ORT'),
    organizer: icalText(m, 'X-ORGANIZER')?.split('\n')[0].trim() || undefined,
    category: icalText(m, 'CATEGORIES'),
    cancelled: /^CANCELLED$/i.test(icalText(m, 'STATUS') ?? ''),
    ...(geo ?? {}),
  };
}

/** Höchstzahl der Termine je Abruf. */
export const NOLIS_MAX = 1000;

/**
 * Gekappte Antwort (NOLIS_MAX Termine, nach Beginn sortiert): ohne den
 * letzten Tag, der angeschnitten sein kann. Sonst unverändert.
 */
export function completeDays(events: NolisEvent[], onCut?: (n: number, lastDay: string) => void): NolisEvent[] {
  if (events.length < NOLIS_MAX) return events;
  const last = events.reduce((a, e) => (e.localDate > a ? e.localDate : a), events[0].localDate);
  onCut?.(events.length, last);
  return events.filter(e => e.localDate < last);
}

const ymd = (d: string) => d.replace(/-/g, '');

/**
 * iCal-URL für die Tage von `from` bis `to`; die übrigen Parameter der
 * Registry bleiben. Maßgeblich ist `auswahl_woche_tage` ab heute, `beginn`
 * und `ende` stehen nur der Vollständigkeit halber im Parametersatz.
 */
export function nolisIcsUrl(feedUrl: string, from: string, to: string): string {
  const u = new URL(feedUrl);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  u.searchParams.set('zeitauswahl', '1');
  u.searchParams.set('auswahl_woche_tage', String(days));
  u.searchParams.set('beginn', `${ymd(from)}000000`);
  u.searchParams.set('ende', `${ymd(to)}235959`);
  return u.href;
}

/**
 * Detailseite eines Termins: `/regional/veranstaltungen/<slug>-<Termin>-<Kommune>.html`
 * (der Slug ist frei, maßgeblich sind die IDs). Marburg zeigt Termine in
 * einer eigenen Oberfläche, die Detailseite ist dort nur der Kalender; der
 * Terminlink steht im `URL`-Feld (`…#/veranstaltungen/…` auf derselben Website).
 */
export function nolisDetailUrl(feedUrl: string, ev: Pick<NolisEvent, 'uid' | 'kommuneId' | 'title' | 'url'>): string {
  const origin = new URL(feedUrl).origin;
  if (ev.url) {
    try {
      const u = new URL(ev.url);
      if (u.host === new URL(origin).host && /#\/veranstaltungen\//.test(u.hash + '/')) return u.href;
    } catch { /* kein gültiger Link */ }
  }
  const slug = ev.title.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '') || 'termin';
  return `${origin}/regional/veranstaltungen/${slug}-${ev.uid}-${ev.kommuneId}.html`;
}
