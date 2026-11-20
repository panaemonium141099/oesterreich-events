/**
 * Orte der Seiten „Was kann man in X machen?" (/was-tun/[slug]).
 *
 * Drei Ortsarten teilen sich EINE Route; der Slug entscheidet:
 *   - Bundesland  → Bundesland-ID ('steiermark')
 *   - Region      → Slug aus TOURISM_REGIONS ('salzkammergut')
 *   - Gemeinde    → Gemeinde-Slug der Stammdaten ('7000-eisenstadt')
 * Gemeinde-Slugs beginnen mit der PLZ, die beiden anderen nie mit einer
 * Ziffer: es gibt keine Kollision (Wächter in regions.test.ts).
 *
 * Alles hier ist pur (keine DB), damit Sitemap, Seite und Tests dieselbe
 * Ortsliste lesen.
 */

import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { haversineKm } from '@/lib/gemeinden/data';
import { getCityHub } from '@/lib/hubs/city-hubs';
import { siteGemeindeBySlug, siteGemeinden, siteNeighbourGemeinden, type SiteGemeinde } from '@/lib/site/gemeinden';
import { slugifyBundesland } from '@/lib/hubs/gemeinde-hub-content';
import { TOURISM_REGIONS, tourismRegionBySlug } from './regions';

export const WAS_TUN_BASE = '/was-tun';

export type WasTunKind = 'gemeinde' | 'region' | 'bundesland';

export interface WasTunPlace {
  kind: WasTunKind;
  slug: string;
  name: string;
  /** Ortsangabe mit Präposition: „in Eisenstadt", „im Salzkammergut". */
  where: string;
  bundeslandId: string;
  bundeslandName: string;
  /** Mittelpunkt und Umkreis der Abfrage; null beim Bundesland (Spaltenfilter). */
  center: { lat: number; lng: number; radiusKm: number } | null;
  /** Gemeinde, an der eine Region hängt (für die Angabe „im Umkreis von … um …"). */
  anchorName: string | null;
  /** Bestehende Event-Übersicht dieses Orts, falls es eine gibt. */
  eventsHubHref: string | null;
}

/** Ortsangaben der Bundesländer. „in Salzburg" wäre die Stadt. */
const BUNDESLAND_WHERE: Record<string, string> = {
  burgenland: 'im Burgenland',
  kaernten: 'in Kärnten',
  niederoesterreich: 'in Niederösterreich',
  oberoesterreich: 'in Oberösterreich',
  salzburg: 'im Salzburger Land',
  steiermark: 'in der Steiermark',
  tirol: 'in Tirol',
  vorarlberg: 'in Vorarlberg',
  wien: 'in Wien',
};

const REAL_BUNDESLAENDER = BUNDESLAENDER.filter((b) => b.id !== 'all' && b.id in BUNDESLAND_WHERE);

function bundeslandName(id: string): string {
  return REAL_BUNDESLAENDER.find((b) => b.id === id)?.name ?? id;
}

/** Bundesland-ID einer Gemeinde der Stammdaten. */
export function gemeindeBundeslandId(g: SiteGemeinde): string {
  return slugifyBundesland(g.bundesland);
}

/**
 * Wien ist Gemeinde und Bundesland zugleich. Die Bundesland-Seite deckt die
 * ganze Stadt ab (ein 10-km-Kreis um den Stephansplatz nicht), deshalb gibt
 * es nur sie; der Gemeinde-Slug leitet dorthin um.
 */
export function wasTunRedirectSlug(slug: string): string | null {
  const g = siteGemeindeBySlug(slug);
  if (g && gemeindeBundeslandId(g) === 'wien') return 'wien';
  return null;
}

export function resolveWasTunPlace(slug: string): WasTunPlace | null {
  if (slug in BUNDESLAND_WHERE) {
    const name = bundeslandName(slug);
    return {
      kind: 'bundesland',
      slug,
      name,
      where: BUNDESLAND_WHERE[slug],
      bundeslandId: slug,
      bundeslandName: name,
      center: null,
      anchorName: null,
      eventsHubHref: `/${slug}`,
    };
  }

  const region = tourismRegionBySlug(slug);
  if (region) {
    const anchor = siteGemeindeBySlug(region.anchor);
    if (!anchor) return null;
    return {
      kind: 'region',
      slug,
      name: region.name,
      where: region.where,
      bundeslandId: region.bundesland,
      bundeslandName: bundeslandName(region.bundesland),
      center: { lat: anchor.lat, lng: anchor.lng, radiusKm: region.radiusKm },
      anchorName: anchor.name,
      eventsHubHref: null,
    };
  }

  const g = siteGemeindeBySlug(slug);
  if (g && gemeindeBundeslandId(g) !== 'wien') {
    const blId = gemeindeBundeslandId(g);
    return {
      kind: 'gemeinde',
      slug,
      name: g.name,
      where: `in ${g.name}`,
      bundeslandId: blId,
      bundeslandName: bundeslandName(blId),
      // Derselbe Umkreis wie die Event-Übersicht der Gemeinde.
      center: { lat: g.lat, lng: g.lng, radiusKm: getCityHub(g.slug)?.radiusKm ?? 10 },
      anchorName: null,
      eventsHubHref: `/gemeinde/${g.slug}`,
    };
  }

  return null;
}

export function wasTunHref(slug: string, themeSlug?: string): string {
  return `${WAS_TUN_BASE}/${slug}${themeSlug ? `/${themeSlug}` : ''}`;
}

export interface WasTunLink {
  name: string;
  href: string;
}

export function bundeslandLinks(): WasTunLink[] {
  return REAL_BUNDESLAENDER.map((b) => ({ name: b.name, href: wasTunHref(b.id) }));
}

export function regionLinks(bundeslandId?: string): WasTunLink[] {
  return TOURISM_REGIONS
    .filter((r) => !bundeslandId || r.bundesland === bundeslandId)
    .map((r) => ({ name: r.name, href: wasTunHref(r.slug) }));
}

function gemeindeLinks(list: readonly SiteGemeinde[]): WasTunLink[] {
  return list
    .filter((g) => gemeindeBundeslandId(g) !== 'wien')
    .map((g) => ({ name: g.name, href: wasTunHref(g.slug) }));
}

/** Höchstens so viele Gemeinden listet eine Regionsseite. */
const REGION_GEMEINDE_LIMIT = 40;

/**
 * Orte, auf die eine Seite weiterverlinkt: Nachbarn (Gemeinde), Gemeinden im
 * Umkreis (Region) oder alle Gemeinden und Regionen (Bundesland).
 */
export function relatedPlaces(place: WasTunPlace): { regions: WasTunLink[]; gemeinden: WasTunLink[] } {
  if (place.kind === 'bundesland') {
    const gemeinden = siteGemeinden()
      .filter((g) => gemeindeBundeslandId(g) === place.bundeslandId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { regions: regionLinks(place.bundeslandId), gemeinden: gemeindeLinks(gemeinden) };
  }

  if (place.kind === 'region' && place.center) {
    const { lat, lng, radiusKm } = place.center;
    const inside = siteGemeinden()
      .map((g) => ({ g, d: haversineKm(lat, lng, g.lat, g.lng) }))
      .filter((x) => x.d <= radiusKm)
      .sort((a, b) => a.d - b.d)
      .slice(0, REGION_GEMEINDE_LIMIT)
      .map((x) => x.g);
    return { regions: [], gemeinden: gemeindeLinks(inside) };
  }

  const g = siteGemeindeBySlug(place.slug);
  if (!g || !place.center) return { regions: [], gemeinden: [] };
  // Regionen, in deren Umkreis die Gemeinde liegt.
  const regions = TOURISM_REGIONS.filter((r) => {
    const anchor = siteGemeindeBySlug(r.anchor);
    return anchor != null && haversineKm(anchor.lat, anchor.lng, g.lat, g.lng) <= r.radiusKm;
  }).map((r) => ({ name: r.name, href: wasTunHref(r.slug) }));
  return { regions, gemeinden: gemeindeLinks(siteNeighbourGemeinden(g, 8)) };
}

/** Alle Slugs der Seitenfamilie (Sitemap). */
export function allWasTunSlugs(): string[] {
  return [
    ...REAL_BUNDESLAENDER.map((b) => b.id),
    ...TOURISM_REGIONS.map((r) => r.slug),
    ...siteGemeinden().filter((g) => gemeindeBundeslandId(g) !== 'wien').map((g) => g.slug),
  ];
}
