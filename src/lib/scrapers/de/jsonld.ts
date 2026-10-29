/**
 * Schema.org-Events aus JSON-LD einer HTML-Seite (fn-29.7 MEC; Grundlage für
 * den allgemeinen Parser fn-29.16). REIN, kein I/O.
 *
 * Zeiten: die Wandzeit aus `startDate`/`endDate` als deutsche Ortszeit; der
 * Versatz im String zählt nicht, weil Websites mit festem Versatz („+01:00"
 * im Sommer) ihn falsch setzen (fn-29.7 Tribe: Seite und iCal zeigen die
 * Wandzeit). Ein reines Datum ist ganztägig, 00:00 ohne Ende ebenso.
 */
import { decodeEntities } from '@/lib/utils/decode-entities';
import { htmlToText } from '@/lib/eventfrog/parse';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

export interface LdEvent {
  name: string;
  url?: string;
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
  lat?: number;
  lng?: number;
}

type Json = Record<string, unknown>;

const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = decodeEntities(v).replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** Alle Objekte mit `@type` Event (auch Unterarten wie MusicEvent) aus allen JSON-LD-Blöcken. */
export function ldEventObjects(html: string): Json[] {
  const out: Json[] = [];
  const visit = (x: unknown): void => {
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== 'object') return;
    const o = x as Json;
    if (o['@graph']) visit(o['@graph']);
    const t = o['@type'];
    if ((Array.isArray(t) ? t : [t]).some(v => typeof v === 'string' && /Event$/.test(v))) out.push(o);
  };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1].trim())); } catch { /* kaputtes JSON-LD: auslassen */ }
  }
  return out;
}

const WALL = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

function wall(v: unknown): { date: string; time?: string } | null {
  const m = typeof v === 'string' ? WALL.exec(v.trim()) : null;
  if (!m) return null;
  return { date: m[1], time: m[2] ? `${m[2]}:${m[3]}:${m[4] ?? '00'}` : undefined };
}

function address(loc: Json | undefined): Pick<LdEvent, 'street' | 'postalCode' | 'locality'> {
  const a = loc?.address;
  if (!a || typeof a !== 'object') return {};
  const o = a as Json;
  const zip = str(o.postalCode);
  return {
    street: str(o.streetAddress),
    postalCode: zip && /^\d{5}$/.test(zip) ? zip : undefined,
    locality: str(o.addressLocality),
  };
}

export function toLdEvent(o: Json): LdEvent | null {
  const name = str(o.name);
  const s = wall(o.startDate);
  if (!name || !s) return null;
  if (typeof o.eventStatus === 'string' && /Cancelled$/.test(o.eventStatus)) return null;
  const e = wall(o.endDate);
  const midnight = s.time === '00:00:00' && (!e || !e.time || e.time === '00:00:00' || e.time.startsWith('23:59'));
  const allDay = !s.time || midnight;
  let start: string, end: string | undefined;
  if (allDay) {
    start = s.date;
    end = e && e.date > s.date ? e.date : undefined;
  } else {
    start = toUtcInstant(`${s.date}T${s.time}`) as string;
    // Ende 00:00 oder 23:59 ist das Tagesende, keine Uhrzeit (wie NOLIS).
    end = e?.time && e.time !== '00:00:00' && !e.time.startsWith('23:59') ? (toUtcInstant(`${e.date}T${e.time}`) as string) : undefined;
    if (end && end <= start) end = undefined;
  }
  const loc = (Array.isArray(o.location) ? o.location[0] : o.location) as Json | undefined;
  const geo = loc?.geo as Json | undefined;
  const lat = Number(geo?.latitude), lng = Number(geo?.longitude);
  const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Json | undefined;
  const org = (Array.isArray(o.organizer) ? o.organizer[0] : o.organizer) as Json | undefined;
  return {
    name,
    url: str(o.url) ?? str(offers?.url) ?? str(o['@id']),
    localDate: s.date,
    start,
    end,
    allDay,
    description: typeof o.description === 'string' ? htmlToText(decodeEntities(o.description)) || undefined : undefined,
    locationName: str(loc?.name),
    ...address(loc),
    organizer: str(org?.name),
    ...(geo && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : {}),
  };
}

export function ldEventsFromHtml(html: string): LdEvent[] {
  return ldEventObjects(html).map(toLdEvent).filter((e): e is LdEvent => e !== null);
}
