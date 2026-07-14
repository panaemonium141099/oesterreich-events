/**
 * Widget-Scopes — gemeinsame Auflösung für /widget/[region] und
 * /api/widget/suggest. Drei Scope-Arten, unterscheidbar am Slug:
 *
 *   - Region:   'oesterreich' | Bundesland-Slug ('wien', 'steiermark', …)
 *   - Bezirk:   'bezirk-' + slugifizierter Bezirksname ('bezirk-hermagor',
 *               'bezirk-1-innere-stadt') — events.district speichert den
 *               Bezirksnamen lowercase ('hermagor', '1. innere stadt'),
 *               verifiziert 2026-07-14 gegen die DB.
 *   - Gemeinde: '{plz}-{ort}' aus der Gemeinde-Registry (beginnt mit
 *               4 Ziffern, kollidiert daher nie mit den anderen beiden).
 *
 * Alles statische Daten (districtsAT + Gemeinde-Registry) — kein DB-Zugriff.
 */
import {
  BUNDESLAND_NAMES,
  DISTRICTS_BY_BUNDESLAND,
  displayDistrictName,
  type BundeslandId,
} from '@/lib/districtsAT';
import { getGemeindeBySlug, gemeindeSlug, ALL_GEMEINDEN } from '@/lib/gemeinden/data';

export type WidgetScope =
  | { kind: 'region'; slug: string; label: string; bundesland: BundeslandId | null; hubPath: string }
  | { kind: 'bezirk'; slug: string; label: string; bundesland: BundeslandId; district: string; hubPath: string }
  | { kind: 'gemeinde'; slug: string; label: string; lat: number; lng: number; hubPath: string };

export const REGION_LABELS: Record<string, string> = {
  oesterreich: 'ganz Österreich',
  ...BUNDESLAND_NAMES,
};

/** Bezirk-Slug → { district (DB-Wert), bundesland }. Einmalig aufgebaut. */
const BEZIRK_INDEX: Map<string, { name: string; bundesland: BundeslandId }> = (() => {
  const m = new Map<string, { name: string; bundesland: BundeslandId }>();
  for (const [bl, districts] of Object.entries(DISTRICTS_BY_BUNDESLAND)) {
    for (const d of districts) {
      m.set(`bezirk-${gemeindeSlug(d.name)}`, { name: d.name, bundesland: bl as BundeslandId });
    }
  }
  return m;
})();

export function resolveWidgetScope(slug: string): WidgetScope | null {
  const regionLabel = REGION_LABELS[slug];
  if (regionLabel) {
    return {
      kind: 'region',
      slug,
      label: regionLabel,
      bundesland: slug === 'oesterreich' ? null : (slug as BundeslandId),
      hubPath: slug === 'oesterreich' ? '/entdecken' : `/${slug}`,
    };
  }

  const bezirk = BEZIRK_INDEX.get(slug);
  if (bezirk) {
    return {
      kind: 'bezirk',
      slug,
      label: `Bezirk ${displayDistrictName(bezirk.name)}`,
      bundesland: bezirk.bundesland,
      district: bezirk.name.toLowerCase(),
      hubPath: `/${bezirk.bundesland}`,
    };
  }

  const gemeinde = getGemeindeBySlug(slug);
  if (gemeinde) {
    return {
      kind: 'gemeinde',
      slug,
      label: gemeinde.name,
      lat: gemeinde.lat,
      lng: gemeinde.lng,
      hubPath: `/gemeinde/${gemeinde.slug}`,
    };
  }

  return null;
}

export interface WidgetSuggestion {
  slug: string;
  label: string;
  /** Kontextzeile fürs Dropdown, z. B. "Bezirk · Kärnten". */
  sub: string;
}

/** Umlaut-tolerante Normalisierung fürs Matching (wie gemeindeSlug, ohne '-'). */
function norm(s: string): string {
  return gemeindeSlug(s).replace(/-/g, ' ');
}

interface IndexedSuggestion extends WidgetSuggestion {
  normLabel: string;
}

const SUGGESTION_INDEX: IndexedSuggestion[] = (() => {
  const out: IndexedSuggestion[] = [];
  for (const [slug, label] of Object.entries(REGION_LABELS)) {
    const display = slug === 'oesterreich' ? 'Ganz Österreich' : label;
    out.push({ slug, label: display, sub: slug === 'oesterreich' ? 'Alle Regionen' : 'Bundesland', normLabel: norm(display) });
  }
  for (const [slug, b] of BEZIRK_INDEX) {
    const display = displayDistrictName(b.name);
    out.push({ slug, label: display, sub: `Bezirk · ${BUNDESLAND_NAMES[b.bundesland]}`, normLabel: norm(display) });
  }
  for (const g of ALL_GEMEINDEN) {
    out.push({ slug: g.slug, label: g.name, sub: `Gemeinde · ${g.plz}, ${g.bundesland}`, normLabel: norm(g.name) });
  }
  return out;
})();

/**
 * Typeahead: Präfix-Treffer vor Substring-Treffern, innerhalb dessen
 * Regionen > Bezirke > Gemeinden (Reihenfolge des Index), max. `limit`.
 */
export function suggestWidgetScopes(query: string, limit = 8): WidgetSuggestion[] {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const prefix: WidgetSuggestion[] = [];
  const substr: WidgetSuggestion[] = [];
  for (const s of SUGGESTION_INDEX) {
    if (s.normLabel.startsWith(q)) {
      prefix.push(s);
    } else if (s.normLabel.includes(q)) {
      substr.push(s);
    }
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...substr].slice(0, limit).map(({ slug, label, sub }) => ({ slug, label, sub }));
}
