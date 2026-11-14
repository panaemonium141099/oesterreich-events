/**
 * Die Regionen der Seite (fn-31): für lasstreffen.at die neun Bundesländer,
 * für lasstreffen.de die 16 Länder. Karte, Filter, Regale, Hubs und Sitemap
 * lesen die Liste von hier, nicht mehr direkt `BUNDESLAENDER`.
 *
 * Der erste Eintrag ist immer die Gesamtansicht (`id: 'all'`) mit dem
 * Kartenausschnitt des Landes.
 */
import { BUNDESLAENDER, bundeslandToId, type Bundesland } from '@/lib/bundeslaender';
import { REGIONS_DE } from '@/lib/regions-de.generated';
import { getSite } from './index';

const IS_AT = getSite().country === 'AT';

/** Alle Einträge der Seite, die Gesamtansicht zuerst. */
export const SITE_REGIONS: Bundesland[] = IS_AT ? BUNDESLAENDER : REGIONS_DE;

/**
 * Echte Regionen ohne Gesamtansicht und ohne Pseudo-Regionen. Für Österreich
 * dieselbe Prüfung wie bisher (`bundeslandToId` kennt genau die neun IDs).
 */
export const SITE_REGION_LIST: Bundesland[] = SITE_REGIONS.filter(r =>
  IS_AT ? bundeslandToId(r.id) === r.id : r.id !== 'all',
);

const BY_ID = new Map(SITE_REGIONS.map(r => [r.id, r]));
const REAL_IDS = new Set(SITE_REGION_LIST.map(r => r.id));

/** Gibt es für diese ID eine Regionsseite auf dieser Seite? */
export function isSiteRegion(id: string): boolean {
  return REAL_IDS.has(id);
}

export function siteRegionById(id: string): Bundesland | undefined {
  return BY_ID.get(id);
}

/**
 * Bild der Regionskachel. Für die österreichischen Bundesländer liegen Fotos
 * mit Bildnachweis vor (/bildnachweis); für die deutschen Länder gibt es noch
 * keine, die Kachel zeigt dann nur den Namen.
 */
export function siteRegionImage(id: string): string | null {
  return IS_AT ? `/images/regions/${id}.jpg` : null;
}

/** Gesamtansicht des Landes: Mittelpunkt, Zoom und Ausschnitt für die Karte. */
export const SITE_OVERVIEW: Bundesland = BY_ID.get('all') ?? SITE_REGIONS[0];
