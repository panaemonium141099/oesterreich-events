/**
 * Gemeinden der Seite für die Gemeinde-Seiten `/gemeinde/[slug]` (fn-31.11).
 *
 * lasstreffen.at: die österreichischen Gemeinden aus `src/lib/gemeinden/data.ts`,
 * unverändert. lasstreffen.de: die deutschen aus `src/lib/gemeinden/de.ts`
 * (Destatis), im selben Format: Name, Amts-PLZ, Kreis als `bezirk`, Name des
 * Landes als `bundesland`, Mittelpunkt, Slug `{plz}-{name}`.
 *
 * Nur für den Server (liest die Stammdateien von der Platte). Die Pipeline
 * und der Ortsresolver lesen weiter direkt `gemeinden/data.ts` bzw.
 * `gemeinden/de.ts`; dieses Modul ist die Sicht der Website.
 */
import {
  ALL_GEMEINDEN,
  currentGemeindeSlug,
  findNeighbourGemeinden,
  gemeindeSlug,
  getGemeindeBySlug,
  haversineKm,
  type AustrianGemeinde,
} from '@/lib/gemeinden/data';
import { loadGemeindenDe } from '@/lib/gemeinden/de';
import { deLandById } from '@/lib/gemeinden/laender-de';
import { getSite } from './index';

/** Eine Gemeinde, wie die Gemeinde-Seite sie braucht (für beide Länder gleich). */
export type SiteGemeinde = AustrianGemeinde;

const IS_AT = getSite().country === 'AT';

let deList: SiteGemeinde[] | null = null;
let deBySlug: Map<string, SiteGemeinde> | null = null;

/**
 * Deutsche Gemeinden mit eindeutigem Slug. Gleicher Name unter derselben
 * Amts-PLZ kommt vor (Garding Stadt und Kirchspiel Garding, 25836): die
 * einwohnerstärkere behält `{plz}-{name}`, die andere bekommt den
 * Gemeindeschlüssel angehängt. Stabil, weil nach Einwohnern und AGS sortiert.
 */
export function buildGemeindenDe(): SiteGemeinde[] {
  const taken = new Set<string>();
  const out: SiteGemeinde[] = [];
  const sorted = [...loadGemeindenDe()]
    .filter(g => g.lat !== 0 || g.lng !== 0)
    .sort((a, b) => b.einwohner - a.einwohner || a.ags.localeCompare(b.ags));
  for (const g of sorted) {
    const base = `${g.plz}-${gemeindeSlug(g.name)}`;
    const slug = taken.has(base) ? `${base}-${g.ags}` : base;
    taken.add(slug);
    out.push({
      name: g.name,
      plz: g.plz,
      bezirk: g.kreis,
      bundesland: deLandById(g.land)?.name ?? g.land,
      lat: g.lat,
      lng: g.lng,
      slug,
    });
  }
  return out;
}

function de(): { list: SiteGemeinde[]; bySlug: Map<string, SiteGemeinde> } {
  if (!deList || !deBySlug) {
    deList = buildGemeindenDe();
    deBySlug = new Map(deList.map(g => [g.slug, g]));
  }
  return { list: deList, bySlug: deBySlug };
}

/** Alle Gemeinden der Seite. */
export function siteGemeinden(): ReadonlyArray<SiteGemeinde> {
  return IS_AT ? ALL_GEMEINDEN : de().list;
}

export function siteGemeindeBySlug(slug: string): SiteGemeinde | null {
  return IS_AT ? getGemeindeBySlug(slug) : de().bySlug.get(slug) ?? null;
}

/** Aktueller Slug zu einem früheren (nur Österreich kennt umgezogene Slugs). */
export function siteCurrentGemeindeSlug(legacySlug: string): string | null {
  return IS_AT ? currentGemeindeSlug(legacySlug) : null;
}

/** Die nächsten Gemeinden nach Entfernung der Mittelpunkte. */
export function siteNeighbourGemeinden(g: SiteGemeinde, limit = 6): SiteGemeinde[] {
  if (IS_AT) return findNeighbourGemeinden(g, limit);
  // Deutschland hat rund 10.700 Gemeinden: erst grob nach Breitengrad
  // eingrenzen (1 Grad ≈ 111 km), dann genau messen.
  return de().list
    .filter(o => o.slug !== g.slug && Math.abs(o.lat - g.lat) < 0.5 && Math.abs(o.lng - g.lng) < 0.8)
    .map(o => ({ g: o, d: haversineKm(g.lat, g.lng, o.lat, o.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(x => x.g);
}
