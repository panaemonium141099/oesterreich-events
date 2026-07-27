/**
 * Filter-/Query-Bau der Uebersichtsseite /aktivitaeten (fn-18 Task 8).
 *
 * Pur und OHNE Runtime-Imports (kein supabase-js, kein next/*) — das Modul
 * wird sowohl von der Client-Liste (ActivitiesBrowser) als auch vom Test
 * importiert. Die Seite selbst bleibt statisch: die Filter leben
 * ausschliesslich im Client-State und werden von dort als Query-Params an
 * /api/activities gereicht (KEINE searchParams im RSC-Pfad — sonst kippt
 * die Route von ISR auf dynamic).
 *
 * Wire-Vertrag ist der von Task 3 eingefrorene /api/activities-Contract:
 * `bundesland`, `tag`, `setting`, `limit`, `cursor`. Unbekannte Werte
 * werden hier verworfen statt durchgereicht — Filter-State kommt zwar aus
 * eigenen Chips, aber der Query-Bau bleibt so auch bei kuenftigen
 * URL-/Deeplink-Quellen deterministisch.
 */

/** Karten pro Seite (Server-Render + jedes "Mehr laden"). */
export const ACTIVITY_LIST_PAGE_SIZE = 24;

/** Werte der Spalte `setting` (public-types.ts). */
export const ACTIVITY_SETTINGS = ['indoor', 'outdoor', 'mixed'] as const;
export type ActivitySetting = (typeof ACTIVITY_SETTINGS)[number];

/**
 * Themen-Chips der Uebersichtsseite. Auswahl ist datengetrieben: die 12
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

export interface ActivityListFilters {
  /** Kanonische lowercase-Bundesland-ID (z. B. 'salzburg'). */
  bundesland: string | null;
  /** Taxonomie-Tag (Array-Containment auf `tags`). */
  tag: string | null;
  /** Exakter `setting`-Wert. */
  setting: ActivitySetting | null;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityListFilters = {
  bundesland: null,
  tag: null,
  setting: null,
};

/** Bundesland-IDs sind lowercase-Slugs — alles andere wird verworfen. */
const BUNDESLAND_ID_RE = /^[a-z]+$/;

export function hasActiveFilter(filters: ActivityListFilters): boolean {
  return filters.bundesland !== null || filters.tag !== null || filters.setting !== null;
}

/** Verwirft unbekannte/nicht wohlgeformte Werte (null == kein Filter). */
export function normalizeActivityFilters(raw: Partial<ActivityListFilters>): ActivityListFilters {
  const bundesland =
    typeof raw.bundesland === 'string' && BUNDESLAND_ID_RE.test(raw.bundesland)
      ? raw.bundesland
      : null;
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
  return { bundesland, tag, setting };
}

/**
 * Query-String fuer /api/activities inkl. fuehrendem '?'. Parameter-
 * Reihenfolge ist fix (bundesland, tag, setting, limit, cursor), damit
 * gleiche Filter denselben URL-String und damit denselben Edge-Cache-Key
 * erzeugen. Kodierung uebernimmt URLSearchParams (Umlaut-Tags wie
 * 'naturführung' muessen prozentkodiert raus).
 */
export function buildActivitiesQuery(
  filters: ActivityListFilters,
  options: { cursor?: string | null; limit?: number } = {},
): string {
  const normalized = normalizeActivityFilters(filters);
  const params = new URLSearchParams();
  if (normalized.bundesland) params.set('bundesland', normalized.bundesland);
  if (normalized.tag) params.set('tag', normalized.tag);
  if (normalized.setting) params.set('setting', normalized.setting);
  params.set('limit', String(options.limit ?? ACTIVITY_LIST_PAGE_SIZE));
  if (options.cursor) params.set('cursor', options.cursor);
  return `?${params.toString()}`;
}
