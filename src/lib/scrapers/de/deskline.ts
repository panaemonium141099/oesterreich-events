/**
 * Feratel Deskline in Deutschland (fn-29, Rest-Adapter): Gemeinden betten
 * das DW5-Widget ein (`resc.deskline.net/DW5/start/<Owner>/<GUID>/index.js`
 * oder ein iframe auf `web5.deskline.net/<Owner>/<GUID>/…`). Der Linkkey
 * der WebAPI steht nicht auf der Seite, sondern im Tag-Kontext des Widgets
 * (`resc.deskline.net/DW5/tags/<owner>/<GUID>/tagcontext.js`, Feld
 * `linkKey`: Zell „ZELL" → `rptzell`, 07.11.2026). Mit ihm liefert dieselbe
 * WebAPI wie in Österreich (`FeratelScraper.ts`) die Termine als JSON:
 * naive Wandzeit, Ort (`place`), Gemeinde (`town`), Koordinaten,
 * Kriterienbaum, Bilder. REIN, kein I/O.
 */
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { normalizeCountryCode } from '@/lib/location/conservative-resolution';
import { feratelCategoryFromCriteria, feratelLocalEnd, pickFeratelDescription, pickFeratelImage, type FeratelCriterion, type FeratelImage, type FeratelStartTimeDuration } from '../feratel-facets';
import { htmlToText } from '@/lib/eventfrog/parse';
import { decodeEntities } from '@/lib/utils/decode-entities';

export const DESKLINE_API = 'https://webapi.deskline.net';

export interface DesklineEmbed {
  owner: string;
  guid: string;
}

/**
 * DW5-Widgets einer Seite. `webclient4.deskline.net/<Code>/de/Login` ist
 * die Anmeldung des Vermieters, kein Kalender (Gerolsteiner Land, Pfronten).
 */
export function desklineEmbeds(html: string): DesklineEmbed[] {
  const out = new Map<string, DesklineEmbed>();
  const add = (owner: string, guid: string) => out.set(`${owner.toLowerCase()}/${guid.toLowerCase()}`, { owner: owner.toLowerCase(), guid: guid.toLowerCase() });
  for (const m of html.matchAll(/resc\.deskline\.net\/DW5\/start\/([A-Za-z0-9_-]+)\/([0-9a-fA-F-]{36})\/index\.js/g)) add(m[1], m[2]);
  for (const m of html.matchAll(/web5\.deskline\.net\/([A-Za-z0-9_-]+)\/([0-9a-fA-F-]{36})\//g)) add(m[1], m[2]);
  return [...out.values()];
}

export function tagcontextUrl(e: DesklineEmbed): string {
  return `https://resc.deskline.net/DW5/tags/${e.owner}/${e.guid}/tagcontext.js`;
}

/** Linkkey der WebAPI aus `tagcontext.js`. */
export function linkKeyFromTagcontext(js: string): string | null {
  const m = /"linkKey"\s*:\s*"([A-Za-z0-9_-]+)"/.exec(js);
  return m ? m[1].toLowerCase() : null;
}

/** Feldauswahl wie in Österreich, ohne Detail-Abfrage. */
export const DESKLINE_FIELDS = [
  'id',
  'dbCode',
  'name',
  'date',
  'hasMoreDates',
  'startTimeDurations{time,weekDays,duration}',
  'criteria{groupName,items{name}}',
  'location{place,town,regions,country,coordinate{long,lat}}',
  'descriptions(types:[32,33]){description,type}',
  'images(count:3,sizes:[10]){urls,copyright,license,author,ai{isAiGenerated}}',
  'mainCriteria{name}',
].join(',');

export const DESKLINE_PAGE_SIZE = 400;

export function desklineEventsUrl(linkKey: string, pageNo: number): string {
  return `${DESKLINE_API}/${linkKey}/de/events?fields=${DESKLINE_FIELDS}&sortingFields=date&pageNo=${pageNo}&pageSize=${DESKLINE_PAGE_SIZE}`;
}

export interface DesklineTermin {
  uid: string;
  dbCode?: string;
  title: string;
  /** Tag der Wandzeit. */
  localDate: string;
  /** Instant (UTC) oder nur das Datum, wenn die Quelle keine Uhrzeit nennt. */
  start: string;
  end?: string;
  allDay: boolean;
  hasMoreDates: boolean;
  description?: string;
  locationName?: string;
  /** `town`: der von der Quelle genannte Ort. */
  locality?: string;
  country: string;
  lat?: number;
  lng?: number;
  image?: string;
  imageCredit?: string;
  category?: string;
  categoryLocked: boolean;
  tags: string[];
}

interface RawEvent {
  id?: string;
  dbCode?: string;
  name?: string;
  date?: string;
  hasMoreDates?: boolean;
  startTimeDurations?: FeratelStartTimeDuration[] | null;
  criteria?: { groupName?: string | null; items?: { name?: string | null }[] | null }[] | null;
  mainCriteria?: { name?: string | null } | null;
  location?: { place?: string | null; town?: string | null; regions?: string[] | null; country?: string | null; coordinate?: { long?: number | null; lat?: number | null } | null } | null;
  descriptions?: { description?: string | null; type?: number | null }[] | null;
  images?: FeratelImage[] | null;
}

export interface DesklinePage {
  events: DesklineTermin[];
  pageCount: number;
  total: number;
}

/**
 * Titel ohne Kalender-Beiwerk mancher Regionen („8.4.2026Mi.16:00-18:00Uhr
 * Kids Soul", „Mi.19:00-UhrNutzung Gemeinde…"), Regel wie `FeratelScraper`.
 */
export function cleanDesklineTitle(raw: string): string {
  let t = decodeEntities(raw).trim();
  t = t.replace(/^\d{1,2}\.\d{1,2}\.\d{4}/, '');
  t = t.replace(/^(Mo|Di|Mi|Do|Fr|Sa|So)\.\s*/i, '');
  t = t.replace(/\d{1,2}:\d{2}(-\d{1,2}:\d{2})?-?\s*Uhr/gi, '');
  t = t.replace(/^Nutzung\s+Gemeinde\s*/i, '');
  return t.replace(/^[\s.,\-:]+/, '').replace(/\s+/g, ' ').trim();
}

export function parseDesklinePage(json: string): DesklinePage {
  const j = JSON.parse(json) as { data?: RawEvent[]; paging?: { pageCount?: number; totalRecordCount?: number } };
  const events: DesklineTermin[] = [];
  for (const e of j.data ?? []) {
    const t = toTermin(e);
    if (t) events.push(t);
  }
  return { events, pageCount: j.paging?.pageCount ?? 1, total: j.paging?.totalRecordCount ?? events.length };
}

function toTermin(e: RawEvent): DesklineTermin | null {
  if (!e.id || !e.name || !e.date) return null;
  const title = cleanDesklineTitle(e.name);
  if (title.length < 3) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(e.date);
  if (!m) return null;
  const localDate = m[1];
  const durations = e.startTimeDurations ?? [];
  const localEnd = feratelLocalEnd(e.date, durations);
  // 00:00 ohne Dauer ist „ohne Uhrzeit" (moselneu: 72 von 400 Terminen am
  // 07.11.2026), kein Termin um Mitternacht.
  const allDay = m[2] === '00' && m[3] === '00' && !localEnd;
  const start = allDay ? localDate : (toUtcInstant(e.date) as string);
  const end = !allDay && localEnd ? (toUtcInstant(localEnd) as string) : undefined;
  const loc = e.location;
  const place = loc?.place?.trim() || undefined;
  const town = loc?.town?.trim() || undefined;
  const lat = loc?.coordinate?.lat, lng = loc?.coordinate?.long;
  const hasGeo = typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0);
  const rawDescription = pickFeratelDescription(e.descriptions);
  const description = rawDescription ? htmlToText(decodeEntities(rawDescription)).slice(0, 1000) || undefined : undefined;
  const criteria: FeratelCriterion[] = (e.criteria ?? []).map(c => ({ groupName: c.groupName ?? null, items: (c.items ?? []).map(i => i.name ?? '').filter(Boolean) }));
  const fromCriteria = feratelCategoryFromCriteria(criteria, e.mainCriteria?.name ?? null);
  const tags = fromCriteria.unambiguous ? [...fromCriteria.tags] : [...criteria.flatMap(c => [c.groupName ?? '', ...c.items]), ...fromCriteria.categories];
  const picked = pickFeratelImage(e.images);
  return {
    uid: e.id,
    dbCode: e.dbCode,
    title,
    localDate,
    start,
    end: end && end > start ? end : undefined,
    allDay,
    hasMoreDates: !!e.hasMoreDates,
    description,
    locationName: place,
    locality: town,
    country: normalizeCountryCode(loc?.country ?? 'Deutschland'),
    ...(hasGeo ? { lat, lng } : {}),
    ...(picked ? { image: picked.url, imageCredit: picked.credit ?? undefined } : {}),
    category: fromCriteria.category ?? undefined,
    categoryLocked: fromCriteria.unambiguous,
    tags: [...new Set(tags.map(t => t.trim()).filter(Boolean))],
  };
}
