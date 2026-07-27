/**
 * Transform-Pipeline Deskline-`infrastructures` -> poi_activities-Row
 * (fn-18, Task 2). Pur und deterministisch — der Script-Teil
 * (import-activities.ts) macht nur Orchestrierung + IO.
 *
 * Pipeline pro Objekt (Task-Spec-Reihenfolge):
 *   UTF-8-Mojibake-Normalisierung -> GESPERRT-Praefix (is_closed=true +
 *   Praefix strippen; geschlossene POIs werden importiert, aber ueberall
 *   via is_closed ausgeschlossen; Wiedereroeffnung setzt is_closed=false —
 *   is_closed ist mutable Business-Spalte) -> open_status uebernehmen ->
 *   Topic-Whitelist (Task 1) -> Gemeinde-Match -> Slug -> price_hint ->
 *   content_fingerprint -> openingTimes via opening.ts in den E8-Vertrag.
 *
 * ── DML-Spaltengruppen (Task-Spec, verbindlich) ─────────────────────────────
 * Zwei getrennte Schreibpfade mit FIXEN Spaltengruppen (NULL-Clobber-Falle,
 * supabase-sync.ts:334-350 — PostgREST normalisiert Batch-Rows auf ein
 * einheitliches Key-Set, deshalb traegt JEDE Row eines Batches exakt
 * dasselbe Spaltenset):
 *   (a) Insert-Pfad: ALLE Business-Spalten INKLUSIVE der insert-only-Spalten
 *       slug, shortid, source_region (write-once, Epic E5).
 *   (b) Update-Pfad: ALLE mutablen Business-Spalten + updated_at und NIE
 *       slug/shortid/source_region. source + source_id sind als
 *       Identitaets-/Konflikt-Schluessel enthalten (unveraenderliche Werte).
 *   Die Sichtungs-/Ordnungsspalten (last_seen_run_seq,
 *   last_seen_complete_run_seq, last_seen_at, seen_regions, visible,
 *   duplicate_of) sind in KEINEM der beiden Pfade Teil des Payloads —
 *   sie gehoeren dem Sichtungs-Update bzw. Reconcile/Prune (prune.ts).
 */

import { mapTopics, type ActivitySetting } from './taxonomy';
import { matchGemeinde } from './gemeinde-match';
import { buildActivitySlug, activityShortId } from './slug';
import { extractPriceHint } from './price-hint';
import { contentFingerprint, fixMojibake } from './fingerprint';
import { normalizeOpeningTimes, type NormalizedOpeningWindow } from './opening';
import { bundeslandToId } from '@/lib/bundeslaender';
import type { DesklineInfrastructure } from './deskline-client';

export const ACTIVITY_SOURCE = 'deskline';

/** plainDescriptions-Typen (live verprobt 2026-07-25): 41 = Kurztext,
 *  42 = Langtext. 43/44 (Kontakt-/Zusatztexte) werden nicht persistiert,
 *  fliessen aber in die price_hint-Extraktion ein. */
const DESC_TYPE_SHORT = 41;
const DESC_TYPE_LONG = 42;

/** GESPERRT-Praefix (Deskline markiert dauerhaft geschlossene POIs im
 *  Anzeigenamen). Nur als eigenes Wort am Anfang — "Gesperrter Wanderweg"
 *  bleibt unangetastet. */
const GESPERRT_PREFIX = /^\s*gesperrt\b[\s:!,./–—-]*/i;

// ── Ergebnis-Typen ───────────────────────────────────────────────────────────

export interface ActivityImage {
  urls: string[];
  copyright: string | null;
  license: string | null;
  author: string | null;
}

/** Vollstaendige Business-Sicht einer transformierten Aktivitaet
 *  (snake_case = DB-Spaltennamen, macht die Payload-Builder trivial). */
export interface TransformedActivity {
  source: typeof ACTIVITY_SOURCE;
  source_region: string;
  source_id: string;
  slug: string;
  shortid: string;
  name: string;
  is_closed: boolean;
  description: string | null;
  description_short: string | null;
  tags: string[];
  topics_raw: unknown;
  setting: ActivitySetting | null;
  lat: number;
  lng: number;
  town: string | null;
  gemeinde_slug: string;
  bundesland: string;
  opening_times_raw: unknown;
  opening_times: NormalizedOpeningWindow[] | null;
  open_status: number | null;
  online_bookable: boolean;
  images: ActivityImage[] | null;
  guest_cards: unknown;
  price_hint: string | null;
  content_fingerprint: string;
}

export type SkipReason =
  | 'invalid'               // fehlende/leere id oder name
  | 'excluded-topic'        // Blocklisten-Treffer (Gastro/Shops/...)
  | 'no-importable-topic'   // kein Whitelist-Topic
  | 'no-coordinates'        // fehlende/nicht-finite Koordinaten
  | 'no-gemeinde-match'     // ausserhalb AT-BBox / >25km vom naechsten Zentrum
  | 'bundesland-unresolved'; // Registry-Match ok, aber keine Bundesland-ID -> Lauf-Fehler!

export type TransformOutcome =
  | {
      ok: true;
      activity: TransformedActivity;
      /** Skip-Log-Daten fuer die Lauf-Statistik. */
      unmappedTopics: string[];
      matchedTopics: string[];
      /** true, wenn bundesland nur ueber die REGIONS-Config aufgeloest wurde
       *  (Fallback/Log lt. Task-Spec — Registry-Zeile lieferte keine ID). */
      bundeslandFromConfigFallback: boolean;
    }
  | {
      ok: false;
      reason: SkipReason;
      /** 'bundesland-unresolved' ist ein Lauf-Fehler (Task-Spec), kein
       *  normaler Skip — der Lauf darf dann nicht als complete gelten. */
      fatal: boolean;
      unmappedTopics: string[];
    };

// ── Text-Helpers ─────────────────────────────────────────────────────────────

/** HTML-Reste + Entities aus Deskline-plainDescriptions entfernen
 *  (liefern trotz "plain" noch <br />, &nbsp; & Co.), Mojibake fixen,
 *  Whitespace normalisieren. */
export function cleanDesklineText(raw: string): string {
  return fixMojibake(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .normalize('NFC')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Anzeigename: Mojibake-Fix + NFC + Whitespace kollabiert (Original-Case). */
export function cleanActivityName(raw: string): string {
  return fixMojibake(raw)
    .normalize('NFC')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** GESPERRT-Praefix erkennen und strippen (Task-Spec: geschlossene POIs
 *  werden importiert, is_closed=true; Wiedereroeffnung im naechsten Lauf
 *  setzt is_closed=false ueber den Update-Pfad). */
export function stripGesperrtPrefix(name: string): { name: string; isClosed: boolean } {
  const m = GESPERRT_PREFIX.exec(name);
  if (!m) return { name, isClosed: false };
  return { name: name.slice(m[0].length).trim(), isClosed: true };
}

/** Protokoll-relative Deskline-Bild-URLs ("//resc.deskline.net/...")
 *  auf https normalisieren. */
function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = cleanActivityName(value);
  return cleaned === '' ? null : cleaned;
}

// ── Transform ────────────────────────────────────────────────────────────────

/**
 * Transformiert eine rohe Deskline-Infrastruktur in die poi_activities-
 * Business-Sicht. `regionCode` = REGIONS-Slug der liefernden Region
 * (source_region der ERST-Sichtung, insert-only); `regionBundesland` =
 * REGIONS-Config-Bundesland, NUR Fallback/Log (enthaelt 'Österreich'-
 * Eintraege und ist nicht verlaesslich — autoritativ ist die Gemeinde-
 * Registry, Epic E4).
 */
export function transformInfrastructure(
  raw: DesklineInfrastructure,
  regionCode: string,
  regionBundesland?: string,
): TransformOutcome {
  const sourceId = typeof raw.id === 'string' ? raw.id.trim() : '';
  const rawName = typeof raw.name === 'string' ? raw.name : '';

  // 1) Mojibake + Whitespace, 2) GESPERRT-Praefix.
  const cleanedName = cleanActivityName(rawName);
  const { name, isClosed } = stripGesperrtPrefix(cleanedName);
  if (!sourceId || !name) {
    return { ok: false, reason: 'invalid', fatal: false, unmappedTopics: [] };
  }

  // 3) Topic-Whitelist (Task 1): Blockliste schlaegt Whitelist.
  const topicNames = Array.isArray(raw.topics)
    ? raw.topics.map((t) => t?.name).filter((n): n is string => typeof n === 'string')
    : [];
  const topicResult = mapTopics(topicNames);
  if (topicResult.excludedTopics.length > 0) {
    return { ok: false, reason: 'excluded-topic', fatal: false, unmappedTopics: topicResult.unmappedTopics };
  }
  if (topicResult.matchedTopics.length === 0) {
    return { ok: false, reason: 'no-importable-topic', fatal: false, unmappedTopics: topicResult.unmappedTopics };
  }

  // 4) Koordinaten + Gemeinde-Match (Epic E4; Koordinaten-Pflicht).
  const lat = raw.location?.coordinate?.lat;
  const lng = raw.location?.coordinate?.long;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'no-coordinates', fatal: false, unmappedTopics: topicResult.unmappedTopics };
  }
  const gemeinde = matchGemeinde(lat, lng);
  if (!gemeinde) {
    return { ok: false, reason: 'no-gemeinde-match', fatal: false, unmappedTopics: topicResult.unmappedTopics };
  }

  // bundesland: autoritativ aus der Registry-Zeile (via bundeslandToId in
  // gemeinde-match). REGIONS-Config nur Fallback/Log; ein echter Fehlwert
  // nach Registry-Match ist ein LAUF-Fehler (Task-Spec).
  let bundesland = gemeinde.bundesland;
  let bundeslandFromConfigFallback = false;
  if (!bundesland) {
    bundesland = bundeslandToId(regionBundesland);
    bundeslandFromConfigFallback = bundesland != null;
  }
  if (!bundesland) {
    return { ok: false, reason: 'bundesland-unresolved', fatal: true, unmappedTopics: topicResult.unmappedTopics };
  }

  // 5) Beschreibungen (41 = kurz, 42 = lang) + price_hint aus ALLEN Texten.
  const plainDescs = Array.isArray(raw.plainDescriptions) ? raw.plainDescriptions : [];
  const descTexts = new Map<number, string>();
  const allTexts: string[] = [];
  for (const d of plainDescs) {
    if (!d || typeof d.description !== 'string') continue;
    const cleaned = cleanDesklineText(d.description);
    if (!cleaned) continue;
    allTexts.push(cleaned);
    if (typeof d.type === 'number' && !descTexts.has(d.type)) {
      descTexts.set(d.type, cleaned);
    }
  }
  const description = descTexts.get(DESC_TYPE_LONG) ?? null;
  const descriptionShort = descTexts.get(DESC_TYPE_SHORT) ?? null;
  const priceHint = extractPriceHint(allTexts.join('\n'));

  // 6) Bilder (Attribution ist Pflicht — copyright/license/author mitnehmen).
  let images: ActivityImage[] | null = null;
  if (Array.isArray(raw.images)) {
    const mapped = raw.images
      .map((img) => {
        const urls = Array.isArray(img?.urls)
          ? img.urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '').map(normalizeImageUrl)
          : [];
        if (urls.length === 0) return null;
        return {
          urls,
          copyright: toNullableString(img?.copyright),
          license: toNullableString(img?.license),
          author: toNullableString(img?.author),
        } satisfies ActivityImage;
      })
      .filter((i): i is ActivityImage => i !== null);
    images = mapped.length > 0 ? mapped : null;
  }

  // 7) Oeffnungszeiten: Raw unveraendert + normalisierter E8-Vertrag.
  const openingTimesRaw =
    Array.isArray(raw.openingTimes) && raw.openingTimes.length > 0 ? raw.openingTimes : null;
  const openingTimes = normalizeOpeningTimes(raw.openingTimes);

  const guestCards =
    Array.isArray(raw.guestCards) && raw.guestCards.length > 0 ? raw.guestCards : null;

  const activity: TransformedActivity = {
    source: ACTIVITY_SOURCE,
    source_region: regionCode,
    source_id: sourceId,
    slug: buildActivitySlug(name, ACTIVITY_SOURCE, sourceId),
    shortid: activityShortId(ACTIVITY_SOURCE, sourceId),
    name,
    is_closed: isClosed,
    description,
    description_short: descriptionShort,
    tags: topicResult.tags,
    topics_raw: Array.isArray(raw.topics) && raw.topics.length > 0 ? raw.topics : null,
    setting: topicResult.setting,
    lat,
    lng,
    town: toNullableString(raw.location?.town),
    gemeinde_slug: gemeinde.gemeindeSlug,
    bundesland,
    opening_times_raw: openingTimesRaw,
    opening_times: openingTimes,
    open_status: typeof raw.openStatus === 'number' && Number.isInteger(raw.openStatus) ? raw.openStatus : null,
    online_bookable: raw.onlineBookable === true,
    images,
    guest_cards: guestCards,
    price_hint: priceHint,
    content_fingerprint: contentFingerprint(name, lat, lng),
  };

  return {
    ok: true,
    activity,
    unmappedTopics: topicResult.unmappedTopics,
    matchedTopics: topicResult.matchedTopics,
    bundeslandFromConfigFallback,
  };
}

// ── DML-Spaltengruppen + Payload-Builder ────────────────────────────────────

/** Mutable Business-Spalten des Update-Pfads (Task-Spec-Liste + is_closed/
 *  setting/opening_times_raw, die die Spec an anderer Stelle explizit als
 *  mutabel definiert). NIE slug/shortid/source_region. */
export const UPDATE_BUSINESS_COLUMNS = [
  'name',
  'is_closed',
  'description',
  'description_short',
  'tags',
  'topics_raw',
  'setting',
  'lat',
  'lng',
  'town',
  'gemeinde_slug',
  'bundesland',
  'opening_times_raw',
  'opening_times',
  'open_status',
  'online_bookable',
  'images',
  'guest_cards',
  'price_hint',
  'content_fingerprint',
] as const;

/** Identitaets-/Konflikt-Schluessel des Update-Upserts (unveraenderliche
 *  Werte — PostgREST braucht sie fuer ON CONFLICT (source, source_id)). */
export const IDENTITY_COLUMNS = ['source', 'source_id'] as const;

/** Insert-only-Spalten (write-once, Epic E5). */
export const INSERT_ONLY_COLUMNS = ['source_region', 'slug', 'shortid'] as const;

/** Sichtungs-/Ordnungsspalten — duerfen NIE in Insert-/Update-Payloads
 *  auftauchen (Tests sichern das ab). */
export const SIGHTING_COLUMNS = [
  'last_seen_run_seq',
  'last_seen_complete_run_seq',
  'last_seen_at',
  'seen_regions',
  'visible',
  'duplicate_of',
] as const;

export type ActivityInsertRow = Record<string, unknown>;
export type ActivityUpdateRow = Record<string, unknown>;

/** Insert-Row: Identitaet + insert-only + ALLE Business-Spalten. */
export function buildInsertRow(a: TransformedActivity): ActivityInsertRow {
  const row: ActivityInsertRow = {};
  for (const col of IDENTITY_COLUMNS) row[col] = a[col];
  for (const col of INSERT_ONLY_COLUMNS) row[col] = a[col];
  for (const col of UPDATE_BUSINESS_COLUMNS) row[col] = a[col];
  return row;
}

/** Update-Row (via Upsert ON CONFLICT source,source_id): Identitaet +
 *  mutable Business-Spalten + updated_at. Jede Row traegt exakt dieses
 *  Spaltenset — fehlende Keys in einzelnen Rows eines PostgREST-Batches
 *  wuerden zu NULL-Clobber fuehren (supabase-sync.ts:334-350). */
/** Bestehende Werte der write-once-Spalten (aus dem Prefetch). */
export type WriteOnceValues = {
  [K in (typeof INSERT_ONLY_COLUMNS)[number]]: string;
};

export function buildUpdateRow(
  a: TransformedActivity,
  updatedAtIso: string,
  existing: WriteOnceValues,
): ActivityUpdateRow {
  const row: ActivityUpdateRow = {};
  for (const col of IDENTITY_COLUMNS) row[col] = a[col];
  for (const col of UPDATE_BUSINESS_COLUMNS) row[col] = a[col];
  // Write-once-Spalten (E5) sind NOT NULL. Der Update-Pfad laeuft als
  // PostgREST-Upsert (INSERT .. ON CONFLICT) — Postgres prueft NOT NULL
  // auf der vorgeschlagenen Insert-Zeile, BEVOR der Konflikt aufgeloest
  // wird. Fehlende Spalten scheitern deshalb, auch wenn nur der
  // UPDATE-Zweig feuert. Wir schreiben daher den BESTEHENDEN Wert
  // verbatim zurueck (No-Op fuer die Semantik, Muster aus
  // supabase-sync.ts:334-350) statt ihn neu zu berechnen — so bleibt
  // write-once gewahrt und der Slug SEO-stabil.
  for (const col of INSERT_ONLY_COLUMNS) row[col] = existing[col];
  row.updated_at = updatedAtIso;
  return row;
}
