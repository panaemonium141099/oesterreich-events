/**
 * Kuratierter Barrierefrei-Datensatz (data/barrierefrei/*.json).
 *
 * REIN — Typen, Validierung und die Zeilen-Zusammenstellung fuer
 * poi_activities. IO (Lesen der Dateien, Geocoding, DB) macht
 * src/scripts/import-barrierefrei.ts.
 *
 * Herkunft: austria.info/planung/barrierefreier-urlaub verlinkt auf die
 * Barrierefrei-Seiten der Landes- und Stadttourismus-Organisationen,
 * Museumsverzeichnisse und Betreiber. Jede Datei ist EINE Quelle
 * (source_region = ihr Slug), jeder Eintrag traegt die Seite, auf der die
 * Angabe steht (Attribution auf der Detailseite, Pflicht).
 *
 * Texte sind eigene Formulierungen bzw. reine Faktenlisten (Eignungen,
 * Ausstattung, Zeiten) — keine Uebernahme fremder Beschreibungstexte.
 * Bilder: Quellbild mit Credit, sonst Wikimedia Commons (Lizenz im Credit).
 */

import { ACTIVITY_TAG_LABELS } from './tag-labels';
import { activityShortId, buildActivitySlug } from './slug';
import { contentFingerprint } from './fingerprint';
import { matchGemeinde } from './gemeinde-match';
import { activityBezirk } from './bezirk';
import { isAccessibilityFeature, type AccessibilityFeature, type CuratedAccessibility } from './accessibility';
import type { ActivitySetting } from './taxonomy';

/** source-Spalte aller kuratierten Barrierefrei-Zeilen. */
export const BARRIEREFREI_SOURCE = 'barrierefrei-web';

export interface DatasetImage {
  url: string;
  /** Anzeige-Credit ("© Name" wird nicht ergaenzt — so wie die Quelle es nennt). */
  credit: string | null;
  license?: string | null;
  author?: string | null;
}

export interface DatasetEntry {
  /** Stabil innerhalb der Quelle (Slug der Quellseite o. ae.). */
  id: string;
  name: string;
  description?: string | null;
  description_short?: string | null;
  tags?: string[];
  setting?: ActivitySetting | null;
  address?: string | null;
  postal_code?: string | null;
  town?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  /** Seite, auf der die Barrierefrei-Angabe steht (Attribution). */
  source_url: string;
  accessibility: {
    features: string[];
    note?: string | null;
  };
  images?: DatasetImage[];
  price_hint?: string | null;
  /** Rein informativ, wird als Teil der Beschreibung ausgegeben. */
  opening_hint?: string | null;
}

export interface DatasetFile {
  source: string;
  source_label: string;
  source_url: string;
  checked_at: string;
  entries: DatasetEntry[];
}

const SOURCE_SLUG_RE = /^[a-z0-9-]+$/;
const ENTRY_ID_RE = /^[a-z0-9][a-z0-9-]{1,120}$/;

export function validateDatasetFile(raw: unknown, fileName: string): DatasetFile {
  if (raw == null || typeof raw !== 'object') throw new Error(`${fileName}: kein Objekt`);
  const f = raw as Record<string, unknown>;
  if (typeof f.source !== 'string' || !SOURCE_SLUG_RE.test(f.source)) throw new Error(`${fileName}: source fehlt/ungueltig`);
  if (typeof f.source_label !== 'string' || !f.source_label.trim()) throw new Error(`${fileName}: source_label fehlt`);
  if (typeof f.source_url !== 'string' || !/^https?:\/\//.test(f.source_url)) throw new Error(`${fileName}: source_url fehlt`);
  if (typeof f.checked_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.checked_at)) throw new Error(`${fileName}: checked_at (YYYY-MM-DD) fehlt`);
  if (!Array.isArray(f.entries)) throw new Error(`${fileName}: entries fehlt`);
  const ids = new Set<string>();
  const entries = f.entries.map((e, i) => validateEntry(e, `${fileName}#${i}`));
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`${fileName}: doppelte id ${e.id}`);
    ids.add(e.id);
  }
  return {
    source: f.source,
    source_label: f.source_label.trim(),
    source_url: f.source_url,
    checked_at: f.checked_at,
    entries,
  };
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function validateEntry(raw: unknown, where: string): DatasetEntry {
  if (raw == null || typeof raw !== 'object') throw new Error(`${where}: kein Objekt`);
  const e = raw as Record<string, unknown>;
  const id = str(e.id);
  if (!id || !ENTRY_ID_RE.test(id)) throw new Error(`${where}: id fehlt/ungueltig (${String(e.id)})`);
  const name = str(e.name);
  if (!name) throw new Error(`${where} (${id}): name fehlt`);
  const sourceUrl = str(e.source_url);
  if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) throw new Error(`${where} (${id}): source_url fehlt`);
  const acc = e.accessibility;
  if (acc == null || typeof acc !== 'object') throw new Error(`${where} (${id}): accessibility fehlt`);
  const features = Array.isArray((acc as { features?: unknown }).features)
    ? ((acc as { features: unknown[] }).features)
    : [];
  for (const feat of features) {
    if (!isAccessibilityFeature(feat)) throw new Error(`${where} (${id}): unbekanntes Merkmal ${String(feat)}`);
  }
  const tags = Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === 'string') : [];
  for (const t of tags) {
    if (!(t in ACTIVITY_TAG_LABELS)) throw new Error(`${where} (${id}): unbekannter Tag ${t}`);
  }
  const setting = e.setting == null ? null : e.setting;
  if (setting !== null && setting !== 'indoor' && setting !== 'outdoor' && setting !== 'mixed') {
    throw new Error(`${where} (${id}): setting ungueltig`);
  }
  const lat = num(e.lat);
  const lng = num(e.lng);
  if ((lat == null) !== (lng == null)) throw new Error(`${where} (${id}): lat/lng nur gemeinsam`);
  const images = Array.isArray(e.images)
    ? e.images
        .filter((img): img is Record<string, unknown> => img != null && typeof img === 'object')
        .map((img) => ({
          url: str(img.url) ?? '',
          credit: str(img.credit),
          license: str(img.license),
          author: str(img.author),
        }))
        .filter((img) => /^https?:\/\//.test(img.url))
    : [];
  return {
    id,
    name,
    description: str(e.description),
    description_short: str(e.description_short),
    tags: [...new Set(tags)],
    setting,
    address: str(e.address),
    postal_code: str(e.postal_code),
    town: str(e.town),
    lat,
    lng,
    website: str(e.website),
    source_url: sourceUrl,
    accessibility: { features: [...new Set(features as AccessibilityFeature[])], note: str((acc as { note?: unknown }).note) },
    images,
    price_hint: str(e.price_hint),
    opening_hint: str(e.opening_hint),
  };
}

// ── Zeilen-Zusammenstellung ────────────────────────────────────────────────

export function curatedAccessibilityOf(entry: DatasetEntry, file: DatasetFile): CuratedAccessibility {
  return {
    features: entry.accessibility.features as AccessibilityFeature[],
    note: entry.accessibility.note ?? null,
    source_url: entry.source_url,
    source_label: file.source_label,
    checked_at: file.checked_at,
  };
}

/** Geocoding-Kandidaten (genau -> grob), gleiche Logik wie Inserate. */
export function geocodeCandidates(entry: DatasetEntry): string[] {
  const place = [entry.postal_code, entry.town].filter(Boolean).join(' ') || null;
  const out = [
    entry.address && place ? `${entry.address}, ${place}` : null,
    entry.address && entry.town && !entry.postal_code ? `${entry.address}, ${entry.town}` : null,
    entry.town ? `${entry.name}, ${entry.town}` : null,
    place,
    // Letzter Versuch ohne Ortsangabe (Nominatim ist auf AT begrenzt, die
    // Gemeinde-Registry prueft das Ergebnis danach).
    !entry.town && !entry.address ? entry.name.split(/\s*[\/(]/)[0] : null,
  ];
  return [...new Set(out.filter((c): c is string => Boolean(c)))];
}

/** Beschreibung: eigener Text + Fakten (Zeiten, Preis). */
export function composeDescription(entry: DatasetEntry): string | null {
  const parts: string[] = [];
  if (entry.description) parts.push(entry.description);
  if (entry.opening_hint) parts.push(`Öffnungszeiten: ${entry.opening_hint}`);
  if (entry.price_hint) parts.push(`Preise: ${entry.price_hint}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

export interface ResolvedPlace {
  lat: number;
  lng: number;
  gemeindeSlug: string;
  bundesland: string;
  bezirk: string | null;
  townFallback: string | null;
}

/** Ort ueber die Gemeinde-Registry aufloesen (wie der Deskline-Ingest). */
export function resolvePlace(lat: number, lng: number): ResolvedPlace | null {
  const m = matchGemeinde(lat, lng);
  if (!m || !m.bundesland) return null;
  return {
    lat,
    lng,
    gemeindeSlug: m.gemeindeSlug,
    bundesland: m.bundesland,
    bezirk: activityBezirk(m.gemeinde, m.bundesland),
    townFallback: m.gemeinde.name,
  };
}

export function sourceIdOf(file: DatasetFile, entry: DatasetEntry): string {
  return `${file.source}:${entry.id}`;
}

/** Insert-Row fuer eine NEUE kuratierte Aktivitaet (alle NOT-NULL-Spalten). */
export function buildCuratedInsertRow(
  file: DatasetFile,
  entry: DatasetEntry,
  place: ResolvedPlace,
  images: DatasetImage[],
  nowIso: string,
): Record<string, unknown> {
  const sourceId = sourceIdOf(file, entry);
  const description = composeDescription(entry);
  return {
    source: BARRIEREFREI_SOURCE,
    source_region: file.source,
    source_id: sourceId,
    slug: buildActivitySlug(entry.name, BARRIEREFREI_SOURCE, sourceId),
    shortid: activityShortId(BARRIEREFREI_SOURCE, sourceId),
    name: entry.name,
    description,
    description_short: entry.description_short ?? null,
    tags: entry.tags ?? [],
    topics_raw: null,
    setting: entry.setting ?? null,
    lat: place.lat,
    lng: place.lng,
    town: entry.town ?? place.townFallback,
    gemeinde_slug: place.gemeindeSlug,
    bundesland: place.bundesland,
    bezirk: place.bezirk,
    opening_times_raw: null,
    opening_times: null,
    open_status: null,
    online_bookable: false,
    images: images.length > 0 ? images.map(toImageJson) : null,
    guest_cards: null,
    price_hint: entry.price_hint ?? null,
    content_fingerprint: contentFingerprint(entry.name, place.lat, place.lng),
    visible: true,
    is_closed: false,
    seen_regions: [file.source],
    quality_score: estimateQualityScore(description, images.length, entry.description_short ?? null),
    accessibility_curated: curatedAccessibilityOf(entry, file),
    source_url: entry.source_url,
    source_label: file.source_label,
    updated_at: nowIso,
  };
}

/** Update-Row (Wiederholungslauf): nur mutable Spalten, Slug/shortid bleiben. */
export function buildCuratedUpdateRow(
  file: DatasetFile,
  entry: DatasetEntry,
  place: ResolvedPlace,
  images: DatasetImage[],
  nowIso: string,
): Record<string, unknown> {
  const description = composeDescription(entry);
  return {
    name: entry.name,
    description,
    description_short: entry.description_short ?? null,
    tags: entry.tags ?? [],
    setting: entry.setting ?? null,
    lat: place.lat,
    lng: place.lng,
    town: entry.town ?? place.townFallback,
    gemeinde_slug: place.gemeindeSlug,
    bundesland: place.bundesland,
    bezirk: place.bezirk,
    images: images.length > 0 ? images.map(toImageJson) : null,
    price_hint: entry.price_hint ?? null,
    content_fingerprint: contentFingerprint(entry.name, place.lat, place.lng),
    is_closed: false,
    visible: true,
    quality_score: estimateQualityScore(description, images.length, entry.description_short ?? null),
    accessibility_curated: curatedAccessibilityOf(entry, file),
    source_url: entry.source_url,
    source_label: file.source_label,
    updated_at: nowIso,
  };
}

/** Naeherung der SQL-Funktion recompute_activity_quality_scores (ohne
 *  Saison/Jitter) — der naechtliche Recompute uebernimmt danach. */
export function estimateQualityScore(description: string | null, imageCount: number, short: string | null): number {
  const len = description?.length ?? 0;
  const desc = len >= 600 ? 25 : len >= 200 ? 18 : len > 0 ? 8 : 0;
  const img = imageCount >= 3 ? 20 : imageCount >= 1 ? 12 : 0;
  return desc + img + (short ? 4 : 0);
}

export function toImageJson(img: DatasetImage): { urls: string[]; copyright: string | null; license: string | null; author: string | null } {
  return { urls: [img.url], copyright: img.credit, license: img.license ?? null, author: img.author ?? null };
}

// ── Abgleich mit dem Deskline-Bestand ─────────────────────────────────────

export function normalizeForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['der', 'die', 'das', 'und', 'im', 'in', 'am', 'an', 'von', 'zu', 'zum', 'zur', 'mit', 'bei', 'the', 'of']);

function tokens(name: string): Set<string> {
  return new Set(normalizeForMatch(name).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

/** Haversine in Metern. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export interface MatchCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Bestehender Deskline-POI, der denselben Ort meint: hoechstens 600 m
 * entfernt UND Namen ueberlappen deutlich (ein Name enthaelt den anderen
 * oder >= 60 % der Tokens des kuerzeren Namens kommen im anderen vor).
 * Bei mehreren Treffern der naechste.
 */
export function findDesklineMatch(
  entry: { name: string; lat: number; lng: number },
  candidates: MatchCandidate[],
  maxMeters = 600,
): MatchCandidate | null {
  const a = normalizeForMatch(entry.name);
  const ta = tokens(entry.name);
  let best: { c: MatchCandidate; d: number } | null = null;
  for (const c of candidates) {
    const d = distanceMeters(entry.lat, entry.lng, c.lat, c.lng);
    if (d > maxMeters) continue;
    const b = normalizeForMatch(c.name);
    const tb = tokens(c.name);
    const contains = a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a));
    const smaller = ta.size <= tb.size ? ta : tb;
    const larger = smaller === ta ? tb : ta;
    let hit = 0;
    for (const t of smaller) if (larger.has(t)) hit++;
    const overlap = smaller.size > 0 ? hit / smaller.size : 0;
    if (!contains && overlap < 0.6) continue;
    if (!best || d < best.d) best = { c, d };
  }
  return best?.c ?? null;
}
