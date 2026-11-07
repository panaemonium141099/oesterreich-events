/**
 * Veranstaltungskalender „ILE Rhön-Grabfeld" (lkrg.net, Software sqronline),
 * fn-29 Rest-Adapter. Die TYPO3-Seiten der Gemeinden binden das Snippet
 * `snippets.lkrg.net/<Token>/general_event_calendar_sqr/snippet.js` ein,
 * das Kalender-Element trägt `data-moddivuuids` (eine oder mehrere UUIDs
 * des Kalender-Moduls); die Vue-App lädt die Termine von
 * `https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=<UUID>`
 * (aus `app.dab64e19.js`, 07.11.2026): JSON-Liste mit Titel, Veranstalter,
 * Beschreibung (HTML), Ort, Straße, „PLZ Ort", Start-/Enddatum, Uhrzeiten,
 * Kategorie und Bildern (files1.sqronline.de). REIN, kein I/O.
 */
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { htmlToText } from '@/lib/eventfrog/parse';
import { decodeEntities } from '@/lib/utils/decode-entities';

export const LKRG_API = 'https://aht1gh-api.sqronline.de/api/modules/events/getevents';

export interface LkrgEmbed {
  uuids: string[];
  /** `data-url` des Elements, sonst `LKRG_API`. */
  api: string;
}

/** Kalender-Element der Seite: nur mit dem lkrg-Snippet, nur UUIDs. */
export function lkrgEmbed(html: string): LkrgEmbed | null {
  if (!/snippets\.lkrg\.net\/[A-Za-z0-9_-]+\/general_event_calendar_sqr\/snippet\.js/.test(html)) return null;
  const el = /<[a-z]+[^>]*data-moddivuuids=["']([^"']+)["'][^>]*>/i.exec(html);
  if (!el) return null;
  const uuids = el[1].split(',').map(s => s.trim().toLowerCase()).filter(s => /^[0-9a-f-]{36}$/.test(s));
  if (!uuids.length) return null;
  const api = /data-url=["'](https?:\/\/[^"']+)["']/.exec(el[0])?.[1] ?? LKRG_API;
  return { uuids, api };
}

export function lkrgEventsUrl(embed: LkrgEmbed, uuid: string): string {
  const u = new URL(embed.api);
  u.searchParams.set('module_division_uuid', uuid);
  return u.href;
}

export interface LkrgTermin {
  uid: string;
  title: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  description?: string;
  organizer?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  category?: string;
  priceText?: string;
  ticketUrl?: string;
  image?: string;
}

interface RawEvent {
  id?: number;
  uuid?: string;
  event_titel?: string | null;
  event_veranstalter?: string | null;
  event_beschreibung?: string | null;
  event_ort?: string | null;
  event_strasse?: string | null;
  event_plzort?: string | null;
  event_startdatum?: string | null;
  event_enddatum?: string | null;
  event_startzeit?: string | null;
  event_endzeit?: string | null;
  event_category?: string | null;
  event_vorverkauf?: string | null;
  event_vorverkauf_link?: string | null;
  freigegeben?: number | boolean | null;
  active?: number | boolean | null;
  image?: { direct_url?: string | null; url?: string | null }[] | null;
}

const clean = (s: string | null | undefined) => {
  const t = s ? decodeEntities(s).replace(/\s+/g, ' ').trim() : '';
  return t || undefined;
};

export function parseLkrgEvents(json: string, today: string): LkrgTermin[] {
  const j = JSON.parse(json) as RawEvent[] | { status?: number; msg?: string };
  if (!Array.isArray(j)) throw new Error(`lkrg: ${(j as { msg?: string }).msg ?? 'keine Liste'}`);
  const out: LkrgTermin[] = [];
  for (const e of j) {
    const t = toTermin(e, today);
    if (t) out.push(t);
  }
  return out;
}

function toTermin(e: RawEvent, today: string): LkrgTermin | null {
  if (e.freigegeben === 0 || e.freigegeben === false || e.active === 0 || e.active === false) return null;
  const title = clean(e.event_titel);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(e.event_startdatum ?? '') ? e.event_startdatum! : null;
  if (!title || !day || !e.uuid) return null;
  const endDay = /^\d{4}-\d{2}-\d{2}$/.test(e.event_enddatum ?? '') ? e.event_enddatum! : undefined;
  // Vergangene Termine liefert die API mit; der Kalender zeigt nur kommende.
  if ((endDay ?? day) < today) return null;
  const time = /^(\d{2}:\d{2})/.exec(e.event_startzeit ?? '')?.[1];
  const endTime = /^(\d{2}:\d{2})/.exec(e.event_endzeit ?? '')?.[1];
  const allDay = !time;
  const start = allDay ? day : (toUtcInstant(`${day}T${time}:00`) as string);
  let end: string | undefined;
  if (allDay) end = endDay && endDay > day ? endDay : undefined;
  else if (endTime) end = toUtcInstant(`${endDay ?? day}T${endTime}:00`) as string;
  else if (endDay && endDay > day) end = toUtcInstant(`${endDay}T23:59:00`) as string;
  const plzOrt = /^(\d{5})\s+(.+)$/.exec(clean(e.event_plzort) ?? '');
  const img = (e.image ?? []).map(i => i.direct_url ?? i.url).find(u => u && /^https?:\/\//.test(u));
  return {
    uid: e.uuid,
    title,
    localDate: day,
    start,
    end: end && end > start ? end : undefined,
    allDay,
    description: e.event_beschreibung ? htmlToText(decodeEntities(e.event_beschreibung)).trim() || undefined : undefined,
    organizer: clean(e.event_veranstalter),
    locationName: clean(e.event_ort),
    street: clean(e.event_strasse),
    postalCode: plzOrt?.[1],
    // „97618 Hohenroth, Leutershausen": Gemeinde und Ortsteil.
    locality: plzOrt ? clean(plzOrt[2].split(',')[0]) : clean(e.event_plzort),
    category: clean(e.event_category),
    priceText: clean(e.event_vorverkauf),
    ticketUrl: e.event_vorverkauf_link && /^https?:\/\//.test(e.event_vorverkauf_link) ? e.event_vorverkauf_link : undefined,
    image: img ?? undefined,
  };
}
