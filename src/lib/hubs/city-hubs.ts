/**
 * City hubs — the handful of major cities that get "city" treatment on the
 * gemeinde hub page instead of the generic village rendering:
 *   - wider event-discovery radius (cities sprawl)
 *   - year-in-title, PLZ-free ("Veranstaltungen in Linz 2026 — N Events")
 *   - curated editorial intro (lead + body) instead of the rotating pool
 *
 * Keyed by the canonical `/gemeinde/{slug}`. The old `/stadt/{city}` routes
 * 301-redirect here (see next.config.ts) — this file is the single source of
 * truth for "which gemeinde slugs are cities" and for that redirect mapping.
 *
 * Slugs verified against ALL_GEMEINDEN — note Klagenfurt's registry slug is
 * `9020-klagenfurt-am-woerthersee`, not `9020-klagenfurt`.
 */

import { STADT_INTROS, type LandingIntro } from '@/content/landing-intros';

export interface CityHub {
  /** Canonical gemeinde slug, e.g. "4020-linz". */
  slug: string;
  name: string;
  /** Event-discovery radius in km (cities sprawl wider than villages). */
  radiusKm: number;
  /** Curated editorial intro rendered under the H1. */
  intro: LandingIntro;
}

/** Resolve a curated city intro, failing loudly if a key is ever missing. */
function intro(key: string): LandingIntro {
  const v = STADT_INTROS[key];
  if (!v) throw new Error(`[city-hubs] missing STADT_INTRO for "${key}"`);
  return v;
}

export const CITY_HUBS: Record<string, CityHub> = {
  '4020-linz': { slug: '4020-linz', name: 'Linz', radiusKm: 15, intro: intro('linz') },
  '8010-graz': { slug: '8010-graz', name: 'Graz', radiusKm: 15, intro: intro('graz') },
  '6020-innsbruck': { slug: '6020-innsbruck', name: 'Innsbruck', radiusKm: 12, intro: intro('innsbruck') },
  '5020-salzburg': { slug: '5020-salzburg', name: 'Salzburg', radiusKm: 12, intro: intro('salzburg') },
  '9020-klagenfurt-am-woerthersee': {
    slug: '9020-klagenfurt-am-woerthersee',
    name: 'Klagenfurt',
    radiusKm: 12,
    intro: intro('klagenfurt'),
  },
};

export function getCityHub(slug: string): CityHub | null {
  return CITY_HUBS[slug] ?? null;
}

export function isCityHub(slug: string): boolean {
  return slug in CITY_HUBS;
}

/**
 * Old `/stadt/{citySlug}` → canonical `/gemeinde/{slug}`. Used by the
 * next.config 301 redirects and to drop the dead /stadt URLs from the sitemap.
 * `wien` is a Bundesland (= Stadt) and redirects to `/wien` instead — handled
 * separately in next.config.
 */
export const STADT_TO_GEMEINDE: Record<string, string> = {
  linz: '4020-linz',
  graz: '8010-graz',
  innsbruck: '6020-innsbruck',
  'salzburg-stadt': '5020-salzburg',
  klagenfurt: '9020-klagenfurt-am-woerthersee',
};
