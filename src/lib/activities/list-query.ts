/**
 * Filter-/Query-Bau der Uebersichtsseite /aktivitaeten (fn-18 Task 8,
 * Filter-Modul 2026-09-15).
 *
 * Pur und OHNE Runtime-Imports (kein supabase-js, kein next/*) — das Modul
 * wird sowohl von der Client-Liste (ActivitiesBrowser/ActivityFilterBar)
 * als auch vom Test importiert. Die Seite selbst bleibt statisch: die
 * Filter leben ausschliesslich im Client-State, werden von dort als
 * Query-Params an /api/activities gereicht und per history.replaceState in
 * die Seiten-URL gespiegelt (KEINE searchParams im RSC-Pfad — sonst kippt
 * die Route von ISR auf dynamic).
 *
 * Wire-Vertrag ist der von Task 3 eingefrorene /api/activities-Contract,
 * erweitert um `bezirk` (Mehrfachauswahl, kommagetrennt, kanonische
 * lowercase-Bezirksnamen aus DISTRICTS_BY_BUNDESLAND == events.district),
 * `q` (Freitext auf Name/Ort) und `count=1` (exakte Trefferzahl).
 * Unbekannte Werte werden hier verworfen statt durchgereicht — so bleibt
 * der Query-Bau auch bei URL-/Deeplink-Quellen deterministisch.
 */

import { getDistrictsByBundesland } from '@/lib/districtsAT';

/** Karten pro Seite (Server-Render + jedes "Mehr laden"). */
export const ACTIVITY_LIST_PAGE_SIZE = 24;

/** Werte der Spalte `setting` (public-types.ts). */
export const ACTIVITY_SETTINGS = ['indoor', 'outdoor', 'mixed'] as const;
export type ActivitySetting = (typeof ACTIVITY_SETTINGS)[number];

/**
 * Themen der Uebersichtsseite. Auswahl ist datengetrieben: die 12
 * haeufigsten Tags einer 5 000-Row-Stichprobe des sichtbaren Bestands
 * (Messung 2026-07-27, Reihenfolge = Haeufigkeit absteigend). Alle
 * Eintraege haben ein kuratiertes Label in tag-labels.ts.
 */
export const ACTIVITY_FILTER_TAGS = [
  'ausstellung',
  'wandern',
  'museumstour',
  'schwimmen',
  'naturführung',
  'reiten',
  'klettern',
  'bergtour',
  'wassersport',
  'tennis',
  'langlauf',
  'ski',
] as const;

/** Obergrenze fuer gleichzeitig gewaehlte Bezirke (groesstes Bundesland
 *  hat 25; die Liste wandert als Query-Param mit). */
export const ACTIVITY_MAX_BEZIRKE = 30;

/** Freitext: mindestens 2, hoechstens 60 Zeichen (nach Whitespace-Kollaps). */
export const ACTIVITY_SEARCH_MIN = 2;
export const ACTIVITY_SEARCH_MAX = 60;

export interface ActivityListFilters {
  /** Kanonische lowercase-Bundesland-ID (z. B. 'salzburg'). */
  bundesland: string | null;
  /** Kanonische lowercase-Bezirksnamen des gewaehlten Bundeslands;
   *  ohne Bundesland immer leer (Bezirk setzt Bundesland voraus). */
  bezirke: string[];
  /** Taxonomie-Tag (Array-Containment auf `tags`). */
  tag: string | null;
  /** Exakter `setting`-Wert. */
  setting: ActivitySetting | null;
  /** Freitext auf Name/Ort; '' = kein Filter. */
  q: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityListFilters = {
  bundesland: null,
  bezirke: [],
  tag: null,
  setting: null,
  q: '',
};

/** Bundesland-IDs sind lowercase-Slugs — alles andere wird verworfen. */
const BUNDESLAND_ID_RE = /^[a-z]+$/;

export function hasActiveFilter(filters: ActivityListFilters): boolean {
  return (
    filters.bundesland !== null ||
    filters.bezirke.length > 0 ||
    filters.tag !== null ||
    filters.setting !== null ||
    filters.q !== ''
  );
}

/** Anzahl aktiver Filter-Dimensionen (fuer den "Filter (n)"-Badge). */
export function countActiveFilters(filters: ActivityListFilters): number {
  return (
    (filters.bundesland ? 1 : 0) +
    (filters.bezirke.length > 0 ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.setting ? 1 : 0) +
    (filters.q ? 1 : 0)
  );
}

/** Kanonische lowercase-Bezirksnamen eines Bundeslands (leer fuer unbekannt). */
export function canonicalBezirkeFor(bundesland: string | null): string[] {
  if (!bundesland) return [];
  return getDistrictsByBundesland(bundesland).map((d) => d.name.toLowerCase());
}

/**
 * Freitext normalisieren: trimmen, Whitespace kollabieren, Laenge kappen.
 * Liefert '' unterhalb der Mindestlaenge. Keine Zeichen-Whitelist hier —
 * die Musterbildung fuer PostgREST macht die API (ilike-Pattern).
 */
export function normalizeActivitySearch(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim().slice(0, ACTIVITY_SEARCH_MAX).trim();
  return collapsed.length >= ACTIVITY_SEARCH_MIN ? collapsed : '';
}

/**
 * PostgREST-ilike-Muster fuer `q` (API-Seite, Filter
 * `name.ilike.<muster>,town.ilike.<muster>` innerhalb eines `.or()`).
 * In or-Filtern trennen Komma und Klammern die Bedingungen und `*` ist der
 * Wildcard — deshalb wird alles ausser Buchstaben, Ziffern, Leerzeichen,
 * Apostroph, Bindestrich, `&` und `/` zum Wildcard: "St. Johann" ->
 * "*St* Johann*" trifft "St. Johann" UND "St Johann". Liefert null, wenn
 * nach der Normalisierung nichts Suchbares uebrig bleibt.
 */
export function activitySearchPattern(raw: unknown): string | null {
  const q = normalizeActivitySearch(raw);
  if (!q) return null;
  const core = q
    .replace(/[^\p{L}\p{N}\s'’&/-]+/gu, '*')
    .replace(/\*{2,}/g, '*')
    .replace(/^\*+|\*+$/g, '')
    .trim();
  if (core.replace(/[\s*]/g, '').length < ACTIVITY_SEARCH_MIN) return null;
  return `*${core}*`;
}

/** Verwirft unbekannte/nicht wohlgeformte Werte (null/[]/'' == kein Filter). */
export function normalizeActivityFilters(raw: Partial<ActivityListFilters>): ActivityListFilters {
  const bundesland =
    typeof raw.bundesland === 'string' && BUNDESLAND_ID_RE.test(raw.bundesland)
      ? raw.bundesland
      : null;

  // Bezirke nur mit Bundesland und nur aus dessen kanonischer Liste;
  // dedupliziert + sortiert -> gleicher Filter == gleicher Cache-Key.
  let bezirke: string[] = [];
  if (bundesland && Array.isArray(raw.bezirke)) {
    const allowed = new Set(canonicalBezirkeFor(bundesland));
    bezirke = [
      ...new Set(
        raw.bezirke
          .filter((b): b is string => typeof b === 'string')
          .map((b) => b.trim().toLowerCase())
          .filter((b) => allowed.has(b)),
      ),
    ]
      .sort()
      .slice(0, ACTIVITY_MAX_BEZIRKE);
  }

  const tag =
    typeof raw.tag === 'string' &&
    (ACTIVITY_FILTER_TAGS as ReadonlyArray<string>).includes(raw.tag)
      ? raw.tag
      : null;
  const setting =
    typeof raw.setting === 'string' &&
    (ACTIVITY_SETTINGS as ReadonlyArray<string>).includes(raw.setting)
      ? (raw.setting as ActivitySetting)
      : null;
  const q = normalizeActivitySearch(raw.q);
  return { bundesland, bezirke, tag, setting, q };
}

/** `bezirk`-Query-Param (kommagetrennt) -> Liste; Kodierung via URLSearchParams. */
export function splitBezirkParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((b) => b.trim()).filter((b) => b.length > 0);
}

/**
 * Query-String fuer /api/activities inkl. fuehrendem '?'. Parameter-
 * Reihenfolge ist fix (bundesland, bezirk, tag, setting, q, count, limit,
 * cursor), damit gleiche Filter denselben URL-String und damit denselben
 * Edge-Cache-Key erzeugen. Kodierung uebernimmt URLSearchParams (Umlaut-
 * Tags wie 'naturführung' und Bezirke wie 'zell am see' muessen
 * prozentkodiert raus).
 */
export function buildActivitiesQuery(
  filters: ActivityListFilters,
  options: { cursor?: string | null; limit?: number; count?: boolean } = {},
): string {
  const normalized = normalizeActivityFilters(filters);
  const params = new URLSearchParams();
  if (normalized.bundesland) params.set('bundesland', normalized.bundesland);
  if (normalized.bezirke.length > 0) params.set('bezirk', normalized.bezirke.join(','));
  if (normalized.tag) params.set('tag', normalized.tag);
  if (normalized.setting) params.set('setting', normalized.setting);
  if (normalized.q) params.set('q', normalized.q);
  if (options.count) params.set('count', '1');
  params.set('limit', String(options.limit ?? ACTIVITY_LIST_PAGE_SIZE));
  if (options.cursor) params.set('cursor', options.cursor);
  return `?${params.toString()}`;
}

/**
 * Seiten-URL <-> Filter (teilbare Links, Zurueck-Navigation). Gleiche
 * Param-Namen wie die API, damit es einen einzigen Codec gibt. Liefert
 * '' ohne aktive Filter (dann wird die URL auf den blanken Pfad gesetzt).
 */
export function filtersToPageSearch(filters: ActivityListFilters): string {
  const normalized = normalizeActivityFilters(filters);
  const params = new URLSearchParams();
  if (normalized.bundesland) params.set('bundesland', normalized.bundesland);
  if (normalized.bezirke.length > 0) params.set('bezirk', normalized.bezirke.join(','));
  if (normalized.tag) params.set('tag', normalized.tag);
  if (normalized.setting) params.set('setting', normalized.setting);
  if (normalized.q) params.set('q', normalized.q);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function filtersFromPageSearch(search: string): ActivityListFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return normalizeActivityFilters({
    bundesland: params.get('bundesland'),
    bezirke: splitBezirkParam(params.get('bezirk')),
    tag: params.get('tag'),
    setting: params.get('setting') as ActivitySetting | null,
    q: params.get('q') ?? '',
  });
}
