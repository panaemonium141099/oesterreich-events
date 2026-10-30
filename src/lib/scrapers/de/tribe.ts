/**
 * The Events Calendar (WordPress, StellarWP „Tribe"), fn-29.7.
 *
 * REST `/wp-json/tribe/events/v1/events?per_page=50&start_date=…&end_date=…&page=N`
 * liefert je Termin `utc_start_date`, `all_day`, Ort (`venue`: Name,
 * Straße, PLZ, Ort, optional `geo_lat`/`geo_lng`), Veranstalter und die
 * Detailseite (`url`). Wiederholungen (Events Calendar Pro) kommen als
 * eigene Termine mit eigener ID. REIN, kein I/O.
 */
import { decodeEntities } from '@/lib/utils/decode-entities';
import { htmlToText } from '@/lib/eventfrog/parse';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

export interface TribeEvent {
  /** Post-ID des Termins auf der Website. */
  uid: string;
  url: string;
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
  organizer?: string;
  category?: string;
  priceText?: string;
  /** Beitragsbild des Termins (Logo/Platzhalter prüft `bild.ts`). */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  lat?: number;
  lng?: number;
}

interface RawVenue { venue?: string; address?: string; zip?: string; city?: string; geo_lat?: number | string; geo_lng?: number | string }
interface RawEvent {
  id: number;
  url: string;
  title: string;
  description?: string;
  excerpt?: string;
  all_day: boolean;
  start_date: string;
  end_date?: string;
  utc_start_date?: string;
  utc_end_date?: string;
  hide_from_listings?: boolean;
  cost?: string;
  venue?: RawVenue | RawVenue[];
  organizer?: { organizer?: string }[];
  categories?: { name?: string }[];
  /** `false` ohne Beitragsbild. */
  image?: { url?: string; width?: number; height?: number } | false;
}

export interface TribePage { events: TribeEvent[]; totalPages: number }

const clean = (s: string | undefined) => {
  const t = s ? decodeEntities(s).replace(/\s+/g, ' ').trim() : '';
  return t || undefined;
};

/** Instant aus der Wandzeit „YYYY-MM-DD hh:mm:ss" in deutscher Ortszeit
 *  (Europe/Berlin = Europe/Vienna bei Offset und Umstellungstagen). */
const berlin = (s: string) => toUtcInstant(s.replace(' ', 'T')) as string;

export function parseTribePage(json: string): TribePage {
  const j = JSON.parse(json) as { events?: RawEvent[]; total_pages?: number };
  const events: TribeEvent[] = [];
  for (const e of j.events ?? []) {
    const t = toEvent(e);
    if (t) events.push(t);
  }
  return { events, totalPages: j.total_pages ?? 1 };
}

/**
 * Durchgestrichener Titel heißt: findet nicht statt (Artlenburg
 * `<b>Pausiert:</b> <s>Spiele-Abend Windmühle Artlenburg</s>`, 2026-10-29).
 */
const STRUCK = /<(s|del|strike)\b[^>]*>/i;

function toEvent(e: RawEvent): TribeEvent | null {
  if (!e.url || !e.start_date || e.hide_from_listings || STRUCK.test(e.title ?? '')) return null;
  // Der Titel kann HTML tragen (Artlenburg `<b><span style=…>…</span></b>`).
  const title = clean(htmlToText(e.title ?? ''));
  if (!title) return null;
  const localDate = e.start_date.slice(0, 10);
  let start: string, end: string | undefined;
  // 00:00 ohne Ende oder bis 00:00 ist „ohne Uhrzeit" (Kaiser-Wilhelm-Koog
  // „Volkstrauertag" 00:00 bis 00:00), kein Termin um Mitternacht.
  const midnight = / 00:00:00$/.test(e.start_date) && (!e.end_date || / 00:00:00$/.test(e.end_date) || / 23:59:59$/.test(e.end_date));
  if (e.all_day || midnight) {
    // Ganztägig: Wandzeit-Datum der Website; Ende ist der letzte Tag (23:59:59).
    start = localDate;
    const last = e.end_date?.slice(0, 10);
    end = last && last > localDate ? last : undefined;
  } else {
    // Wandzeit der Website als deutsche Ortszeit, nicht `utc_start_date`:
    // Websites mit festem Versatz („UTC+1", „UTC+2", „UTC+0", 229 von 7.280
    // Terminen 2026-10-29) rechnen UTC falsch (Mellingen „UTC+2": 18:00
    // angezeigt, 15:00 UTC gemeldet). Bei Europe/Berlin stimmen beide.
    start = berlin(e.start_date);
    const u = e.end_date ? berlin(e.end_date) : undefined;
    // „bis 23:59:59" ist das Tagesende, keine Uhrzeit; gleiches Ende = unbekannt.
    end = u && u > start && !/23:59:59$/.test(e.end_date ?? '') ? u : undefined;
  }
  const v = Array.isArray(e.venue) ? undefined : e.venue;
  const lat = Number(v?.geo_lat), lng = Number(v?.geo_lng);
  const hasGeo = v?.geo_lat != null && v.geo_lat !== '' && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const zip = /^\d{5}$/.test(v?.zip?.trim() ?? '') ? v!.zip!.trim() : undefined;
  return {
    uid: String(e.id),
    url: e.url,
    localDate,
    start,
    end,
    allDay: !!e.all_day || midnight,
    title,
    description: e.description ? htmlToText(decodeEntities(e.description)) || undefined : undefined,
    locationName: clean(v?.venue),
    street: clean(v?.address),
    postalCode: zip,
    locality: clean(v?.city),
    organizer: clean(e.organizer?.[0]?.organizer),
    category: clean(e.categories?.[0]?.name),
    priceText: clean(e.cost),
    ...(e.image && e.image.url ? {
      image: e.image.url,
      ...(e.image.width && e.image.height ? { imageWidth: e.image.width, imageHeight: e.image.height } : {}),
    } : {}),
    ...(hasGeo ? { lat, lng } : {}),
  };
}

/** Seite N der REST-Liste für die Tage `from` bis `to` (Ortszeit der Website). */
export function tribePageUrl(feedUrl: string, from: string, to: string, page: number): string {
  const u = new URL(feedUrl);
  u.search = '';
  u.searchParams.set('per_page', '50');
  u.searchParams.set('start_date', `${from} 00:00:00`);
  u.searchParams.set('end_date', `${to} 23:59:59`);
  u.searchParams.set('page', String(page));
  return u.href;
}
