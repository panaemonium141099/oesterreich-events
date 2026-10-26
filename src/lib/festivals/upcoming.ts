/**
 * Kuratierte kommende Festival-Ausgaben (data/festivals-upcoming.json).
 *
 * Die mica-Registry (data/festival-seed-registry.json) liefert nur die
 * Termine EINES Jahrgangs; danach ist die Festivalseite leer, weil sie
 * `ends_at >= heute` filtert (Befund 2026-10-26: 8 von 175 sichtbar).
 * Diese Datei hält je Festival die nächste recherchierte Ausgabe mit
 * Termin, Ticketlink, Preis, Beschreibung, Bild und Lineup. Der Import
 * (src/scripts/import-upcoming-festivals.ts) schreibt sie in `festivals`
 * und `festival_artists`; der Blog-Autowriter (--festivals) liest daraus
 * seine Kandidaten.
 *
 * Reine Funktionen, keine I/O — getestet in
 * src/__tests__/lib/festivals/upcoming.test.ts.
 */
import type { FestivalDateStatus } from '@/types/festivals';

export type SeedBilling = 'headliner' | 'sub_headliner' | 'support' | 'opener' | 'unknown';

export interface SeedLineupAct {
  name: string;
  billing?: SeedBilling | string | null;
  /** Freitext-Tag, z. B. "Fr 11.06." */
  day?: string | null;
  stage?: string | null;
}

/** Ein Eintrag in data/festivals-upcoming.json. */
export interface UpcomingFestivalSeed {
  /** Muss festivals.slug entsprechen (bestehende Registry-Slugs tragen Umlaute). */
  slug: string;
  name: string;
  website_url: string | null;
  ticket_url: string | null;
  /** ISO-Datum; null = Termin unbekannt (Festival bleibt dann unsichtbar). */
  starts_at: string | null;
  ends_at: string | null;
  date_status: FestivalDateStatus | 'unknown';
  city: string | null;
  state: string | null;
  /** Genre-Codes, kommagetrennt (K, J, P, E, H, G, N, I). */
  genres: string | null;
  price_text: string | null;
  description: string | null;
  image_url: string | null;
  lineup: SeedLineupAct[];
  sources?: string[];
  notes?: string | null;
}

export const BUNDESLAENDER = [
  'Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Salzburg',
  'Tirol', 'Kärnten', 'Vorarlberg', 'Burgenland',
] as const;

const BUNDESLAND_ALIASES: Record<string, string> = {
  'wien': 'Wien',
  'niederoesterreich': 'Niederösterreich', 'niederösterreich': 'Niederösterreich', 'nö': 'Niederösterreich', 'noe': 'Niederösterreich', 'lower austria': 'Niederösterreich',
  'oberoesterreich': 'Oberösterreich', 'oberösterreich': 'Oberösterreich', 'oö': 'Oberösterreich', 'ooe': 'Oberösterreich', 'upper austria': 'Oberösterreich',
  'steiermark': 'Steiermark', 'styria': 'Steiermark',
  'salzburg': 'Salzburg',
  'tirol': 'Tirol', 'tyrol': 'Tirol',
  'kaernten': 'Kärnten', 'kärnten': 'Kärnten', 'carinthia': 'Kärnten',
  'vorarlberg': 'Vorarlberg',
  'burgenland': 'Burgenland',
};

/** Bundesland-Schreibweise der Agenten auf die Anzeigeform normieren. */
export function normalizeBundesland(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return BUNDESLAND_ALIASES[key] ?? null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GENRE_CODE = /^[KJPEHGNIRMW]$/;
const VALID_BILLING = new Set<SeedBilling>(['headliner', 'sub_headliner', 'support', 'opener', 'unknown']);

function isHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\/\S+$/.test(v);
}

/**
 * Prüft einen Seed-Eintrag hart. Liefert eine Liste von Verstößen; leer =
 * gültig. Der Import bricht bei Verstößen ab, statt halbe Zeilen zu
 * schreiben (Regel: Upserts tragen alle Felder, kein stiller Müll).
 */
export function validateSeedEntry(e: UpcomingFestivalSeed, today: string): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

  need(typeof e.slug === 'string' && /^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u.test(e.slug), 'slug fehlt oder ist kein Kleinbuchstaben-kebab-case');
  need(typeof e.name === 'string' && e.name.trim().length >= 3, 'name fehlt');
  need(e.website_url === null || isHttpUrl(e.website_url), 'website_url keine URL');
  need(e.ticket_url === null || isHttpUrl(e.ticket_url), 'ticket_url keine URL');
  need(e.image_url === null || isHttpUrl(e.image_url), 'image_url keine URL');
  need(['confirmed', 'expected', 'unknown'].includes(e.date_status), 'date_status ungültig');

  if (e.starts_at !== null || e.ends_at !== null) {
    need(typeof e.starts_at === 'string' && ISO_DATE.test(e.starts_at), 'starts_at kein ISO-Datum');
    need(typeof e.ends_at === 'string' && ISO_DATE.test(e.ends_at), 'ends_at kein ISO-Datum');
    if (e.starts_at && e.ends_at && ISO_DATE.test(e.starts_at) && ISO_DATE.test(e.ends_at)) {
      need(e.ends_at >= e.starts_at, 'ends_at liegt vor starts_at');
      need(e.ends_at >= today, `Ausgabe ist vorbei (ends_at ${e.ends_at} < ${today})`);
      need(e.starts_at <= addDays(today, 500), 'starts_at liegt mehr als 500 Tage voraus (Vorjahres- oder Tippfehler?)');
    }
    need(e.date_status !== 'unknown', 'Termin gesetzt, aber date_status "unknown"');
  } else {
    need(e.date_status === 'unknown', 'kein Termin, aber date_status nicht "unknown"');
  }

  need(e.state === null || normalizeBundesland(e.state) !== null, `state "${e.state}" ist kein Bundesland`);
  if (e.genres) {
    const codes = e.genres.split(/[,/\s]+/).filter(Boolean);
    need(codes.every(c => GENRE_CODE.test(c)), `genres "${e.genres}" enthält unbekannte Codes`);
  }
  need(e.description === null || (typeof e.description === 'string' && e.description.trim().length >= 80), 'description kürzer als 80 Zeichen');
  need(e.description === null || !/[–—]/.test(e.description), 'description enthält Gedankenstriche');
  need(Array.isArray(e.lineup), 'lineup fehlt (leeres Array erlaubt)');
  if (Array.isArray(e.lineup)) {
    for (const act of e.lineup) {
      need(!!act && typeof act.name === 'string' && act.name.trim().length >= 2 && act.name.length <= 120, `lineup-Eintrag ohne brauchbaren Namen: ${JSON.stringify(act)}`);
    }
  }
  return errors;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Zeilenwerte für den Upsert in `festivals` (ohne Registry-/Lineup-Status). */
export interface FestivalSeedRow {
  slug: string;
  canonical_name: string;
  website_url: string | null;
  ticket_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  date_status: FestivalDateStatus;
  city: string | null;
  state: string | null;
  genres: string | null;
  price_text: string | null;
  description: string | null;
  image_url: string | null;
  seed_updated_at: string;
}

export function toFestivalRow(e: UpcomingFestivalSeed, now: string): FestivalSeedRow {
  const hasDate = !!e.starts_at && !!e.ends_at;
  return {
    slug: e.slug,
    canonical_name: e.name.trim(),
    website_url: e.website_url,
    ticket_url: e.ticket_url,
    starts_at: hasDate ? e.starts_at : null,
    ends_at: hasDate ? e.ends_at : null,
    date_status: e.date_status === 'expected' ? 'expected' : 'confirmed',
    city: e.city?.trim() || null,
    state: normalizeBundesland(e.state),
    genres: e.genres ? e.genres.split(/[,/\s]+/).filter(Boolean).join(', ') : null,
    price_text: e.price_text?.trim() || null,
    description: e.description?.trim() || null,
    image_url: e.image_url,
    seed_updated_at: now,
  };
}

/** Normalform für den Unique-Key (festival_id, artist_name_normalized). */
export function normalizeArtistKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface LineupRow {
  artist_name_raw: string;
  artist_name_normalized: string;
  billing: SeedBilling;
  day_label: string | null;
  stage_name: string | null;
  source_type: 'manual';
  confidence_score: number;
}

/** Lineup-Einträge → festival_artists-Zeilen (dedupliziert über den Key). */
export function toLineupRows(lineup: SeedLineupAct[]): LineupRow[] {
  const seen = new Set<string>();
  const rows: LineupRow[] = [];
  for (const act of lineup) {
    const raw = (act?.name ?? '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const key = normalizeArtistKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const billing = act.billing && VALID_BILLING.has(act.billing as SeedBilling)
      ? (act.billing as SeedBilling)
      : 'unknown';
    rows.push({
      artist_name_raw: raw,
      artist_name_normalized: key,
      billing,
      day_label: act.day?.trim() || null,
      stage_name: act.stage?.trim() || null,
      source_type: 'manual',
      confidence_score: 1,
    });
  }
  return rows;
}

// ─── Blog-Autowriter: Festival-Kandidaten ─────────────────────────────────

export interface FestivalBlogCandidateInput {
  slug: string;
  starts_at: string | null;
  image_url: string | null;
  date_status: FestivalDateStatus;
}

/**
 * Welche Festivals heute einen Blogpost bekommen: Start in
 * [minDays, maxDays] Tagen (5 Monate ≈ 152 Tage, mit zwei Wochen
 * Nachlauf, falls der Cron am Abo-Limit scheitert), bestätigter Termin,
 * Bild vorhanden (Hero-Pflicht), und noch nicht für diese Ausgabe
 * geschrieben (Key `${slug}:${starts_at}` im Autowriter-State).
 * Reihenfolge: frühester Start zuerst, damit kein Festival aus dem
 * Fenster fällt, wenn pro Lauf nur ein Post geschrieben wird.
 */
export function selectFestivalBlogCandidates<T extends FestivalBlogCandidateInput>(
  festivals: T[],
  today: string,
  covered: Set<string>,
  opts: { minDays?: number; maxDays?: number } = {},
): T[] {
  const minDays = opts.minDays ?? 138;
  const maxDays = opts.maxDays ?? 152;
  const from = addDays(today, minDays);
  const to = addDays(today, maxDays);
  return festivals
    .filter(f =>
      f.starts_at !== null
      && f.starts_at >= from
      && f.starts_at <= to
      && f.date_status === 'confirmed'
      && !!f.image_url
      && !covered.has(festivalBlogKey(f)),
    )
    .sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : a.starts_at! > b.starts_at! ? 1 : a.slug.localeCompare(b.slug)));
}

export function festivalBlogKey(f: { slug: string; starts_at: string | null }): string {
  return `${f.slug}:${f.starts_at ?? 'tba'}`;
}
