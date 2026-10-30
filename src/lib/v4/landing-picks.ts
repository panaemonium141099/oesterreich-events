/**
 * Auswahl-Logik der Tagesausgabe (fn-30). Pur, ohne I/O: die Abfragen
 * liefern Pools, hier fällt die Entscheidung, was die Startseite zeigt.
 *
 * Feste Reihenfolge (kein Event doppelt): Tipp des Tages → Saison →
 * Programm (Heute Abend) → Wochenende. Jeder Schritt sieht die IDs der
 * vorigen und lässt sie aus. Alle Tagesgrenzen sind Wiener Kalendertage
 * (`src/lib/utils/event-time.ts`), der Server rechnet in UTC.
 */

import type { Event } from '@/types/events';
import type { FestivalPost } from '@/content/blog/types';
import { SITE_COUNTRY } from '@/lib/site-country';
import { MIN_TRUSTED_EVENT_IMAGE_WIDTH } from '@/lib/event-images/resolveEventImage';
import {
  addViennaDays,
  hasKnownStartTime,
  parseEventDate,
  toViennaDate,
  viennaDayRange,
  viennaEndDate,
  viennaFields,
  viennaWeekday,
} from '@/lib/utils/event-time';
import { normalizeBundesland, toBlogLineup } from '@/lib/festivals/upcoming';
import { hasRenderableImage } from '@/lib/activities/indexability';

// ─── Größen der Ausgabe ──────────────────────────────────────────────────

export const SEASON_COUNT = 6;
export const PROGRAM_COUNT = 10;
export const WEEKEND_COUNT = 8;
export const ARTISTS_LIVE_COUNT = 3;
export const FESTIVALS_COUNT = 4;
export const POSTS_COUNT = 4;
export const ACTIVITIES_COUNT = 8;
export const FESTIVAL_ACTS_COUNT = 3;
/** Programm zeigt Events ab dieser Wiener Stunde. */
export const PROGRAM_FROM_HOUR = 17;

// ─── Rotation und Dubletten ──────────────────────────────────────────────

/**
 * Mulberry32-Shuffle, Seed = Kalenderstunde → stabil pro ISR-Fenster
 * (revalidate 3600): jede Regenerierung zeigt eine andere Auswahl, ohne
 * die statische Cachebarkeit zu verlieren.
 */
export function hourlyShuffle<T>(items: T[], now: Date): T[] {
  const hourSeed = Math.floor(now.getTime() / 3_600_000);
  let a = hourSeed >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Zeilen mit GLEICHEM Titel UND Bild zusammenfassen (Tandemspringen jeden
 * Tag, Heuriger an mehreren Tagen), sonst belegen sie mehrere Karten.
 * Konservativ: derselbe Titel mit anderem Foto bleibt (zwei Ausgaben eines
 * Festivals). Der erste Treffer gewinnt, die Pools sind nach Score sortiert.
 */
export function uniqueByTitleAndImage<T extends { title: string | null; image_url?: string | null }>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (!titleKey) {
      out.push(e);
      continue;
    }
    const key = `${titleKey}::${(e.image_url ?? '').trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export const isSharp = (e: Event) => (e.image_width ?? 0) >= MIN_TRUSTED_EVENT_IMAGE_WIDTH;

/**
 * Führt den Pool scharfer Bilder mit dem Score-Pool zusammen: vorne steht
 * das bestgescorte Event mit scharfem Bild, danach alle nach Score, bei
 * Gleichstand scharfe zuerst. Kleine Teaser bleiben drin, wenn sie
 * relevanter sind, und zeigen über image_width den Kategorie-Fallback.
 */
export function arrangeBySharpness(sharp: unknown[] | null, rest: unknown[] | null): Event[] {
  const sharpRows = (sharp ?? []) as Event[];
  const ids = new Set(sharpRows.map(e => e.id));
  const merged = [...sharpRows, ...((rest ?? []) as Event[]).filter(e => !ids.has(e.id))];
  const hero = merged.find(isSharp) ?? merged[0];
  if (!hero) return [];
  const others = merged
    .filter(e => e !== hero)
    .sort((a, b) => (b.event_score ?? 0) - (a.event_score ?? 0) || Number(isSharp(b)) - Number(isSharp(a)));
  return [hero, ...others];
}

// ─── Saison ──────────────────────────────────────────────────────────────

/** Größe des Pools, aus dem die Saison-Rotation stündlich zieht. */
export const SEASON_ROTATION_POOL = 12;

/**
 * Auswahl der Saison-Karte: gepinnte Events (editorial) zuerst, dann die
 * Top-Events der Saison nach Score ohne Titel-Wiederholungen und ohne
 * Events, die vorher schon gewählt wurden (Tipp). Aus den besten
 * SEASON_ROTATION_POOL wird stündlich neu gemischt.
 */
export function pickSeasonEvents(
  featured: Event[],
  pool: Event[],
  excludeIds: Set<string>,
  count: number,
  now: Date = new Date(),
): Array<Event & { featured: boolean }> {
  const out: Array<Event & { featured: boolean }> = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const take = (e: Event, isFeatured: boolean) => {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (seenIds.has(e.id) || (titleKey && seenTitles.has(titleKey))) return;
    seenIds.add(e.id);
    if (titleKey) seenTitles.add(titleKey);
    out.push({ ...e, featured: isFeatured });
  };

  for (const e of featured) {
    if (out.length >= count) break;
    if (excludeIds.has(e.id)) continue;
    take(e, true);
  }

  const candidates: Event[] = [];
  const poolTitles = new Set(seenTitles);
  for (const e of pool) {
    const titleKey = (e.title ?? '').trim().toLowerCase();
    if (excludeIds.has(e.id) || seenIds.has(e.id) || (titleKey && poolTitles.has(titleKey))) continue;
    if (titleKey) poolTitles.add(titleKey);
    candidates.push(e);
    if (candidates.length >= SEASON_ROTATION_POOL) break;
  }
  for (const e of hourlyShuffle(candidates, now)) {
    if (out.length >= count) break;
    take(e, false);
  }
  return out;
}

// ─── Tipp des Tages ──────────────────────────────────────────────────────

export type TipKind = 'sponsored' | 'editorial' | 'auto';

/** Eine Zeile aus landing_features mit ihrem Event. */
export interface LandingPin {
  event: Event;
  kind: 'sponsored' | 'editorial';
  sponsorName: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface LandingTip {
  event: Event;
  /** sponsored = bezahlte Buchung (Label „Anzeige" + Sponsor), auto = Score-Fallback. */
  kind: TipKind;
  sponsorName: string | null;
}

/** Letzter Wiener Kalendertag, an dem ein Event noch läuft. */
export function eventEndDay(e: Pick<Event, 'start_date' | 'end_date'>): string | null {
  const d = parseEventDate(e.end_date ?? e.start_date);
  return d ? viennaEndDate(d) : null;
}

/**
 * Pflicht-Filter für gepinnte Events: veröffentlicht, Land der Seite,
 * noch nicht vorbei. Fällt ein Pin heraus, greift der Fallback (und der
 * Admin sieht ihn in /admin/boost als abgelaufen).
 */
export function isPinnable(e: Event, today: string): boolean {
  if (e.publish_status !== 'published') return false;
  if ((e.country ?? null) !== SITE_COUNTRY) return false;
  const end = eventEndDay(e);
  return end !== null && end >= today;
}

/** Deckt das Buchungsfenster [startsAt, endsAt) den Wiener Kalendertag? */
export function pinCoversDay(pin: Pick<LandingPin, 'startsAt' | 'endsAt'>, today: string): boolean {
  const day = viennaDayRange(today);
  const starts = parseEventDate(pin.startsAt);
  if (!starts || starts.getTime() > day.end.getTime()) return false;
  const ends = parseEventDate(pin.endsAt);
  return ends === null || ends.getTime() > day.start.getTime();
}

/** Ist der Pin im Moment `now` aktiv (bisherige Saison-Semantik)? */
export function pinActiveAt(pin: Pick<LandingPin, 'startsAt' | 'endsAt'>, now: Date): boolean {
  const starts = parseEventDate(pin.startsAt);
  if (!starts || starts.getTime() > now.getTime()) return false;
  const ends = parseEventDate(pin.endsAt);
  return ends === null || ends.getTime() > now.getTime();
}

/**
 * Tipp des Tages: die sponsored-Buchung des Wiener Tags, sonst das
 * bestgescorte Event mit scharfem Bild aus dem 7-Tage-Pool (ohne Label).
 * Mehrere Buchungen am selben Tag soll die Admin-API verhindern; falls
 * doch, zählt die jüngste.
 */
export function pickTip(pins: LandingPin[], pool: Event[], today: string): LandingTip | null {
  const booked = pins
    .filter(p => p.kind === 'sponsored' && pinCoversDay(p, today) && isPinnable(p.event, today))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (booked) return { event: booked.event, kind: 'sponsored', sponsorName: booked.sponsorName };

  const hero = pool.find(isSharp) ?? pool[0];
  return hero ? { event: hero, kind: 'auto', sponsorName: null } : null;
}

// ─── Programm und Wochenende ─────────────────────────────────────────────

/**
 * Heute Abend: Events des Wiener Tags mit bekannter Startzeit ab 17:00,
 * nach Uhrzeit. Zeilen ohne echte Uhrzeit (Platzhalter 00:00/02:00) fallen
 * weg, sonst stünde „02:00" im Programm.
 */
export function pickProgram(pool: Event[], today: string, excludeIds: Set<string>, count = PROGRAM_COUNT): Event[] {
  const rows: Array<{ e: Event; t: number }> = [];
  for (const e of pool) {
    if (excludeIds.has(e.id) || !hasKnownStartTime(e)) continue;
    const d = parseEventDate(e.start_date);
    if (!d || toViennaDate(d) !== today) continue;
    if (viennaFields(d).hour < PROGRAM_FROM_HOUR) continue;
    rows.push({ e, t: d.getTime() });
  }
  return rows
    .sort((a, b) => a.t - b.t || (b.e.event_score ?? 0) - (a.e.event_score ?? 0))
    .slice(0, count)
    .map(r => r.e);
}

/**
 * Wochenend-Fenster in Wiener Kalendertagen: Mo bis Do das kommende
 * Wochenende (Fr bis So), Fr bis So das laufende ab heute.
 */
export function weekendWindow(today: string): { from: string; to: string } {
  const wd = viennaWeekday(today); // 0 = So … 6 = Sa
  if (wd >= 1 && wd <= 4) {
    const friday = addViennaDays(today, 5 - wd);
    return { from: friday, to: addViennaDays(friday, 2) };
  }
  // Fr (5): heute bis So; Sa (6): heute bis morgen; So (0): nur heute.
  const daysToSunday = wd === 0 ? 0 : 7 - wd;
  return { from: today, to: addViennaDays(today, daysToSunday) };
}

/** Wochenende: Pool nach Schärfe/Score, ohne Dubletten und ohne die Bühne. */
export function pickWeekend(pool: Event[], excludeIds: Set<string>, count = WEEKEND_COUNT): Event[] {
  return uniqueByTitleAndImage(pool.filter(e => !excludeIds.has(e.id))).slice(0, count);
}

// ─── Gesamtauswahl ───────────────────────────────────────────────────────

export interface LandingSelectionInput {
  pins: LandingPin[];
  /** 7-Tage-Pool, bereits per arrangeBySharpness geordnet. */
  tipPool: Event[];
  /** Saison-Pool nach Score (Saison-Wort im Titel zuerst). */
  seasonPool: Event[];
  /** Heutiger Tag, Pool nach Score. */
  programPool: Event[];
  /** Wochenend-Fenster, bereits per arrangeBySharpness geordnet. */
  weekendPool: Event[];
  today: string;
  now: Date;
}

export interface LandingSelection {
  tip: LandingTip | null;
  season: Array<Event & { featured: boolean }>;
  program: Event[];
  weekend: Event[];
}

/** Tipp → Saison → Programm → Wochenende, kein Event doppelt. */
export function pickLandingSelection(input: LandingSelectionInput): LandingSelection {
  const { pins, today, now } = input;
  const used = new Set<string>();

  const tip = pickTip(pins, input.tipPool, today);
  if (tip) used.add(tip.event.id);

  const editorial = pins
    .filter(p => p.kind === 'editorial' && pinActiveAt(p, now) && isPinnable(p.event, today))
    .map(p => p.event);
  const season = pickSeasonEvents(editorial, input.seasonPool, used, SEASON_COUNT, now);
  for (const e of season) used.add(e.id);

  const program = pickProgram(input.programPool, today, used);
  for (const e of program) used.add(e.id);

  const weekend = pickWeekend(input.weekendPool, used);

  return { tip, season, program, weekend };
}

// ─── Diese Woche live (Künstler-Rotation) ────────────────────────────────

export interface ArtistRow {
  artist_id: string;
  artist_name: string;
  artist_image: string | null;
  evo_link: string | null;
}

/** Ein Event mit seinen Feed-Künstlern (Pool-Zeile der Abfrage). */
export interface ArtistEventRow {
  event: Event & { duplicate_of?: string | null };
  artists: ArtistRow[];
}

export interface LandingArtistLive {
  artistId: string;
  name: string;
  image: string | null;
  evoLink: string | null;
  /** Nächster sichtbarer Termin (bei Dedup der Primary). */
  event: Event;
}

/** IDs der Primaries, die für unterdrückte Zeilen nachgeladen werden müssen. */
export function unresolvedPrimaryIds(rows: ArtistEventRow[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.event.publish_status !== 'published' && r.event.duplicate_of) ids.add(r.event.duplicate_of);
  }
  return [...ids];
}

/**
 * Je Künstler der nächste Termin; Künstler mit Bild zuerst; aus beiden
 * Gruppen stündlich gemischt, dann die ersten `count`. Unterdrückte
 * Eventim-Zeilen (duplicate_of) zeigen den sichtbaren Primary, ohne
 * Primary fallen sie weg.
 */
export function pickArtistsLive(
  rows: ArtistEventRow[],
  primaries: Map<string, Event>,
  now: Date,
  count = ARTISTS_LIVE_COUNT,
): LandingArtistLive[] {
  const byArtist = new Map<string, LandingArtistLive>();
  for (const r of rows) {
    let event: Event | null = null;
    if (r.event.publish_status === 'published') event = r.event;
    else if (r.event.duplicate_of) event = primaries.get(r.event.duplicate_of) ?? null;
    if (!event || event.publish_status !== 'published') continue;

    for (const a of r.artists ?? []) {
      const name = (a.artist_name ?? '').trim();
      if (!a.artist_id || !name) continue;
      const image = a.artist_image?.trim() || null;
      const prev = byArtist.get(a.artist_id);
      if (!prev) {
        byArtist.set(a.artist_id, { artistId: a.artist_id, name, image, evoLink: a.evo_link ?? null, event });
        continue;
      }
      if (event.start_date < prev.event.start_date) prev.event = event;
      if (!prev.image && image) prev.image = image;
    }
  }
  const all = [...byArtist.values()];
  const withImage = hourlyShuffle(all.filter(a => a.image), now);
  const withoutImage = hourlyShuffle(all.filter(a => !a.image), now);
  return [...withImage, ...withoutImage].slice(0, count);
}

// ─── Festivals ───────────────────────────────────────────────────────────

export interface FestivalCandidate {
  id: string;
  slug: string;
  canonical_name?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  date_status?: string | null;
  state?: string | null;
  /** Eingebettetes Elternevent; die Abfrage filtert sein Land, deshalb null bei Ausland. */
  parent_event?: { country?: string | null } | Array<{ country?: string | null }> | null;
}

function parentOf<T extends FestivalCandidate>(f: T): { country?: string | null } | null {
  const p = f.parent_event;
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

/** Land über das Elternevent, ohne Elternevent über `state` in den neun Bundesländern. */
export function isAustrianFestival(f: FestivalCandidate): boolean {
  const parent = parentOf(f);
  if (parent) return parent.country == null || parent.country === SITE_COUNTRY;
  return normalizeBundesland(f.state) !== null;
}

/**
 * Festivals der Tagesausgabe: noch nicht vorbei (`ends_at >= heute`),
 * bestätigter Termin, Land der Seite; chronologisch die ersten `count`.
 */
export function pickFestivals<T extends FestivalCandidate>(pool: T[], today: string, count = FESTIVALS_COUNT): T[] {
  return pool
    .filter(f => f.ends_at != null && f.ends_at >= today)
    .filter(f => (f.date_status ?? 'confirmed') === 'confirmed')
    .filter(isAustrianFestival)
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.slug.localeCompare(b.slug))
    .slice(0, count);
}

export interface FestivalActRow {
  artist_name_raw: string;
  billing?: string | null;
  day_label?: string | null;
  stage_name?: string | null;
}

/** Bis zu `max` Acts in Headliner-Reihenfolge (toBlogLineup). */
export function festivalActs(acts: FestivalActRow[], max = FESTIVAL_ACTS_COUNT): string[] {
  return toBlogLineup(
    acts.map(a => ({ name: a.artist_name_raw, billing: a.billing, day: a.day_label, stage: a.stage_name })),
    { max },
  ).lineup.map(a => a.name);
}

// ─── Blog ────────────────────────────────────────────────────────────────

export interface LandingPost {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  publishDate: string;
  category: string;
  readingTime: number;
}

const slugBase = (slug: string) => slug.replace(/-\d{4}$/, '');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();

/** Handelt der Post vom Festival? Autowriter-Slugs enden auf das Jahr. */
export function postMatchesFestival(
  post: Pick<FestivalPost, 'slug' | 'title'>,
  festival: Pick<FestivalCandidate, 'slug' | 'canonical_name'>,
): boolean {
  if (slugBase(post.slug) === festival.slug) return true;
  const name = norm(festival.canonical_name ?? '');
  return name.length >= 4 && norm(post.title).includes(name);
}

/**
 * Vier veröffentlichte Posts, neueste zuerst; Posts zu Festivals, die
 * schon in der Festival-Liste stehen, rücken nach hinten, damit nicht
 * dasselbe Festival zweimal nebeneinander steht.
 */
export function pickPosts(
  posts: FestivalPost[],
  festivals: Array<Pick<FestivalCandidate, 'slug' | 'canonical_name'>>,
  today: string,
  count = POSTS_COUNT,
): LandingPost[] {
  const published = posts.filter(p => p.publishDate <= today);
  const fresh = published.filter(p => !festivals.some(f => postMatchesFestival(p, f)));
  const dup = published.filter(p => festivals.some(f => postMatchesFestival(p, f)));
  return [...fresh, ...dup].slice(0, count).map(p => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    image: p.thumbnailImage ?? p.heroImage,
    publishDate: p.publishDate,
    category: p.category,
    readingTime: p.readingTime,
  }));
}

// ─── Freizeit ────────────────────────────────────────────────────────────

/** Acht Aktivitäten mit Bild aus dem Pool, stündlich gemischt. */
export function pickActivities<T extends { images: unknown }>(pool: T[], now: Date, count = ACTIVITIES_COUNT): T[] {
  return hourlyShuffle(pool.filter(a => hasRenderableImage(a.images)), now).slice(0, count);
}

// ─── Event-Zahl ──────────────────────────────────────────────────────────

/** `country_total` aus dem RPC-Payload von event_counts_for_stats(). */
export function readCountryTotal(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { country_total?: unknown }).country_total;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}
