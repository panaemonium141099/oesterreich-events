/**
 * destination.one (hubermedia, „et4") in Deutschland (fn-29, Rest-Adapter):
 * Gemeinden betten die Terminsuche einer Experience ein
 * (`pages.destination.one/de/<experience>/…` bzw. `pages.et4.de/…`, als
 * Script, iframe oder `data-experience`). Dieselbe Experience liefert
 * `meta.et4.de/rest.ashx/search/?experience=…&type=Event&template=ET2014A.json`
 * als JSON: Termine (`timeIntervals` mit Offset und `tz`), Ort mit Straße,
 * PLZ, Gemeinde und Koordinaten, Veranstalter, Preistext, Bilder mit
 * Lizenz je Bild, Datensatz-Lizenz in `attributes`. Ein Lizenzschlüssel ist
 * laut Doku nur „für nicht öffentliche Projekte" nötig; antwortet eine
 * Experience mit `INVALID_LICENSE`, ist sie nicht öffentlich und bleibt aus
 * (Kiel, Herne, Castrop-Rauxel am 07.11.2026). REIN, kein I/O.
 */
import { htmlToText } from '@/lib/eventfrog/parse';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { decodeEntities } from '@/lib/utils/decode-entities';

export const ET4_META = 'https://meta.et4.de/rest.ashx/search/';
export const ET4_PAGE_SIZE = 500;

export interface Et4Embed {
  experience: string;
  /** Website der eingebetteten Seiten (`pages.destination.one` oder `pages.et4.de`), für Detail-Links. */
  pagesHost: string;
}

const EXPERIENCE = /^[a-z0-9][a-z0-9_-]{1,80}$/i;

/** Experiences einer Seite in der Reihenfolge ihres Auftretens. */
export function et4Embeds(html: string): Et4Embed[] {
  const out = new Map<string, Et4Embed>();
  const add = (experience: string, pagesHost: string) => {
    const exp = experience.toLowerCase();
    if (EXPERIENCE.test(exp) && !out.has(exp)) out.set(exp, { experience: exp, pagesHost });
  };
  for (const m of html.matchAll(/(pages\.(?:destination\.one|et4\.de))\/(?:de|en)\/([A-Za-z0-9_-]+)\//g)) add(m[2], m[1]);
  for (const m of html.matchAll(/data-experience=["']([A-Za-z0-9_-]+)["']/g)) add(m[1], 'pages.destination.one');
  for (const m of html.matchAll(/<meta[^>]+name=["']experience["'][^>]+content=["']([A-Za-z0-9_-]+)["']/g)) add(m[1], 'pages.destination.one');
  return [...out.values()];
}

export function et4SearchUrl(experience: string, from: string, to: string, offset: number): string {
  const u = new URL(ET4_META);
  u.searchParams.set('experience', experience);
  u.searchParams.set('type', 'Event');
  u.searchParams.set('template', 'ET2014A.json');
  u.searchParams.set('startdate', from);
  u.searchParams.set('enddate', to);
  u.searchParams.set('limit', String(ET4_PAGE_SIZE));
  u.searchParams.set('offset', String(offset));
  return u.href;
}

export function et4DetailUrl(embed: Et4Embed, globalId: string, title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'termin';
  return `https://${embed.pagesHost}/de/${embed.experience}/default/detail/Event/${globalId}/${slug}`;
}

export interface Et4Termin {
  /** `<global_id>@<Beginn>`: ein Termin je Vorkommen. */
  uid: string;
  globalId: string;
  title: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  description?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  organizer?: string;
  category?: string;
  priceText?: string;
  website?: string;
  canonical?: string;
  image?: string;
  imageCredit?: string;
  imageWidth?: number;
  imageHeight?: number;
  lat?: number;
  lng?: number;
  license?: string;
}

interface RawInterval {
  weekdays?: string[] | null;
  start?: string | null;
  end?: string | null;
  repeatUntil?: string | null;
  tz?: string | null;
  freq?: string | null;
  interval?: number | null;
  /** Die Quelle zeigt kein Ende (Baltrum: Ende 23:59 als Platzhalter). */
  hideEnd?: boolean | null;
}

interface RawItem {
  global_id?: string;
  id?: string;
  title?: string;
  categories?: string[] | null;
  texts?: { rel?: string; type?: string; value?: string }[] | null;
  city?: string | null;
  zip?: string | null;
  street?: string | null;
  name?: string | null;
  web?: string | null;
  geo?: { main?: { latitude?: number | null; longitude?: number | null } | null } | null;
  media_objects?: { rel?: string; url?: string; type?: string; license?: string | null; author?: string | null; source?: string | null; width?: number | null; height?: number | null }[] | null;
  timeIntervals?: RawInterval[] | null;
  timeIntervalExceptions?: RawInterval[] | null;
  attributes?: { key?: string; value?: string }[] | null;
  addresses?: { rel?: string; name?: string | null }[] | null;
}

export interface Et4Page {
  status: string;
  message?: string;
  items: Et4Termin[];
  overallCount: number;
}

/** Bildlizenzen, die eine Anzeige mit Nennung erlauben (Datenstand destination.one: CC-Kürzel ohne Bindestrich-Varianten). */
const IMAGE_LICENSE_OK = /^(CC0|CC-?BY|CC-?BY-?SA|PD)$/i;

/**
 * Höchstens so viele Vorkommen je Datensatz, die nächsten zuerst (ein
 * Wochenmarkt: rund sieben Monate, der Nachtlauf zieht nach). Vorher
 * lieferten 353 Datensätze mit 40 und mehr Vorkommen 14.562 von 33.443
 * Zeilen (Prüfstand 07.11.2026).
 */
export const MAX_OCCURRENCES = 30;
/**
 * Dauerangebot wie bei Eventfrog (`src/lib/eventfrog/parse.ts`): mindestens
 * jeden zweiten Tag über 30 Tage (Ausstellungen, Ponyreiten, Öffnungszeiten)
 * ist kein Termin und fällt ganz weg.
 */
export const DAUERANGEBOT_MIN = 15;
export const DAUERANGEBOT_DAYS = 30;

const WEEKDAY: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const DAY = 86_400_000;

const clean = (s: string | null | undefined) => {
  const t = s ? decodeEntities(s).replace(/\s+/g, ' ').trim() : '';
  return t || undefined;
};

/** Wandtag und Uhrzeit aus „2026-11-07T18:00:00+01:00" (Offset der Quelle, Europe/Berlin). */
function wall(iso: string): { date: string; time: string; instant: Date } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso.trim());
  if (!m) return null;
  const instant = new Date(iso.trim());
  if (isNaN(instant.getTime())) return null;
  return { date: m[1], time: m[2], instant };
}

interface Occurrence { localDate: string; start: string; end?: string; allDay: boolean }

const nextDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + DAY).toISOString().slice(0, 10);
const weekdayOf = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/**
 * Vorkommen eines Intervalls im Fenster: ohne `freq` genau eines; mit
 * `freq` Weekly (an `weekdays`) oder Daily ab `start` bis `repeatUntil`,
 * jedes zur Wandzeit des Intervallbeginns an seinem Tag (Sommerzeit über
 * `toUtcInstant`). 00:00 bis 00:00 ist ganztägig (Datum ohne Uhrzeit).
 */
export function expandInterval(iv: RawInterval, from: string, to: string, exceptions: Set<string>): Occurrence[] {
  if (!iv.start) return [];
  const s = wall(iv.start);
  if (!s) return [];
  const e = iv.end && !iv.hideEnd ? wall(iv.end) : null;
  const durationMs = e ? Math.max(0, e.instant.getTime() - s.instant.getTime()) : 0;
  const allDay = s.time === '00:00' && (!e || e.time === '00:00');
  const days = Math.max(1, Math.round(durationMs / DAY));
  const one = (localDate: string): Occurrence | null => {
    if (localDate < from || localDate > to || exceptions.has(localDate)) return null;
    if (allDay) {
      let last = localDate;
      for (let i = 1; i < days; i++) last = nextDay(last);
      return { localDate, start: localDate, allDay: true, ...(last > localDate ? { end: last } : {}) };
    }
    const start = toUtcInstant(`${localDate}T${s.time}:00`) as string;
    const end = durationMs > 0 ? new Date(Date.parse(start) + durationMs).toISOString() : undefined;
    return { localDate, start, end, allDay: false };
  };
  const freq = (iv.freq ?? '').toLowerCase();
  if (freq !== 'weekly' && freq !== 'daily') {
    const o = one(s.date);
    return o ? [o] : [];
  }
  const until = iv.repeatUntil ? wall(iv.repeatUntil)?.date ?? to : to;
  const weekdays = new Set((iv.weekdays ?? []).map(w => WEEKDAY[w]).filter(d => d != null));
  const step = Math.max(1, iv.interval ?? 1);
  const out: Occurrence[] = [];
  let d = s.date;
  for (let i = 0; out.length < DAUERANGEBOT_MIN + MAX_OCCURRENCES && i < 800 && d <= until && d <= to; i++, d = nextDay(d)) {
    if (d < from) continue;
    if (freq === 'daily' && i % step !== 0) continue;
    if (freq === 'weekly') {
      if (weekdays.size ? !weekdays.has(weekdayOf(d)) : weekdayOf(d) !== weekdayOf(s.date)) continue;
      if (Math.floor(i / 7) % step !== 0) continue;
    }
    const o = one(d);
    if (o) out.push(o);
  }
  return out;
}

export function parseEt4Page(json: string, embed: Et4Embed, from: string, to: string): Et4Page {
  const j = JSON.parse(json) as { status?: string; message?: string; overallcount?: number; items?: RawItem[] };
  const items: Et4Termin[] = [];
  for (const it of j.items ?? []) items.push(...toTermine(it, embed, from, to));
  return { status: j.status ?? 'UNKNOWN', message: j.message, items, overallCount: j.overallcount ?? 0 };
}

function text(it: RawItem, rel: string): string | undefined {
  const plain = it.texts?.find(t => t.rel === rel && t.type === 'text/plain')?.value;
  if (plain) return clean(plain) && plain.replace(/\r/g, '').trim();
  const html = it.texts?.find(t => t.rel === rel)?.value;
  return html ? htmlToText(decodeEntities(html)).trim() || undefined : undefined;
}

function toTermine(it: RawItem, embed: Et4Embed, from: string, to: string): Et4Termin[] {
  const globalId = it.global_id ?? (it.id ? `e_${it.id}` : undefined);
  const title = clean(it.title);
  if (!globalId || !title) return [];
  const exceptions = new Set<string>();
  for (const x of it.timeIntervalExceptions ?? []) {
    const w = x.start ? wall(x.start) : null;
    if (w) exceptions.add(w.date);
  }
  const occ = new Map<string, Occurrence>();
  for (const iv of it.timeIntervals ?? []) {
    for (const o of expandInterval(iv, from, to, exceptions)) if (!occ.has(o.start)) occ.set(o.start, o);
  }
  if (!occ.size) return [];
  const sorted = [...occ.values()].sort((a, b) => a.start.localeCompare(b.start));
  if (isDauerangebot(sorted)) return [];
  const lat = it.geo?.main?.latitude, lng = it.geo?.main?.longitude;
  const hasGeo = typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0);
  const zip = /^\d{5}$/.test(it.zip?.trim() ?? '') ? it.zip!.trim() : undefined;
  const img = (it.media_objects ?? []).find(m => m.rel === 'default' && m.url && /^image\//.test(m.type ?? 'image/') && IMAGE_LICENSE_OK.test((m.license ?? '').trim()));
  const canonical = (it.media_objects ?? []).find(m => m.rel === 'canonical' && m.url && /^https?:\/\//.test(m.url))?.url;
  const license = it.attributes?.find(a => a.key === 'license')?.value;
  const base = {
    globalId,
    title,
    description: text(it, 'details') ?? text(it, 'teaser'),
    locationName: clean(it.name),
    street: clean(it.street),
    postalCode: zip,
    locality: clean(it.city),
    organizer: clean(it.addresses?.find(a => a.rel === 'organizer')?.name),
    category: clean(it.categories?.[0]),
    priceText: text(it, 'PRICE_INFO'),
    website: it.web && /^https?:\/\//.test(it.web) ? it.web : undefined,
    canonical,
    ...(img ? {
      image: img.url,
      imageCredit: [clean(img.author) ?? clean(img.source), img.license ? `(${img.license.trim()})` : ''].filter(Boolean).join(' ') || undefined,
      ...(img.width && img.height ? { imageWidth: img.width, imageHeight: img.height } : {}),
    } : {}),
    ...(hasGeo ? { lat, lng } : {}),
    license: license?.trim() || undefined,
  };
  return sorted.slice(0, MAX_OCCURRENCES).map(o => ({ uid: `${globalId}@${o.start}`, ...base, ...o }));
}

/** Mindestens `DAUERANGEBOT_MIN` Vorkommen innerhalb von `DAUERANGEBOT_DAYS` Tagen ab dem ersten. */
export function isDauerangebot(sorted: readonly { localDate: string }[]): boolean {
  if (sorted.length < DAUERANGEBOT_MIN) return false;
  const first = Date.parse(`${sorted[0].localDate}T12:00:00Z`);
  const nth = Date.parse(`${sorted[DAUERANGEBOT_MIN - 1].localDate}T12:00:00Z`);
  return (nth - first) / DAY <= DAUERANGEBOT_DAYS;
}
