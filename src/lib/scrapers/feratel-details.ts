/**
 * Feratel Deskline: Event-Detailseite (`/{region}/{lang}/events/{dbCode}/{id}`)
 * mit Cache in `feratel_event_details`.
 *
 * Die Listen-Antwort der WebAPI traegt pro Event nur den naechsten Termin
 * (`hasMoreDates` bei 36 % der Events), keine Adresse, keinen Veranstalter,
 * keinen Link und keine Preisangabe. All das liefert nur die Detailseite:
 *   nextOccurrences   die naechsten drei Termine (rollierend)
 *   addresses         Typ 31 Veranstalter, 32 Veranstaltungsort (Strasse,
 *                     PLZ, Ort, Firma, Website)
 *   links             Typ 1 = Website
 *   dynamicDescriptions  901 Preis, 906 Geeignet fuer, 911 Oeffnungszeiten,
 *                     912 Treffpunkt
 *   handicapClassifications / handicapFacilities  Barrierefreiheit
 *
 * Ein Detail-Aufruf pro Event und Stunde waere zu viel (10.700 Events,
 * Feratel-IP-Limit ~3.500 Aufrufe/h). Deshalb liegt der komprimierte
 * Auszug in der Tabelle `feratel_event_details`; jeder Lauf frischt nur ein
 * Budget (FERATEL_DETAIL_BUDGET, Standard 900) auf: zuerst Events ohne
 * Eintrag, dann die aeltesten. Damit ist jedes Event nach ~12 Stunden
 * einmal durch, und jeder Lauf mischt den Cache in alle Events ein.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface FeratelOccurrence {
  /** Naive Wandzeit "YYYY-MM-DDTHH:MM:00" (Europe/Vienna). */
  localStart: string;
  /** Dauer in Minuten laut Deskline (0 = unbekannt). */
  duration: number;
}

export interface FeratelAddress {
  company: string | null;
  name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  url: string | null;
}

export interface FeratelDetail {
  occurrences: FeratelOccurrence[];
  hasMoreOccurrences: boolean;
  /** addressType 32 */
  venue: FeratelAddress | null;
  /** addressType 31 */
  organizer: FeratelAddress | null;
  website: string | null;
  ticketUrl: string | null;
  price: string | null;
  opening: string | null;
  meetingPoint: string | null;
  suitableFor: string | null;
  handicap: string[];
  copyright: string | null;
}

interface RawAddress {
  addressType?: number | null;
  company?: string | null;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zipCode?: string | null;
  url?: string | null;
}

export interface RawDetail {
  copyright?: string | null;
  author?: string | null;
  nextOccurrences?: { items?: Array<{ date?: string | null; duration?: number | null; startTime?: string | null }> | null; hasMoreItems?: boolean | null } | null;
  addresses?: RawAddress[] | null;
  links?: Array<{ name?: string | null; url?: string | null; type?: number | null; order?: number | null }> | null;
  dynamicDescriptions?: Array<{ description?: string | null; type?: number | null; name?: string | null }> | null;
  handicapClassifications?: Array<{ name?: string | null }> | null;
  handicapFacilities?: Array<{ groupName?: string | null; items?: Array<{ name?: string | null; value?: string | boolean | null }> | null }> | null;
}

export const DETAIL_FIELDS = [
  'id',
  'copyright',
  'author',
  'nextOccurrences{items{date,duration,startTime},hasMoreItems}',
  'addresses{addressType,company,title,firstName,lastName,address1,address2,city,zipCode,url}',
  'links{name,url,type,order}',
  'dynamicDescriptions(len:600){description,type,name}',
  'handicapClassifications{name}',
  'handicapFacilities{groupName,items{name,value}}',
].join(',');

function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return t === '' ? null : t;
}

function toAddress(a: RawAddress | undefined): FeratelAddress | null {
  if (!a) return null;
  const name = clean([a.firstName, a.lastName].filter(Boolean).join(' '));
  const out: FeratelAddress = {
    company: clean(a.company),
    name,
    street: clean(a.address1) ?? clean(a.address2),
    zip: clean(a.zipCode),
    city: clean(a.city),
    url: clean(a.url),
  };
  return out.company || out.name || out.street || out.city ? out : null;
}

function isHttp(u: string | null): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

/** Komprimierter Auszug der Detail-Antwort (das ist, was im Cache liegt). */
export function extractFeratelDetail(raw: RawDetail): FeratelDetail {
  const occurrences: FeratelOccurrence[] = [];
  for (const it of raw.nextOccurrences?.items ?? []) {
    const day = /^(\d{4}-\d{2}-\d{2})/.exec(it.date ?? '')?.[1];
    if (!day) continue;
    const time = /^(\d{2}):(\d{2})/.exec(it.startTime ?? '') ? it.startTime!.slice(0, 5) : '00:00';
    occurrences.push({ localStart: `${day}T${time}:00`, duration: typeof it.duration === 'number' ? it.duration : 0 });
  }
  const addresses = raw.addresses ?? [];
  const venue = toAddress(addresses.find((a) => a.addressType === 32));
  const organizer = toAddress(addresses.find((a) => a.addressType === 31));
  const links = (raw.links ?? []).filter((l) => isHttp(clean(l.url))).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ticket = links.find((l) => /ticket|karten|buchen|anmeld|reservier/i.test(l.name ?? ''));
  const website = links.find((l) => l.type === 1 && l !== ticket) ?? links.find((l) => l !== ticket);
  const dyn = (t: number) => clean(raw.dynamicDescriptions?.find((d) => d.type === t)?.description);
  const handicap: string[] = [];
  for (const c of raw.handicapClassifications ?? []) {
    const n = clean(c.name);
    if (n) handicap.push(n);
  }
  for (const g of raw.handicapFacilities ?? []) {
    for (const it of g.items ?? []) {
      const n = clean(it.name);
      if (n && (it.value === true || it.value === 'true' || it.value === '1' || it.value === 'ja')) handicap.push(n);
    }
  }
  const organizerUrl = organizer?.url && isHttp(organizer.url) ? organizer.url : null;
  const venueUrl = venue?.url && isHttp(venue.url) ? venue.url : null;
  return {
    occurrences,
    hasMoreOccurrences: raw.nextOccurrences?.hasMoreItems === true,
    venue,
    organizer,
    website: clean(website?.url) ?? organizerUrl ?? venueUrl,
    ticketUrl: clean(ticket?.url),
    price: dyn(901),
    opening: dyn(911),
    meetingPoint: dyn(912),
    suitableFor: dyn(906),
    handicap,
    copyright: clean(raw.copyright) ?? clean(raw.author),
  };
}

// ─────────────────── Cache ───────────────────

export interface DetailCacheRow {
  event_id: string;
  db_code: string;
  region: string;
  fetched_at: string;
  detail: FeratelDetail;
}

export interface DetailCacheIndex {
  /** event_id -> fetched_at ISO */
  fetchedAt: Map<string, string>;
  detail: Map<string, FeratelDetail>;
}

/**
 * Cache fuer die angefragten Events laden (PostgREST: `.in()` maximal 200
 * Werte pro Aufruf, Antworten auf 1000 Zeilen gekappt).
 */
export async function loadDetailCache(supabase: SupabaseClient, eventIds: string[]): Promise<DetailCacheIndex> {
  const fetchedAt = new Map<string, string>();
  const detail = new Map<string, FeratelDetail>();
  for (let i = 0; i < eventIds.length; i += 200) {
    const slice = eventIds.slice(i, i + 200);
    const { data, error } = await supabase.from('feratel_event_details').select('event_id, fetched_at, detail').in('event_id', slice);
    if (error) throw new Error(`feratel_event_details lesen: ${error.message}`);
    for (const row of (data ?? []) as Array<{ event_id: string; fetched_at: string; detail: FeratelDetail }>) {
      fetchedAt.set(row.event_id, row.fetched_at);
      detail.set(row.event_id, row.detail);
    }
  }
  return { fetchedAt, detail };
}

export async function saveDetailCache(supabase: SupabaseClient, rows: DetailCacheRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const { error } = await supabase.from('feratel_event_details').upsert(slice, { onConflict: 'event_id' });
    if (error) throw new Error(`feratel_event_details schreiben: ${error.message}`);
  }
}

/**
 * Reihenfolge fuer das Aufrisch-Budget: ohne Cache-Eintrag zuerst, dann
 * nach Alter des Eintrags (aelteste zuerst). Eintraege juenger als
 * `minAgeMs` werden nicht angefasst.
 */
export function selectDetailCandidates(
  eventIds: string[],
  index: DetailCacheIndex,
  budget: number,
  minAgeMs: number,
  now: number = Date.now(),
): string[] {
  const missing: string[] = [];
  const stale: Array<{ id: string; at: number }> = [];
  for (const id of eventIds) {
    const at = index.fetchedAt.get(id);
    if (!at) missing.push(id);
    else {
      const t = Date.parse(at);
      if (now - t >= minAgeMs) stale.push({ id, at: t });
    }
  }
  stale.sort((a, b) => a.at - b.at);
  return [...missing, ...stale.map((s) => s.id)].slice(0, Math.max(0, budget));
}
